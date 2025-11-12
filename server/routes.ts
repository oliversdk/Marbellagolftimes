import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendAffiliateEmail, getEmailConfig } from "./email";
import { insertBookingRequestSchema, insertAffiliateEmailSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/courses - Get all golf courses
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      res.json(courses);
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
      res.json(course);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  // GET /api/slots/search - Mock tee-time search
  // This is a placeholder for future provider integration
  app.get("/api/slots/search", async (req, res) => {
    try {
      const { lat, lng, radiusKm, date, players, fromTime, toTime } = req.query;

      // For now, return mock data structure
      const courses = await storage.getAllCourses();

      // Mock response showing structure for future implementation
      const mockSlots = courses.slice(0, 5).map((course) => ({
        courseId: course.id,
        courseName: course.name,
        distanceKm: Math.random() * 50, // Mock distance
        bookingUrl: course.bookingUrl || course.websiteUrl,
        slots: [
          {
            teeTime: new Date().toISOString(),
            greenFee: Math.floor(Math.random() * 100) + 50,
            currency: "EUR",
            players: players ? parseInt(players as string) : 2,
            source: "mock",
          },
        ],
        note: "Booking via club website - real-time availability coming soon",
      }));

      res.json(mockSlots);
    } catch (error) {
      res.status(500).json({ error: "Failed to search slots" });
    }
  });

  // POST /api/bookings - Create booking request
  app.post("/api/bookings", async (req, res) => {
    try {
      const validatedData = insertBookingRequestSchema.parse(req.body);
      const booking = await storage.createBooking(validatedData);
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid booking data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // GET /api/bookings - Get all booking requests
  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // GET /api/bookings/:id - Get booking by ID
  app.get("/api/bookings/:id", async (req, res) => {
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

  // POST /api/affiliate-emails/send - Send affiliate partnership emails
  app.post("/api/affiliate-emails/send", async (req, res) => {
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

  // GET /api/affiliate-emails - Get all affiliate email records
  app.get("/api/affiliate-emails", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
