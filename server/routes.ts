import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { sendAffiliateEmail, getEmailConfig } from "./email";
import { createGolfmanagerProvider, getGolfmanagerConfig } from "./providers/golfmanager";
import { getSession, isAuthenticated, isAdmin } from "./customAuth";
import { insertBookingRequestSchema, insertAffiliateEmailSchema, insertUserSchema, insertCourseReviewSchema, insertTestimonialSchema, insertAdCampaignSchema, type CourseWithSlots, type TeeTimeSlot, type User, type GolfCourse } from "@shared/schema";
import { bookingConfirmationEmail, type BookingDetails } from "./templates/booking-confirmation";
import { generateICalendar, generateGoogleCalendarUrl, type CalendarEventDetails } from "./utils/calendar";
import { z } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

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

  // Session setup
  app.set("trust proxy", 1);
  app.use(getSession());

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
      res.json({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phoneNumber: user.phoneNumber, profileImageUrl: user.profileImageUrl, isAdmin: user.isAdmin });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // GET /api/courses - Get all golf courses
  app.get("/api/courses", async (req, res) => {
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
      
      res.setHeader('Cache-Control', 'public, max-age=300');
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
      
      // Enrich with course names
      const enrichedThreads = await Promise.all(threads.map(async (thread) => {
        let courseName = null;
        if (thread.courseId) {
          const course = await storage.getCourseById(thread.courseId);
          courseName = course?.name || null;
        }
        return { ...thread, courseName };
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
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
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
        const dateStr = formatQuoteDate(msg.createdAt);
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

      // Validate that imageUrl starts with allowed directory and ends with valid image extension
      const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
      const hasValidExtension = validExtensions.some(ext => imageUrl.toLowerCase().endsWith(ext));
      const startsWithValidDirectory = imageUrl.startsWith("/stock_images/") || imageUrl.startsWith("/generated_images/");
      
      if (!startsWithValidDirectory || !hasValidExtension) {
        return res.status(400).json({ 
          error: "Invalid imageUrl format. Must start with /stock_images/ or /generated_images/ and end with .jpg, .jpeg, .png, or .webp" 
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
  app.patch("/api/admin/courses/:id", isAdmin, async (req, res) => {
    try {
      const updateCourseSchema = z.object({
        kickbackPercent: z.number().min(0).max(100).optional(),
        golfmanagerUser: z.string().optional(),
        golfmanagerPassword: z.string().optional(),
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
  app.patch("/api/admin/courses/:id/details", isAdmin, async (req, res) => {
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
      const { lat, lng, radiusKm, date, players, fromTime, toTime, holes } = req.query;

      const courses = await storage.getAllCourses();
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

          slots.push({
            teeTime: slotDate.toISOString(),
            greenFee: adjustedPrice,
            currency: "EUR",
            players: numPlayers,
            holes: numHoles,
            source: "mock-provider",
            teeName: teeName,
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

      // Filter and sort courses by distance
      const coursesWithDistance = courses
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
          
          if (golfmanagerLink) {
            // Course has Golfmanager - show mock data with GM badge
            return {
              courseId: course.id,
              courseName: course.name,
              distanceKm: Math.round(distance * 10) / 10,
              bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
              slots: generateAllTeeSlots(
                course.name,
                date as string || new Date().toISOString(),
                fromTime as string || "07:00",
                toTime as string || "20:00",
                players ? parseInt(players as string) : 2,
                holes ? parseInt(holes as string) : 18
              ),
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
          return {
            courseId: course.id,
            courseName: course.name,
            distanceKm: Math.round(distance * 10) / 10,
            bookingUrl: course.bookingUrl || course.websiteUrl,
            slots: generateAllTeeSlots(
              course.name,
              date as string || new Date().toISOString(),
              fromTime as string || "07:00",
              toTime as string || "20:00",
              players ? parseInt(players as string) : 2,
              holes ? parseInt(holes as string) : 18
            ),
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
              players: booking.players
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
          } else {
            console.warn('⚠ SMTP not configured - skipping confirmation email. Set SMTP environment variables to enable email notifications.');
          }
        } catch (emailError) {
          // Log error but don't fail the booking
          console.error('Email sending failed:', emailError instanceof Error ? emailError.message : emailError);
          console.warn('⚠ Booking created successfully but confirmation email could not be sent');
        }
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
        description: `Tee time booking for ${booking.players} ${booking.players === 1 ? 'player' : 'players'} at ${course.name}.\\n\\nBooking Reference: ${booking.id}\\n\\nBooked via Fridas Golf - Your Personal Guide to Costa del Sol Golf`,
        location: `${course.name}, ${course.city}, ${course.province}, Spain`,
        startTime: startTime,
        endTime: endTime,
        organizer: 'mailto:bookings@fridasgolf.com'
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
        description: `Tee time booking for ${booking.players} ${booking.players === 1 ? 'player' : 'players'} at ${course.name}.\n\nBooking Reference: ${booking.id}\n\nBooked via Fridas Golf - Your Personal Guide to Costa del Sol Golf`,
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

        // Create affiliate email record
        const affiliateEmail = await storage.createAffiliateEmail({
          courseId,
          subject,
          body,
          status: "DRAFT",
          errorMessage: null,
        });

        // Send email
        const result = await sendAffiliateEmail(course, subject, body, senderName, emailConfig);

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

  // GET /api/providers - Get all tee time providers
  app.get("/api/providers", async (req, res) => {
    try {
      const providers = await storage.getAllProviders();
      res.json(providers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch providers" });
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
    console.log("[Webhook] Inbound email received!");
    console.log("[Webhook] Body keys:", Object.keys(req.body || {}));
    
    try {
      const { from, to, subject, text, html, headers } = req.body;
      
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
      
      // Create the inbound email message
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
      });
      
      console.log(`[Webhook] Email saved to thread ${thread.id}`);
      
      // Always return 200 to SendGrid to acknowledge receipt
      res.status(200).json({ success: true, threadId: thread.id });
    } catch (error) {
      console.error("[Webhook] Error processing inbound email:", error);
      // Still return 200 to prevent SendGrid retries
      res.status(200).send("OK");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
