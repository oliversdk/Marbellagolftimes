import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, real, index, jsonb } from "drizzle-orm/pg-core";
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
  kickbackPercent: real("kickback_percent").default(0), // Commission % (0-100)
  golfmanagerUser: text("golfmanager_user"), // Golfmanager API username
  golfmanagerPassword: text("golfmanager_password"), // Golfmanager API password
  // TeeOne API credentials
  teeoneIdEmpresa: integer("teeone_id_empresa"), // TeeOne company/club ID
  teeoneIdTeeSheet: integer("teeone_id_teesheet"), // TeeOne tee sheet ID
  teeoneApiUser: text("teeone_api_user"), // TeeOne API username
  teeoneApiPassword: text("teeone_api_password"), // TeeOne API password
  membersOnly: text("members_only").notNull().default("false"), // Members-only courses hidden from public
  // AI Enrichment fields
  facilitiesJson: text("facilities_json"), // JSON string with structured facilities data
  bookingRulesJson: text("booking_rules_json"), // JSON string with booking rules
  enrichmentStatus: text("enrichment_status").default("pending"), // pending, processing, complete, failed
  lastEnrichedAt: timestamp("last_enriched_at"),
});

export const insertGolfCourseSchema = createInsertSchema(golfCourses).omit({ id: true });
export type InsertGolfCourse = z.infer<typeof insertGolfCourseSchema>;
export type GolfCourse = typeof golfCourses.$inferSelect;

