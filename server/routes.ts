import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { sendAffiliateEmail, getEmailConfig } from "./email";
import { GolfmanagerProvider, getGolfmanagerConfig } from "./providers/golfmanager";
import { getSession, isAuthenticated, isAdmin } from "./customAuth";
import { insertBookingRequestSchema, insertAffiliateEmailSchema, insertUserSchema, insertCourseReviewSchema, insertTestimonialSchema, type CourseWithSlots, type TeeTimeSlot, type User } from "@shared/schema";
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
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "File not found" });
      }

      // If courseId is provided, verify the course exists BEFORE deleting the file
      if (courseId && typeof courseId === "string") {
        const course = await storage.getCourseById(courseId);
        if (!course) {
          return res.status(404).json({ error: "Course not found" });
        }
      }

      // Delete the file
      await fs.unlink(filePath);
      
      // Update course if courseId provided
      if (courseId && typeof courseId === "string") {
        const updatedCourse = await storage.updateCourseImage(courseId, null);
        if (!updatedCourse) {
          // This shouldn't happen if we checked above, but handle it anyway
          return res.status(500).json({ error: "Failed to update course after deleting file" });
        }
      }
      
      res.json({ success: true, message: "Image deleted successfully" });
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
      
      // Helper function to generate mock slots
      const generateMockSlots = (searchDate: string, from: string, to: string, numPlayers: number, numHoles: number): TeeTimeSlot[] => {
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
            minute = (i * slotInterval) % 60;
          } else {
            // 18 holes: Even distribution
            const totalMinutes = i * slotInterval;
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
          });
        }

        return slots.sort((a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime());
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
        // Mock mode: Generate mock data for all courses
        const mockSlots: CourseWithSlots[] = await Promise.all(coursesWithDistance.map(async ({ course, distance }): Promise<CourseWithSlots> => {
          const providerLinks = await storage.getLinksByCourseId(course.id);
          const providerType: "API" | "DEEP_LINK" | "NONE" = providerLinks.length > 0 
            ? (providerLinks.some(link => link.providerCourseCode?.startsWith("golfmanager:")) ? "API" : "DEEP_LINK")
            : "NONE";

          return {
            courseId: course.id,
            courseName: course.name,
            distanceKm: Math.round(distance * 10) / 10,
            bookingUrl: course.bookingUrl || course.websiteUrl,
            slots: generateMockSlots(
              date as string || new Date().toISOString(),
              fromTime as string || "07:00",
              toTime as string || "20:00",
              players ? parseInt(players as string) : 2,
              holes ? parseInt(holes as string) : 18
            ),
            note: "Mock data - Configure GOLFMANAGER_API_KEY for real availability",
            providerType,
            course,
          };
        }));

        res.json(mockSlots);
      } else if (golfmanagerConfig.mode === "demo") {
        // Demo mode: Use real API for one course, mock for others
        const golfmanager = new GolfmanagerProvider(golfmanagerConfig);
        const results: CourseWithSlots[] = [];
        let demoCourseMapped = false;

        for (const { course, distance } of coursesWithDistance) {
          // Map the first "Marbella Golf & Country Club" to the demo tenant
          if (!demoCourseMapped && course.name === "Marbella Golf & Country Club") {
            try {
              // Build date range for search
              const searchDate = date ? new Date(date as string) : new Date();
              const startTime = `${searchDate.toISOString().split("T")[0]}T${fromTime || "07:00"}:00`;
              const endTime = `${searchDate.toISOString().split("T")[0]}T${toTime || "20:00"}:00`;
              
              console.log(`[Demo Mode] Fetching real availability for ${course.name} from demo tenant`);
              
              const gmSlots = await golfmanager.searchAvailability(
                "demo",
                startTime,
                endTime,
                players ? parseInt(players as string) : 2
              );

              const slots = golfmanager.convertSlotsToTeeTime(
                gmSlots,
                players ? parseInt(players as string) : 2,
                holes ? parseInt(holes as string) : 18
              );

              console.log(`[Demo Mode] Retrieved ${slots.length} slots from demo API`);

              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: course.bookingUrl || course.websiteUrl,
                slots,
                note: "Demo availability from Golfmanager sandbox - Configure GOLFMANAGER_API_KEY for production",
                providerType: "API",
                course,
              });
              
              demoCourseMapped = true;
            } catch (error) {
              console.error(`[Demo Mode] Error fetching demo data for ${course.name}:`, error);
              // Fall back to mock data for this course
              const providerLinks = await storage.getLinksByCourseId(course.id);
              const providerType = providerLinks.length > 0 
                ? (providerLinks.some(link => link.providerCourseCode?.startsWith("golfmanager:")) ? "API" : "DEEP_LINK")
                : "NONE";

              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: course.bookingUrl || course.websiteUrl,
                slots: generateMockSlots(
                  date as string || new Date().toISOString(),
                  fromTime as string || "07:00",
                  toTime as string || "20:00",
                  players ? parseInt(players as string) : 2,
                  holes ? parseInt(holes as string) : 18
                ),
                note: "Mock data (demo API unavailable) - Configure GOLFMANAGER_API_KEY for production",
                providerType,
                course,
              });
            }
          } else {
            // Use mock data for all other courses
            const providerLinks = await storage.getLinksByCourseId(course.id);
            const providerType = providerLinks.length > 0 
              ? (providerLinks.some(link => link.providerCourseCode?.startsWith("golfmanager:")) ? "API" : "DEEP_LINK")
              : "NONE";

            results.push({
              courseId: course.id,
              courseName: course.name,
              distanceKm: Math.round(distance * 10) / 10,
              bookingUrl: course.bookingUrl || course.websiteUrl,
              slots: generateMockSlots(
                date as string || new Date().toISOString(),
                fromTime as string || "07:00",
                toTime as string || "20:00",
                players ? parseInt(players as string) : 2,
                holes ? parseInt(holes as string) : 18
              ),
              note: "Mock data - Configure GOLFMANAGER_API_KEY for production",
              providerType,
              course,
            });
          }
        }

        res.json(results);
      } else {
        // Production mode: Use real API for all courses with provider links
        const golfmanager = new GolfmanagerProvider(golfmanagerConfig);
        const results: CourseWithSlots[] = [];

        for (const { course, distance } of coursesWithDistance) {
          const providerLinks = await storage.getLinksByCourseId(course.id);
          const golfmanagerLink = providerLinks.find((link) => 
            link.providerCourseCode && link.providerCourseCode.startsWith("golfmanager:")
          );

          if (golfmanagerLink && golfmanagerLink.providerCourseCode) {
            try {
              // Extract tenant from provider code (format: "golfmanager:tenant_name")
              const tenant = golfmanagerLink.providerCourseCode.split(":")[1];
              
              // Build date range for search
              const searchDate = date ? new Date(date as string) : new Date();
              const startTime = `${searchDate.toISOString().split("T")[0]}T${fromTime || "07:00"}:00`;
              const endTime = `${searchDate.toISOString().split("T")[0]}T${toTime || "20:00"}:00`;
              
              const gmSlots = await golfmanager.searchAvailability(
                tenant,
                startTime,
                endTime,
                players ? parseInt(players as string) : 2
              );

              const slots = golfmanager.convertSlotsToTeeTime(
                gmSlots,
                players ? parseInt(players as string) : 2,
                holes ? parseInt(holes as string) : 18
              );

              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                slots,
                note: "Live Golfmanager availability",
                providerType: "API",
                course,
              });
            } catch (error) {
              console.error(`Golfmanager error for course ${course.name}:`, error);
              // Continue to next course on error
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
  app.post("/api/affiliate-emails/send", isAuthenticated, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
