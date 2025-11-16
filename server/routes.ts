import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendAffiliateEmail, getEmailConfig } from "./email";
import { GolfmanagerProvider, getGolfmanagerConfig } from "./providers/golfmanager";
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

  // GET /api/slots/search - Tee-time availability search
  app.get("/api/slots/search", async (req, res) => {
    try {
      const { lat, lng, radiusKm, date, players, fromTime, toTime } = req.query;

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
      const generateMockSlots = (searchDate: string, from: string, to: string, numPlayers: number) => {
        const slots = [];
        const [fromHour] = from.split(":").map(Number);
        const [toHour] = to.split(":").map(Number);
        const numSlots = Math.floor(Math.random() * 3) + 3;
        const baseDate = searchDate ? new Date(searchDate) : new Date();
        baseDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < numSlots; i++) {
          const hour = fromHour + Math.floor(Math.random() * (toHour - fromHour));
          const minute = Math.random() < 0.5 ? 0 : 30;
          const slotDate = new Date(baseDate);
          slotDate.setHours(hour, minute, 0, 0);

          slots.push({
            teeTime: slotDate.toISOString(),
            greenFee: Math.floor(Math.random() * 80) + 40,
            currency: "EUR",
            players: numPlayers,
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
        const mockSlots = coursesWithDistance.map(({ course, distance }) => ({
          courseId: course.id,
          courseName: course.name,
          distanceKm: Math.round(distance * 10) / 10,
          bookingUrl: course.bookingUrl || course.websiteUrl,
          slots: generateMockSlots(
            date as string || new Date().toISOString(),
            fromTime as string || "07:00",
            toTime as string || "20:00",
            players ? parseInt(players as string) : 2
          ),
          note: "Mock data - Configure GOLFMANAGER_API_KEY for real availability",
        }));

        res.json(mockSlots);
      } else if (golfmanagerConfig.mode === "demo") {
        // Demo mode: Use real API for one course, mock for others
        const golfmanager = new GolfmanagerProvider(golfmanagerConfig);
        const results = [];
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
                players ? parseInt(players as string) : 2
              );

              console.log(`[Demo Mode] Retrieved ${slots.length} slots from demo API`);

              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: course.bookingUrl || course.websiteUrl,
                slots,
                note: "Demo availability from Golfmanager sandbox - Configure GOLFMANAGER_API_KEY for production",
              });
              
              demoCourseMapped = true;
            } catch (error) {
              console.error(`[Demo Mode] Error fetching demo data for ${course.name}:`, error);
              // Fall back to mock data for this course
              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: course.bookingUrl || course.websiteUrl,
                slots: generateMockSlots(
                  date as string || new Date().toISOString(),
                  fromTime as string || "07:00",
                  toTime as string || "20:00",
                  players ? parseInt(players as string) : 2
                ),
                note: "Mock data (demo API unavailable) - Configure GOLFMANAGER_API_KEY for production",
              });
            }
          } else {
            // Use mock data for all other courses
            results.push({
              courseId: course.id,
              courseName: course.name,
              distanceKm: Math.round(distance * 10) / 10,
              bookingUrl: course.bookingUrl || course.websiteUrl,
              slots: generateMockSlots(
                date as string || new Date().toISOString(),
                fromTime as string || "07:00",
                toTime as string || "20:00",
                players ? parseInt(players as string) : 2
              ),
              note: "Mock data - Configure GOLFMANAGER_API_KEY for production",
            });
          }
        }

        res.json(results);
      } else {
        // Production mode: Use real API for all courses with provider links
        const golfmanager = new GolfmanagerProvider(golfmanagerConfig);
        const results = [];

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
                players ? parseInt(players as string) : 2
              );

              results.push({
                courseId: course.id,
                courseName: course.name,
                distanceKm: Math.round(distance * 10) / 10,
                bookingUrl: golfmanagerLink.bookingUrl || course.bookingUrl || course.websiteUrl,
                slots,
                note: "Live Golfmanager availability",
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
