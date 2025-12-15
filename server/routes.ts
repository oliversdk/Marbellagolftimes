import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { sendAffiliateEmail, getEmailConfig, getEmailRecipient } from "./email";
import { createGolfmanagerProvider, getGolfmanagerConfig } from "./providers/golfmanager";
import { teeoneClient } from "./providers/teeone";
import { getZestGolfService } from "./services/zestGolf";
import { syncBookingToProvider } from "./services/bookingSyncService";
import { getSession, isAuthenticated, isAdmin, isApiKeyAuthenticated, requireScope } from "./customAuth";
import { insertBookingRequestSchema, insertAffiliateEmailSchema, insertUserSchema, insertCourseReviewSchema, insertTestimonialSchema, insertAdCampaignSchema, insertCompanyProfileSchema, insertPartnershipFormSchema, type CourseWithSlots, type TeeTimeSlot, type User, type GolfCourse, users, courseRatePeriods, golfCourses, contractIngestions, courseOnboarding, courseProviderLinks, teeTimeProviders, courseContacts } from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike } from "drizzle-orm";
import { bookingConfirmationEmail, type BookingDetails } from "./templates/booking-confirmation";
import { courseBookingNotificationEmail, type CourseBookingNotificationDetails } from "./templates/course-booking-notification";
import { reviewRequestEmail, type ReviewRequestDetails } from "./templates/review-request";
import { generateICalendar, generateGoogleCalendarUrl, type CalendarEventDetails } from "./utils/calendar";
import { sendEmail } from "./email";
import { z } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover" as const,
});

// ============================================================
// OnTee-inspired Booking API - In-memory storage for orders
// ============================================================
interface TeeTimeHold {
  orderId: string;
  courseId: string;
  tenant: string;
  slotId: string;
  teeTime: string;
  date: string;
  time: string;
  players: number;
  holes: number;
  greenFee: { amount: number; currency: string };
  extras: { type: string; amount: number; currency: string; description?: string }[];
  total: { amount: number; currency: string };
  status: "HELD" | "CONFIRMED" | "EXPIRED";
  holdExpiresAt: Date;
  createdAt: Date;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    language?: string;
  };
  payment?: {
    method: string;
    status: string;
    transactionId?: string;
  };
  bookingId?: string;
}

const teeTimeHolds = new Map<string, TeeTimeHold>();

// ============================================================
// Server-Side Tee Time Price Cache (SECURITY: prices from API only)
// ============================================================
// Prices are cached when fetched from Zest/TeeOne API, NOT from client requests
// This ensures checkout uses authoritative pricing that cannot be manipulated
interface CachedPrice {
  priceCents: number;  // Price per player in cents
  source: string;      // "zest" | "teeone" | "golfmanager"
  expiresAt: Date;
}
export const teeTimePriceCache = new Map<string, CachedPrice>();

// Cleanup expired price cache entries every 10 minutes
setInterval(() => {
  const now = new Date();
  teeTimePriceCache.forEach((value, key) => {
    if (value.expiresAt < now) {
      teeTimePriceCache.delete(key);
    }
  });
}, 10 * 60 * 1000);

