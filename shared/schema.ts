import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Code from blueprint:javascript_log_in_with_replit
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Code from blueprint:javascript_log_in_with_replit
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Golf Courses
export const golfCourses = pgTable("golf_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  country: text("country").notNull().default("Spain"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  websiteUrl: text("website_url"),
  bookingUrl: text("booking_url"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  facilities: text("facilities").array(),
});

export const insertGolfCourseSchema = createInsertSchema(golfCourses).omit({ id: true });
export type InsertGolfCourse = z.infer<typeof insertGolfCourseSchema>;
export type GolfCourse = typeof golfCourses.$inferSelect;

// Tee Time Providers
export const teeTimeProviders = pgTable("tee_time_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  type: text("type").notNull(), // SCRAPER, API, DEEP_LINK_ONLY
  config: text("config"), // JSON string for additional config
});

export const insertTeeTimeProviderSchema = createInsertSchema(teeTimeProviders).omit({ id: true });
export type InsertTeeTimeProvider = z.infer<typeof insertTeeTimeProviderSchema>;
export type TeeTimeProvider = typeof teeTimeProviders.$inferSelect;

// Course Provider Links
export const courseProviderLinks = pgTable("course_provider_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  providerId: varchar("provider_id").notNull().references(() => teeTimeProviders.id),
  providerCourseCode: text("provider_course_code"),
  bookingUrl: text("booking_url"),
});

export const insertCourseProviderLinkSchema = createInsertSchema(courseProviderLinks).omit({ id: true });
export type InsertCourseProviderLink = z.infer<typeof insertCourseProviderLinkSchema>;
export type CourseProviderLink = typeof courseProviderLinks.$inferSelect;

// Booking Requests
export const bookingRequests = pgTable("booking_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  teeTime: timestamp("tee_time").notNull(),
  players: integer("players").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("PENDING"), // PENDING, SENT_TO_COURSE, CONFIRMED, CANCELLED
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({ 
  id: true, 
  createdAt: true 
}).extend({
  teeTime: z.string(),
});

export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;
export type BookingRequest = typeof bookingRequests.$inferSelect;

// Affiliate Emails
export const affiliateEmails = pgTable("affiliate_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at"),
  status: text("status").notNull().default("DRAFT"), // DRAFT, SENT, ERROR
  errorMessage: text("error_message"),
});

export const insertAffiliateEmailSchema = createInsertSchema(affiliateEmails).omit({ 
  id: true, 
  sentAt: true 
});

export type InsertAffiliateEmail = z.infer<typeof insertAffiliateEmailSchema>;
export type AffiliateEmail = typeof affiliateEmails.$inferSelect;

// API Response Types
export interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  holes: number;
  source: string;
}

export interface CourseWithSlots {
  courseId: string;
  courseName: string;
  distanceKm: number;
  bookingUrl?: string;
  slots: TeeTimeSlot[];
  note?: string;
  course?: GolfCourse;
  providerType: "API" | "DEEP_LINK" | "NONE";
}