// Course Gallery Images
export const courseImages = pgTable("course_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCourseImageSchema = createInsertSchema(courseImages).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertCourseImage = z.infer<typeof insertCourseImageSchema>;
export type CourseImage = typeof courseImages.$inferSelect;

// Course Add-ons (buggy, clubs rental, trolley, etc.)
export const courseAddOns = pgTable("course_add_ons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(), // Price in cents (e.g., 3000 = €30.00)
  type: text("type").notNull(), // 'buggy_shared', 'buggy_individual', 'clubs', 'trolley', 'caddy', 'other'
  perPlayer: text("per_player").notNull().default("true"), // If true, multiply by number of players
  isActive: text("is_active").notNull().default("true"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertCourseAddOnSchema = createInsertSchema(courseAddOns).omit({ id: true });
export type InsertCourseAddOn = z.infer<typeof insertCourseAddOnSchema>;
export type CourseAddOn = typeof courseAddOns.$inferSelect;

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
  packageType: text("package_type"), // Selected package type (GREEN_FEE_BUGGY, GREEN_FEE_BUGGY_LUNCH, EARLY_BIRD, TWILIGHT)
  status: text("status").notNull().default("PENDING"), // PENDING, SENT_TO_COURSE, CONFIRMED, CANCELLED
  estimatedPrice: real("estimated_price"), // Estimated revenue in EUR
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

// Course Onboarding (Partnership Funnel)
export const courseOnboarding = pgTable("course_onboarding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id).unique(),
  // Funnel stage: NOT_CONTACTED, OUTREACH_SENT, INTERESTED, NOT_INTERESTED, PARTNERSHIP_ACCEPTED, CREDENTIALS_RECEIVED
  stage: text("stage").notNull().default("NOT_CONTACTED"),
  // Outreach tracking
  outreachSentAt: timestamp("outreach_sent_at"),
  outreachMethod: text("outreach_method"), // EMAIL, PHONE, IN_PERSON
  // Response tracking
  responseReceivedAt: timestamp("response_received_at"),
  responseNotes: text("response_notes"),
  // Partnership tracking
  partnershipAcceptedAt: timestamp("partnership_accepted_at"),
  agreedCommission: real("agreed_commission"), // Agreed kickback percentage
  // Credentials tracking
  credentialsReceivedAt: timestamp("credentials_received_at"),
  credentialsType: text("credentials_type"), // GOLFMANAGER_V1, GOLFMANAGER_V3, TEEONE, OTHER
  // Contact info
  contactPerson: text("contact_person"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // General
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCourseOnboardingSchema = createInsertSchema(courseOnboarding).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});

export type InsertCourseOnboarding = z.infer<typeof insertCourseOnboardingSchema>;
export type CourseOnboarding = typeof courseOnboarding.$inferSelect;

// Onboarding stages for funnel visualization
export const ONBOARDING_STAGES = [
  "NOT_CONTACTED",
  "OUTREACH_SENT", 
  "INTERESTED",
  "NOT_INTERESTED",
  "PARTNERSHIP_ACCEPTED",
  "CREDENTIALS_RECEIVED"
] as const;

export type OnboardingStage = typeof ONBOARDING_STAGES[number];

// Course Contact Logs (for tracking all communications)
export const courseContactLogs = pgTable("course_contact_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  type: text("type").notNull(), // EMAIL, PHONE, IN_PERSON, NOTE
  direction: text("direction").notNull().default("OUTBOUND"), // OUTBOUND, INBOUND
  subject: text("subject"),
  body: text("body"),
  outcome: text("outcome"), // POSITIVE, NEGATIVE, NEUTRAL, NO_RESPONSE
  loggedByUserId: varchar("logged_by_user_id").references(() => users.id),
  loggedAt: timestamp("logged_at").notNull().defaultNow(),
});

export const insertCourseContactLogSchema = createInsertSchema(courseContactLogs).omit({ 
  id: true, 
  loggedAt: true 
});

export type InsertCourseContactLog = z.infer<typeof insertCourseContactLogSchema>;
export type CourseContactLog = typeof courseContactLogs.$inferSelect;

// Contact log types
export const CONTACT_LOG_TYPES = ["EMAIL", "PHONE", "IN_PERSON", "NOTE"] as const;
export type ContactLogType = typeof CONTACT_LOG_TYPES[number];

// Unmatched Inbound Emails (for emails that couldn't be matched to a course)
export const unmatchedInboundEmails = pgTable("unmatched_inbound_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email"),
  subject: text("subject"),
  body: text("body"),
  assignedToCourseId: varchar("assigned_to_course_id").references(() => golfCourses.id),
  assignedByUserId: varchar("assigned_by_user_id").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const insertUnmatchedInboundEmailSchema = createInsertSchema(unmatchedInboundEmails).omit({ 
  id: true, 
  receivedAt: true,
  assignedToCourseId: true,
  assignedByUserId: true,
  assignedAt: true,
});

export type InsertUnmatchedInboundEmail = z.infer<typeof insertUnmatchedInboundEmailSchema>;
export type UnmatchedInboundEmail = typeof unmatchedInboundEmails.$inferSelect;

// Inbound Email Threads (conversations with golf courses)
export const inboundEmailThreads = pgTable("inbound_email_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => golfCourses.id), // Can be null for unmatched emails
  subject: text("subject").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  // Status tracking
  status: text("status").notNull().default("OPEN"), // OPEN, REPLIED, CLOSED, ARCHIVED
  isRead: text("is_read").notNull().default("false"),
  requiresResponse: text("requires_response").notNull().default("true"),
  // Response tracking
  respondedAt: timestamp("responded_at"),
  respondedByUserId: varchar("responded_by_user_id").references(() => users.id),
  // Assignment
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  // Alert tracking
  lastAlertSentAt: timestamp("last_alert_sent_at"),
  alertCount: integer("alert_count").notNull().default(0),
  isMuted: text("is_muted").notNull().default("false"), // Mute alerts for this thread
  // Timestamps
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInboundEmailThreadSchema = createInsertSchema(inboundEmailThreads).omit({ 
  id: true, 
  createdAt: true,
  lastActivityAt: true,
  respondedAt: true,
  lastAlertSentAt: true,
  alertCount: true,
});

export type InsertInboundEmailThread = z.infer<typeof insertInboundEmailThreadSchema>;
export type InboundEmailThread = typeof inboundEmailThreads.$inferSelect;

// Individual Email Messages within a thread
export const inboundEmails = pgTable("inbound_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => inboundEmailThreads.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // INBOUND, OUTBOUND
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email"),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  // Email metadata for threading
  messageId: text("message_id"), // Email Message-ID header
  inReplyTo: text("in_reply_to"), // In-Reply-To header
  references: text("references"), // References header
  // Attachments - JSON array of {name, size, type, documentId?} for saved attachments
  attachmentsJson: text("attachments_json"),
  // Tracking
  sentByUserId: varchar("sent_by_user_id").references(() => users.id), // For outbound emails
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const insertInboundEmailSchema = createInsertSchema(inboundEmails).omit({ 
  id: true, 
  receivedAt: true,
});

export type InsertInboundEmail = z.infer<typeof insertInboundEmailSchema>;
export type InboundEmail = typeof inboundEmails.$inferSelect;

// Thread statuses
export const THREAD_STATUSES = ["OPEN", "REPLIED", "CLOSED", "ARCHIVED", "DELETED"] as const;
export type ThreadStatus = typeof THREAD_STATUSES[number];

// Email directions
export const EMAIL_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type EmailDirection = typeof EMAIL_DIRECTIONS[number];

// Admin Alert Settings (for email notification preferences)
export const adminAlertSettings = pgTable("admin_alert_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  // Alert preferences
  emailAlerts: text("email_alerts").notNull().default("true"),
  alertEmail: text("alert_email"), // Override email for alerts
  // Timing
  slaHours: integer("sla_hours").notNull().default(2), // Hours before SLA breach alert
  digestFrequency: text("digest_frequency").notNull().default("INSTANT"), // INSTANT, HOURLY, DAILY
  // Quiet hours
  quietHoursStart: text("quiet_hours_start"), // e.g., "22:00"
  quietHoursEnd: text("quiet_hours_end"), // e.g., "08:00"
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdminAlertSettingsSchema = createInsertSchema(adminAlertSettings).omit({ 
  id: true, 
  updatedAt: true,
});

export type InsertAdminAlertSettings = z.infer<typeof insertAdminAlertSettingsSchema>;
export type AdminAlertSettings = typeof adminAlertSettings.$inferSelect;

// Digest frequencies
export const DIGEST_FREQUENCIES = ["INSTANT", "HOURLY", "DAILY"] as const;
export type DigestFrequency = typeof DIGEST_FREQUENCIES[number];

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

// Ad Campaigns (for ROI tracking)
export const adCampaigns = pgTable("ad_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // Google Ads, Facebook, Instagram, etc.
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  totalSpend: real("total_spend").notNull().default(0), // Total ad spend in EUR
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdCampaignSchema = createInsertSchema(adCampaigns).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
}).extend({
  startDate: z.string(),
  endDate: z.string().optional(),
  totalSpend: z.number().min(0, "Total spend must be positive"),
});

export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;
export type AdCampaign = typeof adCampaigns.$inferSelect;

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

// API Keys for External Integrations
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  scopes: text("scopes").array().notNull().default(sql`ARRAY['read:courses', 'read:bookings', 'write:bookings']::text[]`),
  createdById: varchar("created_by_id").references(() => users.id),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ 
  id: true, 
  createdAt: true,
  lastUsedAt: true,
  keyHash: true,
  keyPrefix: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Course Documents - for storing contracts, agreements, etc. per course
export const courseDocuments = pgTable("course_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Display name for the document
  fileName: text("file_name").notNull(), // Original file name
  fileUrl: text("file_url").notNull(), // Object storage URL
  fileType: text("file_type").notNull(), // MIME type (application/pdf, etc.)
  fileSize: integer("file_size"), // Size in bytes
  category: text("category").notNull().default("contract"), // contract, agreement, rate_card, other
  notes: text("notes"), // Optional notes about the document
  validFrom: timestamp("valid_from"), // Contract validity start
  validUntil: timestamp("valid_until"), // Contract validity end
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCourseDocumentSchema = createInsertSchema(courseDocuments).omit({ 
  id: true, 
  createdAt: true,
});

export type InsertCourseDocument = z.infer<typeof insertCourseDocumentSchema>;
export type CourseDocument = typeof courseDocuments.$inferSelect;

// Contract Ingestions - Track AI processing of uploaded contracts
export const contractIngestions = pgTable("contract_ingestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => courseDocuments.id, { onDelete: "cascade" }),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id),
  status: text("status").notNull().default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  rawText: text("raw_text"), // Extracted text from PDF
  parsedData: jsonb("parsed_data"), // AI-extracted structured data as JSON
  errorMessage: text("error_message"),
  confidenceScore: real("confidence_score"), // AI confidence 0-1
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContractIngestionSchema = createInsertSchema(contractIngestions).omit({ 
  id: true, 
  createdAt: true,
  processedAt: true,
});

export type InsertContractIngestion = z.infer<typeof insertContractIngestionSchema>;
export type ContractIngestion = typeof contractIngestions.$inferSelect;

// Contract ingestion statuses
export const INGESTION_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
export type IngestionStatus = typeof INGESTION_STATUSES[number];

// Course Rate Periods - Store seasonal kickback rates with dates
export const courseRatePeriods = pgTable("course_rate_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id, { onDelete: "cascade" }),
  ingestionId: varchar("ingestion_id").references(() => contractIngestions.id), // Link to source contract
  seasonLabel: text("season_label").notNull(), // e.g., "Low Season", "High Season", "Peak"
  packageType: text("package_type").notNull().default("GREEN_FEE_BUGGY"), // Package category
  startDate: text("start_date").notNull(), // Date range start (MM-DD format or month name)
  endDate: text("end_date").notNull(), // Date range end
  year: integer("year"), // Specific year if applicable
  rackRate: real("rack_rate").notNull(), // Public rate in EUR
  netRate: real("net_rate").notNull(), // Our negotiated rate in EUR
  kickbackPercent: real("kickback_percent").notNull(), // Calculated: ((rack-net)/rack)*100
  currency: text("currency").notNull().default("EUR"),
  // Package inclusions
  includesBuggy: text("includes_buggy").notNull().default("true"),
  includesLunch: text("includes_lunch").notNull().default("false"),
  includesCart: text("includes_cart").notNull().default("false"),
  // Time-based restrictions
  isEarlyBird: text("is_early_bird").notNull().default("false"), // Before 9am typically
  isTwilight: text("is_twilight").notNull().default("false"), // After 3pm typically
  timeRestriction: text("time_restriction"), // e.g., "8:00-9:00" or "from 15:00"
  // Group discount rules
  minPlayersForDiscount: integer("min_players_for_discount"), // e.g., 8 for "1 free per 8"
  freePlayersPerGroup: integer("free_players_per_group"), // e.g., 1 for "1 free per 8"
  notes: text("notes"), // Any special conditions
  isVerified: text("is_verified").notNull().default("false"), // Admin verified
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCourseRatePeriodSchema = createInsertSchema(courseRatePeriods).omit({ 
  id: true, 
  createdAt: true,
});

export type InsertCourseRatePeriod = z.infer<typeof insertCourseRatePeriodSchema>;
export type CourseRatePeriod = typeof courseRatePeriods.$inferSelect;

// Course Contacts - Store contact people from contracts
export const courseContacts = pgTable("course_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => golfCourses.id, { onDelete: "cascade" }),
  ingestionId: varchar("ingestion_id").references(() => contractIngestions.id), // Link to source contract
  name: text("name").notNull(),
  role: text("role"), // e.g., "Sales Manager", "Director", "Commercial"
  email: text("email"),
  phone: text("phone"),
  isPrimary: text("is_primary").notNull().default("false"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCourseContactSchema = createInsertSchema(courseContacts).omit({ 
  id: true, 
  createdAt: true,
});

export type InsertCourseContact = z.infer<typeof insertCourseContactSchema>;
export type CourseContact = typeof courseContacts.$inferSelect;

// Parsed contract data structure (for JSON storage)
export interface ParsedContractData {
  validFrom?: string;
  validUntil?: string;
  courseName?: string;
  partnerName?: string;
  contacts?: Array<{
    name: string;
    role?: string;
    email?: string;
    phone?: string;
  }>;
  ratePeriods?: Array<{
    seasonLabel: string;
    startDate: string;
    endDate: string;
    rackRate: number;
    netRate: number;
    kickbackPercent: number;
    currency?: string;
    notes?: string;
  }>;
  specialTerms?: Array<{
    type: string; // GROUP_DISCOUNT, EARLY_BIRD, BUGGY_INCLUDED, etc.
    description: string;
    value?: number; // e.g., "1 free per 8 paying" -> 8
  }>;
  currency?: string;
  rawTerms?: string[];
}

// API Response Types
export interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  holes: number;
  source: string;
  teeName?: string; // e.g., "TEE 1", "TEE 10", "Los Lagos", "Campo America"
  slotsAvailable?: number; // 1-4: Number of remaining player slots available (ontee.com style dots indicator)
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
  providerName?: "golfmanager" | "teeone" | "zest" | null;
}

export interface CourseWithReviews extends GolfCourse {
  averageRating?: number;
  reviewCount?: number;
  reviews?: CourseReview[];
}