// Helper to cache a price from an API response
export function cacheApiPrice(courseId: string, teeTime: string, priceCents: number, source: string) {
  const cacheKey = `${courseId}:${teeTime}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry
  teeTimePriceCache.set(cacheKey, { priceCents, source, expiresAt });
}

// Cleanup expired holds every 5 minutes
setInterval(() => {
  const now = new Date();
  teeTimeHolds.forEach((hold, orderId) => {
    if (hold.status === "HELD" && hold.holdExpiresAt < now) {
      hold.status = "EXPIRED";
      console.log(`[OnTee API] Hold expired: ${orderId}`);
    }
  });
}, 5 * 60 * 1000);

// Helper function to get course contact email with priority
// Priority: "Zest Primary" > "Zest Reservations" > course.email
async function getCourseNotificationEmail(courseId: string, fallbackEmail?: string | null): Promise<string | null> {
  try {
    console.log(`[Email Debug] Getting notification email for courseId: ${courseId}, fallback: ${fallbackEmail}`);
    const contacts = await db.select().from(courseContacts).where(eq(courseContacts.courseId, courseId));
    console.log(`[Email Debug] Found ${contacts.length} contacts for course ${courseId}:`, contacts.map(c => ({ role: c.role, email: c.email, isPrimary: c.isPrimary })));
    
    // Priority 1: Look for "Zest Primary" role
    const zestPrimary = contacts.find(c => c.role === "Zest Primary" && c.email);
    if (zestPrimary?.email) {
      console.log(`[Email Debug] Using Zest Primary email: ${zestPrimary.email}`);
      return zestPrimary.email;
    }
    
    // Priority 2: Look for "Zest Reservations" role
    const zestReservations = contacts.find(c => c.role === "Zest Reservations" && c.email);
    if (zestReservations?.email) {
      console.log(`[Email Debug] Using Zest Reservations email: ${zestReservations.email}`);
      return zestReservations.email;
    }
    
    // Priority 3: Any primary contact with email
    const primaryContact = contacts.find(c => c.isPrimary === "true" && c.email);
    if (primaryContact?.email) {
      console.log(`[Email Debug] Using primary contact email: ${primaryContact.email}`);
      return primaryContact.email;
    }
    
    // Priority 4: Any contact with email
    const anyContact = contacts.find(c => c.email);
    if (anyContact?.email) {
      console.log(`[Email Debug] Using any contact email: ${anyContact.email}`);
      return anyContact.email;
    }
    
    // Fallback to course.email
    console.log(`[Email Debug] Using fallback email: ${fallbackEmail}`);
    return fallbackEmail || null;
  } catch (error) {
    console.warn("[Email] Error fetching course contacts:", error);
    return fallbackEmail || null;
  }
}

// Helper function to send course booking notification email
async function sendCourseBookingNotification(
  booking: { id: string; customerName: string; customerEmail: string; customerPhone?: string | null; teeTime: Date | string; players: number; totalAmountCents?: number | null },
  course: { id: string; name: string; email?: string | null }
): Promise<void> {
  try {
    const emailConfig = getEmailConfig();
    if (!emailConfig) {
      console.warn("[Email] SMTP not configured - skipping course notification");
      storage.createEmailLog({
        bookingId: booking.id,
        courseId: course.id,
        emailType: "COURSE_NOTIFICATION",
        recipientEmail: course.email || "unknown",
        recipientName: course.name,
        subject: "Course Notification (SMTP not configured)",
        bodyText: null,
        bodyHtml: null,
        status: "FAILED",
        errorMessage: "SMTP not configured",
      }).catch(e => console.warn("Failed to log skipped course notification:", e));
      return;
    }
    
    const courseEmail = await getCourseNotificationEmail(course.id, course.email);
    if (!courseEmail) {
      console.warn(`[Email] No contact email found for course ${course.name} - skipping notification`);
      storage.createEmailLog({
        bookingId: booking.id,
        courseId: course.id,
        emailType: "COURSE_NOTIFICATION",
        recipientEmail: "no-email-configured",
        recipientName: course.name,
        subject: "Course Notification (no email)",
        bodyText: null,
        bodyHtml: null,
        status: "FAILED",
        errorMessage: "No contact email found for course",
      }).catch(e => console.warn("Failed to log skipped course notification:", e));
      return;
    }
    
    const notificationDetails: CourseBookingNotificationDetails = {
      bookingId: booking.id,
      courseName: course.name,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone || undefined,
      teeTime: typeof booking.teeTime === 'string' ? new Date(booking.teeTime) : booking.teeTime,
      players: booking.players,
      totalAmountCents: booking.totalAmountCents || undefined,
    };
    
    const emailContent = courseBookingNotificationEmail(notificationDetails);
    
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.port === 465,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });
    
    const recipient = getEmailRecipient(courseEmail);
    
    await transporter.sendMail({
      from: emailConfig.from,
      to: recipient,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    
    console.log(`✓ Course notification email sent to ${recipient} (original: ${courseEmail}) for booking ${booking.id}`);
    
    storage.createEmailLog({
      bookingId: booking.id,
      courseId: course.id,
      emailType: "COURSE_NOTIFICATION",
      recipientEmail: recipient,
      recipientName: course.name,
      subject: emailContent.subject,
      bodyText: emailContent.text,
      bodyHtml: emailContent.html,
      status: "SENT",
    }).catch(e => console.warn("Failed to log course notification email:", e));
  } catch (error) {
    console.warn(`⚠ Failed to send course notification email:`, error instanceof Error ? error.message : error);
    storage.createEmailLog({
      bookingId: booking.id,
      courseId: course.id,
      emailType: "COURSE_NOTIFICATION",
      recipientEmail: course.email || "unknown",
      recipientName: course.name,
      subject: "Course Notification (failed)",
      bodyText: null,
      bodyHtml: null,
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }).catch(e => console.warn("Failed to log failed course notification:", e));
  }
}

// TeeOne tenant mapping for courses
const TEEONE_TENANTS: Record<string, string> = {
  "El Paraíso Golf Club": "paraiso",
  "Marbella Golf & Country Club": "marbella",
  "Estepona Golf": "estepona",
  "Atalaya Golf & Country Club": "atalaya",
  "Santa Clara Golf Marbella": "santaclara",
  "Los Naranjos Golf Club": "naranjos",
  "Mijas Golf": "mijas",
  "Torrequebrada Golf": "torrequebrada",
  "Real Club Valderrama": "valderrama",
  "Flamingos Golf (Villa Padierna)": "villapadierna",
  "Los Arqueros Golf & Country Club": "arqueros",
  "La Quinta Golf & Country Club": "quinta",
};

// Validation schema for updating user information
const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  phoneNumber: z.string().optional(),
  isAdmin: z.enum(["true", "false"]).optional(),
}).refine(data => {
  // At least one field must be provided
  return data.firstName !== undefined || data.lastName !== undefined || 
         data.email !== undefined || data.phoneNumber !== undefined || data.isAdmin !== undefined;
}, {
  message: "At least one field must be provided"
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for image uploads
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../client/public/stock_images");
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: original name with timestamp
    const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    // Sanitize filename: remove spaces and special characters
    const sanitizedName = basename.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    cb(null, sanitizedName + "_" + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WEBP) are allowed"));
    }
  }
});

// Document upload for contracts, PDFs, etc.
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for documents
  },
  fileFilter: function (req, file, cb) {
    // Accept common document types
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg", "image/jpg", "image/png", "image/webp"
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word, Excel, and image files are allowed"));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Static asset caching for images
  app.use('/generated_images', express.static(path.join(__dirname, '../client/public/generated_images'), {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }));

  app.use('/stock_images', express.static(path.join(__dirname, '../client/public/stock_images'), {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }));

  // Session setup - MUST be before any routes that use authentication
  app.set("trust proxy", 1);
  app.use(getSession());

  // Object Storage endpoints for persistent image storage
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Get presigned upload URL for course images (Admin only)
  app.post("/api/objects/upload-url", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { filename, contentType } = req.body;
      
      // Validate content type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (contentType && !allowedTypes.includes(contentType)) {
        return res.status(400).json({ error: "Invalid content type. Only JPEG, PNG, and WebP are allowed." });
      }
      
      // Validate filename
      if (filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
        if (!ext || !allowedExtensions.includes(ext)) {
          return res.status(400).json({ error: "Invalid file extension. Only JPG, PNG, and WebP are allowed." });
        }
      }
      
      // Check if Object Storage is configured
      if (!process.env.PRIVATE_OBJECT_DIR) {
        console.error("PRIVATE_OBJECT_DIR not configured");
        return res.status(500).json({ error: "Object Storage not configured. Please set up Object Storage in your Replit workspace." });
      }
      
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, objectPath } = await objectStorageService.getObjectEntityUploadURL(filename);
      res.json({ uploadURL, objectPath });
    } catch (error: any) {
      console.error("Error getting upload URL:", error?.message || error);
      res.status(500).json({ error: error?.message || "Failed to get upload URL" });
    }
  });

  // Complete image upload and add to course gallery (Admin only)
  app.post("/api/courses/:courseId/images/complete", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { objectPath, setAsMain } = req.body;

      if (!objectPath) {
        return res.status(400).json({ error: "objectPath is required" });
      }

      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Get existing images to determine sort order
      const existingImages = await storage.getImagesByCourseId(courseId);
      const nextSortOrder = existingImages.length > 0 
        ? Math.max(...existingImages.map(img => img.sortOrder)) + 1 
        : 0;

      // Add to course_images table
      const galleryImage = await storage.createCourseImage({
        courseId,
        imageUrl: objectPath,
        caption: null,
        sortOrder: nextSortOrder
      });

      // Set as main image if requested or no main image exists
      if (setAsMain === true || !course.imageUrl) {
        await storage.updateCourseImage(courseId, objectPath);
      }

      res.json({ 
        success: true,
        image: galleryImage
      });
    } catch (error) {
      console.error("Error completing image upload:", error);
      res.status(500).json({ error: "Failed to complete image upload" });
    }
  });

  // PDF Reports download endpoints
  app.get('/api/reports/progress-report', async (req, res) => {
    try {
      const pdfPath = path.join(__dirname, '../reports/Marbella-Golf-Times-Progress-Report-Nov2025.pdf');
      const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);
      
      if (!fileExists) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Marbella-Golf-Times-Progress-Report-Nov2025.pdf"');
      
      const fileBuffer = await fs.readFile(pdfPath);
      res.send(fileBuffer);
    } catch (error) {
      console.error('Error serving PDF:', error);
      res.status(500).json({ message: 'Failed to serve report' });
    }
  });

  // System Documentation PDFs - English, Danish, Swedish
  app.get('/api/reports/system-docs/:lang', async (req, res) => {
    try {
      const lang = req.params.lang.toUpperCase();
      const validLangs = ['EN', 'DA', 'SV'];
      
      if (!validLangs.includes(lang)) {
        return res.status(400).json({ message: 'Invalid language. Use: EN, DA, or SV' });
      }
      
      const pdfPath = path.join(__dirname, `../reports/Marbella-Golf-Times-System-Documentation-${lang}.pdf`);
      const fileExists = await fs.access(pdfPath).then(() => true).catch(() => false);
      
      if (!fileExists) {
        return res.status(404).json({ message: 'Documentation not found' });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Marbella-Golf-Times-System-Documentation-${lang}.pdf"`);
      
      const fileBuffer = await fs.readFile(pdfPath);
      res.send(fileBuffer);
    } catch (error) {
      console.error('Error serving PDF:', error);
      res.status(500).json({ message: 'Failed to serve documentation' });
    }
  });

  // Auth routes

  // POST /api/auth/signup - Create new user
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.flatten() });
      }
      
      const { email, firstName, lastName, phoneNumber, password } = result.data;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        email,
        firstName,
        lastName,
        phoneNumber,
        passwordHash,
      });
      
      // Set session
      req.session.userId = user.id;
      
      res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // POST /api/auth/login - Login existing user
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Verify password
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // POST /api/auth/logout - Logout current user
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // GET /api/login - Redirect to login page (for email links)
  app.get("/api/login", (req, res) => {
    let returnTo = req.query.returnTo as string || "/";
    
    // Security: Only allow same-origin paths (prevent open redirect attacks)
    // Must start with "/" and not "//" to prevent protocol-relative URLs
    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
      returnTo = "/";
    }
    
    // If already logged in, redirect directly to destination
    if (req.session?.userId) {
      return res.redirect(returnTo);
    }
    // Otherwise redirect to login page with returnTo param
    res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  });

  // GET /api/auth/user - Get current user
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName, 
        phoneNumber: user.phoneNumber, 
        profileImageUrl: user.profileImageUrl, 
        isAdmin: user.isAdmin,
        country: user.country,
        handicap: user.handicap,
        homeClub: user.homeClub,
        preferredTeeTime: user.preferredTeeTime,
        gender: user.gender
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // PATCH /api/profile - Update current user's profile
  app.patch("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { firstName, lastName, phoneNumber, country, handicap, homeClub, preferredTeeTime, gender } = req.body;
      
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
      if (country !== undefined) updates.country = country;
      if (handicap !== undefined) updates.handicap = handicap !== '' ? parseFloat(handicap) : null;
      if (homeClub !== undefined) updates.homeClub = homeClub;
      if (preferredTeeTime !== undefined) updates.preferredTeeTime = preferredTeeTime;
      if (gender !== undefined) updates.gender = gender;

      const updated = await storage.updateUser(userId, updates);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        id: updated.id, 
        email: updated.email, 
        firstName: updated.firstName, 
        lastName: updated.lastName, 
        phoneNumber: updated.phoneNumber,
        country: updated.country,
        handicap: updated.handicap,
        homeClub: updated.homeClub,
        preferredTeeTime: updated.preferredTeeTime,
        gender: updated.gender,
        profileImageUrl: updated.profileImageUrl, 
        isAdmin: updated.isAdmin 
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // GET /api/admin/users - Get all users (Admin only)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Don't send password hashes to frontend
      const sanitizedUsers = allUsers.map((u: User) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phoneNumber: u.phoneNumber,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // PATCH /api/admin/users/:id/admin - Toggle admin status (Admin only)
  app.patch("/api/admin/users/:id/admin", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin: newIsAdmin } = req.body;

      if (typeof newIsAdmin !== 'boolean') {
        return res.status(400).json({ message: "isAdmin must be a boolean" });
      }

      const updated = await storage.setUserAdmin(id, newIsAdmin);
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "Admin status updated successfully", user: { id, isAdmin: newIsAdmin ? 'true' : 'false' } });
    } catch (error) {
      console.error("Error updating admin status:", error);
      res.status(500).json({ message: "Failed to update admin status" });
    }
  });

  // PATCH /api/admin/users/:id - Update user information (Admin only)
  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      console.log("PATCH /api/admin/users/:id - Updating user:", id, "with body:", req.body);

      // Prevent admin from editing themselves
      if (req.session.userId === id) {
        return res.status(403).json({ message: "Cannot edit your own account" });
      }

      // Validate request body
      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error("Validation failed:", validationResult.error.issues);
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: validationResult.error.issues 
        });
      }

      const updates = validationResult.data;
      console.log("Validated updates:", updates);

      // Check if email is being updated and if it already exists
      if (updates.email) {
        const existingUser = await storage.getUserByEmail(updates.email);
        if (existingUser && existingUser.id !== id) {
          console.error("Email already in use:", updates.email);
          return res.status(409).json({ message: "Email already in use" });
        }
      }

      const updated = await storage.updateUser(id, updates);
      console.log("Update result:", updated ? "Success" : "User not found");
      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      // Return sanitized user data
      const sanitizedUser = {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phoneNumber: updated.phoneNumber,
        isAdmin: updated.isAdmin,
      };

      res.json({ message: "User updated successfully", user: sanitizedUser });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // DELETE /api/admin/users/:id - Delete user (Admin only)
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (req.session.userId === id) {
        return res.status(403).json({ message: "Cannot delete your own account" });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // GET /api/admin/users/:id/bookings - Get bookings for a specific user (Admin only)
  app.get("/api/admin/users/:id/bookings", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const bookings = await storage.getBookingsByUserId(id);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ message: "Failed to fetch user bookings" });
    }
  });

  // GET /api/admin/analytics/bookings - Get bookings analytics (Admin only)
  app.get("/api/admin/analytics/bookings", isAdmin, async (req, res) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'day';
      if (!['day', 'week', 'month'].includes(period)) {
        return res.status(400).json({ message: "Invalid period. Use 'day', 'week', or 'month'" });
      }
      const analytics = await storage.getBookingsAnalytics(period);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching bookings analytics:", error);
      res.status(500).json({ message: "Failed to fetch bookings analytics" });
    }
  });

  // GET /api/admin/analytics/revenue - Get revenue analytics (Admin only)
  app.get("/api/admin/analytics/revenue", isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getRevenueAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching revenue analytics:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  // GET /api/admin/analytics/popular-courses - Get popular courses (Admin only)
  app.get("/api/admin/analytics/popular-courses", isAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const analytics = await storage.getPopularCourses(limit);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching popular courses:", error);
      res.status(500).json({ message: "Failed to fetch popular courses" });
    }
  });

  // GET /api/admin/analytics/commission - Get total commission and breakdown per course
  app.get("/api/admin/analytics/commission", isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getCommissionAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching commission analytics:", error);
      res.status(500).json({ message: "Failed to fetch commission analytics" });
    }
  });

  // GET /api/admin/analytics/commission-by-period - Get commission over time
  app.get("/api/admin/analytics/commission-by-period", isAdmin, async (req, res) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'day';
      if (!['day', 'week', 'month'].includes(period)) {
        return res.status(400).json({ message: "Invalid period. Use 'day', 'week', or 'month'" });
      }
      const analytics = await storage.getCommissionByPeriod(period);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching commission by period:", error);
      res.status(500).json({ message: "Failed to fetch commission by period" });
    }
  });

  // GET /api/admin/analytics/roi - Get ROI analytics
  app.get("/api/admin/analytics/roi", isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getROIAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching ROI analytics:", error);
      res.status(500).json({ message: "Failed to fetch ROI analytics" });
    }
  });

  // GET /api/admin/analytics/onboarding-progress - Get partnership funnel progress over time
  app.get("/api/admin/analytics/onboarding-progress", isAdmin, async (req, res) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
      if (!['day', 'week', 'month'].includes(period)) {
        return res.status(400).json({ message: "Invalid period. Use 'day', 'week', or 'month'" });
      }
      const data = await storage.getOnboardingProgressOverTime(period);
      res.json(data);
    } catch (error) {
      console.error("Error fetching onboarding progress:", error);
      res.status(500).json({ message: "Failed to fetch onboarding progress" });
    }
  });

  // GET /api/admin/activity-feed - Get recent activity for team feed
  app.get("/api/admin/activity-feed", isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get courses first for lookup
      const courses = await storage.getAllCourses();
      const coursesWithCommission = courses.filter(c => (c.kickbackPercent || 0) > 0);
      
      // Get recent bookings
      const allBookings = await storage.getAllBookings();
      const recentBookings = [...allBookings]
        .sort((a: typeof allBookings[0], b: typeof allBookings[0]) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
        .slice(0, limit);
      
      // Get recent affiliate emails sent
      const affiliateEmails = await storage.getAllAffiliateEmails();
      const recentEmails = affiliateEmails
        .filter(e => e.sentAt)
        .sort((a: typeof affiliateEmails[0], b: typeof affiliateEmails[0]) => 
          new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime()
        )
        .slice(0, limit);
      
      // Build activity feed
      const activities: Array<{
        type: 'booking' | 'email_sent' | 'partnership' | 'milestone';
        timestamp: string;
        data: Record<string, unknown>;
      }> = [];
      
      // Add bookings as activities
      for (const booking of recentBookings) {
        const course = courses.find(c => c.id === booking.courseId);
        const timestamp = booking.createdAt instanceof Date 
          ? booking.createdAt.toISOString() 
          : (booking.createdAt || new Date().toISOString());
        activities.push({
          type: 'booking',
          timestamp,
          data: {
            courseName: course?.name || 'Unknown Course',
            customerName: booking.customerName,
            players: booking.players,
            estimatedPrice: booking.estimatedPrice,
            status: booking.status,
          }
        });
      }
      
      // Add emails as activities
      for (const email of recentEmails) {
        const course = courses.find(c => c.id === email.courseId);
        const timestamp = email.sentAt instanceof Date 
          ? email.sentAt.toISOString() 
          : (email.sentAt ? String(email.sentAt) : new Date().toISOString());
        activities.push({
          type: 'email_sent',
          timestamp,
          data: {
            courseName: course?.name || 'Unknown Course',
            status: email.status,
          }
        });
      }
      
      // Add milestone if we hit partnership targets
      if (coursesWithCommission.length >= 5) {
        activities.push({
          type: 'milestone',
          timestamp: new Date().toISOString(),
          data: {
            milestoneName: 'partnerships_5',
            count: coursesWithCommission.length,
          }
        });
      }
      
      // Sort by timestamp desc and limit
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json({
        activities: activities.slice(0, limit),
        stats: {
          totalBookings: allBookings.length,
          totalCourses: courses.length,
          totalPartnerships: coursesWithCommission.length,
          pendingBookings: allBookings.filter((b: typeof allBookings[0]) => b.status === 'pending').length,
          confirmedBookings: allBookings.filter((b: typeof allBookings[0]) => b.status === 'confirmed').length,
        }
      });
    } catch (error) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  // Admin Booking Notifications
  app.get("/api/admin/notifications", isAdmin, async (req, res) => {
    try {
      const notifications = await storage.getUnreadNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/admin/notifications/count", isAdmin, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount();
      res.json({ count });
    } catch (error) {
      console.error("Error fetching notification count:", error);
      res.status(500).json({ error: "Failed to fetch notification count" });
    }
  });

  app.patch("/api/admin/notifications/:id/read", isAdmin, async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/admin/notifications/mark-all-read", isAdmin, async (req, res) => {
    try {
      await storage.markAllNotificationsAsRead();
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  // GET /api/admin/email-logs - Retrieve email logs with optional filters
  app.get("/api/admin/email-logs", isAdmin, async (req, res) => {
    try {
      const { emailType, courseId, bookingId, limit, offset } = req.query;
      const result = await storage.getEmailLogs({
        emailType: emailType as string | undefined,
        courseId: courseId as string | undefined,
        bookingId: bookingId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      res.status(500).json({ error: "Failed to fetch email logs" });
    }
  });

  // POST /api/admin/send-review-requests - Send review request emails for completed bookings
  app.post("/api/admin/send-review-requests", isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const allBookings = await storage.getAllBookings();
      const courses = await storage.getAllCourses();
      const courseMap = new Map(courses.map(c => [c.id, c]));

      // Find eligible bookings: CONFIRMED, tee time in the past, reviewRequestSent = false
      const eligibleBookings = allBookings.filter(booking => {
        if (booking.status !== "CONFIRMED") return false;
        if (booking.reviewRequestSent === "true") return false;
        const teeTime = new Date(booking.teeTime);
        return teeTime < now;
      });

      if (eligibleBookings.length === 0) {
        return res.json({ 
          success: true, 
          message: "No eligible bookings found for review requests",
          sent: 0 
        });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      let sentCount = 0;
      const errors: string[] = [];

      for (const booking of eligibleBookings) {
        if (!booking.customerEmail) {
          errors.push(`No email for booking ${booking.id}`);
          continue;
        }

        const course = courseMap.get(booking.courseId);
        if (!course) {
          errors.push(`Course not found for booking ${booking.id}`);
          continue;
        }

        const reviewDetails: ReviewRequestDetails = {
          bookingId: booking.id,
          customerName: booking.customerName,
          courseName: course.name,
          courseCity: course.city,
          teeTime: new Date(booking.teeTime),
          players: booking.players,
        };

        const emailContent = reviewRequestEmail(reviewDetails, baseUrl);
        const result = await sendEmail({
          to: booking.customerEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        if (result.success) {
          await storage.updateBookingReviewRequestSent(booking.id);
          sentCount++;
          console.log(`✓ Review request sent for booking ${booking.id} to ${booking.customerEmail}`);
        } else {
          errors.push(`Failed to send to ${booking.customerEmail}: ${result.error}`);
        }
      }

      res.json({
        success: true,
        message: `Sent ${sentCount} review request emails`,
        sent: sentCount,
        eligible: eligibleBookings.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error sending review requests:", error);
      res.status(500).json({ error: "Failed to send review requests" });
    }
  });

  // GET /api/admin/test-golfmanager - Test Golfmanager API connection
  app.get("/api/admin/test-golfmanager", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const tenant = (req.query.tenant as string) || "demo";
      const version = (req.query.version as string) || "v1";
      
      console.log(`[Golfmanager Test] Testing API connection for tenant: ${tenant}, version: ${version}`);
      
      // Create provider instance
      const provider = createGolfmanagerProvider(tenant, version as "v1" | "v3");
      
      // Test 1: Get tenant info
      let tenantInfo = null;
      let tenantError = null;
      try {
        tenantInfo = await provider.getTenant();
      } catch (e: any) {
        tenantError = e.message || "Unknown error";
      }
      
      // Test 2: Get resources (tees)
      let resources = null;
      let resourcesError = null;
      try {
        resources = await provider.getResources();
      } catch (e: any) {
        resourcesError = e.message || "Unknown error";
      }
      
      // Test 3: Get availability types
      let availabilityTypes = null;
      let typesError = null;
      try {
        availabilityTypes = await provider.getAvailabilityTypes();
      } catch (e: any) {
        typesError = e.message || "Unknown error";
      }
      
      // Test 4: Search availability for tomorrow
      let slots = null;
      let slotsError = null;
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startDate = tomorrow.toISOString().split("T")[0] + "T07:00:00";
        const endDate = tomorrow.toISOString().split("T")[0] + "T18:00:00";
        slots = await provider.searchAvailability(startDate, endDate);
      } catch (e: any) {
        slotsError = e.message || "Unknown error";
      }
      
      const connected = !tenantError && !resourcesError;
      
      res.json({
        success: connected,
        tenant,
        version,
        mode: process.env.GOLFMANAGER_MODE || "unknown",
        tests: {
          tenant: { data: tenantInfo, error: tenantError },
          resources: { data: resources, error: resourcesError, count: resources?.length || 0 },
          availabilityTypes: { data: availabilityTypes, error: typesError, count: availabilityTypes?.length || 0 },
          availability: { data: slots?.slice(0, 5), error: slotsError, count: slots?.length || 0 }
        },
        message: connected 
          ? `Successfully connected to Golfmanager ${version.toUpperCase()} for tenant "${tenant}"` 
          : `Failed to connect: ${tenantError || resourcesError}`
      });
    } catch (error: any) {
      console.error("[Golfmanager Test] Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Test failed" 
      });
    }
  });

  // GET /api/admin/campaigns - Get all ad campaigns
  app.get("/api/admin/campaigns", isAdmin, async (req, res) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  // POST /api/admin/campaigns - Create new campaign
  app.post("/api/admin/campaigns", isAdmin, async (req, res) => {
    try {
      const result = insertAdCampaignSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.flatten() });
      }
      const campaign = await storage.createCampaign(result.data);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  // PATCH /api/admin/campaigns/:id - Update campaign
  app.patch("/api/admin/campaigns/:id", isAdmin, async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  // DELETE /api/admin/campaigns/:id - Delete campaign
  app.delete("/api/admin/campaigns/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // GET /api/courses - Get all golf courses (public courses for visitors, all for admins)
  app.get("/api/courses", async (req: any, res) => {
    try {
      // Check if user is admin - if so, return all courses; otherwise filter members-only
      let isAdminUser = false;
      try {
        // Use req.session directly to check if user is logged in and is admin
        if (req.session?.userId) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, req.session.userId))
            .limit(1);
          isAdminUser = user?.isAdmin === "true";
        }
      } catch (e) {
        // Session lookup failed - treat as public user
        isAdminUser = false;
      }
      
      // Admins see all courses, public visitors only see non-members-only courses
      const courses = isAdminUser 
        ? await storage.getAllCourses()
        : await storage.getPublicCourses();
      
      // Add average rating and review count to each course
      const coursesWithRatings = await Promise.all(
        courses.map(async (course) => {
          const reviews = await storage.getAllReviewsByCourseId(course.id);
          const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;
          
          return {
            ...course,
            averageRating: avgRating,
            reviewCount: reviews.length,
          };
        })
      );
      
      // Vary caching by admin status - admins get no cache to see all courses including members-only
      if (isAdminUser) {
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=300');
      }
      res.json(coursesWithRatings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  // GET /api/rate-periods - Public endpoint to get rate periods for a course (for booking flow)
  // NOTE: This returns customer-facing data only - no internal commission/kickback info
  app.get("/api/rate-periods", async (req, res) => {
    try {
      const { courseId } = req.query;
      if (!courseId) {
        return res.status(400).json({ error: "courseId is required" });
      }

      const periods = await db.select({
        id: courseRatePeriods.id,
        courseId: courseRatePeriods.courseId,
        seasonLabel: courseRatePeriods.seasonLabel,
        packageType: courseRatePeriods.packageType,
        startDate: courseRatePeriods.startDate,
        endDate: courseRatePeriods.endDate,
        year: courseRatePeriods.year,
        rackRate: courseRatePeriods.rackRate, // Public price only
        currency: courseRatePeriods.currency,
        includesBuggy: courseRatePeriods.includesBuggy,
        includesLunch: courseRatePeriods.includesLunch,
        includesCart: courseRatePeriods.includesCart,
        isEarlyBird: courseRatePeriods.isEarlyBird,
        isTwilight: courseRatePeriods.isTwilight,
        timeRestriction: courseRatePeriods.timeRestriction,
        minPlayersForDiscount: courseRatePeriods.minPlayersForDiscount,
        freePlayersPerGroup: courseRatePeriods.freePlayersPerGroup,
        // Do NOT expose: netRate, kickbackPercent - internal data
      })
        .from(courseRatePeriods)
        .where(eq(courseRatePeriods.courseId, String(courseId)))
        .orderBy(courseRatePeriods.packageType, courseRatePeriods.seasonLabel);
      
      res.json(periods);
    } catch (error) {
      console.error("Failed to fetch rate periods:", error);
      res.status(500).json({ error: "Failed to fetch rate periods" });
    }
  });

  // GET /api/admin/courses - Get ALL courses including members-only (Admin only)
  app.get("/api/admin/courses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      
      // Add average rating and review count to each course
      const coursesWithRatings = await Promise.all(
        courses.map(async (course) => {
          const reviews = await storage.getAllReviewsByCourseId(course.id);
          const avgRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;
          
          return {
            ...course,
            averageRating: avgRating,
            reviewCount: reviews.length,
          };
        })
      );
      
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.json(coursesWithRatings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  // GET /api/admin/course-providers - Get all courses with provider info (Admin only)
  app.get("/api/admin/course-providers", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      const allLinks = await storage.getAllLinks();
      
      // Map courses to provider info
      const coursesWithProviders = courses.map(course => {
        const courseLinks = allLinks.filter(link => link.courseId === course.id);
        
        // Determine provider type from links
        let providerType: "golfmanager_v1" | "golfmanager_v3" | "teeone" | null = null;
        let providerCode: string | null = null;
        
        for (const link of courseLinks) {
          if (link.providerCourseCode?.startsWith("golfmanagerv3:")) {
            providerType = "golfmanager_v3";
            providerCode = link.providerCourseCode;
            break;
          } else if (link.providerCourseCode?.startsWith("golfmanager:")) {
            providerType = "golfmanager_v1";
            providerCode = link.providerCourseCode;
            break;
          } else if (link.providerCourseCode?.startsWith("teeone:")) {
            providerType = "teeone";
            providerCode = link.providerCourseCode;
            break;
          }
        }
        
        return {
          id: course.id,
          name: course.name,
          city: course.city,
          providerType,
          providerCode,
        };
      });
      
      res.json(coursesWithProviders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course providers" });
    }
  });

  // ==================== COURSE ONBOARDING (Partnership Funnel) ====================
  
  // GET /api/admin/onboarding - Get all onboarding records with course info (Admin only)
  app.get("/api/admin/onboarding", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      const onboardingRecords = await storage.getAllOnboarding();
      const allLinks = await storage.getAllLinks();
      
      // Create a map for quick lookup
      const onboardingMap = new Map(onboardingRecords.map(o => [o.courseId, o]));
      
      // Combine course info with onboarding status
      const coursesWithOnboarding = courses.map(course => {
        const onboarding = onboardingMap.get(course.id);
        const courseLinks = allLinks.filter(link => link.courseId === course.id);
        
        // Determine provider type
        let providerType: string | null = null;
        for (const link of courseLinks) {
          if (link.providerCourseCode?.startsWith("golfmanagerv3:")) {
            providerType = "golfmanager_v3";
            break;
          } else if (link.providerCourseCode?.startsWith("golfmanager:")) {
            providerType = "golfmanager_v1";
            break;
          } else if (link.providerCourseCode?.startsWith("teeone:")) {
            providerType = "teeone";
            break;
          }
        }
        
        return {
          courseId: course.id,
          courseName: course.name,
          city: course.city,
          email: course.email,
          phone: course.phone,
          providerType,
          stage: onboarding?.stage || "NOT_CONTACTED",
          outreachSentAt: onboarding?.outreachSentAt,
          outreachMethod: onboarding?.outreachMethod,
          responseReceivedAt: onboarding?.responseReceivedAt,
          responseNotes: onboarding?.responseNotes,
          partnershipAcceptedAt: onboarding?.partnershipAcceptedAt,
          agreedCommission: onboarding?.agreedCommission,
          credentialsReceivedAt: onboarding?.credentialsReceivedAt,
          credentialsType: onboarding?.credentialsType,
          contactPerson: onboarding?.contactPerson,
          contactEmail: onboarding?.contactEmail,
          contactPhone: onboarding?.contactPhone,
          notes: onboarding?.notes,
          updatedAt: onboarding?.updatedAt,
        };
      });
      
      res.json(coursesWithOnboarding);
    } catch (error) {
      console.error("Failed to fetch onboarding:", error);
      res.status(500).json({ error: "Failed to fetch onboarding data" });
    }
  });

  // GET /api/admin/onboarding/stats - Get funnel statistics (Admin only)
  app.get("/api/admin/onboarding/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const stats = await storage.getOnboardingStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch onboarding stats" });
    }
  });

  // PUT /api/admin/onboarding/:courseId/stage - Update course onboarding stage (Admin only)
  app.put("/api/admin/onboarding/:courseId/stage", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { stage } = req.body;
      
      const validStages = ["NOT_CONTACTED", "OUTREACH_SENT", "INTERESTED", "NOT_INTERESTED", "PARTNERSHIP_ACCEPTED", "CREDENTIALS_RECEIVED"];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ error: "Invalid stage" });
      }
      
      const result = await storage.updateOnboardingStage(courseId, stage);
      res.json(result);
    } catch (error) {
      console.error("Failed to update stage:", error);
      res.status(500).json({ error: "Failed to update onboarding stage" });
    }
  });

  // PATCH /api/admin/onboarding/:courseId - Update course onboarding details (Admin only)
  app.patch("/api/admin/onboarding/:courseId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const updates = req.body;
      
      // Check if onboarding exists, create if not
      const existing = await storage.getOnboardingByCourseId(courseId);
      if (!existing) {
        const created = await storage.createOnboarding({ 
          courseId,
          stage: updates.stage || "NOT_CONTACTED",
          ...updates 
        });
        return res.json(created);
      }
      
      const result = await storage.updateOnboarding(courseId, updates);
      res.json(result);
    } catch (error) {
      console.error("Failed to update onboarding:", error);
      res.status(500).json({ error: "Failed to update onboarding" });
    }
  });

  // GET /api/admin/follow-ups - Get courses needing follow-up with course info (Admin only)
  app.get("/api/admin/follow-ups", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const coursesNeedingFollowUp = await storage.getCoursesNeedingFollowUp();
      const allCourses = await storage.getAllCourses();
      const courseMap = new Map(allCourses.map(c => [c.id, c]));
      
      const now = new Date();
      const result = coursesNeedingFollowUp.map(onboarding => {
        const course = courseMap.get(onboarding.courseId);
        const nextFollowUp = onboarding.nextFollowUpAt ? new Date(onboarding.nextFollowUpAt) : null;
        const daysOverdue = nextFollowUp 
          ? Math.floor((now.getTime() - nextFollowUp.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        
        return {
          courseId: onboarding.courseId,
          courseName: course?.name || "Unknown Course",
          stage: onboarding.stage,
          outreachSentAt: onboarding.outreachSentAt,
          nextFollowUpAt: onboarding.nextFollowUpAt,
          daysOverdue: daysOverdue !== null && daysOverdue > 0 ? daysOverdue : 0,
          contactPerson: onboarding.contactPerson,
          contactEmail: onboarding.contactEmail,
          lastFollowUpAt: onboarding.lastFollowUpAt,
          followUpIntervalDays: onboarding.followUpIntervalDays,
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch follow-ups" });
    }
  });

  // PATCH /api/admin/follow-ups/:courseId/snooze - Snooze follow-up (Admin only)
  app.patch("/api/admin/follow-ups/:courseId/snooze", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { days } = req.body;
      
      if (typeof days !== 'number' || days < 1 || days > 365) {
        return res.status(400).json({ error: "Days must be a number between 1 and 365" });
      }
      
      const result = await storage.snoozeFollowUp(courseId, days);
      if (!result) {
        return res.status(404).json({ error: "Course onboarding not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Failed to snooze follow-up:", error);
      res.status(500).json({ error: "Failed to snooze follow-up" });
    }
  });

  // PATCH /api/admin/follow-ups/:courseId/complete - Mark follow-up as done (Admin only)
  app.patch("/api/admin/follow-ups/:courseId/complete", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      
      const result = await storage.completeFollowUp(courseId);
      if (!result) {
        return res.status(404).json({ error: "Course onboarding not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Failed to complete follow-up:", error);
      res.status(500).json({ error: "Failed to complete follow-up" });
    }
  });

  // GET /api/admin/courses/:courseId/contact-logs - Get contact logs for a course (Admin only)
  app.get("/api/admin/courses/:courseId/contact-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const logs = await storage.getContactLogsByCourseId(courseId);
      res.json(logs);
    } catch (error) {
      console.error("Failed to fetch contact logs:", error);
      res.status(500).json({ error: "Failed to fetch contact logs" });
    }
  });

  // POST /api/admin/courses/:courseId/contact-logs - Create contact log (Admin only)
  app.post("/api/admin/courses/:courseId/contact-logs", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { type, direction, subject, body, outcome } = req.body;
      const log = await storage.createContactLog({
        courseId,
        type,
        direction: direction || "OUTBOUND",
        subject,
        body,
        outcome,
        loggedByUserId: req.session.userId,
      });
      res.json(log);
    } catch (error) {
      console.error("Failed to create contact log:", error);
      res.status(500).json({ error: "Failed to create contact log" });
    }
  });

  // DELETE /api/admin/contact-logs/:id - Delete contact log (Admin only)
  app.delete("/api/admin/contact-logs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteContactLog(id);
      if (!success) {
        return res.status(404).json({ error: "Contact log not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete contact log:", error);
      res.status(500).json({ error: "Failed to delete contact log" });
    }
  });

  // GET /api/admin/unmatched-emails - Get all unmatched inbound emails (Admin only)
  app.get("/api/admin/unmatched-emails", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const emails = await storage.getUnmatchedEmails();
      res.json(emails);
    } catch (error) {
      console.error("Failed to fetch unmatched emails:", error);
      res.status(500).json({ error: "Failed to fetch unmatched emails" });
    }
  });

  // POST /api/admin/unmatched-emails/:id/assign - Assign email to course (Admin only)
  app.post("/api/admin/unmatched-emails/:id/assign", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { courseId } = req.body;
      
      if (!courseId) {
        return res.status(400).json({ error: "courseId is required" });
      }
      
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const updatedEmail = await storage.assignEmailToCourse(id, courseId, userId);
      
      if (!updatedEmail) {
        return res.status(404).json({ error: "Email not found" });
      }
      
      // Also create a contact log entry for the course
      await storage.createContactLog({
        courseId: courseId,
        type: "EMAIL",
        direction: "INBOUND",
        subject: updatedEmail.subject || "(No subject)",
        body: updatedEmail.body || "(No content)",
        outcome: null,
        loggedByUserId: userId,
      });
      
      res.json(updatedEmail);
    } catch (error) {
      console.error("Failed to assign email:", error);
      res.status(500).json({ error: "Failed to assign email" });
    }
  });

  // DELETE /api/admin/unmatched-emails/:id - Delete unmatched email (Admin only)
  app.delete("/api/admin/unmatched-emails/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUnmatchedEmail(id);
      if (!success) {
        return res.status(404).json({ error: "Email not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete unmatched email:", error);
      res.status(500).json({ error: "Failed to delete unmatched email" });
    }
  });

  // ============================================
  // INBOUND EMAIL INBOX SYSTEM
  // ============================================

  // GET /api/admin/inbox/count - Get count of unanswered emails (for badge)
  app.get("/api/admin/inbox/count", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const count = await storage.getUnansweredThreadsCount();
      res.json({ count });
    } catch (error) {
      console.error("Failed to get inbox count:", error);
      res.status(500).json({ error: "Failed to get inbox count" });
    }
  });

  // GET /api/admin/inbox - Get all inbound email threads (Admin only)
  app.get("/api/admin/inbox", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Include deleted threads so frontend can show them in trash filter
      const threads = await storage.getAllInboundThreads(true);
      
      // Enrich with course names and check for attachments
      const enrichedThreads = await Promise.all(threads.map(async (thread) => {
        let courseName = null;
        if (thread.courseId) {
          const course = await storage.getCourseById(thread.courseId);
          courseName = course?.name || null;
        }
        
        // Check if any message in the thread has attachments
        const messages = await storage.getEmailsByThreadId(thread.id);
        const hasAttachments = messages.some(msg => {
          if (!msg.attachmentsJson) return false;
          try {
            const attachments = typeof msg.attachmentsJson === 'string' 
              ? JSON.parse(msg.attachmentsJson) 
              : msg.attachmentsJson;
            return Array.isArray(attachments) && attachments.length > 0;
          } catch {
            return false;
          }
        });
        
        return { ...thread, courseName, hasAttachments };
      }));
      
      res.json(enrichedThreads);
    } catch (error) {
      console.error("Failed to get inbox threads:", error);
      res.status(500).json({ error: "Failed to get inbox threads" });
    }
  });

  // GET /api/admin/inbox/:id - Get single thread with all messages (Admin only)
  app.get("/api/admin/inbox/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      // Get all messages in thread
      const messages = await storage.getEmailsByThreadId(thread.id);
      
      // Get course name if linked
      let courseName = null;
      if (thread.courseId) {
        const course = await storage.getCourseById(thread.courseId);
        courseName = course?.name || null;
      }
      
      // Mark as read when viewing and get updated thread
      let updatedThread = thread;
      if (thread.isRead !== "true") {
        const marked = await storage.markThreadAsRead(thread.id);
        if (marked) {
          updatedThread = marked;
        }
      }
      
      res.json({ ...updatedThread, courseName, messages });
    } catch (error) {
      console.error("Failed to get inbox thread:", error);
      res.status(500).json({ error: "Failed to get inbox thread" });
    }
  });

  // POST /api/admin/inbox/:id/reply - Send reply to thread (Admin only)
  app.post("/api/admin/inbox/:id/reply", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const { body, subject } = req.body;
      if (!body || typeof body !== "string") {
        return res.status(400).json({ error: "Reply body is required" });
      }
      
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Generate unique message ID for threading
      const messageId = `<${randomUUID()}@marbellagolftimes.com>`;
      
      // Fetch all messages in the thread to build conversation history
      const messages = await storage.getEmailsByThreadId(thread.id);
      
      // Build quoted conversation history (oldest to newest, reversed for quoting)
      const sortedMessages = [...messages].sort((a, b) => 
        new Date(a.receivedAt || 0).getTime() - new Date(b.receivedAt || 0).getTime()
      );
      
      // Format date for email quote header
      const formatQuoteDate = (date: Date | string | null) => {
        if (!date) return "";
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };
      
      // Build conversation history in text format
      let textHistory = "";
      let htmlHistory = "";
      
      for (const msg of sortedMessages) {
        const sender = msg.direction === "IN" ? msg.fromEmail : "Marbella Golf Times";
        const dateStr = formatQuoteDate(msg.receivedAt);
        const msgBody = msg.bodyText || "";
        
        // Text version with > prefix
        textHistory += `\n\n---------- ${msg.direction === "IN" ? "Original Message" : "Previous Reply"} ----------\n`;
        textHistory += `From: ${sender}\n`;
        textHistory += `Date: ${dateStr}\n`;
        textHistory += `Subject: ${msg.subject}\n\n`;
        textHistory += msgBody.split('\n').map(line => `> ${line}`).join('\n');
        
        // HTML version with blockquote styling
        htmlHistory += `
          <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
            <p style="color: #666; font-size: 12px; margin-bottom: 10px;">
              On ${dateStr}, <strong>${sender}</strong> wrote:
            </p>
            <blockquote style="margin: 0 0 0 10px; padding-left: 10px; border-left: 2px solid #d9d9d9; color: #555;">
              ${(msg.bodyHtml || msg.bodyText || "").replace(/\n/g, '<br>')}
            </blockquote>
          </div>
        `;
      }
      
      // Compose full email with new reply + history
      const fullTextBody = body + textHistory;
      const fullHtmlBody = `
        <div style="font-family: sans-serif;">
          <div style="margin-bottom: 20px;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          ${htmlHistory}
        </div>
      `;
      
      // Actually send the email FIRST (before creating record)
      const { sendEmail } = await import("./email");
      console.log("[Inbox Reply] Attempting to send reply to:", thread.fromEmail, "with", messages.length, "messages in history");
      
      const emailResult = await sendEmail({
        to: thread.fromEmail,
        subject: subject || `Re: ${thread.subject}`,
        text: fullTextBody,
        html: fullHtmlBody,
      });
      
      if (!emailResult.success) {
        console.error("[Inbox Reply] Email send failed:", emailResult.error);
        return res.status(500).json({ error: `Failed to send email: ${emailResult.error}` });
      }
      
      console.log("[Inbox Reply] Email sent successfully, creating record");
      
      // Create outbound email record - store only the new reply body for the dashboard
      const outboundEmail = await storage.createInboundEmail({
        threadId: thread.id,
        direction: "OUT",
        fromEmail: process.env.FROM_EMAIL || "info@marbellagolftimes.com",
        toEmail: thread.fromEmail,
        subject: subject || `Re: ${thread.subject}`,
        bodyText: body, // Only store new reply in database for clean dashboard view
        bodyHtml: `<div style="font-family: sans-serif;">${body.replace(/\n/g, '<br>')}</div>`,
        messageId: messageId,
        inReplyTo: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].messageId : null,
      });
      
      // Mark thread as replied
      await storage.markThreadAsReplied(thread.id, userId);
      
      console.log("[Inbox Reply] Reply completed successfully");
      res.json({ success: true, email: outboundEmail });
    } catch (error) {
      console.error("[Inbox Reply] Failed to send reply:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: `Failed to send reply: ${errorMessage}` });
    }
  });

  // PATCH /api/admin/inbox/:id/status - Update thread status (Admin only)
  app.patch("/api/admin/inbox/:id/status", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const { status, requiresResponse } = req.body;
      
      const updates: { status?: string; requiresResponse?: string } = {};
      if (status && ["OPEN", "REPLIED", "CLOSED", "ARCHIVED"].includes(status)) {
        updates.status = status;
      }
      if (typeof requiresResponse === "boolean") {
        updates.requiresResponse = requiresResponse ? "true" : "false";
      }
      
      const updatedThread = await storage.updateInboundThread(req.params.id, updates);
      res.json(updatedThread);
    } catch (error) {
      console.error("Failed to update thread status:", error);
      res.status(500).json({ error: "Failed to update thread status" });
    }
  });

  // PATCH /api/admin/inbox/:id/link-course - Link thread to course (Admin only)
  app.patch("/api/admin/inbox/:id/link-course", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const { courseId } = req.body;
      
      // Verify course exists if provided
      if (courseId) {
        const course = await storage.getCourseById(courseId);
        if (!course) {
          return res.status(400).json({ error: "Course not found" });
        }
      }
      
      const updatedThread = await storage.updateInboundThread(req.params.id, { 
        courseId: courseId || null 
      });
      res.json(updatedThread);
    } catch (error) {
      console.error("Failed to link thread to course:", error);
      res.status(500).json({ error: "Failed to link thread to course" });
    }
  });

  // PATCH /api/admin/inbox/:id/mute - Mute/unmute thread alerts (Admin only)
  app.patch("/api/admin/inbox/:id/mute", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const { muted } = req.body;
      if (typeof muted !== "boolean") {
        return res.status(400).json({ error: "muted must be a boolean" });
      }
      
      const updatedThread = await storage.muteThread(req.params.id, muted);
      res.json(updatedThread);
    } catch (error) {
      console.error("Failed to mute thread:", error);
      res.status(500).json({ error: "Failed to mute thread" });
    }
  });

  // DELETE /api/admin/inbox/:id - Soft delete thread (move to trash) (Admin only)
  app.delete("/api/admin/inbox/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const deletedThread = await storage.deleteThread(req.params.id);
      res.json(deletedThread);
    } catch (error) {
      console.error("Failed to delete thread:", error);
      res.status(500).json({ error: "Failed to delete thread" });
    }
  });

  // PATCH /api/admin/inbox/:id/restore - Restore deleted thread (Admin only)
  app.patch("/api/admin/inbox/:id/restore", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      if (thread.status !== "DELETED") {
        return res.status(400).json({ error: "Thread is not deleted" });
      }
      
      const restoredThread = await storage.restoreThread(req.params.id);
      res.json(restoredThread);
    } catch (error) {
      console.error("Failed to restore thread:", error);
      res.status(500).json({ error: "Failed to restore thread" });
    }
  });

  // DELETE /api/admin/inbox/:id/permanent - Permanently delete thread (Admin only)
  app.delete("/api/admin/inbox/:id/permanent", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const thread = await storage.getInboundThreadById(req.params.id);
      if (!thread) {
        return res.status(404).json({ error: "Thread not found" });
      }
      
      const success = await storage.permanentlyDeleteThread(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to permanently delete thread" });
      }
    } catch (error) {
      console.error("Failed to permanently delete thread:", error);
      res.status(500).json({ error: "Failed to permanently delete thread" });
    }
  });

  // GET /api/admin/inbox/settings - Get admin alert settings (Admin only)
  app.get("/api/admin/inbox/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const settings = await storage.getAdminAlertSettings(userId);
      
      res.json(settings || {
        emailAlerts: "true",
        alertThresholdHours: 2,
        alertEmail: null,
      });
    } catch (error) {
      console.error("Failed to get alert settings:", error);
      res.status(500).json({ error: "Failed to get alert settings" });
    }
  });

  // PATCH /api/admin/inbox/settings - Update admin alert settings (Admin only)
  app.patch("/api/admin/inbox/settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const { emailAlerts, alertThresholdHours, alertEmail } = req.body;
      
      const updates: { emailAlerts?: string; alertThresholdHours?: number; alertEmail?: string | null } = {};
      if (typeof emailAlerts === "boolean") {
        updates.emailAlerts = emailAlerts ? "true" : "false";
      }
      if (typeof alertThresholdHours === "number" && alertThresholdHours > 0) {
        updates.alertThresholdHours = alertThresholdHours;
      }
      if (typeof alertEmail === "string" || alertEmail === null) {
        updates.alertEmail = alertEmail;
      }
      
      const settings = await storage.upsertAdminAlertSettings(userId, updates);
      res.json(settings);
    } catch (error) {
      console.error("Failed to update alert settings:", error);
      res.status(500).json({ error: "Failed to update alert settings" });
    }
  });

  // NOTE: The actual inbound email webhook is defined below with multer middleware
  // to handle SendGrid's multipart form data

  // GET /api/courses/:id - Get course by ID
  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      // Add average rating and review count
      const reviews = await storage.getAllReviewsByCourseId(course.id);
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;
      
      const courseWithRating = {
        ...course,
        averageRating: avgRating,
        reviewCount: reviews.length,
      };
      
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(courseWithRating);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // GET /api/courses/:id/images - Get all gallery images for a course (Public)
  app.get("/api/courses/:id/images", async (req, res) => {
    try {
      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      const images = await storage.getImagesByCourseId(req.params.id);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(images);
    } catch (error) {
      console.error("Failed to fetch course images:", error);
      res.status(500).json({ error: "Failed to fetch course images" });
    }
  });

  // POST /api/courses/:id/images - Add gallery image (Admin only)
  app.post("/api/courses/:id/images", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { imageUrl, caption } = req.body;
      
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Get existing images to determine sort order
      const existingImages = await storage.getImagesByCourseId(req.params.id);
      const nextSortOrder = existingImages.length > 0 
        ? Math.max(...existingImages.map(img => img.sortOrder)) + 1 
        : 0;

      const newImage = await storage.createCourseImage({
        courseId: req.params.id,
        imageUrl,
        caption: caption || null,
        sortOrder: nextSortOrder,
      });

      res.status(201).json(newImage);
    } catch (error) {
      console.error("Failed to create course image:", error);
      res.status(500).json({ error: "Failed to create course image" });
    }
  });

  // DELETE /api/course-images/:imageId - Delete gallery image (Admin only)
  app.delete("/api/course-images/:imageId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCourseImage(req.params.imageId);
      if (!success) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete course image:", error);
      res.status(500).json({ error: "Failed to delete course image" });
    }
  });

  // PATCH /api/courses/:id/images/reorder - Reorder gallery images (Admin only)
  app.patch("/api/courses/:id/images/reorder", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { imageIds } = req.body;
      
      if (!Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ error: "imageIds array is required" });
      }

      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      await storage.reorderCourseImages(req.params.id, imageIds);
      
      const updatedImages = await storage.getImagesByCourseId(req.params.id);
      res.json(updatedImages);
    } catch (error) {
      console.error("Failed to reorder course images:", error);
      res.status(500).json({ error: "Failed to reorder course images" });
    }
  });

  // POST /api/courses/:id/images/swap-main - Swap main image with a gallery image (Admin only)
  app.post("/api/courses/:id/images/swap-main", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { promoteImageId, demoteToPosition } = req.body;
      
      if (!promoteImageId || typeof promoteImageId !== "string") {
        return res.status(400).json({ error: "promoteImageId is required" });
      }

      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Get the gallery image to promote
      const galleryImages = await storage.getImagesByCourseId(req.params.id);
      const imageToPromote = galleryImages.find(img => img.id === promoteImageId);
      
      if (!imageToPromote) {
        return res.status(404).json({ error: "Gallery image not found" });
      }

      const oldMainImageUrl = course.imageUrl;
      const newMainImageUrl = imageToPromote.imageUrl;
      
      // Step 1: Set the new main image
      await storage.updateCourseImage(req.params.id, newMainImageUrl);
      
      // Step 2: Delete the promoted image from gallery
      await storage.deleteCourseImage(promoteImageId);
      
      // Step 3: If there was an old main image, add it to gallery
      if (oldMainImageUrl) {
        const position = typeof demoteToPosition === "number" ? demoteToPosition : imageToPromote.sortOrder;
        await storage.createCourseImage({
          courseId: req.params.id,
          imageUrl: oldMainImageUrl,
          caption: null,
          sortOrder: position,
        });
      }
      
      // Return updated data
      const updatedImages = await storage.getImagesByCourseId(req.params.id);
      const updatedCourse = await storage.getCourseById(req.params.id);
      
      res.json({ 
        course: updatedCourse,
        images: updatedImages 
      });
    } catch (error) {
      console.error("Failed to swap main image:", error);
      res.status(500).json({ error: "Failed to swap main image" });
    }
  });

  // GET /api/weather/:lat/:lng - Get weather data for location (Open-Meteo API - Free, no API key required)
  app.get("/api/weather/:lat/:lng", async (req, res) => {
    try {
      const { lat, lng } = req.params;
      
      // Validate lat/lng parameters
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      // Call Open-Meteo API (Free, no API key required)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weathercode,windspeed_10m&timezone=auto`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Weather API error: ${response.status} ${response.statusText}`);
        return res.status(response.status).json({ 
          error: "Failed to fetch weather data",
          message: "Weather service temporarily unavailable" 
        });
      }

      const data = await response.json();
      
      // Map Open-Meteo weather codes to descriptions and icon codes
      const weatherCodeMap: Record<number, { description: string; icon: string }> = {
        0: { description: "clear sky", icon: "01d" },
        1: { description: "mainly clear", icon: "02d" },
        2: { description: "partly cloudy", icon: "03d" },
        3: { description: "overcast", icon: "04d" },
        45: { description: "foggy", icon: "50d" },
        48: { description: "depositing rime fog", icon: "50d" },
        51: { description: "light drizzle", icon: "09d" },
        53: { description: "moderate drizzle", icon: "09d" },
        55: { description: "dense drizzle", icon: "09d" },
        61: { description: "slight rain", icon: "10d" },
        63: { description: "moderate rain", icon: "10d" },
        65: { description: "heavy rain", icon: "10d" },
        71: { description: "slight snow", icon: "13d" },
        73: { description: "moderate snow", icon: "13d" },
        75: { description: "heavy snow", icon: "13d" },
        80: { description: "slight rain showers", icon: "09d" },
        81: { description: "moderate rain showers", icon: "09d" },
        82: { description: "violent rain showers", icon: "09d" },
        95: { description: "thunderstorm", icon: "11d" },
        96: { description: "thunderstorm with slight hail", icon: "11d" },
        99: { description: "thunderstorm with heavy hail", icon: "11d" }
      };

      const weatherCode = data.current.weathercode || 0;
      const weatherInfo = weatherCodeMap[weatherCode] || { description: "unknown", icon: "01d" };
      
      // Open-Meteo returns wind speed in km/h by default (no conversion needed)
      const windKmh = data.current.windspeed_10m;
      
      // Return formatted weather data
      res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache for 30 minutes
      res.json({
        temp: data.current.temperature_2m,
        conditions: weatherInfo.description,
        wind: windKmh,
        humidity: data.current.relative_humidity_2m,
        icon: weatherInfo.icon
      });
    } catch (error) {
      console.error("Weather API error:", error);
      res.status(500).json({ 
        error: "Failed to fetch weather data",
        message: "Weather service temporarily unavailable" 
      });
    }
  });

  // POST /api/courses/enrich-all - Batch AI enrichment of all courses (Admin only)
  app.post("/api/courses/enrich-all", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseEnrichmentService } = await import("./services/courseEnrichment");
      
      res.json({ message: "Batch enrichment started", status: "processing" });

      courseEnrichmentService.enrichAllCourses()
        .then(result => {
          console.log(`[Enrichment] Batch complete:`, result);
        })
        .catch(error => {
          console.error(`[Enrichment] Batch failed:`, error);
        });

    } catch (error) {
      console.error("Error starting batch enrichment:", error);
      res.status(500).json({ error: "Failed to start batch enrichment" });
    }
  });

  // POST /api/courses/:id/enrich - AI-powered course enrichment (Admin only)
  app.post("/api/courses/:id/enrich", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseEnrichmentService } = await import("./services/courseEnrichment");
      
      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      res.json({ message: "Enrichment started", status: "processing" });

      courseEnrichmentService.enrichCourse(req.params.id)
        .then(result => {
          console.log(`[Enrichment] Completed for ${course.name}:`, result);
        })
        .catch(error => {
          console.error(`[Enrichment] Failed for ${course.name}:`, error);
        });

    } catch (error) {
      console.error("Error starting enrichment:", error);
      res.status(500).json({ error: "Failed to start enrichment" });
    }
  });

  // PATCH /api/courses/:id/image - Update course image (Admin only)
  app.patch("/api/courses/:id/image", isAuthenticated, async (req, res) => {
    try {
      const { imageUrl } = req.body;

      // Allow null to clear the image
      if (imageUrl === null) {
        const updatedCourse = await storage.updateCourseImage(req.params.id, null);
        if (!updatedCourse) {
          return res.status(404).json({ error: "Course not found" });
        }
        return res.json(updatedCourse);
      }

      // Validate imageUrl is a string
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ error: "imageUrl must be a string or null" });
      }

      // Validate that imageUrl is a valid image URL
      const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
      const hasValidExtension = validExtensions.some(ext => imageUrl.toLowerCase().endsWith(ext));
      const isValidUrl = 
        imageUrl.startsWith("/stock_images/") || 
        imageUrl.startsWith("/generated_images/") ||
        imageUrl.startsWith("/objects/") ||
        imageUrl.startsWith("public/") ||
        imageUrl.startsWith("https://storage.googleapis.com/") ||
        imageUrl.startsWith("https://");
      
      if (!isValidUrl || !hasValidExtension) {
        return res.status(400).json({ 
          error: "Invalid imageUrl format. Must be a valid image URL ending with .jpg, .jpeg, .png, or .webp" 
        });
      }

      const updatedCourse = await storage.updateCourseImage(req.params.id, imageUrl);
      
      if (!updatedCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      res.json(updatedCourse);
    } catch (error) {
      res.status(500).json({ error: "Failed to update course image" });
    }
  });

  // PATCH /api/admin/courses/:id - Update course settings (kickback + credentials) (Admin only)
  app.patch("/api/admin/courses/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const updateCourseSchema = z.object({
        kickbackPercent: z.number().min(0).max(100).optional(),
        golfmanagerUser: z.string().optional(),
        golfmanagerPassword: z.string().optional(),
        teeoneIdEmpresa: z.number().optional(),
        teeoneIdTeeSheet: z.number().optional(),
        teeoneApiUser: z.string().optional(),
        teeoneApiPassword: z.string().optional(),
      });

      const result = updateCourseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: result.error.flatten() 
        });
      }

      // Build updates object with only provided fields
      const updates: Partial<GolfCourse> = {};
      if (result.data.kickbackPercent !== undefined) {
        updates.kickbackPercent = result.data.kickbackPercent;
      }
      if (result.data.golfmanagerUser !== undefined) {
        updates.golfmanagerUser = result.data.golfmanagerUser || null;
      }
      if (result.data.golfmanagerPassword !== undefined) {
        updates.golfmanagerPassword = result.data.golfmanagerPassword || null;
      }
      // TeeOne credentials
      if (result.data.teeoneIdEmpresa !== undefined) {
        updates.teeoneIdEmpresa = result.data.teeoneIdEmpresa || null;
      }
      if (result.data.teeoneIdTeeSheet !== undefined) {
        updates.teeoneIdTeeSheet = result.data.teeoneIdTeeSheet || null;
      }
      if (result.data.teeoneApiUser !== undefined) {
        updates.teeoneApiUser = result.data.teeoneApiUser || null;
      }
      if (result.data.teeoneApiPassword !== undefined) {
        updates.teeoneApiPassword = result.data.teeoneApiPassword || null;
      }

      const updatedCourse = await storage.updateCourse(req.params.id, updates);
      
      if (!updatedCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      res.json(updatedCourse);
    } catch (error) {
      console.error("Error updating course:", error);
      res.status(500).json({ error: "Failed to update course settings" });
    }
  });

  // PATCH /api/admin/courses/:id/details - Update course details (name, city, etc.) (Admin only)
  app.patch("/api/admin/courses/:id/details", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const updateCourseDetailsSchema = z.object({
        name: z.string().min(1).optional(),
        city: z.string().min(1).optional(),
        province: z.string().optional(),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        websiteUrl: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      });

      const result = updateCourseDetailsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: result.error.flatten() 
        });
      }

      // Build updates object with only provided fields
      const updates: Partial<GolfCourse> = {};
      if (result.data.name !== undefined) updates.name = result.data.name;
      if (result.data.city !== undefined) updates.city = result.data.city;
      if (result.data.province !== undefined) updates.province = result.data.province;
      if (result.data.email !== undefined) updates.email = result.data.email || null;
      if (result.data.phone !== undefined) updates.phone = result.data.phone || null;
      if (result.data.websiteUrl !== undefined) updates.websiteUrl = result.data.websiteUrl || null;
      if (result.data.notes !== undefined) updates.notes = result.data.notes || null;

      const updatedCourse = await storage.updateCourse(req.params.id, updates);
      
      if (!updatedCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      res.json(updatedCourse);
    } catch (error) {
      console.error("Error updating course details:", error);
      res.status(500).json({ error: "Failed to update course details" });
    }
  });

  // PATCH /api/admin/courses/:id/members-only - Set members-only status (Admin only)
  app.patch("/api/admin/courses/:id/members-only", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { membersOnly } = req.body;
      
      if (typeof membersOnly !== "boolean") {
        return res.status(400).json({ error: "membersOnly must be a boolean" });
      }
      
      const updatedCourse = await storage.setMembersOnly(req.params.id, membersOnly);
      
      if (!updatedCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      res.json(updatedCourse);
    } catch (error) {
      console.error("Error setting members-only status:", error);
      res.status(500).json({ error: "Failed to set members-only status" });
    }
  });

  // PATCH /api/admin/courses/:id/provider - Set booking provider for a course (Admin only)
  app.patch("/api/admin/courses/:id/provider", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { providerType, providerCourseCode } = req.body;
      
      // providerType can be: "none", "golfmanager_v1", "golfmanager_v3", "teeone"
      const validTypes = ["none", "golfmanager_v1", "golfmanager_v3", "teeone"];
      if (providerType && !validTypes.includes(providerType)) {
        return res.status(400).json({ error: `providerType must be one of: ${validTypes.join(", ")}` });
      }
      
      // Verify course exists
      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      await storage.setCourseProvider(req.params.id, providerType || null, providerCourseCode);
      
      // Fetch updated links to return
      const links = await storage.getLinksByCourseId(req.params.id);
      
      res.json({ 
        success: true, 
        courseId: req.params.id, 
        providerType: providerType || "none",
        links 
      });
    } catch (error) {
      console.error("Error setting course provider:", error);
      res.status(500).json({ error: "Failed to set course provider" });
    }
  });

  // POST /api/upload/course-image - Upload a course image (Admin only)
  app.post("/api/upload/course-image", isAuthenticated, upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Return the URL path for the uploaded image
      const imageUrl = `/stock_images/${req.file.filename}`;
      
      res.json({ 
        imageUrl,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // POST /api/courses/:courseId/images/upload - Upload multiple images for a course (Admin only)
  app.post("/api/courses/:courseId/images/upload", isAuthenticated, upload.array("images", 5), async (req, res) => {
    try {
      const { courseId } = req.params;
      const files = req.files as Express.Multer.File[];
      const { setAsMain } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      // Verify course exists
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      const uploadedImages: any[] = [];

      // Process each uploaded file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageUrl = `/stock_images/${file.filename}`;

        // Add to course_images table
        const galleryImage = await storage.createCourseImage({
          courseId,
          imageUrl,
          caption: null,
          sortOrder: i
        });

        uploadedImages.push({
          id: galleryImage.id,
          imageUrl,
          filename: file.filename,
          size: file.size
        });

        // Set first image as main if setAsMain is true or no main image exists
        if (i === 0 && (setAsMain === "true" || !course.imageUrl)) {
          await storage.updateCourseImage(courseId, imageUrl);
        }
      }

      res.json({ 
        success: true,
        uploaded: uploadedImages.length,
        images: uploadedImages
      });
    } catch (error: any) {
      console.error("Error uploading course images:", error);
      res.status(500).json({ error: error.message || "Failed to upload images" });
    }
  });

  // DELETE /api/images/:filename - Delete an image file (Admin only)
  app.delete("/api/images/:filename", isAuthenticated, async (req, res) => {
    try {
      const { filename } = req.params; // Already URL-decoded by Express
      const { courseId, directory } = req.query;
      
      // CRITICAL SECURITY: Validate decoded filename with strict whitelist regex
      // Only allow alphanumeric characters, dots, underscores, and hyphens
      const safeFilenameRegex = /^[A-Za-z0-9._-]+$/;
      if (!safeFilenameRegex.test(filename)) {
        return res.status(400).json({ 
          error: "Invalid filename. Only alphanumeric characters, dots, underscores, and hyphens are allowed." 
        });
      }
      
      // Defense in depth: Explicitly reject path traversal attempts
      // This catches any edge cases that might bypass the regex
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return res.status(400).json({ error: "Invalid filename" });
      }

      // Determine which directory to delete from
      const allowedDirectories = ["stock_images", "generated_images"];
      let targetDirectory = "stock_images"; // default
      
      if (directory && typeof directory === "string" && allowedDirectories.includes(directory)) {
        targetDirectory = directory;
      }

      const filePath = path.join(__dirname, `../client/public/${targetDirectory}`, filename);
      
      // If courseId is provided, verify the course exists first
      if (courseId && typeof courseId === "string") {
        const course = await storage.getCourseById(courseId);
        if (!course) {
          return res.status(404).json({ error: "Course not found" });
        }
      }

      // Check if file exists and delete it (idempotent - success even if already deleted)
      let fileDeleted = false;
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        fileDeleted = true;
      } catch {
        // File doesn't exist - that's OK, treat as already deleted (idempotent delete)
        console.log(`File ${filename} not found, treating as already deleted`);
      }
      
      // Update course database regardless of whether physical file existed
      if (courseId && typeof courseId === "string") {
        const updatedCourse = await storage.updateCourseImage(courseId, null);
        if (!updatedCourse) {
          return res.status(500).json({ error: "Failed to update course after deleting file" });
        }
      }
      
      res.json({ 
        success: true, 
        message: fileDeleted ? "Image deleted successfully" : "Image reference removed (file already deleted)" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete image" });
    }
  });

  // GET /api/slots/search - Tee-time availability search
  app.get("/api/slots/search", async (req, res) => {
    try {
      const { lat, lng, radiusKm, date, players, fromTime, toTime, holes, courseId } = req.query;

      // If courseId is provided, get only that specific course
      let courses;
      if (courseId && typeof courseId === 'string') {
        const singleCourse = await storage.getCourseById(courseId);
        courses = singleCourse ? [singleCourse] : [];
      } else {
        courses = await storage.getAllCourses();
      }
      
      const userLat = lat ? parseFloat(lat as string) : null;
      const userLng = lng ? parseFloat(lng as string) : null;

      // Helper function to calculate distance (Haversine formula)
      const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLng = (lng2 - lng1) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Get Golfmanager configuration (always returns a config with mode)
      const golfmanagerConfig = getGolfmanagerConfig();
      
      // Multi-tee course configurations (like TeeTimesBooking.com)
      const multiTeeConfigs: Record<string, string[]> = {
        // Courses with multiple tees/layouts
        "mijas golf": ["Los Lagos", "Los Olivos"],
        "la cala": ["Campo America", "Campo Asia", "Campo Europa"],
        "atalaya": ["Old Course", "New Course"],
        "villa padierna": ["Flamingos", "Alferini", "Tramores"],
        "la quinta": ["TEE 1", "TEE 10"],
        "chaparral": ["TEE 1", "TEE 10"],
        "calanova": ["TEE 1", "TEE 10"],
        "estepona golf": ["18 Holes", "9 Holes"],
        "la duquesa": ["TEE 1", "TEE 10"],
        "la hacienda": ["Heathland", "Links"],
        "cerrado del águila": ["18 Holes", "9 Holes"],
        "la noria": ["18 Holes", "9 Holes"],
        "los arqueros": ["18 Holes", "9 Holes"],
      };
      
      // Get tee names for a course (returns ["TEE 1"] for single-tee courses)
      const getTeeNames = (courseName: string): string[] => {
        const lowerName = courseName.toLowerCase();
        for (const [key, tees] of Object.entries(multiTeeConfigs)) {
          if (lowerName.includes(key)) {
            return tees;
          }
        }
        return ["TEE 1"]; // Default single tee
      };
      
      // Helper function to generate mock slots for a specific tee
      const generateMockSlots = (searchDate: string, from: string, to: string, numPlayers: number, numHoles: number, teeName: string = "TEE 1"): TeeTimeSlot[] => {
        const slots: TeeTimeSlot[] = [];
        const [fromHour] = from.split(":").map(Number);
        const [toHour] = to.split(":").map(Number);
        const baseDate = searchDate ? new Date(searchDate) : new Date();
        baseDate.setHours(0, 0, 0, 0);

        // Price multiplier based on holes (9 holes typically cost ~50-60% of 18 holes)
        const priceMultiplier = numHoles === 9 ? 0.55 : 1;

        // Generate different tee times based on holes selection
        // 9 holes: More frequent slots (every 20-30 min), earlier/later times preferred
        // 18 holes: Less frequent slots (every 40-60 min), full day coverage
        const slotInterval = numHoles === 9 ? 20 : 45; // minutes between slots
        const numSlots = Math.floor((toHour - fromHour) * 60 / slotInterval);

        // For 9 holes, add some randomness to prefer morning/afternoon
        // For 18 holes, distribute evenly throughout the day
        const useSeed = numHoles === 9;
        
        // Use teeName as seed offset for different times per tee
        const teeOffset = teeName.charCodeAt(0) % 30;
        
        for (let i = 0; i < numSlots && i < 8; i++) { // Max 8 slots per course
          let hour: number;
          let minute: number;
          
          if (useSeed) {
            // 9 holes: Prefer earlier or later times
            const preferEarly = Math.random() < 0.6;
            if (preferEarly) {
              hour = fromHour + Math.floor(Math.random() * Math.min(3, toHour - fromHour));
            } else {
              hour = Math.max(fromHour, toHour - 3) + Math.floor(Math.random() * 3);
            }
            minute = ((i * slotInterval) + teeOffset) % 60;
          } else {
            // 18 holes: Even distribution with tee offset
            const totalMinutes = (i * slotInterval) + teeOffset;
            hour = fromHour + Math.floor(totalMinutes / 60);
            minute = totalMinutes % 60;
          }
          
          if (hour >= toHour) break;
          
          const slotDate = new Date(baseDate);
          slotDate.setHours(hour, minute, 0, 0);

          const basePrice = Math.floor(Math.random() * 80) + 40;
          const adjustedPrice = Math.round(basePrice * priceMultiplier);
          
          // Generate realistic slotsAvailable (ontee.com style dots)
          // Weighted towards fuller availability with some limited/urgent slots
          const availabilityRoll = Math.random();
          let slotsAvailable: number;
          if (availabilityRoll < 0.1) slotsAvailable = 1;       // 10% - last spot (urgent)
          else if (availabilityRoll < 0.25) slotsAvailable = 2; // 15% - limited
          else if (availabilityRoll < 0.5) slotsAvailable = 3;  // 25% - good
          else slotsAvailable = 4;                               // 50% - fully open

          slots.push({
            teeTime: slotDate.toISOString(),
            greenFee: adjustedPrice,
            currency: "EUR",
            players: numPlayers,
            holes: numHoles,
            source: "mock-provider",
            teeName: teeName,
            slotsAvailable: slotsAvailable,
          });
        }

        return slots.sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime());
      };
      
      // Generate all slots for a course (including multiple tees)
      const generateAllTeeSlots = (courseName: string, searchDate: string, from: string, to: string, numPlayers: number, numHoles: number): TeeTimeSlot[] => {
        const teeNames = getTeeNames(courseName);
        const allSlots: TeeTimeSlot[] = [];
        
        for (const teeName of teeNames) {
          const teeSlots = generateMockSlots(searchDate, from, to, numPlayers, numHoles, teeName);
          allSlots.push(...teeSlots);
        }
        
        return allSlots.sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime());
      };

      // Filter and sort courses by distance (or use all courses if searching by courseId)
      let coursesWithDistance: { course: any; distance: number }[];
      
      if (courseId && typeof courseId === 'string') {
        // When searching by courseId, skip distance filtering
        coursesWithDistance = courses.map(course => ({
          course,
          distance: 0 // Distance not relevant for single course lookup
        }));
      } else {
        // Normal mode: Filter and sort by distance
        coursesWithDistance = courses
          .map((course) => {
            if (!userLat || !userLng || !course.lat || !course.lng) return null;
            const courseLat = parseFloat(course.lat);
            const courseLng = parseFloat(course.lng);
            if (isNaN(courseLat) || isNaN(courseLng)) return null;
            const distance = calculateDistance(userLat, userLng, courseLat, courseLng);
            return { course, distance };
          })
          .filter((item): item is { course: any; distance: number } => 
            item !== null && !isNaN(item.distance)
          )
          .sort((a, b) => a.distance - b.distance);
      }

      if (golfmanagerConfig.mode === "mock") {
        // Mock mode: Show courses with provider info for badges
        const mockSlots: CourseWithSlots[] = await Promise.all(coursesWithDistance.map(async ({ course, distance }): Promise<CourseWithSlots> => {
          const providerLinks = await storage.getLinksByCourseId(course.id);
          
          // Check for Golfmanager booking link (V1 or V3)
          const golfmanagerLink = providerLinks.find((link) => 
            link.providerCourseCode && (
              link.providerCourseCode.startsWith("golfmanager:") ||
              link.providerCourseCode.startsWith("golfmanagerv3:")
            )
          );
          
          // Check for TeeOne booking link
          const teeoneLink = providerLinks.find((link) => 
            link.providerCourseCode && link.providerCourseCode.startsWith("teeone:")
          );
          
          // Check for Zest Golf booking link (format: "zest:facilityId")
          const zestLink = providerLinks.find((link) => 
            link.providerCourseCode && link.providerCourseCode.startsWith("zest:")
          );
          
          // PRIORITY 1: Zest Golf - fetch real tee times from connected courses
          if (zestLink) {
            try {
              const facilityId = parseInt(zestLink.providerCourseCode!.split(":")[1]);
              const zestService = getZestGolfService();
              const searchDate = date ? new Date(date as string) : new Date();
              const numPlayers = players ? parseInt(players as string) : 2;
              const numHoles = holes ? parseInt(holes as string) : 18;
              
              const zestResponse = await zestService.getTeeTimes(
                facilityId,
                searchDate,
                numPlayers,
                numHoles as 9 | 18
              );
              
              // Convert Zest tee times to our TeeTimeSlot format
              // Note: Zest API returns teeTimeV2 format (not V3)
              const slots: TeeTimeSlot[] = (zestResponse.teeTimeV2 || zestResponse.teeTimeV3 || [])
                .filter((tt: any) => {
                  // Filter by time range if specified
                  if (!fromTime && !toTime) return true;
                  const teeHour = new Date(tt.time).getHours();
                  const teeMinute = new Date(tt.time).getMinutes();
                  const teeTimeMinutes = teeHour * 60 + teeMinute;
                  const fromMinutes = fromTime ? parseInt((fromTime as string).split(":")[0]) * 60 + parseInt((fromTime as string).split(":")[1] || "0") : 0;
                  const toMinutes = toTime ? parseInt((toTime as string).split(":")[0]) * 60 + parseInt((toTime as string).split(":")[1] || "0") : 24 * 60;
                  return teeTimeMinutes >= fromMinutes && teeTimeMinutes <= toMinutes;
                })
                .map((tt: any) => {
                  // Find price for the requested number of players (players can be number or string)
                  const playerPricing = tt.pricing?.find((p: any) => Number(p.players) === numPlayers);
                  // Use publicRate (customer-facing price) instead of price (channel manager price)
                  // Fallback to price if publicRate not available
                  const priceAmount = playerPricing?.publicRate?.amount || playerPricing?.price?.amount || 
                                     tt.pricing?.[0]?.publicRate?.amount || tt.pricing?.[0]?.price?.amount || 0;
                  // Price from Zest is total for all players, so divide by number of players
                  const perPlayerPrice = Math.round(priceAmount / numPlayers);
                  
                  return {
                    teeTime: tt.time,
                    greenFee: perPlayerPrice,
                    currency: playerPricing?.price?.currency || "EUR",
                    players: numPlayers,
                    holes: tt.holes || numHoles,
                    source: "zest-golf",
                    teeName: tt.course || "TEE 1",
                    slotsAvailable: tt.players || 4,
                    zestTeeId: tt.id,
                    extraProducts: tt.extraProducts,
                  };
                });
              
              console.log(`[Zest Golf] Retrieved ${slots.length} real tee times for ${course.name} (facility: ${facilityId})`);
              
              // SECURITY: Cache prices server-side for secure checkout
              slots.forEach(slot => {
                if (slot.greenFee && slot.greenFee > 0) {
                  cacheApiPrice(course.id, slot.teeTime, Math.round(slot.greenFee * 100), "zest");
                }
              });
              
              return {
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: zestLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                slots,
                note: slots.length > 0 ? undefined : "No availability for selected date/time",
                providerType: "API",
                providerName: "zest",
                course,
              };
            } catch (error) {
              console.error(`[Zest Golf] Error fetching tee times for ${course.name}:`, error);
              // Fall back to TeeOne or mock data
            }
          }
          
          if (golfmanagerLink) {
            // Course has Golfmanager - show mock data with GM badge
            const slots = generateAllTeeSlots(
              course.name,
              date as string || new Date().toISOString(),
              fromTime as string || "07:00",
              toTime as string || "20:00",
              players ? parseInt(players as string) : 2,
              holes ? parseInt(holes as string) : 18
            );
            
            // Cache mock prices for server-side validation during checkout
            slots.forEach(slot => {
              if (slot.greenFee && slot.greenFee > 0) {
                cacheApiPrice(course.id, slot.teeTime, Math.round(slot.greenFee * 100), "golfmanager-mock");
              }
            });
            
            return {
              courseId: course.id,
              courseName: course.name,
              distanceKm: Math.round(distance * 10) / 10,
              bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
              slots,
              note: "Mock data - Real-time availability coming soon",
              providerType: "API",
              providerName: "golfmanager",
              course,
            };
          }
          
          if (teeoneLink) {
            // Course has TeeOne - show as direct booking link
            return {
              courseId: course.id,
              courseName: course.name,
              distanceKm: Math.round(distance * 10) / 10,
              bookingUrl: teeoneLink.bookingUrl || course.bookingUrl || course.websiteUrl,
              slots: [],
              note: "Book directly on course website",
              providerType: "DEEP_LINK",
              providerName: "teeone",
              course,
            };
          }
          
          // Other courses get mock data without provider badge
          const providerType: "API" | "DEEP_LINK" | "NONE" = providerLinks.length > 0 ? "DEEP_LINK" : "NONE";
          const slots = generateAllTeeSlots(
            course.name,
            date as string || new Date().toISOString(),
            fromTime as string || "07:00",
            toTime as string || "20:00",
            players ? parseInt(players as string) : 2,
            holes ? parseInt(holes as string) : 18
          );
          
          // Cache mock prices for server-side validation during checkout
          slots.forEach(slot => {
            if (slot.greenFee && slot.greenFee > 0) {
              cacheApiPrice(course.id, slot.teeTime, Math.round(slot.greenFee * 100), "mock");
            }
          });
          
          return {
            courseId: course.id,
            courseName: course.name,
            distanceKm: Math.round(distance * 10) / 10,
            bookingUrl: course.bookingUrl || course.websiteUrl,
            slots,
            note: "Mock data - Configure booking provider for real availability",
            providerType,
            providerName: null,
            course,
          };
        }));

        res.json(mockSlots);
      } else if (golfmanagerConfig.mode === "demo" || golfmanagerConfig.mode === "production") {
        // Demo/Production mode: Fetch real tee times from Golfmanager for linked courses  
        const results: CourseWithSlots[] = [];

        for (const { course, distance } of coursesWithDistance) {
          const providerLinks = await storage.getLinksByCourseId(course.id);
          
          // Check for Golfmanager/TeeOne Golf booking link (supports both V1 and V3)
          // Format: "golfmanager:tenant" for V1, "golfmanagerv3:tenant" for V3
          const golfmanagerLink = providerLinks.find((link) => 
            link.providerCourseCode && (
              link.providerCourseCode.startsWith("golfmanager:") ||
              link.providerCourseCode.startsWith("golfmanagerv3:")
            )
          );
          
          if (golfmanagerLink) {
            // Parse provider code to extract version and tenant (normalize for robustness)
            const providerCode = (golfmanagerLink.providerCourseCode || "").toLowerCase().trim();
            const isV3 = providerCode.startsWith("golfmanagerv3:");
            const version: "v1" | "v3" = isV3 ? "v3" : "v1";
            const tenant = providerCode.split(":")[1]?.trim();
            
            if (!tenant) {
              console.error(`[Golfmanager] Invalid providerCourseCode for ${course.name}: ${golfmanagerLink.providerCourseCode}`);
              // Fall back to booking link
              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                slots: [],
                note: "Book directly on course booking page",
                providerType: "DEEP_LINK",
                providerName: "golfmanager",
                course,
              });
              continue;
            }
            
            try {
              // Create tenant-specific provider instance with database credentials (if available)
              const dbCredentials = course.golfmanagerUser && course.golfmanagerPassword 
                ? { user: course.golfmanagerUser, password: course.golfmanagerPassword }
                : undefined;
              
              const provider = createGolfmanagerProvider(tenant, version, dbCredentials);
              
              // Build date range for search
              const searchDate = date ? new Date(date as string) : new Date();
              const startTime = `${searchDate.toISOString().split("T")[0]}T${fromTime || "07:00"}:00`;
              const endTime = `${searchDate.toISOString().split("T")[0]}T${toTime || "20:00"}:00`;
              
              console.log(`[Golfmanager] Fetching availability for ${course.name} (tenant: ${tenant}, version: ${version})`);
              
              // Search for availability (no idResource specified = searches all resources/tees)
              const gmSlots = await provider.searchAvailability(
                startTime,
                endTime,
                undefined, // idResource - search all tees
                players ? parseInt(players as string) : 2, // slots/players
                holes ? [`${holes}holes`] : undefined // tags filter
              );

              const slots = provider.convertSlotsToTeeTime(
                gmSlots,
                players ? parseInt(players as string) : 2,
                holes ? parseInt(holes as string) : 18
              );

              console.log(`[Golfmanager] Retrieved ${slots.length} slots for ${course.name} (tenant: ${tenant}, version: ${version})`);

              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                slots,
                note: slots.length > 0 ? undefined : "No availability for selected date/time",
                providerType: "API",
                providerName: "golfmanager",
                course,
              });
            } catch (error) {
              console.error(`[Golfmanager] Error fetching availability for ${course.name} (tenant: ${tenant}, version: ${version}):`, error);
              
              // If demo mode and tenant access failed, fall back to demo tenant data
              if (golfmanagerConfig.mode === "demo") {
                try {
                  console.log(`[Golfmanager] Falling back to demo tenant for ${course.name}`);
                  
                  const demoProvider = createGolfmanagerProvider("demo");
                  
                  const searchDate = date ? new Date(date as string) : new Date();
                  const startTime = `${searchDate.toISOString().split("T")[0]}T${fromTime || "07:00"}:00`;
                  const endTime = `${searchDate.toISOString().split("T")[0]}T${toTime || "20:00"}:00`;
                  
                  const gmSlots = await demoProvider.searchAvailability(
                    startTime,
                    endTime,
                    undefined,
                    players ? parseInt(players as string) : 2,
                    holes ? [`${holes}holes`] : undefined
                  );

                  const slots = demoProvider.convertSlotsToTeeTime(
                    gmSlots,
                    players ? parseInt(players as string) : 2,
                    holes ? parseInt(holes as string) : 18
                  );

                  console.log(`[Golfmanager] Retrieved ${slots.length} demo slots for ${course.name}`);

                  results.push({
                    courseId: course.id,
                    courseName: course.name,
                    distanceKm: Math.round(distance * 10) / 10,
                    bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                    slots,
                    note: "Demo times shown - Real availability coming soon",
                    providerType: "API",
                    providerName: "golfmanager",
                    course,
                  });
                } catch (demoError) {
                  console.error(`[Golfmanager] Demo fallback also failed for ${course.name}:`, demoError);
                  // Final fallback: Show course with booking link but no slots
                  results.push({
                    courseId: course.id,
                    courseName: course.name,
                    distanceKm: Math.round(distance * 10) / 10,
                    bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                    slots: [],
                    note: "Book directly on course booking page",
                    providerType: "DEEP_LINK",
                    providerName: "golfmanager",
                    course,
                  });
                }
              } else {
                // Production mode: Show course with booking link but no slots
                results.push({
                  courseId: course.id,
                  courseName: course.name,
                  distanceKm: Math.round(distance * 10) / 10,
                  bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                  slots: [],
                  note: "Real-time availability temporarily unavailable - Book directly on course page",
                  providerType: "DEEP_LINK",
                  providerName: "golfmanager",
                  course,
                });
              }
            }
          } else {
            // Check for TeeOne Golf booking link
            const teeoneLink = providerLinks.find((link) => 
              link.providerCourseCode && link.providerCourseCode.startsWith("teeone:")
            );
            
            if (teeoneLink) {
              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: teeoneLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                slots: [],
                note: "Book directly on course website",
                providerType: "DEEP_LINK",
                providerName: "teeone",
                course,
              });
            } else {
              // Course without Golfmanager/TeeOne - show with direct booking link if available
              const deepLinkProvider = providerLinks.find((link) => link.bookingUrl);
              
              if (deepLinkProvider) {
                results.push({
                  courseId: course.id,
                  courseName: course.name,
                  distanceKm: Math.round(distance * 10) / 10,
                  bookingUrl: deepLinkProvider.bookingUrl || course.bookingUrl || course.websiteUrl,
                  slots: [],
                  note: "Book directly on course website",
                  providerType: "DEEP_LINK",
                  providerName: null,
                  course,
                });
              }
            }
          }
        }

        res.json(results);
      }
    } catch (error) {
      console.error("Slot search error:", error);
      res.status(500).json({ error: "Failed to search slots" });
    }
  });

  // GET /api/bookings - Get current user's bookings (Authenticated endpoint)
  app.get("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const bookings = await storage.getBookingsByUserId(userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // POST /api/booking-requests - Create booking request (Public endpoint)
  app.post("/api/booking-requests", async (req: any, res) => {
    try {
      // Add userId if user is authenticated
      const bookingData = {
        ...req.body,
        userId: req.session.userId || null,
      };
      
      const validatedData = insertBookingRequestSchema.parse(bookingData);
      const booking = await storage.createBooking(validatedData);
      
      // Get course details for email
      const course = await storage.getCourseById(booking.courseId);
      
      if (course) {
        // Send confirmation email to customer (non-blocking, handle gracefully if SMTP not configured)
        try {
          const emailConfig = getEmailConfig();
          
          if (emailConfig) {
            const bookingDetails: BookingDetails = {
              id: booking.id,
              courseName: course.name,
              courseCity: course.city,
              customerName: booking.customerName,
              teeTime: new Date(booking.teeTime),
              players: booking.players,
              courseLat: course.lat ? String(course.lat) : null,
              courseLng: course.lng ? String(course.lng) : null,
              totalAmountCents: booking.totalAmountCents,
            };
            
            const emailContent = bookingConfirmationEmail(bookingDetails);
            
            const transporter = nodemailer.createTransport({
              host: emailConfig.host,
              port: emailConfig.port,
              secure: emailConfig.port === 465,
              auth: {
                user: emailConfig.user,
                pass: emailConfig.pass,
              },
            });
            
            await transporter.sendMail({
              from: emailConfig.from,
              to: booking.customerEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            });
            
            console.log(`✓ Booking confirmation email sent to ${booking.customerEmail}`);
            
            storage.createEmailLog({
              bookingId: booking.id,
              courseId: course.id,
              emailType: "CUSTOMER_CONFIRMATION",
              recipientEmail: booking.customerEmail,
              recipientName: booking.customerName,
              subject: emailContent.subject,
              bodyText: emailContent.text,
              bodyHtml: emailContent.html,
              status: "SENT",
            }).catch(e => console.warn("Failed to log customer confirmation email:", e));
          } else {
            console.warn('⚠ SMTP not configured - skipping confirmation email. Set SMTP environment variables to enable email notifications.');
            storage.createEmailLog({
              bookingId: booking.id,
              courseId: course.id,
              emailType: "CUSTOMER_CONFIRMATION",
              recipientEmail: booking.customerEmail,
              recipientName: booking.customerName,
              subject: "Booking Confirmation (SMTP not configured)",
              bodyText: null,
              bodyHtml: null,
              status: "FAILED",
              errorMessage: "SMTP not configured",
            }).catch(e => console.warn("Failed to log skipped email:", e));
          }
        } catch (emailError) {
          console.error('Email sending failed:', emailError instanceof Error ? emailError.message : emailError);
          console.warn('⚠ Booking created successfully but confirmation email could not be sent');
          storage.createEmailLog({
            bookingId: booking.id,
            courseId: course.id,
            emailType: "CUSTOMER_CONFIRMATION",
            recipientEmail: booking.customerEmail,
            recipientName: booking.customerName,
            subject: "Booking Confirmation (failed)",
            bodyText: null,
            bodyHtml: null,
            status: "FAILED",
            errorMessage: emailError instanceof Error ? emailError.message : "Unknown error",
          }).catch(e => console.warn("Failed to log failed email:", e));
        }
        
        // Send notification email to golf course (non-blocking)
        sendCourseBookingNotification(booking, course).catch(() => {});
      }
      
      // Create admin notification for new booking
      try {
        await storage.createBookingNotification({
          bookingId: booking.id,
          type: "NEW_BOOKING",
          status: "UNREAD",
        });
      } catch (notifError) {
        console.warn("Failed to create booking notification:", notifError);
      }
      
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid booking data", details: error.errors });
      }
      console.error('Booking creation error:', error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // GET /api/booking-requests - Get all booking requests (Admin only)
  app.get("/api/booking-requests", isAuthenticated, async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // ============================================================
  // Stripe Payment Endpoints
  // ============================================================

  // POST /api/create-checkout-session - Create Stripe checkout session
  // SECURITY: Green fee must match cached price from API display, add-ons validated from database
  app.post("/api/create-checkout-session", async (req: any, res) => {
    try {
      const { 
        courseId, 
        teeTime, 
        players, 
        selectedAddOnIds, // Array of add-on IDs
        customerName,
        customerEmail,
        customerPhone
      } = req.body;

      if (!courseId || !teeTime || !players) {
        return res.status(400).json({ error: "Missing required booking details" });
      }

      const numPlayers = parseInt(players, 10);
      if (isNaN(numPlayers) || numPlayers < 1 || numPlayers > 4) {
        return res.status(400).json({ error: "Invalid number of players" });
      }

      // Get course details from database
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Get add-ons from database to validate pricing
      const courseAddOns = await storage.getAddOnsByCourseId(courseId);
      
      // SECURITY: Get green fee from server-side cache (set when user clicked on slot)
      const cacheKey = `${courseId}:${teeTime}`;
      const cachedPrice = teeTimePriceCache.get(cacheKey);
      
      if (!cachedPrice) {
        return res.status(400).json({ 
          error: "Price not found. Please select a tee time again.",
          code: "PRICE_NOT_CACHED"
        });
      }
      
      if (cachedPrice.expiresAt < new Date()) {
        teeTimePriceCache.delete(cacheKey);
        return res.status(400).json({ 
          error: "Price expired. Please select a tee time again.",
          code: "PRICE_EXPIRED"
        });
      }
      
      const greenFeeCents = cachedPrice.priceCents;
      console.log(`[Stripe] Using cached green fee: €${greenFeeCents/100} for ${teeTime}`);

      // Build line items with SERVER-SIDE pricing only
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      let totalCents = 0;
      const addOnsJsonData: any[] = [];

      // Green fee line item - priced from server
      const greenFeeTotal = greenFeeCents * numPlayers;
      totalCents += greenFeeTotal;
      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name: `Green Fee - ${course.name}`,
            description: `${numPlayers} player${numPlayers > 1 ? 's' : ''} at ${new Date(teeTime).toLocaleString('en-GB', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}`,
          },
          unit_amount: greenFeeCents,
        },
        quantity: numPlayers,
      });

      // Add-on line items - validated against database pricing
      if (selectedAddOnIds && Array.isArray(selectedAddOnIds)) {
        for (const addOnId of selectedAddOnIds) {
          const addon = courseAddOns.find((a: { id: string }) => a.id === addOnId);
          if (!addon) {
            console.warn(`Add-on ${addOnId} not found for course ${courseId}`);
            continue;
          }

          let quantity = 1;
          if (addon.type === 'buggy_shared') {
            quantity = Math.ceil(numPlayers / 2);
          } else if (addon.perPlayer === 'true') {
            quantity = numPlayers;
          }

          const addOnTotal = addon.priceCents * quantity;
          totalCents += addOnTotal;

          lineItems.push({
            price_data: {
              currency: "eur",
              product_data: {
                name: addon.name,
                description: addon.description || undefined,
              },
              unit_amount: addon.priceCents,
            },
            quantity,
          });

          addOnsJsonData.push({
            id: addon.id,
            name: addon.name,
            type: addon.type,
            priceCents: addon.priceCents,
            quantity,
          });
        }
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${req.headers.origin}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/course/${courseId}`,
        customer_email: customerEmail || undefined,
        metadata: {
          courseId,
          courseName: course.name,
          teeTime,
          players: String(numPlayers),
          customerName: customerName || "",
          customerPhone: customerPhone || "",
          totalAmountCents: String(totalCents),
          addOnsJson: JSON.stringify(addOnsJsonData),
          greenFeeCents: String(greenFeeCents),
        },
      });

      res.json({ 
        sessionId: session.id,
        url: session.url 
      });
    } catch (error) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ 
        error: "Failed to create checkout session",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // GET /api/checkout-session/:sessionId - Get checkout session details
  app.get("/api/checkout-session/:sessionId", async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
        expand: ["line_items", "payment_intent"],
      });

      res.json({
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
      });
    } catch (error) {
      console.error("Stripe session retrieval error:", error);
      res.status(500).json({ error: "Failed to retrieve checkout session" });
    }
  });

  // POST /api/stripe-webhook - Handle Stripe webhooks
  // Note: Webhooks require STRIPE_WEBHOOK_SECRET to be configured for signature verification
  // For development, we also create bookings on success page load as fallback
  app.post("/api/stripe-webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // If no webhook secret configured, just acknowledge
    if (!webhookSecret) {
      console.log("Stripe webhook received but STRIPE_WEBHOOK_SECRET not configured");
      return res.json({ received: true });
    }

    try {
      const event = stripe.webhooks.constructEvent(req.body, sig as string, webhookSecret);

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`Payment successful for session ${session.id}`);
          
          // Create booking in database
          const metadata = session.metadata || {};
          if (metadata.courseId && metadata.teeTime) {
            try {
              const booking = await storage.createBooking({
                courseId: metadata.courseId,
                teeTime: metadata.teeTime,
                players: parseInt(metadata.players || "2", 10),
                customerName: metadata.customerName || "Guest",
                customerEmail: session.customer_email || "",
                customerPhone: metadata.customerPhone || "",
                userId: null,
                status: "CONFIRMED",
                paymentStatus: "paid",
                paymentIntentId: typeof session.payment_intent === 'string' 
                  ? session.payment_intent 
                  : session.payment_intent?.id || null,
                totalAmountCents: parseInt(metadata.totalAmountCents || "0", 10),
                addOnsJson: metadata.addOnsJson || null,
              });
              console.log(`✓ Booking created via webhook: ${booking.id}`);
              
              // Get course for emails
              const course = await storage.getCourseById(metadata.courseId);
              if (course) {
                // Send confirmation email to customer (non-blocking, graceful failure)
                const emailConfig = getEmailConfig();
                if (emailConfig && booking.customerEmail) {
                  try {
                    const bookingDetails: BookingDetails = {
                      id: booking.id,
                      courseName: course.name,
                      courseCity: course.city,
                      customerName: booking.customerName,
                      teeTime: new Date(booking.teeTime),
                      players: booking.players,
                      courseLat: course.lat ? String(course.lat) : null,
                      courseLng: course.lng ? String(course.lng) : null,
                      totalAmountCents: booking.totalAmountCents,
                    };
                    
                    const emailContent = bookingConfirmationEmail(bookingDetails);
                    
                    const transporter = nodemailer.createTransport({
                      host: emailConfig.host,
                      port: emailConfig.port,
                      secure: emailConfig.port === 465,
                      auth: {
                        user: emailConfig.user,
                        pass: emailConfig.pass,
                      },
                    });
                    
                    transporter.sendMail({
                      from: emailConfig.from,
                      to: booking.customerEmail,
                      subject: emailContent.subject,
                      html: emailContent.html,
                      text: emailContent.text,
                    }).then(() => {
                      console.log(`✓ Customer confirmation email sent to ${booking.customerEmail}`);
                      storage.createEmailLog({
                        bookingId: booking.id,
                        courseId: course.id,
                        emailType: "CUSTOMER_CONFIRMATION",
                        recipientEmail: booking.customerEmail,
                        recipientName: booking.customerName,
                        subject: emailContent.subject,
                        bodyText: emailContent.text,
                        bodyHtml: emailContent.html,
                        status: "SENT",
                      }).catch(e => console.warn("Failed to log customer confirmation email:", e));
                    }).catch((emailErr) => {
                      console.warn(`⚠ Failed to send customer confirmation email:`, emailErr instanceof Error ? emailErr.message : emailErr);
                    });
                  } catch (emailError) {
                    console.warn('⚠ Email sending setup failed:', emailError instanceof Error ? emailError.message : emailError);
                  }
                }
                
                // Send notification email to golf course (non-blocking)
                sendCourseBookingNotification(booking, course).catch(() => {});
              }
            } catch (err) {
              console.error("Error creating booking from webhook:", err);
            }
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`Payment failed: ${paymentIntent.id}`);
          break;
        }
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: "Webhook error" });
    }
  });

  // POST /api/simulate-payment - Simulate payment for test courses (development testing)
  // Only works for courses with "Test" in the name - bypasses Stripe for testing
  app.post("/api/simulate-payment", async (req: any, res) => {
    try {
      const { 
        courseId, 
        teeTime, 
        players, 
        selectedAddOnIds,
        customerName,
        customerEmail,
        customerPhone
      } = req.body;

      if (!courseId || !teeTime || !players) {
        return res.status(400).json({ error: "Missing required booking details" });
      }

      // Get course and verify it's a test course
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // SECURITY: Only allow simulation for test courses
      if (!course.name.toLowerCase().includes('test')) {
        return res.status(403).json({ 
          error: "Payment simulation only available for test courses",
          code: "NOT_TEST_COURSE"
        });
      }

      const numPlayers = parseInt(players, 10);
      if (isNaN(numPlayers) || numPlayers < 1 || numPlayers > 4) {
        return res.status(400).json({ error: "Invalid number of players" });
      }

      // Get cached price or use mock price for test course
      const cacheKey = `${courseId}:${teeTime}`;
      const cachedPrice = teeTimePriceCache.get(cacheKey);
      const greenFeeCents = cachedPrice?.priceCents || 5000; // Default €50 for test

      // Get add-ons from database
      const courseAddOns = await storage.getAddOnsByCourseId(courseId);
      let totalCents = greenFeeCents * numPlayers;
      const addOnsJsonData: any[] = [];

      if (selectedAddOnIds && Array.isArray(selectedAddOnIds)) {
        for (const addOnId of selectedAddOnIds) {
          const addon = courseAddOns.find((a: { id: string }) => a.id === addOnId);
          if (!addon) continue;

          let quantity = 1;
          if (addon.type === 'buggy_shared') {
            quantity = Math.ceil(numPlayers / 2);
          } else if (addon.perPlayer === 'true') {
            quantity = numPlayers;
          }

          totalCents += addon.priceCents * quantity;
          addOnsJsonData.push({
            id: addon.id,
            name: addon.name,
            type: addon.type,
            priceCents: addon.priceCents,
            quantity,
          });
        }
      }

      // Create simulated booking directly in database
      const simulatedPaymentId = `sim_${randomUUID().replace(/-/g, '').substring(0, 24)}`;
      
      const booking = await storage.createBooking({
        courseId,
        teeTime,
        players: numPlayers,
        customerName: customerName || "Test User",
        customerEmail: customerEmail || "test@example.com",
        customerPhone: customerPhone || "",
        userId: req.session?.userId || null,
        status: "CONFIRMED",
        paymentStatus: "paid",
        paymentIntentId: simulatedPaymentId,
        totalAmountCents: totalCents,
        addOnsJson: addOnsJsonData.length > 0 ? JSON.stringify(addOnsJsonData) : null,
      });

      console.log(`✓ Simulated payment booking created: ${booking.id} for ${course.name}`);
      
      // Send confirmation email to customer (non-blocking, graceful failure)
      const emailConfig = getEmailConfig();
      if (emailConfig && booking.customerEmail && booking.customerEmail !== "test@example.com") {
        try {
          const bookingDetails: BookingDetails = {
            id: booking.id,
            courseName: course.name,
            courseCity: course.city,
            customerName: booking.customerName,
            teeTime: new Date(booking.teeTime),
            players: booking.players,
            courseLat: course.lat ? String(course.lat) : null,
            courseLng: course.lng ? String(course.lng) : null,
            totalAmountCents: booking.totalAmountCents,
          };
          
          const emailContent = bookingConfirmationEmail(bookingDetails);
          
          const transporter = nodemailer.createTransport({
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.port === 465,
            auth: {
              user: emailConfig.user,
              pass: emailConfig.pass,
            },
          });
          
          transporter.sendMail({
            from: emailConfig.from,
            to: booking.customerEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          }).then(() => {
            console.log(`✓ Customer confirmation email sent to ${booking.customerEmail}`);
            storage.createEmailLog({
              bookingId: booking.id,
              courseId: course.id,
              emailType: "CUSTOMER_CONFIRMATION",
              recipientEmail: booking.customerEmail,
              recipientName: booking.customerName,
              subject: emailContent.subject,
              bodyText: emailContent.text,
              bodyHtml: emailContent.html,
              status: "SENT",
            }).catch(e => console.warn("Failed to log customer confirmation email:", e));
          }).catch((err) => {
            console.warn(`⚠ Failed to send customer confirmation email:`, err instanceof Error ? err.message : err);
          });
        } catch (emailError) {
          console.warn('⚠ Email sending setup failed:', emailError instanceof Error ? emailError.message : emailError);
        }
      }
      
      // Send notification email to golf course (non-blocking)
      sendCourseBookingNotification(booking, course).catch(() => {});

      res.json({ 
        booking,
        simulated: true,
        message: "Payment simulated successfully for test course"
      });
    } catch (error) {
      console.error("Simulate payment error:", error);
      res.status(500).json({ error: "Failed to simulate payment" });
    }
  });

  // POST /api/confirm-payment - Confirm payment and create booking (fallback for webhook)
  // Called from success page when webhook may not be configured
  app.post("/api/confirm-payment", async (req: any, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Missing session ID" });
      }

      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const metadata = session.metadata || {};
      
      // Check if booking already exists for this session (idempotency)
      const paymentIntentId = typeof session.payment_intent === 'string' 
        ? session.payment_intent 
        : session.payment_intent?.id;
      
      if (paymentIntentId) {
        const existingBookings = await storage.getAllBookings();
        const existingBooking = existingBookings.find(b => b.paymentIntentId === paymentIntentId);
        if (existingBooking) {
          console.log(`Booking already exists for payment ${paymentIntentId}: ${existingBooking.id}`);
          return res.json({ booking: existingBooking, alreadyExists: true });
        }
      }

      // Create booking
      if (!metadata.courseId || !metadata.teeTime) {
        return res.status(400).json({ error: "Missing booking metadata" });
      }

      const booking = await storage.createBooking({
        courseId: metadata.courseId,
        teeTime: metadata.teeTime,
        players: parseInt(metadata.players || "2", 10),
        customerName: metadata.customerName || "Guest",
        customerEmail: session.customer_email || "",
        customerPhone: metadata.customerPhone || "",
        userId: req.session?.userId || null,
        status: "CONFIRMED",
        paymentStatus: "paid",
        paymentIntentId: paymentIntentId || null,
        totalAmountCents: parseInt(metadata.totalAmountCents || "0", 10),
        addOnsJson: metadata.addOnsJson || null,
      });

      console.log(`✓ Booking confirmed via success page: ${booking.id}`);
      
      // Get course for emails
      const course = await storage.getCourseById(metadata.courseId);
      if (course) {
        // Send confirmation email to customer (non-blocking, graceful failure)
        const emailConfig = getEmailConfig();
        if (emailConfig && booking.customerEmail) {
          try {
            const bookingDetails: BookingDetails = {
              id: booking.id,
              courseName: course.name,
              courseCity: course.city,
              customerName: booking.customerName,
              teeTime: new Date(booking.teeTime),
              players: booking.players,
              courseLat: course.lat ? String(course.lat) : null,
              courseLng: course.lng ? String(course.lng) : null,
              totalAmountCents: booking.totalAmountCents,
            };
            
            const emailContent = bookingConfirmationEmail(bookingDetails);
            
            const transporter = nodemailer.createTransport({
              host: emailConfig.host,
              port: emailConfig.port,
              secure: emailConfig.port === 465,
              auth: {
                user: emailConfig.user,
                pass: emailConfig.pass,
              },
            });
            
            transporter.sendMail({
              from: emailConfig.from,
              to: booking.customerEmail,
              subject: emailContent.subject,
              html: emailContent.html,
              text: emailContent.text,
            }).then(() => {
              console.log(`✓ Customer confirmation email sent to ${booking.customerEmail}`);
              storage.createEmailLog({
                bookingId: booking.id,
                courseId: course.id,
                emailType: "CUSTOMER_CONFIRMATION",
                recipientEmail: booking.customerEmail,
                recipientName: booking.customerName,
                subject: emailContent.subject,
                bodyText: emailContent.text,
                bodyHtml: emailContent.html,
                status: "SENT",
              }).catch(e => console.warn("Failed to log customer confirmation email:", e));
            }).catch((emailErr) => {
              console.warn(`⚠ Failed to send customer confirmation email:`, emailErr instanceof Error ? emailErr.message : emailErr);
            });
          } catch (emailError) {
            console.warn('⚠ Email sending setup failed:', emailError instanceof Error ? emailError.message : emailError);
          }
        }
        
        // Send notification email to golf course (non-blocking)
        sendCourseBookingNotification(booking, course).catch(() => {});
      }
      
      res.json({ booking, alreadyExists: false });
    } catch (error) {
      console.error("Payment confirmation error:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  // GET /api/booking-requests/:id - Get booking by ID (Admin only)
  app.get("/api/booking-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const booking = await storage.getBookingById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // GET /api/booking-requests/:id/calendar/download - Download iCal file for booking (Public endpoint)
  app.get("/api/booking-requests/:id/calendar/download", async (req, res) => {
    try {
      const booking = await storage.getBookingById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const course = await storage.getCourseById(booking.courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Calculate end time (4 hours after start)
      const startTime = new Date(booking.teeTime);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 4);

      const eventDetails: CalendarEventDetails = {
        summary: `Golf at ${course.name}`,
        description: `Tee time booking for ${booking.players} ${booking.players === 1 ? 'player' : 'players'} at ${course.name}.\\n\\nBooking Reference: ${booking.id}\\n\\nBooked via Marbella Golf Times - Your Personal Guide to Costa del Sol Golf`,
        location: `${course.name}, ${course.city}, ${course.province}, Spain`,
        startTime: startTime,
        endTime: endTime,
        organizer: 'mailto:bookings@marbellagolftimes.com'
      };

      const icsContent = generateICalendar(eventDetails);

      // Set headers for file download
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="golf-${course.name.replace(/\s+/g, '-').toLowerCase()}-${booking.id.substring(0, 8)}.ics"`);
      res.send(icsContent);
    } catch (error) {
      console.error('Calendar generation error:', error);
      res.status(500).json({ error: "Failed to generate calendar file" });
    }
  });

  // GET /api/booking-requests/:id/calendar/google - Get Google Calendar URL for booking (Public endpoint)
  app.get("/api/booking-requests/:id/calendar/google", async (req, res) => {
    try {
      const booking = await storage.getBookingById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const course = await storage.getCourseById(booking.courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Calculate end time (4 hours after start)
      const startTime = new Date(booking.teeTime);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 4);

      const eventDetails: CalendarEventDetails = {
        summary: `Golf at ${course.name}`,
        description: `Tee time booking for ${booking.players} ${booking.players === 1 ? 'player' : 'players'} at ${course.name}.\n\nBooking Reference: ${booking.id}\n\nBooked via Marbella Golf Times - Your Personal Guide to Costa del Sol Golf`,
        location: `${course.name}, ${course.city}, ${course.province}, Spain`,
        startTime: startTime,
        endTime: endTime,
      };

      const googleCalendarUrl = generateGoogleCalendarUrl(eventDetails);

      res.json({ url: googleCalendarUrl });
    } catch (error) {
      console.error('Google calendar URL generation error:', error);
      res.status(500).json({ error: "Failed to generate Google Calendar URL" });
    }
  });

  // POST /api/affiliate-emails/send - Send affiliate partnership emails (Admin only)
  app.post("/api/affiliate-emails/send", isAuthenticated, async (req: any, res) => {
    try {
      const { courseIds, subject, body, senderName } = req.body;

      if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({ error: "courseIds array is required" });
      }

      if (courseIds.length > 10) {
        return res.status(400).json({ error: "Maximum 10 courses can be emailed at once" });
      }

      if (!subject || !body || !senderName) {
        return res.status(400).json({ error: "subject, body, and senderName are required" });
      }

      // Check if email config is available
      const emailConfig = getEmailConfig();
      if (!emailConfig) {
        return res.status(503).json({
          error: "Email service not configured. Please set SMTP environment variables.",
        });
      }

      const results = [];
      let sentCount = 0;
      let errorCount = 0;

      // Send email to each course
      for (const courseId of courseIds) {
        const course = await storage.getCourseById(courseId);
        if (!course) {
          results.push({ courseId, success: false, error: "Course not found" });
          errorCount++;
          continue;
        }

        // Generate tracking token for email open tracking
        const trackingToken = randomUUID();

        // Create affiliate email record with tracking token
        const affiliateEmail = await storage.createAffiliateEmail({
          courseId,
          subject,
          body,
          status: "DRAFT",
          errorMessage: null,
          trackingToken,
        });

        // Send email with tracking pixel
        const result = await sendAffiliateEmail(course, subject, body, senderName, emailConfig, trackingToken);

        if (result.success) {
          // Update record as sent
          await storage.updateAffiliateEmail(affiliateEmail.id, {
            status: "SENT",
            sentAt: new Date(),
          });
          
          // Automatically log the email in contact logs
          const personalizedSubject = subject.replace(/\[COURSE_NAME\]/g, course.name);
          const personalizedBody = body
            .replace(/\[COURSE_NAME\]/g, course.name)
            .replace(/\[SENDER_NAME\]/g, senderName);
          
          await storage.createContactLog({
            courseId,
            type: "EMAIL",
            direction: "OUTBOUND",
            subject: personalizedSubject,
            body: personalizedBody,
            outcome: null,
            loggedByUserId: req.user?.id || null,
          });
          
          // Update onboarding stage to OUTREACH_SENT
          await storage.updateOnboardingStage(courseId, "OUTREACH_SENT");
          
          results.push({ courseId, courseName: course.name, success: true });
          sentCount++;
        } else {
          // Update record with error
          await storage.updateAffiliateEmail(affiliateEmail.id, {
            status: "ERROR",
            errorMessage: result.error,
          });
          results.push({
            courseId,
            courseName: course.name,
            success: false,
            error: result.error,
          });
          errorCount++;
        }
      }

      res.json({
        sent: sentCount,
        errors: errorCount,
        total: courseIds.length,
        results,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to send affiliate emails" });
    }
  });

  // GET /api/affiliate-emails - Get all affiliate email records (Admin only)
  app.get("/api/affiliate-emails", isAuthenticated, async (req, res) => {
    try {
      const emails = await storage.getAllAffiliateEmails();
      res.json(emails);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch affiliate emails" });
    }
  });

  // GET /api/admin/sent-emails - Get all sent affiliate emails with course info (Admin only)
  app.get("/api/admin/sent-emails", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const emails = await storage.getAllAffiliateEmails();
      const courses = await storage.getAllCourses();
      
      // Map course info to emails
      const courseMap = new Map(courses.map(c => [c.id, c]));
      const sentEmailsWithCourse = emails.map(email => {
        const course = courseMap.get(email.courseId);
        return {
          ...email,
          courseName: course?.name || null,
          courseEmail: course?.email || null,
        };
      });
      
      res.json(sentEmailsWithCourse);
    } catch (error) {
      console.error("Failed to fetch sent emails:", error);
      res.status(500).json({ error: "Failed to fetch sent emails" });
    }
  });

  // GET /api/admin/affiliate-email-courses - Get all courses with affiliate email stats (Admin only)
  app.get("/api/admin/affiliate-email-courses", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const courses = await storage.getAffiliateEmailCourses();
      res.json(courses);
    } catch (error) {
      console.error("Failed to fetch affiliate email courses:", error);
      res.status(500).json({ error: "Failed to fetch affiliate email courses" });
    }
  });

  // GET /api/email/track/:token - Public tracking pixel endpoint (no auth required)
  app.get("/api/email/track/:token", async (req, res) => {
    try {
      const { token } = req.params;
      await storage.recordEmailOpen(token);
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.send(pixel);
    } catch (error) {
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      res.set('Content-Type', 'image/gif');
      res.send(pixel);
    }
  });

  // GET /api/providers - Get all tee time providers
  app.get("/api/providers", async (req, res) => {
    try {
      const providers = await storage.getAllProviders();
      res.json(providers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  });

  // ==================== Course Add-ons ====================

  // GET /api/courses/:courseId/add-ons - Get available add-ons for a course
  app.get("/api/courses/:courseId/add-ons", async (req, res) => {
    try {
      const { courseId } = req.params;
      const addOns = await storage.getAddOnsByCourseId(courseId);
      res.json(addOns);
    } catch (error) {
      console.error("Error fetching add-ons:", error);
      res.status(500).json({ error: "Failed to fetch add-ons" });
    }
  });

  // POST /api/courses/:courseId/add-ons - Create add-on (Admin only)
  app.post("/api/courses/:courseId/add-ons", isAdmin, async (req: any, res) => {
    try {
      const { courseId } = req.params;
      const { name, description, priceCents, type, perPlayer, sortOrder } = req.body;
      
      if (!name || !type || priceCents === undefined) {
        return res.status(400).json({ error: "name, type and priceCents are required" });
      }

      const addOn = await storage.createAddOn({
        courseId,
        name,
        description: description || null,
        priceCents: Number(priceCents),
        type,
        perPlayer: perPlayer === false ? "false" : "true",
        isActive: "true",
        sortOrder: sortOrder || 0,
      });
      res.status(201).json(addOn);
    } catch (error) {
      console.error("Error creating add-on:", error);
      res.status(500).json({ error: "Failed to create add-on" });
    }
  });

  // PATCH /api/add-ons/:id - Update add-on (Admin only)
  app.patch("/api/add-ons/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const addOn = await storage.updateAddOn(id, updates);
      if (!addOn) {
        return res.status(404).json({ error: "Add-on not found" });
      }
      res.json(addOn);
    } catch (error) {
      console.error("Error updating add-on:", error);
      res.status(500).json({ error: "Failed to update add-on" });
    }
  });

  // DELETE /api/add-ons/:id - Delete add-on (Admin only)
  app.delete("/api/add-ons/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteAddOn(id);
      if (!success) {
        return res.status(404).json({ error: "Add-on not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting add-on:", error);
      res.status(500).json({ error: "Failed to delete add-on" });
    }
  });

  // PATCH /api/booking-requests/:id/cancel - Cancel a booking (Authenticated users only, must own booking)
  app.patch("/api/booking-requests/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { cancellationReason } = req.body;
      
      // Get booking
      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check ownership - user must own the booking
      if (booking.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only cancel your own bookings" });
      }

      // Check if already cancelled
      if (booking.status === "CANCELLED") {
        return res.status(400).json({ error: "Booking is already cancelled" });
      }

      // Check if booking is in the past
      if (new Date(booking.teeTime) < new Date()) {
        return res.status(400).json({ error: "Cannot cancel past bookings" });
      }

      // Check 24-hour deadline
      const now = new Date();
      const teeTime = new Date(booking.teeTime);
      const hoursUntilTeeTime = (teeTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilTeeTime < 24) {
        return res.status(400).json({ 
          error: "Cancellations must be made at least 24 hours before tee time" 
        });
      }

      // Cancel the booking
      const updatedBooking = await storage.cancelBooking(id, cancellationReason);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // PATCH /api/booking-requests/:id/status - Update booking status (Admin only)
  app.patch("/api/booking-requests/:id/status", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validate status
      const validStatuses = ["PENDING", "ACCEPTED", "FULFILLED", "CONFIRMED", "CANCELLED"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }

      // Get booking to check if it exists
      const booking = await storage.getBookingById(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Update status
      const updatedBooking = await storage.updateBookingStatus(id, status);
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ error: "Failed to update booking status" });
    }
  });

  // POST /api/booking-requests/:id/rebook - Create new booking based on existing one (Authenticated)
  app.post("/api/booking-requests/:id/rebook", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { teeTime, players } = req.body;
      
      // Get original booking
      const originalBooking = await storage.getBookingById(id);
      if (!originalBooking) {
        return res.status(404).json({ error: "Original booking not found" });
      }

      // Check ownership - user must own the original booking
      if (originalBooking.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only rebook your own bookings" });
      }

      // Create new booking with same details but new tee time
      const newBooking = await storage.createBooking({
        userId: req.session.userId,
        courseId: originalBooking.courseId,
        teeTime: teeTime || originalBooking.teeTime.toISOString(),
        players: players || originalBooking.players,
        customerName: originalBooking.customerName,
        customerEmail: originalBooking.customerEmail,
        customerPhone: originalBooking.customerPhone,
        status: "PENDING",
      });

      res.json(newBooking);
    } catch (error) {
      console.error("Error rebooking:", error);
      res.status(500).json({ error: "Failed to create new booking" });
    }
  });

  // ===== COURSE REVIEWS =====

  // GET /api/courses/:courseId/reviews - Get all reviews for a course (Public)
  app.get("/api/courses/:courseId/reviews", async (req, res) => {
    try {
      const { courseId } = req.params;
      const reviews = await storage.getAllReviewsByCourseId(courseId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching course reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  // POST /api/courses/:courseId/reviews - Create a review (Authenticated)
  app.post("/api/courses/:courseId/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const { courseId } = req.params;

      // Check if course exists
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Validate review data with Zod schema
      const reviewData = {
        courseId,
        userId: req.session.userId,
        ...req.body,
      };

      const validatedData = insertCourseReviewSchema.parse(reviewData);
      const newReview = await storage.createReview(validatedData);

      res.json(newReview);
    } catch (error) {
      console.error("Error creating review:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid review data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // GET /api/reviews/booking/:bookingId - Get booking info for review page (Public)
  app.get("/api/reviews/booking/:bookingId", async (req, res) => {
    try {
      const { bookingId } = req.params;
      
      const booking = await storage.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      const course = await storage.getCourseById(booking.courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      res.json({
        booking: {
          id: booking.id,
          customerName: booking.customerName,
          teeTime: booking.teeTime,
          players: booking.players,
          userId: booking.userId,
        },
        course: {
          id: course.id,
          name: course.name,
          city: course.city,
          imageUrl: course.imageUrl,
        }
      });
    } catch (error) {
      console.error("Error fetching booking for review:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // POST /api/reviews - Create a review from public link (Public - uses booking's userId)
  app.post("/api/reviews", async (req, res) => {
    try {
      const { bookingId, courseId, rating, title, review } = req.body;
      
      if (!bookingId || !courseId || !rating) {
        return res.status(400).json({ error: "Missing required fields: bookingId, courseId, rating" });
      }
      
      // Validate rating
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      // Fetch the booking to get userId
      const booking = await storage.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Check if course exists
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      // Verify booking matches the course
      if (booking.courseId !== courseId) {
        return res.status(400).json({ error: "Booking does not match the specified course" });
      }
      
      // Use booking's userId if available, otherwise we need to handle it
      if (!booking.userId) {
        return res.status(400).json({ 
          error: "This booking was made as a guest. Please log in to submit a review.",
          requiresLogin: true 
        });
      }
      
      const reviewData = {
        courseId,
        userId: booking.userId,
        rating: Math.round(rating),
        title: title || null,
        review: review || null,
        photoUrls: [],
      };
      
      const validatedData = insertCourseReviewSchema.parse(reviewData);
      const newReview = await storage.createReview(validatedData);
      
      res.json(newReview);
    } catch (error) {
      console.error("Error creating review:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid review data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  // ===== TESTIMONIALS =====

  // POST /api/testimonials - Create testimonial (Authenticated)
  app.post("/api/testimonials", isAuthenticated, async (req: any, res) => {
    try {
      // Validate testimonial data with Zod schema
      const testimonialData = {
        userId: req.session.userId,
        ...req.body,
      };

      const validatedData = insertTestimonialSchema.parse(testimonialData);
      const testimonial = await storage.createTestimonial(validatedData);

      res.json(testimonial);
    } catch (error) {
      console.error("Error creating testimonial:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid testimonial data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create testimonial" });
    }
  });

  // GET /api/testimonials - Get approved testimonials (Public)
  app.get("/api/testimonials", async (req, res) => {
    try {
      const testimonials = await storage.getApprovedTestimonials();
      res.json(testimonials);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      res.status(500).json({ error: "Failed to fetch testimonials" });
    }
  });

  // ===== SENDGRID INBOUND EMAIL WEBHOOK =====
  // This endpoint receives parsed inbound emails from SendGrid Inbound Parse
  // Uses multer to handle SendGrid's multipart form data
  const inboundEmailParser = multer({ storage: multer.memoryStorage() });
  
  app.post("/api/webhooks/inbound-email", inboundEmailParser.any(), async (req, res) => {
    // Write debug info to file for persistence
    const fs = await import('fs');
    const { simpleParser } = await import('mailparser');
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body || {}),
      filesCount: (req.files as Express.Multer.File[] | undefined)?.length || 0,
      files: (req.files as Express.Multer.File[] | undefined)?.map(f => ({ 
        fieldname: f.fieldname, 
        originalname: f.originalname, 
        mimetype: f.mimetype, 
        size: f.size 
      })) || [],
      attachmentInfo: req.body['attachment-info'] || null,
      from: req.body.from,
      subject: req.body.subject,
      hasRawEmail: !!req.body.email
    };
    
    fs.writeFileSync('/tmp/webhook_debug.json', JSON.stringify(debugInfo, null, 2));
    console.log("[Webhook] Debug info written to /tmp/webhook_debug.json");
    console.log("[Webhook] ========== INBOUND EMAIL RECEIVED ==========");
    console.log("[Webhook] Content-Type:", req.headers['content-type']);
    console.log("[Webhook] Body keys:", Object.keys(req.body || {}));
    console.log("[Webhook] Files count:", debugInfo.filesCount);
    console.log("[Webhook] Has raw email field:", !!req.body.email);
    
    // Log attachment info from SendGrid
    if (req.body['attachment-info']) {
      console.log("[Webhook] Attachment-info from SendGrid:", req.body['attachment-info']);
    } else {
      console.log("[Webhook] NO attachment-info field in request body");
    }
    
    try {
      let from: string, to: string, subject: string, text: string | undefined, html: string | undefined, headers: string;
      let parsedAttachments: { filename: string; contentType: string; content: Buffer; size: number }[] = [];
      
      // Check if this is raw MIME mode (when "POST the raw, full MIME message" is enabled)
      if (req.body.email) {
        console.log("[Webhook] Parsing raw MIME email...");
        const parsed = await simpleParser(req.body.email);
        
        from = parsed.from?.text || '';
        to = parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to.text) || '' : '';
        subject = parsed.subject || '';
        text = parsed.text || undefined;
        html = parsed.html || undefined;
        headers = parsed.headerLines?.map(h => `${h.key}: ${h.line}`).join('\n') || '';
        
        // Extract attachments from parsed email
        if (parsed.attachments && parsed.attachments.length > 0) {
          console.log(`[Webhook] Found ${parsed.attachments.length} attachments in raw MIME`);
          parsedAttachments = parsed.attachments.map(att => ({
            filename: att.filename || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            content: att.content,
            size: att.size
          }));
        }
        
        console.log(`[Webhook] Parsed raw MIME - from: ${from}, subject: ${subject}, text length: ${text?.length || 0}, attachments: ${parsedAttachments.length}`);
      } else {
        // Standard parsed mode
        ({ from, to, subject, text, html, headers } = req.body);
      }
      
      // Extract email address from various formats
      const extractEmail = (emailStr: string): string => {
        if (!emailStr) return "";
        const cleaned = emailStr.replace(/^["']|["']$/g, "").trim();
        const bracketMatch = cleaned.match(/<([^>]+)>/);
        if (bracketMatch) return bracketMatch[1].toLowerCase().trim();
        const emailMatch = cleaned.match(/[\w.-]+@[\w.-]+\.\w+/);
        return emailMatch ? emailMatch[0].toLowerCase().trim() : "";
      };
      
      const fromEmail = extractEmail(from);
      
      if (!fromEmail) {
        console.log("[Webhook] ERROR: No sender email found");
        return res.status(200).send("OK");
      }
      
      console.log(`[Webhook] Processing email from ${fromEmail}, subject: ${subject}`);
      
      // Parse headers for threading
      const headerLines = (headers || "").split("\n");
      let messageId: string | null = null;
      let inReplyTo: string | null = null;
      
      for (const line of headerLines) {
        if (line.toLowerCase().startsWith("message-id:")) {
          messageId = line.substring(11).trim();
        } else if (line.toLowerCase().startsWith("in-reply-to:")) {
          inReplyTo = line.substring(12).trim();
        }
      }
      
      console.log(`[Webhook] Email headers - messageId: ${messageId}, inReplyTo: ${inReplyTo}`);
      
      // Try to find existing thread by email headers
      let thread = await storage.findThreadByEmailHeaders(messageId, inReplyTo, fromEmail);
      
      // Try to match to a course by email
      let courseId: string | null = null;
      
      // First, inherit courseId from existing thread if available
      if (thread?.courseId) {
        courseId = thread.courseId;
        console.log(`[Webhook] Using courseId from existing thread: ${courseId}`);
      }
      
      // If no courseId from thread, try to match by email domain
      if (!courseId) {
        const allCourses = await storage.getAllCourses();
        const emailDomain = fromEmail.split("@")[1];
        
        for (const course of allCourses) {
          if (course.email) {
            const courseEmail = extractEmail(course.email);
            const courseDomain = courseEmail.split("@")[1];
            if (courseEmail === fromEmail || courseDomain === emailDomain) {
              courseId = course.id;
              break;
            }
          }
        }
      }
      
      // Get email body
      let emailBody = text;
      if (!emailBody && html) {
        emailBody = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      }
      emailBody = emailBody || "(No content)";
      
      // Create new thread if none exists
      if (!thread) {
        thread = await storage.createInboundThread({
          courseId: courseId,
          fromEmail: fromEmail,
          subject: subject || "(No subject)",
          status: "OPEN",
          isRead: "false",
          requiresResponse: "true",
        });
        console.log(`[Webhook] Created new thread ${thread.id}`);
      } else {
        // Update existing thread: reopen and mark as requiring response
        await storage.updateInboundThread(thread.id, {
          status: "OPEN",
          requiresResponse: "true",
          isRead: "false",
        });
        console.log(`[Webhook] Updated existing thread ${thread.id}`);
      }
      
      // Process email attachments first to build attachmentsJson
      const files = req.files as Express.Multer.File[] | undefined;
      let attachmentCount = 0;
      const attachmentsList: { name: string; size: number; type: string; documentId?: string }[] = [];
      const objectStorage = new ObjectStorageService();
      
      // Handle attachments from raw MIME parsing first
      if (parsedAttachments.length > 0) {
        console.log(`[Webhook] Processing ${parsedAttachments.length} attachment(s) from raw MIME`);
        
        for (const att of parsedAttachments) {
          try {
            const timestamp = Date.now();
            const safeFilename = att.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            
            console.log(`[Webhook] Processing attachment: ${safeFilename} (${att.size} bytes)`);
            
            const attachmentInfo: { name: string; size: number; type: string; documentId?: string } = {
              name: safeFilename,
              size: att.size,
              type: att.contentType,
            };
            
            // If we have a courseId, upload to object storage and create document
            if (courseId) {
              const storagePath = `courses/${courseId}/documents/email-${timestamp}-${safeFilename}`;
              const fileUrl = await objectStorage.uploadPrivateFile(storagePath, att.content, att.contentType);
              
              const doc = await storage.createCourseDocument({
                courseId,
                name: `Email: ${safeFilename}`,
                fileName: safeFilename,
                fileUrl,
                fileType: att.contentType,
                fileSize: att.size,
                category: "email_attachment",
                notes: `Automatically imported from email: "${subject || 'No subject'}" from ${fromEmail}`,
                uploadedById: null,
              });
              
              attachmentInfo.documentId = doc.id;
              console.log(`[Webhook] Saved attachment as document: ${safeFilename} (doc id: ${doc.id})`);
            }
            
            attachmentsList.push(attachmentInfo);
            attachmentCount++;
          } catch (attachError) {
            console.error(`[Webhook] Error processing attachment ${att.filename}:`, attachError);
          }
        }
      }
      // Handle attachments from multer (non-raw mode)
      else if (files && files.length > 0) {
        console.log(`[Webhook] Found ${files.length} file(s) in request`);
        
        for (const file of files) {
          try {
            // Skip non-file attachments (SendGrid may send text fields as files)
            if (!file.buffer || file.size === 0) {
              console.log(`[Webhook] Skipping empty file: ${file.fieldname}`);
              continue;
            }
            
            // Generate unique filename for storage
            const timestamp = Date.now();
            const safeFilename = (file.originalname || file.fieldname || 'attachment').replace(/[^a-zA-Z0-9.-]/g, '_');
            
            console.log(`[Webhook] Processing attachment: ${safeFilename} (${file.size} bytes)`);
            
            // Track attachment in list
            const attachmentInfo: { name: string; size: number; type: string; documentId?: string } = {
              name: safeFilename,
              size: file.size,
              type: file.mimetype || 'application/octet-stream',
            };
            
            // If we have a courseId, upload to object storage and create document
            if (courseId) {
              const storagePath = `courses/${courseId}/documents/email-${timestamp}-${safeFilename}`;
              const fileUrl = await objectStorage.uploadPrivateFile(storagePath, file.buffer, file.mimetype || 'application/octet-stream');
              
              // Create course document record
              const doc = await storage.createCourseDocument({
                courseId,
                name: `Email: ${safeFilename}`,
                fileName: safeFilename,
                fileUrl,
                fileType: file.mimetype || 'application/octet-stream',
                fileSize: file.size,
                category: "email_attachment",
                notes: `Automatically imported from email: "${subject || 'No subject'}" from ${fromEmail}`,
                uploadedById: null,
              });
              
              attachmentInfo.documentId = doc.id;
              console.log(`[Webhook] Saved attachment as document: ${safeFilename} (doc id: ${doc.id})`);
            }
            
            attachmentsList.push(attachmentInfo);
            attachmentCount++;
          } catch (attachError) {
            console.error(`[Webhook] Error processing attachment ${file.originalname}:`, attachError);
            // Continue with other attachments
          }
        }
      }
      
      if (attachmentCount > 0) {
        console.log(`[Webhook] Processed ${attachmentCount} attachment(s), ${courseId ? 'saved as documents' : 'not saved (no course match)'}`);
      }
      
      // Create the inbound email message with attachments info
      await storage.createInboundEmail({
        threadId: thread.id,
        direction: "IN",
        fromEmail: fromEmail,
        toEmail: to || process.env.FROM_EMAIL || "info@marbellagolftimes.com",
        subject: subject || "(No subject)",
        bodyText: emailBody,
        bodyHtml: html || null,
        messageId: messageId,
        inReplyTo: inReplyTo,
        attachmentsJson: attachmentsList.length > 0 ? JSON.stringify(attachmentsList) : null,
      });
      
      console.log(`[Webhook] Email saved to thread ${thread.id}${attachmentCount > 0 ? ` with ${attachmentCount} attachment(s)` : ''}`);
      
      // Always return 200 to SendGrid to acknowledge receipt
      res.status(200).json({ success: true, threadId: thread.id, attachmentsSaved: attachmentCount });
    } catch (error) {
      console.error("[Webhook] Error processing inbound email:", error);
      // Still return 200 to prevent SendGrid retries
      res.status(200).send("OK");
    }
  });

  // ============================================================
  // EXTERNAL API v1 - For AI CEO and External Integrations
  // ============================================================
  // All endpoints require X-API-Key header authentication
  // Scopes: read:courses, read:bookings, write:bookings, read:analytics, read:users

  // Helper function to determine management tool type from provider links
  const getManagementToolType = (providerLinks: { providerCourseCode: string | null }[]): string | null => {
    for (const link of providerLinks) {
      if (link.providerCourseCode) {
        if (link.providerCourseCode.startsWith("golfmanagerv3:")) {
          return "golfmanager_v3";
        } else if (link.providerCourseCode.startsWith("golfmanager:")) {
          return "golfmanager_v1";
        } else if (link.providerCourseCode.startsWith("teeone:")) {
          return "teeone";
        }
      }
    }
    return null;
  };

  // GET /api/v1/external/courses - List all courses with images
  app.get("/api/v1/external/courses", isApiKeyAuthenticated, requireScope("read:courses"), async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      
      // Get images and provider info for each course
      const coursesWithImages = await Promise.all(
        courses.map(async (course) => {
          const images = await storage.getImagesByCourseId(course.id);
          const providerLinks = await storage.getLinksByCourseId(course.id);
          const managementTool = getManagementToolType(providerLinks);
          
          return {
            id: course.id,
            name: course.name,
            city: course.city,
            province: course.province,
            country: course.country,
            lat: course.lat,
            lng: course.lng,
            websiteUrl: course.websiteUrl,
            bookingUrl: course.bookingUrl,
            email: course.email,
            phone: course.phone,
            notes: course.notes,
            imageUrl: course.imageUrl,
            facilities: course.facilities,
            kickbackPercent: course.kickbackPercent,
            membersOnly: course.membersOnly,
            managementTool: managementTool, // golfmanager_v1, golfmanager_v3, teeone, or null
            images: images.map(img => ({
              id: img.id,
              imageUrl: img.imageUrl,
              caption: img.caption,
              sortOrder: img.sortOrder,
            })),
          };
        })
      );
      
      res.json({
        success: true,
        count: coursesWithImages.length,
        data: coursesWithImages,
      });
    } catch (error) {
      console.error("External API - Get courses error:", error);
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  // GET /api/v1/external/courses/:id - Get single course with full details
  app.get("/api/v1/external/courses/:id", isApiKeyAuthenticated, requireScope("read:courses"), async (req, res) => {
    try {
      const course = await storage.getCourseById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      const images = await storage.getImagesByCourseId(course.id);
      const reviews = await storage.getAllReviewsByCourseId(course.id);
      const providerLinks = await storage.getLinksByCourseId(course.id);
      const managementTool = getManagementToolType(providerLinks);
      
      res.json({
        success: true,
        data: {
          ...course,
          managementTool: managementTool, // golfmanager_v1, golfmanager_v3, teeone, or null
          images: images.map(img => ({
            id: img.id,
            imageUrl: img.imageUrl,
            caption: img.caption,
            sortOrder: img.sortOrder,
          })),
          reviews: reviews.map(r => ({
            id: r.id,
            rating: r.rating,
            review: r.review,
            createdAt: r.createdAt,
          })),
          averageRating: reviews.length > 0 
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
            : null,
          reviewCount: reviews.length,
        },
      });
    } catch (error) {
      console.error("External API - Get course error:", error);
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // GET /api/v1/external/bookings - List all bookings
  app.get("/api/v1/external/bookings", isApiKeyAuthenticated, requireScope("read:bookings"), async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      const courses = await storage.getAllCourses();
      const courseMap = new Map(courses.map(c => [c.id, c]));
      
      const enrichedBookings = bookings.map(booking => ({
        id: booking.id,
        status: booking.status,
        courseId: booking.courseId,
        courseName: courseMap.get(booking.courseId)?.name || "Unknown",
        teeTime: booking.teeTime,
        players: booking.players,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        estimatedPrice: booking.estimatedPrice,
        userId: booking.userId,
        createdAt: booking.createdAt,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason,
      }));
      
      res.json({
        success: true,
        count: enrichedBookings.length,
        data: enrichedBookings,
      });
    } catch (error) {
      console.error("External API - Get bookings error:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // GET /api/v1/external/bookings/:id - Get single booking
  app.get("/api/v1/external/bookings/:id", isApiKeyAuthenticated, requireScope("read:bookings"), async (req, res) => {
    try {
      const booking = await storage.getBookingById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      const course = await storage.getCourseById(booking.courseId);
      
      res.json({
        success: true,
        data: {
          ...booking,
          courseName: course?.name || "Unknown",
          courseDetails: course ? {
            id: course.id,
            name: course.name,
            city: course.city,
            email: course.email,
            phone: course.phone,
          } : null,
        },
      });
    } catch (error) {
      console.error("External API - Get booking error:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // POST /api/v1/external/bookings - Create new booking
  app.post("/api/v1/external/bookings", isApiKeyAuthenticated, requireScope("write:bookings"), async (req, res) => {
    try {
      const bookingSchema = z.object({
        courseId: z.string().uuid("Invalid course ID"),
        teeTime: z.string().datetime("Invalid tee time format (use ISO 8601)"),
        players: z.number().int().min(1).max(4),
        customerName: z.string().min(1, "Customer name is required"),
        customerEmail: z.string().email("Invalid email"),
        customerPhone: z.string().optional(),
        estimatedPrice: z.number().optional(),
        userId: z.string().optional(),
      });
      
      const parsed = bookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Validation failed",
          details: parsed.error.errors,
        });
      }
      
      // Verify course exists
      const course = await storage.getCourseById(parsed.data.courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      const booking = await storage.createBooking({
        courseId: parsed.data.courseId,
        teeTime: parsed.data.teeTime,
        players: parsed.data.players,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        customerPhone: parsed.data.customerPhone || null,
        estimatedPrice: parsed.data.estimatedPrice || null,
        userId: parsed.data.userId || null,
        status: "PENDING",
      });
      
      res.status(201).json({
        success: true,
        data: {
          ...booking,
          courseName: course.name,
        },
      });
    } catch (error) {
      console.error("External API - Create booking error:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // PATCH /api/v1/external/bookings/:id/status - Update booking status
  app.patch("/api/v1/external/bookings/:id/status", isApiKeyAuthenticated, requireScope("write:bookings"), async (req, res) => {
    try {
      const { status } = req.body;
      const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED"];
      
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ 
          error: "Invalid status",
          validStatuses,
        });
      }
      
      const booking = await storage.getBookingById(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      
      const updated = await storage.updateBookingStatus(req.params.id, status);
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      console.error("External API - Update booking status error:", error);
      res.status(500).json({ error: "Failed to update booking status" });
    }
  });

  // GET /api/v1/external/analytics - Get analytics summary
  // NOTE: This endpoint exposes full revenue/ROI data. Only grant read:analytics scope to trusted integrations.
  app.get("/api/v1/external/analytics", isApiKeyAuthenticated, requireScope("read:analytics"), async (req, res) => {
    try {
      const [revenue, popularCourses, roiAnalytics, bookingsDaily, bookingsWeekly, bookingsMonthly] = await Promise.all([
        storage.getRevenueAnalytics(),
        storage.getPopularCourses(10),
        storage.getROIAnalytics(),
        storage.getBookingsAnalytics("day"),
        storage.getBookingsAnalytics("week"),
        storage.getBookingsAnalytics("month"),
      ]);
      
      res.json({
        success: true,
        data: {
          revenue,
          roi: roiAnalytics,
          popularCourses,
          bookingTrends: {
            daily: bookingsDaily,
            weekly: bookingsWeekly,
            monthly: bookingsMonthly,
          },
        },
      });
    } catch (error) {
      console.error("External API - Get analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // GET /api/v1/external/users - List all users (excludes sensitive data)
  app.get("/api/v1/external/users", isApiKeyAuthenticated, requireScope("read:users"), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Remove sensitive data
      const safeUsers = allUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      }));
      
      res.json({
        success: true,
        count: safeUsers.length,
        data: safeUsers,
      });
    } catch (error) {
      console.error("External API - Get users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // GET /api/v1/external/slots - Search tee time slots
  app.get("/api/v1/external/slots", isApiKeyAuthenticated, requireScope("read:courses"), async (req, res) => {
    try {
      const { date, courseId, players } = req.query;
      
      if (!date) {
        return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)" });
      }
      
      // Use the existing slot search logic
      const searchDate = new Date(date as string);
      if (isNaN(searchDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      // Get courses to search
      let coursesToSearch: GolfCourse[];
      if (courseId) {
        const course = await storage.getCourseById(courseId as string);
        if (!course) {
          return res.status(404).json({ error: "Course not found" });
        }
        coursesToSearch = [course];
      } else {
        coursesToSearch = await storage.getAllCourses();
      }
      
      // Generate mock slots for now (in production, would call real provider APIs)
      const results: CourseWithSlots[] = [];
      
      for (const course of coursesToSearch) {
        const slots: TeeTimeSlot[] = [];
        
        // Generate sample slots
        for (let hour = 7; hour <= 16; hour++) {
          for (let minute = 0; minute < 60; minute += 10) {
            const slotTime = new Date(searchDate);
            slotTime.setHours(hour, minute, 0, 0);
            
            slots.push({
              teeTime: slotTime.toISOString(),
              greenFee: Math.floor(Math.random() * 100) + 50,
              currency: "EUR",
              players: parseInt(players as string) || 4,
              holes: 18,
              source: "api",
              teeName: hour < 10 ? "TEE 1" : "TEE 10",
              slotsAvailable: Math.floor(Math.random() * 4) + 1,
            });
          }
        }
        
        results.push({
          courseId: course.id,
          courseName: course.name,
          distanceKm: 0,
          bookingUrl: course.bookingUrl || undefined,
          slots,
          providerType: "API",
          providerName: "golfmanager",
        });
      }
      
      res.json({
        success: true,
        date: date,
        count: results.length,
        data: results,
      });
    } catch (error) {
      console.error("External API - Get slots error:", error);
      res.status(500).json({ error: "Failed to fetch slots" });
    }
  });

  // ============================================================
  // OnTee-inspired Booking API (TeeOne Integration)
  // ============================================================
  // These endpoints mirror OnTee's booking flow for TeeOne courses

  // POST /api/v1/bookings/available - Get available tee times from TeeOne
  app.post("/api/v1/bookings/available", async (req, res) => {
    try {
      const { facilityId, courseId, date, players, holes, fromTime, toTime } = req.body || {};

      if (!facilityId || !date || !players) {
        return res.status(400).json({
          error: "facilityId, date and players are required in the request body"
        });
      }

      // Find the course by facilityId (course name or ID)
      let course: GolfCourse | undefined;
      const allCourses = await storage.getAllCourses();
      
      // Try to match by name (facilityId) or by ID
      course = allCourses.find(c => 
        c.name.toLowerCase().includes(facilityId.toLowerCase()) ||
        c.id === facilityId
      );

      if (!course) {
        return res.status(404).json({ error: `Course not found: ${facilityId}` });
      }

      // Check if this is a TeeOne course
      const providerLinks = await storage.getLinksByCourseId(course.id);
      const teeoneLink = providerLinks.find(link => 
        link.providerCourseCode?.startsWith("teeone:")
      );

      if (!teeoneLink) {
        return res.status(400).json({ 
          error: `Course "${course.name}" does not use TeeOne booking system`,
          managementTool: getManagementToolType(providerLinks)
        });
      }

      // Extract tenant from providerCourseCode (e.g., "teeone:paraiso" -> "paraiso")
      const tenant = teeoneLink.providerCourseCode!.replace("teeone:", "");
      
      console.log(`[OnTee API] Fetching availability for ${course.name} (tenant: ${tenant}) on ${date}`);

      // Build TeeOne credentials from course data if available
      const credentials = course.teeoneIdEmpresa && course.teeoneApiUser && course.teeoneApiPassword ? {
        idEmpresa: course.teeoneIdEmpresa,
        idTeeSheet: course.teeoneIdTeeSheet || 1,
        apiUser: course.teeoneApiUser,
        apiPassword: course.teeoneApiPassword,
      } : null;

      // Fetch availability from TeeOne API (or mock data if no credentials)
      const teeTimeSlots = await teeoneClient.searchAvailability(
        credentials,
        date,
        players,
        holes || 18,
        fromTime,
        toTime
      );

      // Convert to OnTee-style slot format
      const slots = teeTimeSlots.map((slot, index) => {
        const slotId = `${course!.id}-${tenant}-${slot.teeTime}`;
        const slotTime = slot.teeTime.split("T")[1]?.substring(0, 5) || "00:00";
        
        return {
          slotId,
          facilityId: course!.name,
          courseId: course!.id,
          tenant,
          date,
          time: slotTime,
          holes: slot.holes || holes || 18,
          requestedPlayers: players,
          availableSpots: 4, // TeeOne doesn't return this, default to 4
          greenFee: {
            amount: slot.greenFee || 0,
            currency: slot.currency || "EUR"
          },
          source: "teeone",
          rawProviderData: slot
        };
      });

      console.log(`[OnTee API] Retrieved ${slots.length} slots for ${course.name}`);

      res.json({ 
        success: true,
        course: {
          id: course.id,
          name: course.name,
          tenant,
          managementTool: "teeone"
        },
        slots 
      });
    } catch (error) {
      console.error("[OnTee API] Availability error:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // POST /api/v1/orders/items - Create/update an order with a selected tee time
  app.post("/api/v1/orders/items", async (req, res) => {
    try {
      const { slotId, players, greenFee, extras, orderId } = req.body || {};

      if (!slotId || !players) {
        return res.status(400).json({
          error: "slotId and players are required in the request body"
        });
      }

      // Parse slotId to extract course info
      // Format: courseId-tenant-teeTime where courseId is UUID (contains dashes)
      // Example: 35bfec83-5c4c-4e39-8d4f-bb83c64f69b2-paraiso-2025-12-10T09:00:00
      // Strategy: Find tenant code (after 5th dash if UUID format) then split
      const parts = slotId.split("-");
      
      // UUID has 5 parts (e.g., 35bfec83-5c4c-4e39-8d4f-bb83c64f69b2)
      // So courseId = parts[0..4], tenant = parts[5], teeTime = parts[6..]
      if (parts.length < 7) {
        return res.status(400).json({ error: "Invalid slotId format. Expected: courseId-tenant-teeTime" });
      }

      const courseId = parts.slice(0, 5).join("-"); // UUID format
      const tenant = parts[5];
      const teeTime = parts.slice(6).join("-"); // Remaining parts are the teeTime

      // Get course info
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Use provided greenFee or default
      const finalGreenFee = greenFee?.amount 
        ? greenFee 
        : { amount: 80, currency: "EUR" };

      // Calculate total
      let totalAmount = finalGreenFee.amount * players;
      const extrasArray = extras || [];
      for (const extra of extrasArray) {
        totalAmount += extra.amount || 0;
      }

      // Create or update order
      const newOrderId = orderId || randomUUID();
      let hold = teeTimeHolds.get(newOrderId);

      if (!hold) {
        // Create new hold with 15 minute expiry
        const date = teeTime.split("T")[0] || new Date().toISOString().split("T")[0];
        const time = teeTime.split("T")[1]?.substring(0, 5) || "00:00";

        hold = {
          orderId: newOrderId,
          courseId,
          tenant,
          slotId,
          teeTime,
          date,
          time,
          players,
          holes: 18,
          greenFee: finalGreenFee,
          extras: extrasArray,
          total: { amount: totalAmount, currency: finalGreenFee.currency },
          status: "HELD",
          holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min hold
          createdAt: new Date(),
        };
        teeTimeHolds.set(newOrderId, hold);
        console.log(`[OnTee API] Created new hold: ${newOrderId} for ${course.name}`);
      } else {
        // Update existing hold
        hold.greenFee = finalGreenFee;
        hold.extras = extrasArray;
        hold.total = { amount: totalAmount, currency: finalGreenFee.currency };
        hold.players = players;
        console.log(`[OnTee API] Updated hold: ${newOrderId}`);
      }

      res.json({
        orderId: hold.orderId,
        course: {
          id: course.id,
          name: course.name,
          tenant
        },
        items: [{
          itemId: randomUUID(),
          slotId,
          teeTime,
          players,
          greenFee: hold.greenFee,
          extras: hold.extras
        }],
        total: hold.total,
        status: hold.status,
        holdExpiresAt: hold.holdExpiresAt.toISOString()
      });
    } catch (error) {
      console.error("[OnTee API] Order items error:", error);
      res.status(500).json({ error: "Failed to create/update order" });
    }
  });

  // POST /api/v1/bookings/confirm - Confirm booking (after payment)
  app.post("/api/v1/bookings/confirm", async (req, res) => {
    try {
      const { orderId, customer, payment } = req.body || {};

      if (!orderId || !customer) {
        return res.status(400).json({
          error: "orderId and customer are required in the request body"
        });
      }

      // Find the hold
      const hold = teeTimeHolds.get(orderId);
      if (!hold) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (hold.status === "EXPIRED") {
        return res.status(410).json({ error: "Hold has expired. Please select a new tee time." });
      }

      if (hold.status === "CONFIRMED") {
        return res.status(400).json({ error: "Booking already confirmed", bookingId: hold.bookingId });
      }

      // Get course info
      const course = await storage.getCourseById(hold.courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Validate customer info
      if (!customer.firstName || !customer.lastName || !customer.email) {
        return res.status(400).json({ 
          error: "Customer firstName, lastName, and email are required" 
        });
      }

      // Update hold with customer and payment info
      hold.customer = customer;
      hold.payment = payment || { method: "pending", status: "pending" };
      hold.status = "CONFIRMED";

      // Create actual booking in the database
      const bookingData = {
        courseId: hold.courseId,
        teeTime: hold.teeTime,
        players: hold.players,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
        customerPhone: customer.phone || null,
        estimatedPrice: hold.total.amount,
        status: "CONFIRMED",
      };

      const booking = await storage.createBooking(bookingData);
      hold.bookingId = booking.id;

      console.log(`[OnTee API] Booking confirmed: ${booking.id} for ${course.name}`);

      // Sync booking to external provider (Zest/TeeOne) - non-blocking
      syncBookingToProvider(booking, course).then(async (syncResult) => {
        try {
          if (syncResult.provider) {
            await storage.updateBookingSyncStatus(
              booking.id,
              syncResult.success ? "success" : "failed",
              syncResult.error || null,
              syncResult.providerBookingId || null
            );
            console.log(`[BookingSync] Updated sync status for booking ${booking.id}: ${syncResult.success ? "success" : "failed"}`);
          }
        } catch (err) {
          console.error(`[BookingSync] Failed to update sync status for booking ${booking.id}:`, err);
        }
      }).catch((err) => {
        console.error(`[BookingSync] Error syncing booking ${booking.id}:`, err);
      });

      // Generate voucher URL (placeholder - in production this would be a real PDF)
      const voucherUrl = `/api/bookings/${booking.id}/voucher`;

      res.json({
        success: true,
        bookingId: booking.id,
        status: "CONFIRMED",
        orderId: hold.orderId,
        voucherUrl,
        teeTime: {
          course: course.name,
          date: hold.date,
          time: hold.time,
          players: hold.players,
          holes: hold.holes,
          greenFee: hold.greenFee
        },
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone
        },
        total: hold.total
      });
    } catch (error) {
      console.error("[OnTee API] Booking confirm error:", error);
      res.status(500).json({ error: "Failed to confirm booking" });
    }
  });

  // GET /api/v1/bookings/orders/:orderId - Get order status
  app.get("/api/v1/bookings/orders/:orderId", async (req, res) => {
    try {
      const hold = teeTimeHolds.get(req.params.orderId);
      if (!hold) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Check if expired
      if (hold.status === "HELD" && hold.holdExpiresAt < new Date()) {
        hold.status = "EXPIRED";
      }

      const course = await storage.getCourseById(hold.courseId);

      res.json({
        orderId: hold.orderId,
        status: hold.status,
        course: course ? { id: course.id, name: course.name } : null,
        teeTime: {
          date: hold.date,
          time: hold.time,
          players: hold.players,
          holes: hold.holes
        },
        greenFee: hold.greenFee,
        extras: hold.extras,
        total: hold.total,
        holdExpiresAt: hold.holdExpiresAt.toISOString(),
        bookingId: hold.bookingId
      });
    } catch (error) {
      console.error("[OnTee API] Get order error:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // GET /openapi.json - OpenAPI specification for OnTee-style endpoints
  app.get("/openapi.json", (req, res) => {
    res.json({
      openapi: "3.0.0",
      info: {
        title: "MarbellaGolfTimes Booking API",
        version: "1.0.0",
        description: "OnTee-inspired tee-time booking API for TeeOne golf courses in Costa del Sol"
      },
      servers: [{ url: "https://marbellagolftimes.replit.app" }],
      paths: {
        "/api/v1/bookings/available": {
          post: {
            summary: "Get available tee times for a course",
            description: "Fetches real-time availability from TeeOne booking system",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["facilityId", "date", "players"],
                    properties: {
                      facilityId: { type: "string", example: "El Paraíso Golf Club" },
                      courseId: { type: "string", description: "Optional course ID" },
                      date: { type: "string", format: "date", example: "2025-12-10" },
                      players: { type: "integer", minimum: 1, maximum: 4, example: 2 },
                      holes: { type: "integer", enum: [9, 18], example: 18 },
                      fromTime: { type: "string", example: "08:00" },
                      toTime: { type: "string", example: "16:00" }
                    }
                  }
                }
              }
            },
            responses: {
              "200": { description: "List of available tee times" },
              "404": { description: "Course not found" },
              "400": { description: "Course does not use TeeOne" }
            }
          }
        },
        "/api/v1/orders/items": {
          post: {
            summary: "Create or update an order with a selected tee time",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["slotId", "players"],
                    properties: {
                      slotId: { type: "string" },
                      players: { type: "integer" },
                      greenFee: {
                        type: "object",
                        properties: {
                          amount: { type: "number" },
                          currency: { type: "string", example: "EUR" }
                        }
                      },
                      extras: { type: "array", items: { type: "object" } },
                      orderId: { type: "string", description: "Optional - provide to update existing order" }
                    }
                  }
                }
              }
            },
            responses: { "200": { description: "Order created/updated with 15-minute hold" } }
          }
        },
        "/api/v1/bookings/confirm": {
          post: {
            summary: "Confirm booking after payment",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["orderId", "customer"],
                    properties: {
                      orderId: { type: "string" },
                      customer: {
                        type: "object",
                        properties: {
                          firstName: { type: "string" },
                          lastName: { type: "string" },
                          email: { type: "string" },
                          phone: { type: "string" },
                          language: { type: "string", example: "en" }
                        }
                      },
                      payment: {
                        type: "object",
                        properties: {
                          method: { type: "string", example: "stripe" },
                          status: { type: "string", example: "paid" },
                          transactionId: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            },
            responses: { "200": { description: "Booking confirmed" } }
          }
        }
      }
    });
  });

  // ============================================================
  // API Key Management (Admin only, session-based auth)
  // ============================================================

  // GET /api/admin/api-keys - List all API keys
  app.get("/api/admin/api-keys", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const keys = await storage.getAllApiKeys();
      
      // Return keys without exposing hashes
      const safeKeys = keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        createdById: key.createdById,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
      }));
      
      res.json(safeKeys);
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // POST /api/admin/api-keys - Create new API key
  app.post("/api/admin/api-keys", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, scopes, expiresAt } = req.body;
      
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const validScopes = ["read:courses", "read:bookings", "write:bookings", "read:analytics", "read:users"];
      const requestedScopes = scopes || validScopes;
      
      for (const scope of requestedScopes) {
        if (!validScopes.includes(scope)) {
          return res.status(400).json({ error: `Invalid scope: ${scope}` });
        }
      }
      
      const result = await storage.createApiKey(
        name,
        requestedScopes,
        req.session.userId!,
        expiresAt ? new Date(expiresAt) : undefined
      );
      
      // Return the raw key only once - it cannot be retrieved later
      res.status(201).json({
        message: "API key created successfully. Copy the key now - it won't be shown again.",
        apiKey: {
          id: result.apiKey.id,
          name: result.apiKey.name,
          keyPrefix: result.apiKey.keyPrefix,
          scopes: result.apiKey.scopes,
          createdAt: result.apiKey.createdAt,
          expiresAt: result.apiKey.expiresAt,
        },
        rawKey: result.rawKey,
      });
    } catch (error) {
      console.error("Failed to create API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  // PATCH /api/admin/api-keys/:id/revoke - Revoke API key (keeps record)
  app.patch("/api/admin/api-keys/:id/revoke", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.revokeApiKey(req.params.id);
      
      if (!success) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      res.json({ success: true, message: "API key revoked" });
    } catch (error) {
      console.error("Failed to revoke API key:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  // DELETE /api/admin/api-keys/:id - Permanently delete API key
  app.delete("/api/admin/api-keys/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteApiKey(req.params.id);
      
      if (!success) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      res.json({ success: true, message: "API key deleted" });
    } catch (error) {
      console.error("Failed to delete API key:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });

  // ============================================================
  // Course Documents API - Store contracts/agreements per course
  // ============================================================

  // GET /api/admin/courses/:courseId/documents - List documents for a course
  app.get("/api/admin/courses/:courseId/documents", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const documents = await storage.getCourseDocuments(req.params.courseId);
      res.json(documents);
    } catch (error) {
      console.error("Failed to get course documents:", error);
      res.status(500).json({ error: "Failed to get course documents" });
    }
  });

  // POST /api/admin/courses/:courseId/documents - Upload document for a course
  app.post("/api/admin/courses/:courseId/documents", isAuthenticated, isAdmin, documentUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = (req.session as any)?.userId;
      const courseId = req.params.courseId;
      
      // Verify course exists
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Upload to object storage
      const objectStorage = new ObjectStorageService();
      const fileName = `courses/${courseId}/documents/${Date.now()}-${file.originalname}`;
      const fileUrl = await objectStorage.uploadPrivateFile(fileName, file.buffer, file.mimetype);

      // Save document metadata
      const document = await storage.createCourseDocument({
        courseId,
        name: req.body.name || file.originalname,
        fileName: file.originalname,
        fileUrl,
        fileType: file.mimetype,
        fileSize: file.size,
        category: req.body.category || "contract",
        notes: req.body.notes,
        validFrom: req.body.validFrom ? new Date(req.body.validFrom) : undefined,
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
        uploadedById: userId,
      });

      res.json(document);
    } catch (error) {
      console.error("Failed to upload document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // GET /api/admin/courses/:courseId/documents/:documentId/download - Download document
  app.get("/api/admin/courses/:courseId/documents/:documentId/download", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const document = await storage.getCourseDocument(req.params.documentId);
      if (!document || document.courseId !== req.params.courseId) {
        return res.status(404).json({ error: "Document not found" });
      }

      const objectStorage = new ObjectStorageService();
      const fileData = await objectStorage.getPrivateFile(document.fileUrl);
      
      res.setHeader("Content-Type", document.fileType);
      res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
      res.send(fileData);
    } catch (error) {
      console.error("Failed to download document:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  // GET /api/admin/documents/:documentId/download - Download document by ID only (for email attachments)
  app.get("/api/admin/documents/:documentId/download", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const document = await storage.getCourseDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const objectStorage = new ObjectStorageService();
      const fileData = await objectStorage.getPrivateFile(document.fileUrl);
      
      res.setHeader("Content-Type", document.fileType);
      res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
      res.send(fileData);
    } catch (error) {
      console.error("Failed to download document:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  // DELETE /api/admin/courses/:courseId/documents/:documentId - Delete document
  app.delete("/api/admin/courses/:courseId/documents/:documentId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const document = await storage.getCourseDocument(req.params.documentId);
      if (!document || document.courseId !== req.params.courseId) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Delete from object storage
      const objectStorage = new ObjectStorageService();
      try {
        await objectStorage.deletePrivateFile(document.fileUrl);
      } catch (e) {
        console.log("Could not delete file from storage:", e);
      }

      // Delete metadata
      await storage.deleteCourseDocument(req.params.documentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ============================================================
  // Company Profile API - Business details for partnership forms
  // ============================================================

  // GET /api/admin/company-profile - Get company profile
  app.get("/api/admin/company-profile", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const profile = await storage.getCompanyProfile();
      res.json(profile || null);
    } catch (error) {
      console.error("Failed to get company profile:", error);
      res.status(500).json({ error: "Failed to get company profile" });
    }
  });

  // POST /api/admin/company-profile - Create or update company profile (upsert)
  app.post("/api/admin/company-profile", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Validate request body
      const validation = insertCompanyProfileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.flatten() });
      }
      
      const existing = await storage.getCompanyProfile();
      
      if (existing) {
        // Update existing profile
        const updated = await storage.updateCompanyProfile(existing.id, validation.data);
        res.json(updated);
      } else {
        // Create new profile
        const created = await storage.createCompanyProfile(validation.data);
        res.json(created);
      }
    } catch (error) {
      console.error("Failed to save company profile:", error);
      res.status(500).json({ error: "Failed to save company profile" });
    }
  });

  // ============================================================
  // Partnership Forms API - Track forms sent/received per course
  // ============================================================

  // GET /api/admin/courses/:courseId/partnership-forms - Get forms for a course
  app.get("/api/admin/courses/:courseId/partnership-forms", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const forms = await storage.getPartnershipFormsByCourseId(req.params.courseId);
      res.json(forms);
    } catch (error) {
      console.error("Failed to get partnership forms:", error);
      res.status(500).json({ error: "Failed to get partnership forms" });
    }
  });

  // POST /api/admin/courses/:courseId/partnership-forms - Create partnership form
  app.post("/api/admin/courses/:courseId/partnership-forms", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Validate request body (merge courseId from params)
      const validation = insertPartnershipFormSchema.safeParse({
        ...req.body,
        courseId: req.params.courseId,
      });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.flatten() });
      }
      
      const form = await storage.createPartnershipForm(validation.data);
      res.json(form);
    } catch (error) {
      console.error("Failed to create partnership form:", error);
      res.status(500).json({ error: "Failed to create partnership form" });
    }
  });

  // PATCH /api/admin/partnership-forms/:id - Update form status
  app.patch("/api/admin/partnership-forms/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Validate partial update - allow any subset of fields
      const partialSchema = insertPartnershipFormSchema.partial();
      const validation = partialSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.flatten() });
      }
      
      const updates = { ...validation.data } as any;
      
      // Auto-set timestamps based on status changes
      if (updates.status === "SENT" && !updates.sentAt) {
        updates.sentAt = new Date();
        updates.sentByUserId = (req.session as any)?.userId;
      }
      if (updates.status === "RECEIVED" && !updates.receivedAt) {
        updates.receivedAt = new Date();
      }
      if (updates.status === "PROCESSED" && !updates.processedAt) {
        updates.processedAt = new Date();
      }
      
      const updated = await storage.updatePartnershipForm(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Partnership form not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update partnership form:", error);
      res.status(500).json({ error: "Failed to update partnership form" });
    }
  });

  // DELETE /api/admin/partnership-forms/:id - Delete form
  app.delete("/api/admin/partnership-forms/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deletePartnershipForm(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Partnership form not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete partnership form:", error);
      res.status(500).json({ error: "Failed to delete partnership form" });
    }
  });

  // POST /api/admin/fill-form - Upload PDF form and get filled version with company data
  app.post("/api/admin/fill-form", isAuthenticated, isAdmin, documentUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!req.file.mimetype.includes("pdf")) {
        return res.status(400).json({ error: "Only PDF files are supported" });
      }

      const { formFiller } = await import("./services/formFiller");
      const result = await formFiller.fillForm(req.file.buffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="filled-form.pdf"`);
      res.setHeader("X-Fields-Matched", result.fieldsMatched.join(","));
      res.setHeader("X-Fields-Unmatched", result.fieldsUnmatched.join(","));
      res.send(result.pdfBuffer);
    } catch (error) {
      console.error("Failed to fill form:", error);
      res.status(500).json({ error: `Failed to fill form: ${error}` });
    }
  });

  // ==========================================
  // CONTRACT PROCESSING & RATE PERIODS
  // ==========================================

  // POST /api/admin/courses/:courseId/documents/:documentId/process - Process contract with AI
  app.post("/api/admin/courses/:courseId/documents/:documentId/process", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const document = await storage.getCourseDocument(req.params.documentId);
      if (!document || document.courseId !== req.params.courseId) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (!document.fileType.includes("pdf")) {
        return res.status(400).json({ error: "Only PDF documents can be processed" });
      }

      const { contractParser } = await import("./services/contractParser");
      const result = await contractParser.processDocument(req.params.documentId);
      
      res.json({
        success: true,
        ingestionId: result.ingestionId,
        ratePeriods: result.ratePeriods,
        contacts: result.contacts,
        parsedData: result.parsedData,
      });
    } catch (error) {
      console.error("Failed to process contract:", error);
      res.status(500).json({ error: `Failed to process contract: ${error}` });
    }
  });

  // GET /api/admin/courses/:courseId/rate-periods - Get rate periods for a course
  app.get("/api/admin/courses/:courseId/rate-periods", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { contractParser } = await import("./services/contractParser");
      const ratePeriods = await contractParser.getCourseRatePeriods(req.params.courseId);
      res.json(ratePeriods);
    } catch (error) {
      console.error("Failed to get rate periods:", error);
      res.status(500).json({ error: "Failed to get rate periods" });
    }
  });

  // GET /api/admin/courses/:courseId/contacts - Get contacts for a course
  app.get("/api/admin/courses/:courseId/contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { contractParser } = await import("./services/contractParser");
      const contacts = await contractParser.getCourseContacts(req.params.courseId);
      res.json(contacts);
    } catch (error) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "Failed to get contacts" });
    }
  });

  // GET /api/admin/rate-periods - Get all rate periods for comparison view
  app.get("/api/admin/rate-periods", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allRatePeriods = await db.select({
        id: courseRatePeriods.id,
        courseId: courseRatePeriods.courseId,
        courseName: golfCourses.name,
        seasonLabel: courseRatePeriods.seasonLabel,
        packageType: courseRatePeriods.packageType,
        startDate: courseRatePeriods.startDate,
        endDate: courseRatePeriods.endDate,
        year: courseRatePeriods.year,
        rackRate: courseRatePeriods.rackRate,
        netRate: courseRatePeriods.netRate,
        kickbackPercent: courseRatePeriods.kickbackPercent,
        currency: courseRatePeriods.currency,
        includesBuggy: courseRatePeriods.includesBuggy,
        includesLunch: courseRatePeriods.includesLunch,
        includesCart: courseRatePeriods.includesCart,
        isEarlyBird: courseRatePeriods.isEarlyBird,
        isTwilight: courseRatePeriods.isTwilight,
        timeRestriction: courseRatePeriods.timeRestriction,
        minPlayersForDiscount: courseRatePeriods.minPlayersForDiscount,
        freePlayersPerGroup: courseRatePeriods.freePlayersPerGroup,
        notes: courseRatePeriods.notes,
        isVerified: courseRatePeriods.isVerified,
      })
      .from(courseRatePeriods)
      .leftJoin(golfCourses, eq(courseRatePeriods.courseId, golfCourses.id))
      .orderBy(golfCourses.name, courseRatePeriods.packageType, courseRatePeriods.seasonLabel);
      
      res.json(allRatePeriods);
    } catch (error) {
      console.error("Failed to get all rate periods:", error);
      res.status(500).json({ error: "Failed to get rate periods" });
    }
  });

  // GET /api/admin/contracts/ingestions - Get all contract ingestions
  app.get("/api/admin/contracts/ingestions", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ingestions = await db.select({
        id: contractIngestions.id,
        documentId: contractIngestions.documentId,
        courseId: contractIngestions.courseId,
        courseName: golfCourses.name,
        status: contractIngestions.status,
        confidenceScore: contractIngestions.confidenceScore,
        errorMessage: contractIngestions.errorMessage,
        processedAt: contractIngestions.processedAt,
        createdAt: contractIngestions.createdAt,
      })
      .from(contractIngestions)
      .leftJoin(golfCourses, eq(contractIngestions.courseId, golfCourses.id))
      .orderBy(contractIngestions.createdAt);
      
      res.json(ingestions);
    } catch (error) {
      console.error("Failed to get contract ingestions:", error);
      res.status(500).json({ error: "Failed to get contract ingestions" });
    }
  });

  // GET /api/admin/courses/:courseId/all-contacts - Get all contacts for a course
  app.get("/api/admin/courses/:courseId/all-contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { contractParser } = await import("./services/contractParser");
      const contractContacts = await contractParser.getCourseContacts(req.params.courseId);
      
      const [onboarding] = await db.select()
        .from(courseOnboarding)
        .where(eq(courseOnboarding.courseId, req.params.courseId));
      
      const allContacts = [...contractContacts];
      
      if (onboarding?.contactPerson) {
        allContacts.push({
          id: 'onboarding',
          courseId: req.params.courseId,
          ingestionId: null,
          name: onboarding.contactPerson,
          role: 'Primary Contact (Onboarding)',
          email: onboarding.contactEmail,
          phone: onboarding.contactPhone,
          isPrimary: "true",
          notes: null,
          createdAt: onboarding.createdAt,
        });
      }
      
      res.json(allContacts);
    } catch (error) {
      console.error("Failed to get all contacts:", error);
      res.status(500).json({ error: "Failed to get contacts" });
    }
  });

  // ============================================================
  // Zest Golf Channel Manager API Integration
  // ============================================================
  
  app.get("/api/zest/test", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      const result = await zest.testConnection();
      res.json(result);
    } catch (error: any) {
      console.error("Zest Golf test failed:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/zest/countries", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      const connectedOnly = req.query.connected === "true";
      const countries = await zest.getCountries(connectedOnly);
      res.json({ success: true, countries });
    } catch (error: any) {
      console.error("Failed to fetch Zest countries:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/zest/facilities", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      const country = req.query.country as string || "Spain";
      const connectedOnly = req.query.connected === "true";
      const facilities = await zest.getFacilities(country, connectedOnly);
      res.json({ success: true, facilities });
    } catch (error: any) {
      console.error("Failed to fetch Zest facilities:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/zest/facilities/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      const details = await zest.getFacilityDetails(parseInt(req.params.id));
      res.json({ success: true, facility: details });
    } catch (error: any) {
      console.error("Failed to fetch Zest facility details:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/zest/teetimes/:facilityId", async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      
      const facilityId = parseInt(req.params.facilityId);
      const dateStr = req.query.date as string;
      const players = parseInt(req.query.players as string) || 4;
      const holes = (parseInt(req.query.holes as string) || 18) as 9 | 18;
      
      if (!dateStr) {
        return res.status(400).json({ success: false, error: "Date is required" });
      }
      
      const bookingDate = new Date(dateStr);
      const teeTimes = await zest.getTeeTimes(facilityId, bookingDate, players, holes);
      res.json({ success: true, teeTimes });
    } catch (error: any) {
      console.error("Failed to fetch Zest tee times:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/zest/bookings", isAuthenticated, async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      const result = await zest.createBooking(req.body);
      res.json({ success: true, booking: result });
    } catch (error: any) {
      console.error("Failed to create Zest booking:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/zest/bookings/:bookingId", isAuthenticated, async (req, res) => {
    try {
      const { getZestGolfService } = await import("./services/zestGolf");
      const zest = getZestGolfService();
      const success = await zest.cancelBooking(req.params.bookingId);
      res.json({ success });
    } catch (error: any) {
      console.error("Failed to cancel Zest booking:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Zest Golf Automation - Puppeteer-based facility management
  app.get("/api/zest/automation/test", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { ZestGolfAutomation, validateZestCredentials, isAutomationBusy } = await import("./services/zestGolfAutomation");
      
      const credCheck = validateZestCredentials();
      if (!credCheck.valid) {
        return res.status(400).json({ success: false, message: credCheck.error, error: credCheck.error });
      }
      
      if (isAutomationBusy()) {
        return res.status(409).json({ success: false, message: "Another automation task is already running", error: "Busy" });
      }
      
      const automation = new ZestGolfAutomation();
      const result = await automation.testConnection();
      
      if (!result.success) {
        return res.status(result.error?.includes("Login") ? 401 : 500).json(result);
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Zest automation test failed:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.post("/api/zest/automation/resend-all", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { ZestGolfAutomation, validateZestCredentials, isAutomationBusy } = await import("./services/zestGolfAutomation");
      
      const credCheck = validateZestCredentials();
      if (!credCheck.valid) {
        return res.status(400).json({ success: false, message: credCheck.error, error: credCheck.error });
      }
      
      if (isAutomationBusy()) {
        return res.status(409).json({ success: false, message: "Another automation task is already running", error: "Busy" });
      }
      
      const automation = new ZestGolfAutomation();
      const result = await automation.runFullAutomation();
      
      if (!result.success) {
        return res.status(result.error?.includes("Login") ? 401 : 500).json(result);
      }
      
      // Update only the matching Zest Golf pending facilities in our database
      let coursesUpdated = 0;
      const matchedCourses: string[] = [];
      const unmatchedFacilities: string[] = [];
      try {
        if (result.facilities && result.facilities.length > 0) {
          const allCourses = await storage.getCourses();
          console.log(`[Zest Matching] Processing ${result.facilities.length} facilities against ${allCourses.length} courses`);
          
          for (const facility of result.facilities) {
            // Log facility details for debugging
            console.log(`[Zest Matching] Facility: name="${facility.name}", city="${facility.city}", status="${facility.status}"`);
            
            // Try to match Zest facility to our course by name OR city
            const facilityName = (facility.name || "").toLowerCase().trim();
            const facilityCity = (facility.city || "").toLowerCase().trim();
            
            const matchedCourse = allCourses.find(course => {
              const courseName = course.name.toLowerCase().trim();
              const courseCity = (course.city || "").toLowerCase().trim();
              
              // Match by name
              if (facilityName && (
                courseName.includes(facilityName) || 
                facilityName.includes(courseName) ||
                courseName === facilityName
              )) {
                return true;
              }
              
              // Match by city if name match failed - find courses in the same city
              // with city name appearing in either the course name or exact city match
              if (facilityCity && (
                courseCity === facilityCity ||
                courseCity.includes(facilityCity) ||
                facilityCity.includes(courseCity) ||
                courseName.includes(facilityCity)
              )) {
                return true;
              }
              
              return false;
            });
            
            if (matchedCourse) {
              console.log(`[Zest Matching] Matched: "${facility.name || facility.city}" -> "${matchedCourse.name}"`);
              const onboarding = await storage.getOnboardingByCourseId(matchedCourse.id);
              // Update if no onboarding record exists OR stage is NOT_CONTACTED or null
              if (!onboarding || !onboarding.stage || onboarding.stage === "NOT_CONTACTED") {
                await storage.updateOnboardingStage(matchedCourse.id, "OUTREACH_SENT");
                coursesUpdated++;
                matchedCourses.push(matchedCourse.name);
              } else {
                console.log(`[Zest Matching] Skipped "${matchedCourse.name}" - already at stage: ${onboarding.stage}`);
              }
            } else {
              unmatchedFacilities.push(facility.name || facility.city || "Unknown");
              console.log(`[Zest Matching] No match found for: "${facility.name || facility.city}"`);
            }
          }
          console.log(`[Zest Matching] Updated ${coursesUpdated} courses to OUTREACH_SENT:`, matchedCourses);
          if (unmatchedFacilities.length > 0) {
            console.log(`[Zest Matching] Unmatched facilities:`, unmatchedFacilities);
          }
        }
      } catch (updateError) {
        console.error("Error updating onboarding stages:", updateError);
      }
      
      res.json({
        ...result,
        coursesUpdated,
        matchedCourses,
        message: `${result.message}. Updated ${coursesUpdated} matching courses to Outreach Sent.`
      });
    } catch (error: any) {
      console.error("Zest automation failed:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.get("/api/zest/automation/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { ZestGolfAutomation, validateZestCredentials, isAutomationBusy } = await import("./services/zestGolfAutomation");
      
      const credCheck = validateZestCredentials();
      if (!credCheck.valid) {
        return res.status(400).json({ success: false, message: credCheck.error, error: credCheck.error });
      }
      
      if (isAutomationBusy()) {
        return res.status(409).json({ success: false, message: "Another automation task is already running", error: "Busy" });
      }
      
      const automation = new ZestGolfAutomation();
      await automation.initialize();
      const loginSuccess = await automation.login();
      
      if (!loginSuccess) {
        await automation.close();
        return res.status(401).json({ success: false, message: "Failed to login to Zest Golf", error: "Login failed" });
      }
      
      const facilities = await automation.getPendingFacilities();
      await automation.close();
      
      res.json({ success: true, message: `Found ${facilities.length} pending facilities`, facilities });
    } catch (error: any) {
      console.error("Failed to get pending facilities:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.get("/api/zest/automation/analyze", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { ZestGolfAutomation, validateZestCredentials, isAutomationBusy } = await import("./services/zestGolfAutomation");
      
      const credCheck = validateZestCredentials();
      if (!credCheck.valid) {
        return res.status(400).json({ success: false, message: credCheck.error, error: credCheck.error });
      }
      
      if (isAutomationBusy()) {
        return res.status(409).json({ success: false, message: "Another automation task is already running", error: "Busy" });
      }
      
      console.log("Starting Zest Golf API analysis...");
      const automation = new ZestGolfAutomation();
      const result = await automation.analyzeNetworkRequests();
      
      console.log("Zest API Analysis Result:", result.message);
      console.log("Discovered endpoints:", result.apiCalls.map(c => `${c.method} ${c.url}`));
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to analyze Zest API:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message, apiCalls: [] });
    }
  });

  // Get commission rates from Zest Golf
  app.get("/api/zest/automation/commission-rates", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { ZestGolfAutomation, validateZestCredentials, isAutomationBusy } = await import("./services/zestGolfAutomation");
      
      const credCheck = validateZestCredentials();
      if (!credCheck.valid) {
        return res.status(400).json({ success: false, message: credCheck.error, error: credCheck.error });
      }
      
      if (isAutomationBusy()) {
        return res.status(409).json({ success: false, message: "Another automation task is already running", error: "Busy" });
      }
      
      console.log("Fetching commission rates from Zest Golf...");
      const automation = new ZestGolfAutomation();
      const result = await automation.getCommissionRates();
      
      console.log("Commission rates result:", result.message);
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to get commission rates:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message, rates: [] });
    }
  });

  // Zest Golf Pricing Sync - API-based pricing data sync
  app.post("/api/zest/pricing/sync", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { syncAllZestPricing } = await import("./services/zestPricingSync");
      
      console.log("Starting Zest pricing sync...");
      const result = await syncAllZestPricing();
      
      console.log(`Zest pricing sync complete: ${result.successCount}/${result.totalCourses} courses synced`);
      
      res.json({
        success: true,
        message: `Synced pricing for ${result.successCount} of ${result.totalCourses} courses`,
        ...result,
      });
    } catch (error: any) {
      console.error("Failed to sync Zest pricing:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.post("/api/zest/pricing/sync/:courseId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { syncZestPricingForCourse } = await import("./services/zestPricingSync");
      
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }
      
      const providerLink = await db.select()
        .from(courseProviderLinks)
        .innerJoin(teeTimeProviders, eq(courseProviderLinks.providerId, teeTimeProviders.id))
        .where(and(
          eq(courseProviderLinks.courseId, courseId),
          ilike(teeTimeProviders.name, "%zest%")
        ))
        .limit(1);
      
      if (providerLink.length === 0) {
        return res.status(400).json({ success: false, message: "Course is not linked to Zest Golf" });
      }
      
      const facilityIdMatch = providerLink[0].course_provider_links.providerCourseCode?.match(/zest:(\d+)/);
      if (!facilityIdMatch) {
        return res.status(400).json({ success: false, message: "Invalid Zest facility ID" });
      }
      
      const zestFacilityId = parseInt(facilityIdMatch[1]);
      const result = await syncZestPricingForCourse(courseId, zestFacilityId, course.name);
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to sync Zest pricing for course:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.get("/api/zest/pricing", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { getAllZestPricingData } = await import("./services/zestPricingSync");
      
      const pricingData = await getAllZestPricingData();
      
      res.json({
        success: true,
        count: pricingData.length,
        data: pricingData,
      });
    } catch (error: any) {
      console.error("Failed to get Zest pricing data:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.get("/api/zest/pricing/:courseId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { getZestPricingData } = await import("./services/zestPricingSync");
      
      const pricingData = await getZestPricingData(courseId);
      
      if (!pricingData) {
        return res.status(404).json({ success: false, message: "No pricing data found for this course" });
      }
      
      res.json({
        success: true,
        data: pricingData,
      });
    } catch (error: any) {
      console.error("Failed to get Zest pricing data:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.post("/api/zest/contacts/sync", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { syncAllZestContacts } = await import("./services/zestPricingSync");
      
      const result = await syncAllZestContacts();
      
      res.json({
        success: true,
        message: `Synced contacts for ${result.successCount} of ${result.totalCourses} courses`,
        ...result,
      });
    } catch (error: any) {
      console.error("Failed to sync Zest contacts:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  app.post("/api/zest/contacts/sync/:courseId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { syncZestContactForCourse } = await import("./services/zestPricingSync");
      
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }
      
      const providerLink = await db.select()
        .from(courseProviderLinks)
        .innerJoin(teeTimeProviders, eq(courseProviderLinks.providerId, teeTimeProviders.id))
        .where(and(
          eq(courseProviderLinks.courseId, courseId),
          ilike(teeTimeProviders.name, "%zest%")
        ))
        .limit(1);
      
      if (providerLink.length === 0) {
        return res.status(400).json({ success: false, message: "Course is not linked to Zest Golf" });
      }
      
      const providerCode = providerLink[0].course_provider_links.providerCourseCode;
      const facilityIdMatch = providerCode?.match(/zest:(\d+)/);
      
      if (!facilityIdMatch) {
        return res.status(400).json({ success: false, message: "Invalid Zest facility ID in provider link" });
      }
      
      const zestFacilityId = parseInt(facilityIdMatch[1]);
      const result = await syncZestContactForCourse(courseId, zestFacilityId, course.name);
      
      const { success, ...resultData } = result;
      res.json({
        success,
        message: success ? "Contact info synced successfully" : result.error,
        ...resultData,
      });
    } catch (error: any) {
      console.error("Failed to sync Zest contact for course:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  // Save/upsert course contact by role
  app.post("/api/admin/courses/:courseId/contacts", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { role, name, email, phone } = req.body;
      
      if (!role) {
        return res.status(400).json({ success: false, message: "Role is required" });
      }
      
      const existingContact = await db.select()
        .from(courseContacts)
        .where(and(
          eq(courseContacts.courseId, courseId),
          eq(courseContacts.role, role)
        ))
        .limit(1);
      
      if (existingContact.length > 0) {
        await db.update(courseContacts)
          .set({
            name: name || null,
            email: email || null,
            phone: phone || null,
          })
          .where(eq(courseContacts.id, existingContact[0].id));
      } else {
        await db.insert(courseContacts).values({
          courseId,
          role,
          name: name || "",
          email: email || null,
          phone: phone || null,
          isPrimary: role === "Zest Primary" ? "true" : "false",
        });
      }
      
      // Also update courseOnboarding if saving Primary contact
      if (role === "Zest Primary") {
        const existingOnboarding = await db.select()
          .from(courseOnboarding)
          .where(eq(courseOnboarding.courseId, courseId))
          .limit(1);
          
        if (existingOnboarding.length > 0) {
          await db.update(courseOnboarding)
            .set({
              contactPerson: name || existingOnboarding[0].contactPerson,
              contactEmail: email || existingOnboarding[0].contactEmail,
              contactPhone: phone || existingOnboarding[0].contactPhone,
              updatedAt: new Date(),
            })
            .where(eq(courseOnboarding.courseId, courseId));
        }
      }
      
      res.json({ success: true, message: `${role} contact saved` });
    } catch (error: any) {
      console.error("Failed to save course contact:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/zest/contacts/scrape/:courseId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { courseId } = req.params;
      const { ZestGolfAutomation } = await import("./services/zestGolfAutomation");
      
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }
      
      const providerLink = await db.select()
        .from(courseProviderLinks)
        .innerJoin(teeTimeProviders, eq(courseProviderLinks.providerId, teeTimeProviders.id))
        .where(and(
          eq(courseProviderLinks.courseId, courseId),
          ilike(teeTimeProviders.name, "%zest%")
        ))
        .limit(1);
      
      if (providerLink.length === 0) {
        return res.status(400).json({ success: false, message: "Course is not linked to Zest Golf" });
      }
      
      const providerCode = providerLink[0].course_provider_links.providerCourseCode;
      const facilityIdMatch = providerCode?.match(/zest:(\d+)/);
      
      if (!facilityIdMatch) {
        return res.status(400).json({ success: false, message: "Invalid Zest facility ID in provider link" });
      }
      
      const zestFacilityId = parseInt(facilityIdMatch[1]);
      
      const automation = new ZestGolfAutomation();
      const result = await automation.scrapeFacilityContactsWithLogin(zestFacilityId);
      
      if (result.success && result.contacts.length > 0) {
        // Helper to clean phone numbers from scraper artifacts
        const cleanPhone = (phone: string | null | undefined): string | null => {
          if (!phone) return null;
          // Remove tabs, newlines, and excessive whitespace, keep only digits, +, (, ), -, spaces
          const cleaned = phone.replace(/[\t\n\r]+/g, '').replace(/\s+/g, ' ').trim();
          // Extract just digits to check if valid phone
          const digits = cleaned.replace(/[^\d]/g, '');
          return digits.length >= 6 ? cleaned : null;
        };

        for (const contact of result.contacts) {
          const role = contact.role === "Primary" ? "Zest Primary" : 
                       contact.role === "Billing" ? "Zest Billing" : "Zest Reservations";
          
          const cleanedPhone = cleanPhone(contact.phone);
          const cleanedName = contact.name?.trim() || null;
          const cleanedEmail = contact.email?.trim()?.toLowerCase() || null;
          
          const existingContact = await db.select()
            .from(courseContacts)
            .where(and(
              eq(courseContacts.courseId, courseId),
              eq(courseContacts.role, role)
            ))
            .limit(1);

          if (existingContact.length > 0) {
            // Build update object only with non-null scraped values
            const updateData: Record<string, any> = {};
            if (cleanedName) updateData.name = cleanedName;
            if (cleanedEmail) updateData.email = cleanedEmail;
            if (cleanedPhone) updateData.phone = cleanedPhone;
            
            if (Object.keys(updateData).length > 0) {
              await db.update(courseContacts)
                .set(updateData)
                .where(eq(courseContacts.id, existingContact[0].id));
            }
          } else {
            // Insert new contact even without a name (use role as placeholder)
            await db.insert(courseContacts).values({
              courseId,
              role,
              name: cleanedName || `${role.replace('Zest ', '')} Contact`,
              email: cleanedEmail,
              phone: cleanedPhone,
              isPrimary: role === "Zest Primary" ? "true" : "false",
              notes: "Scraped from Zest Golf Portal",
            });
          }
        }

        const primaryContact = result.contacts.find(c => c.role === "Primary");
        if (primaryContact) {
          const pCleanName = primaryContact.name?.trim() || null;
          const pCleanEmail = primaryContact.email?.trim()?.toLowerCase() || null;
          const pCleanPhone = cleanPhone(primaryContact.phone);
          
          const existingOnboarding = await db.select()
            .from(courseOnboarding)
            .where(eq(courseOnboarding.courseId, courseId))
            .limit(1);

          if (existingOnboarding.length > 0) {
            const onboardingUpdate: Record<string, any> = { updatedAt: new Date() };
            if (pCleanName) onboardingUpdate.contactPerson = pCleanName;
            if (pCleanEmail) onboardingUpdate.contactEmail = pCleanEmail;
            if (pCleanPhone) onboardingUpdate.contactPhone = pCleanPhone;
            
            await db.update(courseOnboarding)
              .set(onboardingUpdate)
              .where(eq(courseOnboarding.courseId, courseId));
          } else {
            await db.insert(courseOnboarding).values({
              courseId,
              stage: "NOT_CONTACTED",
              contactPerson: pCleanName,
              contactEmail: pCleanEmail,
              contactPhone: pCleanPhone,
            });
          }
        }
      }
      
      res.json({
        success: result.success,
        message: result.success 
          ? `Scraped ${result.contacts.length} contacts from Zest Portal` 
          : result.error,
        facilityId: zestFacilityId,
        contacts: result.contacts,
      });
    } catch (error: any) {
      console.error("Failed to scrape Zest contacts from portal:", error);
      res.status(500).json({ success: false, message: error.message, error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
