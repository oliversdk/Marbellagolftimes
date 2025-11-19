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

// User storage table with custom email/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phoneNumber: varchar("phone_number"),
  passwordHash: varchar("password_hash").notNull(),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"), // For future Stripe integration
  isAdmin: text("is_admin").notNull().default("false"), // Admin role flag
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stripeCustomerId: true,
  profileImageUrl: true,
  passwordHash: true,
  isAdmin: true, // Prevent users from setting admin during signup
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
  phoneNumber: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
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
  userId: varchar("user_id").references(() => users.id), // Nullable for guest bookings
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  teeTime: timestamp("tee_time").notNull(),
  players: integer("players").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("PENDING"), // PENDING, SENT_TO_COURSE, CONFIRMED, CANCELLED
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
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

// Course Reviews
export const courseReviews = pgTable("course_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 stars
  title: text("title"),
  review: text("review"),
  photoUrls: text("photo_urls").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCourseReviewSchema = createInsertSchema(courseReviews).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
}).extend({
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  review: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

export type InsertCourseReview = z.infer<typeof insertCourseReviewSchema>;
export type CourseReview = typeof courseReviews.$inferSelect;

// Testimonials
export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  customerName: text("customer_name").notNull(),
  content: text("content").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  location: text("location"), // e.g., "Marbella, Spain"
  isApproved: text("is_approved").notNull().default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTestimonialSchema = createInsertSchema(testimonials).omit({ 
  id: true, 
  createdAt: true,
  isApproved: true 
}).extend({
  rating: z.number().min(1).max(5),
});

export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
export type Testimonial = typeof testimonials.$inferSelect;

// Blog Posts
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImageUrl: text("cover_image_url"),
  authorId: varchar("author_id").notNull().references(() => users.id),
  category: text("category"), // e.g., "Golf Tips", "Course Guides"
  tags: text("tags").array(),
  isPublished: text("is_published").notNull().default("false"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
  publishedAt: true 
});

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// Newsletters
export const newsletters = pgTable("newsletters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  recipientType: text("recipient_type").notNull(), // ALL, RECENT_BOOKERS, SUBSCRIBERS
  sentAt: timestamp("sent_at"),
  sentCount: integer("sent_count").default(0),
  status: text("status").notNull().default("DRAFT"), // DRAFT, SENDING, SENT, ERROR
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNewsletterSchema = createInsertSchema(newsletters).omit({ 
  id: true, 
  createdAt: true,
  sentAt: true,
  sentCount: true 
});

export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type Newsletter = typeof newsletters.$inferSelect;

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

export interface CourseWithReviews extends GolfCourse {
  averageRating?: number;
  reviewCount?: number;
  reviews?: CourseReview[];
}
