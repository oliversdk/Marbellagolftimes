import {
  type GolfCourse,
  type InsertGolfCourse,
  type TeeTimeProvider,
  type InsertTeeTimeProvider,
  type CourseProviderLink,
  type InsertCourseProviderLink,
  type BookingRequest,
  type InsertBookingRequest,
  type AffiliateEmail,
  type InsertAffiliateEmail,
  type User,
  type CourseReview,
  type InsertCourseReview,
  type Testimonial,
  type InsertTestimonial,
  type AdCampaign,
  type InsertAdCampaign,
  type CourseOnboarding,
  type InsertCourseOnboarding,
  type OnboardingStage,
  type CourseContactLog,
  type InsertCourseContactLog,
  type CourseImage,
  type InsertCourseImage,
  type UnmatchedInboundEmail,
  type InsertUnmatchedInboundEmail,
  type InboundEmailThread,
  type InsertInboundEmailThread,
  type InboundEmail,
  type InsertInboundEmail,
  type AdminAlertSettings,
  type ApiKey,
  golfCourses,
  teeTimeProviders,
  courseProviderLinks,
  bookingRequests,
  affiliateEmails,
  users,
  courseReviews,
  testimonials,
  adCampaigns,
  blogPosts,
  courseOnboarding,
  courseContactLogs,
  courseImages,
  unmatchedInboundEmails,
  inboundEmailThreads,
  inboundEmails,
  adminAlertSettings,
  apiKeys,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, ne, desc, sql as sqlFunc, sql, count, sum, and, or, isNull, lt } from "drizzle-orm";

export interface IStorage {
  // Golf Courses
  getAllCourses(): Promise<GolfCourse[]>;
  getPublicCourses(): Promise<GolfCourse[]>; // Excludes members-only courses
  getCourseById(id: string): Promise<GolfCourse | undefined>;
  createCourse(course: InsertGolfCourse): Promise<GolfCourse>;
  updateCourse(id: string, updates: Partial<GolfCourse>): Promise<GolfCourse | undefined>;
  updateCourseImage(courseId: string, imageUrl: string | null): Promise<GolfCourse | undefined>;
  setMembersOnly(courseId: string, membersOnly: boolean): Promise<GolfCourse | undefined>;

  // Tee Time Providers
  getAllProviders(): Promise<TeeTimeProvider[]>;
  getProviderById(id: string): Promise<TeeTimeProvider | undefined>;
  createProvider(provider: InsertTeeTimeProvider): Promise<TeeTimeProvider>;

  // Course Provider Links
  getAllLinks(): Promise<CourseProviderLink[]>;
  getLinksByCourseId(courseId: string): Promise<CourseProviderLink[]>;
  createLink(link: InsertCourseProviderLink): Promise<CourseProviderLink>;
  deleteLinksByCourseId(courseId: string): Promise<boolean>;
  setCourseProvider(courseId: string, providerType: string | null, providerCourseCode?: string): Promise<boolean>;

  // Booking Requests
  getAllBookings(): Promise<BookingRequest[]>;
  getBookingById(id: string): Promise<BookingRequest | undefined>;
  getBookingsByUserId(userId: string): Promise<(BookingRequest & { courseName?: string })[]>;
  createBooking(booking: InsertBookingRequest): Promise<BookingRequest>;
  cancelBooking(id: string, reason?: string): Promise<BookingRequest | undefined>;
  updateBookingStatus(id: string, status: string): Promise<BookingRequest | undefined>;

  // Affiliate Emails
  getAllAffiliateEmails(): Promise<AffiliateEmail[]>;
  createAffiliateEmail(email: InsertAffiliateEmail): Promise<AffiliateEmail>;
  updateAffiliateEmail(id: string, updates: Partial<AffiliateEmail>): Promise<AffiliateEmail | undefined>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string; firstName: string; lastName: string; phoneNumber?: string; passwordHash: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
  setUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined>;
  updateUser(id: string, updates: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string; isAdmin?: string }): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Course Reviews
  getAllReviewsByCourseId(courseId: string): Promise<CourseReview[]>;
  getReviewById(id: string): Promise<CourseReview | undefined>;
  createReview(review: InsertCourseReview): Promise<CourseReview>;
  updateReview(id: string, updates: Partial<CourseReview>): Promise<CourseReview | undefined>;
  deleteReview(id: string): Promise<boolean>;

  // Testimonials
  getAllTestimonials(): Promise<Testimonial[]>;
  getApprovedTestimonials(): Promise<Testimonial[]>;
  createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial>;
  approveTestimonial(id: string): Promise<Testimonial | undefined>;
  deleteTestimonial(id: string): Promise<boolean>;

  // Analytics
  getBookingsAnalytics(period: 'day' | 'week' | 'month'): Promise<Array<{ date: string; count: number }>>;
  getRevenueAnalytics(): Promise<{ totalRevenue: number; averageBookingValue: number; confirmedBookings: number }>;
  getPopularCourses(limit?: number): Promise<Array<{ courseId: string; courseName: string; bookingCount: number }>>;
  
  // Commission Analytics
  getCommissionAnalytics(): Promise<{
    totalCommission: number;
    commissionsPerCourse: Array<{ courseId: string; courseName: string; commission: number; bookingCount: number }>;
  }>;
  getCommissionByPeriod(period: 'day' | 'week' | 'month'): Promise<Array<{ date: string; commission: number }>>;

  // Ad Campaigns CRUD
  getAllCampaigns(): Promise<AdCampaign[]>;
  getCampaignById(id: string): Promise<AdCampaign | undefined>;
  createCampaign(campaign: InsertAdCampaign): Promise<AdCampaign>;
  updateCampaign(id: string, updates: Partial<AdCampaign>): Promise<AdCampaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // ROI Analytics  
  getROIAnalytics(): Promise<{
    totalCommission: number;
    totalAdSpend: number;
    netProfit: number;
    roi: number;
  }>;

  // Course Onboarding
  getAllOnboarding(): Promise<CourseOnboarding[]>;
  getOnboardingByCourseId(courseId: string): Promise<CourseOnboarding | undefined>;
  createOnboarding(onboarding: InsertCourseOnboarding): Promise<CourseOnboarding>;
  updateOnboarding(courseId: string, updates: Partial<CourseOnboarding>): Promise<CourseOnboarding | undefined>;
  updateOnboardingStage(courseId: string, stage: OnboardingStage): Promise<CourseOnboarding | undefined>;
  getOnboardingStats(): Promise<Record<OnboardingStage, number>>;

  // Course Contact Logs
  getContactLogsByCourseId(courseId: string): Promise<CourseContactLog[]>;
  createContactLog(log: InsertCourseContactLog): Promise<CourseContactLog>;
  deleteContactLog(id: string): Promise<boolean>;

  // Course Gallery Images
  getImagesByCourseId(courseId: string): Promise<CourseImage[]>;
  createCourseImage(image: InsertCourseImage): Promise<CourseImage>;
  deleteCourseImage(id: string): Promise<boolean>;
  reorderCourseImages(courseId: string, imageIds: string[]): Promise<void>;

  // Unmatched Inbound Emails
  getUnmatchedEmails(): Promise<UnmatchedInboundEmail[]>;
  createUnmatchedEmail(email: InsertUnmatchedInboundEmail): Promise<UnmatchedInboundEmail>;
  assignEmailToCourse(emailId: string, courseId: string, assignedByUserId: string): Promise<UnmatchedInboundEmail | undefined>;
  deleteUnmatchedEmail(id: string): Promise<boolean>;

  // Inbound Email Threads
  getAllInboundThreads(includeDeleted?: boolean): Promise<InboundEmailThread[]>;
  getDeletedInboundThreads(): Promise<InboundEmailThread[]>;
  getInboundThreadById(id: string): Promise<InboundEmailThread | undefined>;
  getInboundThreadByCourseId(courseId: string): Promise<InboundEmailThread[]>;
  getUnansweredThreadsCount(): Promise<number>;
  getUnansweredThreads(): Promise<InboundEmailThread[]>;
  createInboundThread(thread: InsertInboundEmailThread): Promise<InboundEmailThread>;
  updateInboundThread(id: string, updates: Partial<InboundEmailThread>): Promise<InboundEmailThread | undefined>;
  markThreadAsRead(id: string): Promise<InboundEmailThread | undefined>;
  markThreadAsReplied(id: string, userId: string): Promise<InboundEmailThread | undefined>;
  muteThread(id: string, muted: boolean): Promise<InboundEmailThread | undefined>;
  deleteThread(id: string): Promise<InboundEmailThread | undefined>;
  restoreThread(id: string): Promise<InboundEmailThread | undefined>;
  permanentlyDeleteThread(id: string): Promise<boolean>;
  
  // Inbound Emails (messages within threads)
  getEmailsByThreadId(threadId: string): Promise<InboundEmail[]>;
  createInboundEmail(email: InsertInboundEmail): Promise<InboundEmail>;
  findThreadByEmailHeaders(messageId: string | null, inReplyTo: string | null, fromEmail: string): Promise<InboundEmailThread | undefined>;
  
  // Admin Alert Settings
  getAdminAlertSettings(userId: string): Promise<AdminAlertSettings | undefined>;
  upsertAdminAlertSettings(userId: string, settings: Partial<AdminAlertSettings>): Promise<AdminAlertSettings>;
  getAdminsForAlerts(): Promise<{ userId: string; email: string; alertEmail?: string | null }[]>;
  getOverdueThreads(slaHours: number): Promise<InboundEmailThread[]>;

  // API Keys
  createApiKey(name: string, scopes: string[], createdById: string, expiresAt?: Date): Promise<{ apiKey: ApiKey; rawKey: string }>;
  validateApiKey(rawKey: string): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string }>;
  getAllApiKeys(): Promise<ApiKey[]>;
  revokeApiKey(id: string): Promise<boolean>;
  updateApiKeyLastUsed(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private courses: Map<string, GolfCourse>;
  private providers: Map<string, TeeTimeProvider>;
  private links: Map<string, CourseProviderLink>;
  private bookings: Map<string, BookingRequest>;
  private affiliateEmails: Map<string, AffiliateEmail>;
  private users: Map<string, User>;
  private courseReviews: Map<string, CourseReview>;
  private testimonials: Map<string, Testimonial>;
  private campaigns: Map<string, AdCampaign>;

  constructor() {
    this.courses = new Map();
    this.providers = new Map();
    this.links = new Map();
    this.bookings = new Map();
    this.affiliateEmails = new Map();
    this.users = new Map();
    this.courseReviews = new Map();
    this.testimonials = new Map();
    this.campaigns = new Map();
    
    // Seed initial data
    this.seedData();
  }

  private seedData() {
    // Seed golf courses from Costa del Sol
    const seedCourses: InsertGolfCourse[] = [
      // Sotogrande / San Roque area
      {
        name: "Real Club Valderrama",
        city: "Sotogrande",
        province: "Cádiz",
        country: "Spain",
        lat: "36.2950",
        lng: "-5.2870",
        websiteUrl: "https://www.valderrama.com",
        bookingUrl: "https://open.imaster.golf/en/valderrama/disponibilidad",
        email: "greenfees@valderrama.com",
        phone: "+34 956 79 12 00",
        notes: "Host of 1997 Ryder Cup - €500 green fee",
        imageUrl: "/generated_images/Valderrama_aerial_sunset_view_d9530718.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "Real Club de Golf Sotogrande",
        city: "Sotogrande",
        province: "Cádiz",
        country: "Spain",
        lat: "36.2920",
        lng: "-5.2780",
        websiteUrl: "https://www.golfsotogrande.com",
        bookingUrl: "https://www.golfsotogrande.com",
        email: "info@golfsotogrande.com",
        phone: "+34 956 78 50 14",
        notes: "Robert Trent Jones design",
        imageUrl: "/generated_images/Coastal_bunker_ocean_view_a3735d23.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "La Reserva Club Sotogrande",
        city: "Sotogrande",
        province: "Cádiz",
        country: "Spain",
        lat: "36.2985",
        lng: "-5.2645",
        websiteUrl: "https://www.sotogrande.com",
        bookingUrl: "https://www.sotogrande.com/en/golf",
        email: "lareserva@sotogrande.com",
        phone: "+34 956 78 52 52",
        notes: "Modern parkland course",
        imageUrl: "/generated_images/Modern_clubhouse_mountain_view_2032acdf.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "San Roque Club",
        city: "San Roque",
        province: "Cádiz",
        country: "Spain",
        lat: "36.2150",
        lng: "-5.3850",
        websiteUrl: "https://www.sanroqueclub.com",
        bookingUrl: "https://www.sanroqueclub.com",
        email: "info@sanroqueclub.com",
        phone: "+34 956 61 30 30",
        notes: "Two courses: Old and New",
        imageUrl: "/generated_images/Olive_tree_lined_fairway_35bef37a.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "Club de Golf La Cañada",
        city: "Guadiaro",
        province: "Cádiz",
        country: "Spain",
        lat: "36.2780",
        lng: "-5.2980",
        websiteUrl: "https://www.lacanadagolf.com",
        bookingUrl: "https://www.lacanadagolf.com",
        email: "reservas@lacanadagolf.com",
        phone: "+34 956 79 41 00",
        notes: "Family-friendly course",
        imageUrl: "/generated_images/Island_green_water_feature_cba96746.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },

      // Casares / Estepona area
      {
        name: "Finca Cortesín Golf Club",
        city: "Casares",
        province: "Málaga",
        country: "Spain",
        lat: "36.4125",
        lng: "-5.2340",
        websiteUrl: "https://www.fincacortesin.com",
        bookingUrl: "https://www.fincacortesin.com/golf",
        email: "proshop@golfcortesin.es",
        phone: "+34 952 93 78 84",
        notes: "Hosted Volvo World Match Play",
        imageUrl: "/generated_images/Misty_sunrise_fairway_f4daefff.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "Casares Costa Golf",
        city: "Casares",
        province: "Málaga",
        country: "Spain",
        lat: "36.4015",
        lng: "-5.2710",
        websiteUrl: "https://www.casarescostagolf.com",
        bookingUrl: "https://www.casarescostagolf.com",
        email: "info@casarescostagolf.com",
        phone: "+34 952 89 50 00",
        notes: "Coastal views",
        imageUrl: "/generated_images/Elevated_tee_valley_vista_9d043485.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Doña Julia Golf Club",
        city: "Casares",
        province: "Málaga",
        country: "Spain",
        lat: "36.3980",
        lng: "-5.2580",
        websiteUrl: "https://www.donajuliagolf.es",
        bookingUrl: "https://www.donajuliagolf.es",
        email: "reservas@donajuliagolf.es",
        phone: "+34 952 93 77 53",
        notes: "Mountain and sea views",
        imageUrl: "/generated_images/Dunes_green_grass_bunkers_598731ad.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Valle Romano Golf & Resort",
        city: "Estepona",
        province: "Málaga",
        country: "Spain",
        lat: "36.4520",
        lng: "-5.1235",
        websiteUrl: "https://www.valleromano.es",
        bookingUrl: "https://www.valleromano.es/en/golf",
        email: "reservasgolf@valleromano.es",
        phone: "+34 952 80 99 00",
        notes: "Resort with hotel",
        imageUrl: "/generated_images/Resort_pool_golf_view_4e3e8823.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "El Paraíso Golf Club",
        city: "Estepona",
        province: "Málaga",
        country: "Spain",
        lat: "36.4890",
        lng: "-5.0125",
        websiteUrl: "https://elparaisogolf.com",
        bookingUrl: "https://open.teeone.golf/en/paraiso/disponibilidad",
        email: "info@elparaisogolfclub.com",
        phone: "+34 952 88 38 46",
        notes: "Gary Player design",
        imageUrl: "/generated_images/Pine_forest_tree_lined_b311e285.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
        kickbackPercent: 30,
      },
      {
        name: "Estepona Golf",
        city: "Estepona",
        province: "Málaga",
        country: "Spain",
        lat: "36.4650",
        lng: "-5.0980",
        websiteUrl: "https://www.esteponagolf.com",
        bookingUrl: "https://open.teeone.golf/en/esteponagolf/disponibilidad",
        email: "information@esteponagolf.com",
        phone: "+34 952 11 30 82",
        notes: "Municipal course",
        imageUrl: "/generated_images/Cascading_waterfall_feature_35d05b82.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },
      {
        name: "Atalaya Golf & Country Club",
        city: "Estepona",
        province: "Málaga",
        country: "Spain",
        lat: "36.4595",
        lng: "-5.0145",
        websiteUrl: "https://www.atalaya-golf.com",
        bookingUrl: "https://open.teeone.golf/en/atalaya/disponibilidad",
        email: "info@atalaya-golf.com",
        phone: "+34 952 88 20 89",
        notes: "Old Course + New Course",
        imageUrl: "/generated_images/Narrow_strategic_fairway_c329dbbf.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "La Resina Golf & Country Club",
        city: "Estepona",
        province: "Málaga",
        country: "Spain",
        lat: "36.4775",
        lng: "-5.0245",
        websiteUrl: "https://www.laresinagolfclub.com",
        bookingUrl: "https://www.laresinagolfclub.com",
        email: "laresinagolf@hotmail.com",
        phone: "+34 952 11 43 81",
        notes: "Challenging layout",
        imageUrl: "/generated_images/Practice_putting_green_0a4cc6df.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Flamingos Golf (Villa Padierna)",
        city: "Benahavís",
        province: "Málaga",
        country: "Spain",
        lat: "36.4920",
        lng: "-4.9850",
        websiteUrl: "https://www.villapadiernagolfclub.com",
        bookingUrl: "https://open.imaster.golf/en/villapadierna/disponibilidad",
        email: "info@villapadiernagolfclub.com",
        phone: "+34 952 88 97 91",
        notes: "Part of luxury hotel resort - 3 courses: Flamingos, Alferini, Tramores",
        imageUrl: "/generated_images/Dogleg_par_5_aerial_f691a2d3.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },

      // Benahavís / Marbella area
      {
        name: "Los Arqueros Golf & Country Club",
        city: "Benahavís",
        province: "Málaga",
        country: "Spain",
        lat: "36.5125",
        lng: "-4.9625",
        websiteUrl: "https://www.losarquerosgolf.com",
        bookingUrl: "https://open.imaster.golf/en/arqueros/disponibilidad",
        email: "caddiemaster@es.taylorwimpey.com",
        phone: "+34 952 78 46 00",
        notes: "Seve Ballesteros design",
        imageUrl: "/generated_images/Vineyard_hillside_course_726f3cbf.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "El Higueral Golf",
        city: "Benahavís",
        province: "Málaga",
        country: "Spain",
        lat: "36.5235",
        lng: "-4.9415",
        websiteUrl: "https://www.elhigueralgolf.com",
        bookingUrl: "https://www.elhigueralgolf.com",
        email: "reservas@elhigueralgolf.com",
        phone: "+34 952 88 64 45",
        notes: "Compact 9-hole course",
        imageUrl: "/generated_images/Dramatic_seaside_cliffs_f029f091.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },
      {
        name: "Monte Mayor Golf & Country Club",
        city: "Benahavís",
        province: "Málaga",
        country: "Spain",
        lat: "36.5315",
        lng: "-4.9285",
        websiteUrl: "https://www.montemayorspain.com",
        bookingUrl: "https://www.montemayorspain.com",
        email: "reservations@montemayorspain.com",
        phone: "+34 952 93 70 12",
        notes: "Mountain course",
        imageUrl: "/generated_images/Stone_bridge_stream_crossing_ed5e3c5e.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },
      {
        name: "Marbella Club Golf Resort",
        city: "Benahavís",
        province: "Málaga",
        country: "Spain",
        lat: "36.5425",
        lng: "-4.9185",
        websiteUrl: "https://www.marbellaclubgolf.com",
        bookingUrl: "https://www.marbellaclubgolf.com",
        email: "info@marbellaclubgolf.com",
        phone: "+34 952 85 09 00",
        notes: "Dave Thomas design",
        imageUrl: "/generated_images/Desert_rock_formations_f69c5d18.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "Real Club de Golf Guadalmina",
        city: "San Pedro de Alcántara",
        province: "Málaga",
        country: "Spain",
        lat: "36.4965",
        lng: "-4.9985",
        websiteUrl: "https://www.guadalminagolf.com",
        bookingUrl: "https://www.guadalminagolf.com/en/tee-times",
        email: "reservas@guadalminagolf.com",
        phone: "+34 952 88 33 75",
        notes: "Two courses: North and South",
        imageUrl: "/generated_images/Rainbow_after_storm_green_68eec4eb.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "La Quinta Golf & Country Club",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5215",
        lng: "-4.9545",
        websiteUrl: "https://www.laquintagolf.com",
        bookingUrl: "https://open.imaster.golf/en/quinta/disponibilidad",
        email: "reservas@laquintagolf.com",
        phone: "+34 952 76 24 90",
        notes: "27 holes with lake features - Manuel Piñero design",
        imageUrl: "/generated_images/Lavender_field_cart_path_e4bc5d25.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Los Naranjos Golf Club",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5135",
        lng: "-4.9465",
        websiteUrl: "https://www.losnaranjos.com",
        bookingUrl: "https://open.teeone.golf/en/naranjos/disponibilidad",
        email: "golfclub@losnaranjos.com",
        phone: "+34 952 81 52 06",
        notes: "Part of Golf Valley",
        imageUrl: "/generated_images/Lake_fountain_signature_hole_8bf0b968.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Real Club de Golf Las Brisas",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5165",
        lng: "-4.9395",
        websiteUrl: "https://www.realclubdegolflasbrisas.com",
        bookingUrl: "https://www.realclubdegolflasbrisas.com",
        email: "info@realclubdegolflasbrisas.com",
        phone: "+34 952 81 08 75",
        notes: "Robert Trent Jones Sr. design",
        imageUrl: "/generated_images/Red_rock_canyon_course_377bc8ce.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "Aloha Golf Club",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5185",
        lng: "-4.9325",
        websiteUrl: "https://www.clubdegolfaloha.com",
        bookingUrl: "https://www.clubdegolfaloha.com",
        email: "info@clubdegolfaloha.com",
        phone: "+34 952 90 70 85",
        notes: "Championship course in Nueva Andalucía",
        imageUrl: "/generated_images/Scottish_links_pot_bunkers_6cfb95d6.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Magna Marbella Golf",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5425",
        lng: "-4.8965",
        websiteUrl: "https://www.magnamarbellagolf.com",
        bookingUrl: "https://www.magnamarbellagolf.com",
        email: "info@magnamarbellagolf.com",
        phone: "+34 952 83 08 00",
        notes: "Executive 9-hole course",
        imageUrl: "/generated_images/Snow_mountains_alpine_vista_185e1bfc.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },
      {
        name: "Rio Real Golf & Hotel",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5325",
        lng: "-4.8525",
        websiteUrl: "https://www.rioreal.com",
        bookingUrl: "https://www.rioreal.com/en/golf/online-booking",
        email: "reservas@rioreal.com",
        phone: "+34 952 76 57 33",
        notes: "Javier Arana design",
        imageUrl: "/generated_images/Twilight_moonlit_evening_07522490.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Santa Clara Golf Marbella",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5245",
        lng: "-4.8785",
        websiteUrl: "https://www.santaclaragolfmarbella.com",
        bookingUrl: "https://open.teeone.golf/en/santaclaramarbella/disponibilidad",
        email: "reservas@santaclaragolfmarbella.com",
        phone: "+34 952 85 09 11",
        notes: "Enrique Canales design",
        imageUrl: "/generated_images/Japanese_garden_zen_elements_bc1d6523.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Santa Maria Golf & Country Club",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5185",
        lng: "-4.8215",
        websiteUrl: "https://www.santamariagolfclub.com",
        bookingUrl: "https://www.santamariagolfclub.com/en/tee-times",
        email: "caddymaster@santamariagolfclub.com",
        phone: "+34 952 83 10 36",
        notes: "In Elviria area",
        imageUrl: "/generated_images/Windswept_coastal_links_3c1fac7e.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Marbella Golf & Country Club",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5315",
        lng: "-4.8945",
        websiteUrl: "https://www.marbellagolf.com",
        bookingUrl: "https://open.teeone.golf/en/marbella/disponibilidad",
        email: "reservas@marbellagolf.com",
        phone: "+34 952 83 05 00",
        notes: "Historic course established 1989",
        imageUrl: "/generated_images/Cypress_shadows_Tuscan_hills_3f3e9d43.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Greenlife Golf",
        city: "Marbella",
        province: "Málaga",
        country: "Spain",
        lat: "36.5125",
        lng: "-4.8145",
        websiteUrl: "https://www.greenlife-golf.com",
        bookingUrl: "https://www.greenlife-golf.com",
        email: "golf@greenlife-golf.com",
        phone: "+34 952 83 41 43",
        notes: "Pitch & putt and par-3",
        imageUrl: "/generated_images/Wetlands_boardwalk_par_3_ae8169db.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },

      // Mijas / Fuengirola / Benalmádena / Málaga
      {
        name: "La Cala Resort",
        city: "Mijas Costa",
        province: "Málaga",
        country: "Spain",
        lat: "36.5625",
        lng: "-4.7125",
        websiteUrl: "https://www.lacala.com",
        bookingUrl: "https://www.lacala.com/en/golf/tee-times",
        email: "golf@lacala.com",
        phone: "+34 952 66 90 33",
        notes: "Three courses: America, Asia, Europa",
        imageUrl: "/generated_images/Red_sand_bunker_feature_30f83d4b.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
      },
      {
        name: "Mijas Golf",
        city: "Mijas",
        province: "Málaga",
        country: "Spain",
        lat: "36.5845",
        lng: "-4.6425",
        websiteUrl: "https://www.mijasgolf.org",
        bookingUrl: "https://open.teeone.golf/en/mijas/disponibilidad",
        email: "teetimes@mijasgolf.org",
        phone: "+34 952 47 68 43",
        notes: "Two courses: Los Lagos and Los Olivos",
        imageUrl: "/generated_images/Golf_academy_driving_range_4506e503.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Santana Golf & Country Club",
        city: "Mijas Costa",
        province: "Málaga",
        country: "Spain",
        lat: "36.5525",
        lng: "-4.6785",
        websiteUrl: "https://www.santanagolf.com",
        bookingUrl: "https://www.santanagolf.com",
        email: "info@santanagolf.com",
        phone: "+34 952 93 33 38",
        notes: "Hill course with views",
        imageUrl: "/generated_images/Championship_tournament_grandstand_cf147fe9.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Calanova Golf Club",
        city: "La Cala de Mijas",
        province: "Málaga",
        country: "Spain",
        lat: "36.5948",
        lng: "-4.6325",
        websiteUrl: "https://calanovagolf.es",
        bookingUrl: "https://www.calanovagolf.es/web/en/reservas.php",
        email: "reservas@calanovagolfclub.com",
        phone: "+34 951 170 194",
        notes: "Par 72 course with buggy included in green fee",
        imageUrl: "/generated_images/Orange_grove_fairway_2750cd17.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "El Chaparral Golf Club",
        city: "Mijas Costa",
        province: "Málaga",
        country: "Spain",
        lat: "36.5235",
        lng: "-4.7565",
        websiteUrl: "https://www.golfelchaparral.com",
        bookingUrl: "https://www.golfelchaparral.com/en/book-online",
        email: "reservas@golfelchaparral.com",
        phone: "+34 952 58 70 08",
        notes: "Coastal location - Pepe Gancedo design",
        imageUrl: "/generated_images/Sunset_silhouette_putting_6142b7a3.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Miraflores Golf",
        city: "Mijas Costa",
        province: "Málaga",
        country: "Spain",
        lat: "36.5415",
        lng: "-4.7225",
        websiteUrl: "https://www.miraflores-golf.com",
        bookingUrl: "https://www.miraflores-golf.com",
        email: "info@miraflores-golf.com",
        phone: "+34 952 93 19 60",
        notes: "Family-friendly",
        imageUrl: "/generated_images/Clubhouse_veranda_mountain_a00733a5.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "La Noria Golf & Resort",
        city: "La Cala de Mijas",
        province: "Málaga",
        country: "Spain",
        lat: "36.6125",
        lng: "-4.6685",
        websiteUrl: "https://www.lanoriagolf.com",
        bookingUrl: "https://www.lanoriagolf.com",
        email: "info@lanoriagolf.net",
        phone: "+34 952 58 96 92",
        notes: "Resort facilities",
        imageUrl: "/generated_images/Eucalyptus_forest_corridor_791aa351.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "La Siesta Golf",
        city: "Mijas Costa",
        province: "Málaga",
        country: "Spain",
        lat: "36.5325",
        lng: "-4.6945",
        websiteUrl: "https://www.lasiestagolf.com",
        bookingUrl: "https://www.lasiestagolf.com",
        email: "lasiestagolf@gmail.com",
        phone: "+34 952 93 31 51",
        notes: "Short course",
        imageUrl: "/generated_images/Flamingos_water_hazard_504cdf6e.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },
      {
        name: "Cerrado del Águila Golf",
        city: "Mijas Costa",
        province: "Málaga",
        country: "Spain",
        lat: "36.5685",
        lng: "-4.6325",
        websiteUrl: "https://www.cerradodelaguila.com",
        bookingUrl: "https://www.cerradodelaguila.com/en/booking",
        email: "info@cerradodelaguila.com",
        phone: "+34 952 58 96 00",
        notes: "Mountain views",
        imageUrl: "/generated_images/Night_golf_dramatic_lighting_1f4a3df9.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Lauro Golf",
        city: "Alhaurín de la Torre",
        province: "Málaga",
        country: "Spain",
        lat: "36.6745",
        lng: "-4.5625",
        websiteUrl: "https://www.laurogolf.com",
        bookingUrl: "https://www.laurogolf.com",
        email: "info@laurogolf.com",
        phone: "+34 952 41 27 67",
        notes: "27 holes",
        imageUrl: "/generated_images/Terrace_panoramic_coastline_4558abef.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Torrequebrada Golf",
        city: "Benalmádena",
        province: "Málaga",
        country: "Spain",
        lat: "36.5985",
        lng: "-4.5425",
        websiteUrl: "https://www.golftorrequebrada.com",
        bookingUrl: "https://open.teeone.golf/en/torrequebrada/disponibilidad",
        email: "bookings@golftorrequebrada.com",
        phone: "+34 952 44 27 42",
        notes: "José María Olazábal design",
        imageUrl: "/generated_images/Castle_historic_background_1a975ee0.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Guadalhorce Club de Golf",
        city: "Campanillas",
        province: "Málaga",
        country: "Spain",
        lat: "36.7515",
        lng: "-4.5185",
        websiteUrl: "https://www.guadalhorce.com",
        bookingUrl: "https://www.guadalhorce.com",
        email: "reservas@guadalhorce.com",
        phone: "+34 952 17 93 78",
        notes: "Municipal course near Málaga",
        imageUrl: "/generated_images/Wildflower_meadow_borders_0d5abb75.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
      },
      {
        name: "Parador de Málaga Golf",
        city: "Málaga",
        province: "Málaga",
        country: "Spain",
        lat: "36.6785",
        lng: "-4.4825",
        websiteUrl: "https://www.parador.es",
        bookingUrl: "https://www.parador.es/en/paradores/parador-de-malaga-golf",
        email: "malaga@parador.es",
        phone: "+34 952 38 12 55",
        notes: "Part of Parador hotel chain",
        imageUrl: "/generated_images/Minimalist_modern_architecture_a6f85524.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
      {
        name: "Baviera Golf",
        city: "Caleta de Vélez",
        province: "Málaga",
        country: "Spain",
        lat: "36.7397",
        lng: "-4.0997",
        websiteUrl: "https://www.bavieragolf.com",
        bookingUrl: "https://www.bavieragolf.com",
        email: "info@bavieragolf.com",
        phone: "+34 952 555 015",
        notes: "José María Cañizares design with TopTracer driving range",
        imageUrl: "/generated_images/Island_par_3_bridge_63fb85b9.png",
        facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      },
    ];

    // Seed courses
    for (const courseData of seedCourses) {
      const id = randomUUID();
      const course: GolfCourse = {
        id,
        name: courseData.name,
        city: courseData.city,
        province: courseData.province,
        country: courseData.country || "Spain",
        lat: courseData.lat || null,
        lng: courseData.lng || null,
        websiteUrl: courseData.websiteUrl || null,
        bookingUrl: courseData.bookingUrl || null,
        email: courseData.email || null,
        phone: courseData.phone || null,
        notes: courseData.notes || null,
        imageUrl: courseData.imageUrl || null,
        facilities: courseData.facilities || null,
        kickbackPercent: courseData.kickbackPercent ?? 0,
      };
      this.courses.set(id, course);
    }

    // Seed a few providers
    const providers: InsertTeeTimeProvider[] = [
      {
        name: "Golfmanager",
        baseUrl: "https://www.golfmanager.app",
        type: "API",
        config: null,
      },
      {
        name: "iMasterGolf",
        baseUrl: "https://www.imastergolf.com",
        type: "API",
        config: null,
      },
      {
        name: "Direct Club Site",
        baseUrl: null,
        type: "DEEP_LINK_ONLY",
        config: null,
      },
    ];

    for (const providerData of providers) {
      const id = randomUUID();
      const provider: TeeTimeProvider = {
        id,
        name: providerData.name,
        type: providerData.type,
        baseUrl: providerData.baseUrl || null,
        config: providerData.config || null,
      };
      this.providers.set(id, provider);
    }

    // Get Golfmanager provider ID for linking
    const golfmanagerProvider = Array.from(this.providers.values()).find(
      (p) => p.name === "Golfmanager"
    );

    if (golfmanagerProvider) {
      // Add provider links for Golfmanager/iMaster/teeone courses
      const golfmanagerCourses = [
        { courseName: "La Reserva Club Sotogrande", tenant: "lareserva" },
        { courseName: "Finca Cortesín Golf Club", tenant: "fincacortesin" },
        { courseName: "Real Club de Golf Sotogrande", tenant: "rcgsotogrande" },
        { courseName: "San Roque Club", tenant: "sanroque" },
        { courseName: "El Paraíso Golf Club", tenant: "paraiso" },
        { courseName: "Marbella Golf & Country Club", tenant: "marbella" },
        { courseName: "Estepona Golf", tenant: "estepona" },
        { courseName: "Atalaya Golf & Country Club", tenant: "atalaya" },
        { courseName: "Santa Clara Golf Marbella", tenant: "santaclara" },
        { courseName: "Los Naranjos Golf Club", tenant: "naranjos" },
        { courseName: "Mijas Golf", tenant: "mijas" },
        { courseName: "Torrequebrada Golf", tenant: "torrequebrada" },
        { courseName: "Real Club Valderrama", tenant: "valderrama" },
        { courseName: "Flamingos Golf (Villa Padierna)", tenant: "villapadierna" },
        { courseName: "Los Arqueros Golf & Country Club", tenant: "arqueros" },
        { courseName: "La Quinta Golf & Country Club", tenant: "quinta" },
      ];

      for (const { courseName, tenant } of golfmanagerCourses) {
        const course = Array.from(this.courses.values()).find(
          (c) => c.name === courseName
        );
        if (course) {
          const linkId = randomUUID();
          const link: CourseProviderLink = {
            id: linkId,
            courseId: course.id,
            providerId: golfmanagerProvider.id,
            bookingUrl: `https://open.teeone.golf/en/${tenant}/disponibilidad`,
            providerCourseCode: `golfmanager:${tenant}`,
          };
          this.links.set(linkId, link);
        }
      }
    }

    // Get Direct Club Site provider ID for linking
    const directBookingProvider = Array.from(this.providers.values()).find(
      (p) => p.name === "Direct Club Site"
    );

    if (directBookingProvider) {
      // Add provider links for direct booking courses (deep-link only)
      const directBookingCourses = [
        "Club de Golf La Cañada",
        "El Chaparral Golf Club",
        "Calanova Golf Club",
        "Baviera Golf",
      ];

      for (const courseName of directBookingCourses) {
        const course = Array.from(this.courses.values()).find(
          (c) => c.name === courseName
        );
        if (course) {
          const linkId = randomUUID();
          const link: CourseProviderLink = {
            id: linkId,
            courseId: course.id,
            providerId: directBookingProvider.id,
            bookingUrl: course.bookingUrl || course.websiteUrl || "",
            providerCourseCode: `direct:${course.id}`,
          };
          this.links.set(linkId, link);
        }
      }
    }

    // Seed testimonials (demonstration data - replace with real customer testimonials post-launch)
    const seedTestimonials: InsertTestimonial[] = [
      {
        userId: null,
        customerName: "James Mitchell",
        content: "Outstanding service from start to finish. Fridas Golf secured us tee times at Valderrama during peak season - something we couldn't achieve on our own. The concierge approach makes all the difference.",
        rating: 5,
        location: "London, UK",
      },
      {
        userId: null,
        customerName: "Sofia Andersson",
        content: "We used Fridas Golf for our annual golf trip to Costa del Sol. The platform showed real availability across all the premium courses, and booking was seamless. Highly recommend for serious golfers.",
        rating: 5,
        location: "Stockholm, Sweden",
      },
      {
        userId: null,
        customerName: "Michael Rasmussen",
        content: "Exceptional experience. The team helped us plan a perfect week of golf, from Sotogrande to Málaga. Real-time availability and personal service - exactly what we were looking for.",
        rating: 5,
        location: "Copenhagen, Denmark",
      },
      {
        userId: null,
        customerName: "Elena Rodriguez",
        content: "As a local, I've tried many booking platforms. Fridas Golf stands out for their curated selection and genuine expertise. Perfect for visitors who want the best Costa del Sol has to offer.",
        rating: 5,
        location: "Marbella, Spain",
      },
      {
        userId: null,
        customerName: "Thomas Wagner",
        content: "First-class service. The platform is modern and efficient, but it's the personal touch that sets Fridas Golf apart. They helped us secure dream tee times at courses we'd only read about.",
        rating: 5,
        location: "Munich, Germany",
      },
    ];

    for (const testimonialData of seedTestimonials) {
      const id = randomUUID();
      const testimonial: Testimonial = {
        id,
        userId: testimonialData.userId || null,
        customerName: testimonialData.customerName,
        content: testimonialData.content,
        rating: testimonialData.rating,
        location: testimonialData.location || null,
        isApproved: "true",
        createdAt: new Date(),
      };
      this.testimonials.set(id, testimonial);
    }
  }

  // Golf Courses
  async getAllCourses(): Promise<GolfCourse[]> {
    return Array.from(this.courses.values());
  }

  async getCourseById(id: string): Promise<GolfCourse | undefined> {
    return this.courses.get(id);
  }

  async createCourse(insertCourse: InsertGolfCourse): Promise<GolfCourse> {
    const id = randomUUID();
    const course: GolfCourse = {
      id,
      name: insertCourse.name,
      city: insertCourse.city,
      province: insertCourse.province,
      country: insertCourse.country || "Spain",
      lat: insertCourse.lat || null,
      lng: insertCourse.lng || null,
      websiteUrl: insertCourse.websiteUrl || null,
      bookingUrl: insertCourse.bookingUrl || null,
      email: insertCourse.email || null,
      phone: insertCourse.phone || null,
      notes: insertCourse.notes || null,
      imageUrl: insertCourse.imageUrl || null,
      facilities: insertCourse.facilities || null,
      kickbackPercent: insertCourse.kickbackPercent ?? 0,
    };
    this.courses.set(id, course);
    return course;
  }

  async updateCourse(id: string, updates: Partial<GolfCourse>): Promise<GolfCourse | undefined> {
    const course = this.courses.get(id);
    if (!course) return undefined;

    const updatedCourse = { ...course, ...updates };
    this.courses.set(id, updatedCourse);
    return updatedCourse;
  }

  async updateCourseImage(courseId: string, imageUrl: string | null): Promise<GolfCourse | undefined> {
    const course = this.courses.get(courseId);
    if (!course) return undefined;

    const updatedCourse = { ...course, imageUrl };
    this.courses.set(courseId, updatedCourse);
    return updatedCourse;
  }

  async getPublicCourses(): Promise<GolfCourse[]> {
    return Array.from(this.courses.values()).filter(c => c.membersOnly !== "true");
  }

  async setMembersOnly(courseId: string, membersOnly: boolean): Promise<GolfCourse | undefined> {
    const course = this.courses.get(courseId);
    if (!course) return undefined;

    const updatedCourse = { ...course, membersOnly: membersOnly ? "true" : "false" };
    this.courses.set(courseId, updatedCourse);
    return updatedCourse;
  }

  // Tee Time Providers
  async getAllProviders(): Promise<TeeTimeProvider[]> {
    return Array.from(this.providers.values());
  }

  async getAllLinks(): Promise<CourseProviderLink[]> {
    return Array.from(this.links.values());
  }

  async getLinksByCourseId(courseId: string): Promise<CourseProviderLink[]> {
    return Array.from(this.links.values()).filter(
      (link) => link.courseId === courseId
    );
  }

  async createLink(data: InsertCourseProviderLink): Promise<CourseProviderLink> {
    const id = randomUUID();
    const link: CourseProviderLink = {
      id,
      courseId: data.courseId,
      providerId: data.providerId,
      bookingUrl: data.bookingUrl || null,
      providerCourseCode: data.providerCourseCode || null,
    };
    this.links.set(id, link);
    return link;
  }

  async deleteLinksByCourseId(courseId: string): Promise<boolean> {
    const linksToDelete = Array.from(this.links.entries())
      .filter(([, link]) => link.courseId === courseId);
    linksToDelete.forEach(([id]) => this.links.delete(id));
    return true;
  }

  async setCourseProvider(courseId: string, providerType: string | null, providerCourseCode?: string): Promise<boolean> {
    // First delete existing links for this course
    await this.deleteLinksByCourseId(courseId);
    
    if (!providerType || providerType === "none") {
      return true; // No provider to set
    }
    
    // Find or create the provider based on type
    let provider = Array.from(this.providers.values()).find(p => {
      if (providerType === "golfmanager_v1") return p.name === "Golfmanager" && p.type === "API";
      if (providerType === "golfmanager_v3") return p.name === "Golfmanager" && p.type === "API";
      if (providerType === "teeone") return p.name === "TeeOne Golf";
      return false;
    });
    
    if (!provider) {
      // Create provider if it doesn't exist
      if (providerType === "teeone") {
        provider = await this.createProvider({ name: "TeeOne Golf", type: "DEEP_LINK", baseUrl: "https://open.teeone.golf" });
      } else if (providerType === "golfmanager_v1" || providerType === "golfmanager_v3") {
        provider = await this.createProvider({ name: "Golfmanager", type: "API", baseUrl: "https://www.golfmanager.app" });
      }
    }
    
    if (provider) {
      // Create the provider course code based on type with correct prefix format
      // The API expects: golfmanager: for V1, golfmanagerv3: for V3, teeone: for TeeOne
      let codePrefix = providerType;
      if (providerType === "golfmanager_v1") codePrefix = "golfmanager";
      else if (providerType === "golfmanager_v3") codePrefix = "golfmanagerv3";
      
      const code = providerCourseCode || `${codePrefix}:${courseId}`;
      await this.createLink({
        courseId,
        providerId: provider.id,
        providerCourseCode: code,
      });
    }
    
    return true;
  }

  async getProviderById(id: string): Promise<TeeTimeProvider | undefined> {
    return this.providers.get(id);
  }

  async createProvider(insertProvider: InsertTeeTimeProvider): Promise<TeeTimeProvider> {
    const id = randomUUID();
    const provider: TeeTimeProvider = {
      id,
      name: insertProvider.name,
      type: insertProvider.type,
      baseUrl: insertProvider.baseUrl || null,
      config: insertProvider.config || null,
    };
    this.providers.set(id, provider);
    return provider;
  }

  // Booking Requests
  async getAllBookings(): Promise<BookingRequest[]> {
    return Array.from(this.bookings.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getBookingById(id: string): Promise<BookingRequest | undefined> {
    return this.bookings.get(id);
  }

  async getBookingsByUserId(userId: string): Promise<(BookingRequest & { courseName?: string })[]> {
    const userBookings = Array.from(this.bookings.values())
      .filter(booking => booking.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return userBookings.map(booking => {
      const course = this.courses.get(booking.courseId);
      return {
        ...booking,
        courseName: course?.name,
      };
    });
  }

  async createBooking(insertBooking: InsertBookingRequest): Promise<BookingRequest> {
    const id = randomUUID();
    const booking: BookingRequest = {
      id,
      userId: insertBooking.userId || null,
      courseId: insertBooking.courseId,
      teeTime: new Date(insertBooking.teeTime),
      players: insertBooking.players,
      customerName: insertBooking.customerName,
      customerEmail: insertBooking.customerEmail,
      customerPhone: insertBooking.customerPhone || null,
      status: insertBooking.status || "PENDING",
      estimatedPrice: insertBooking.estimatedPrice || null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: new Date(),
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async cancelBooking(id: string, reason?: string): Promise<BookingRequest | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;
    
    const updatedBooking = {
      ...booking,
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason || null,
    };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async updateBookingStatus(id: string, status: string): Promise<BookingRequest | undefined> {
    const booking = this.bookings.get(id);
    if (!booking) return undefined;
    
    const updatedBooking = {
      ...booking,
      status,
    };
    this.bookings.set(id, updatedBooking);
    return updatedBooking;
  }

  // Affiliate Emails
  async getAllAffiliateEmails(): Promise<AffiliateEmail[]> {
    return Array.from(this.affiliateEmails.values());
  }

  async createAffiliateEmail(insertEmail: InsertAffiliateEmail): Promise<AffiliateEmail> {
    const id = randomUUID();
    const email: AffiliateEmail = {
      id,
      courseId: insertEmail.courseId,
      subject: insertEmail.subject,
      body: insertEmail.body,
      status: insertEmail.status || "DRAFT",
      sentAt: null,
      errorMessage: insertEmail.errorMessage || null,
    };
    this.affiliateEmails.set(id, email);
    return email;
  }

  async updateAffiliateEmail(id: string, updates: Partial<AffiliateEmail>): Promise<AffiliateEmail | undefined> {
    const email = this.affiliateEmails.get(id);
    if (!email) return undefined;

    const updatedEmail = { ...email, ...updates };
    this.affiliateEmails.set(id, updatedEmail);
    return updatedEmail;
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(userData: { email: string; firstName: string; lastName: string; phoneNumber?: string; passwordHash: string }): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phoneNumber: userData.phoneNumber || null,
      passwordHash: userData.passwordHash,
      profileImageUrl: null,
      stripeCustomerId: null,
      isAdmin: 'false',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async setUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, isAdmin: isAdmin ? 'true' : 'false' };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUser(id: string, updates: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string; isAdmin?: string }): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Course Reviews
  async getAllReviewsByCourseId(courseId: string): Promise<CourseReview[]> {
    return Array.from(this.courseReviews.values()).filter(r => r.courseId === courseId);
  }

  async getReviewById(id: string): Promise<CourseReview | undefined> {
    return this.courseReviews.get(id);
  }

  async createReview(review: InsertCourseReview): Promise<CourseReview> {
    const id = randomUUID();
    const newReview: CourseReview = {
      id,
      ...review,
      photoUrls: review.photoUrls && review.photoUrls.length > 0 ? review.photoUrls : null,
      title: review.title || null,
      review: review.review || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.courseReviews.set(id, newReview);
    return newReview;
  }

  async updateReview(id: string, updates: Partial<CourseReview>): Promise<CourseReview | undefined> {
    const review = this.courseReviews.get(id);
    if (!review) return undefined;
    
    const updated = {
      ...review,
      ...updates,
      updatedAt: new Date(),
    };
    this.courseReviews.set(id, updated);
    return updated;
  }

  async deleteReview(id: string): Promise<boolean> {
    return this.courseReviews.delete(id);
  }

  // Testimonials
  async getAllTestimonials(): Promise<Testimonial[]> {
    return Array.from(this.testimonials.values());
  }

  async getApprovedTestimonials(): Promise<Testimonial[]> {
    return Array.from(this.testimonials.values()).filter(t => t.isApproved === 'true');
  }

  async createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial> {
    const id = randomUUID();
    const newTestimonial: Testimonial = {
      id,
      ...testimonial,
      userId: testimonial.userId || null,
      location: testimonial.location || null,
      isApproved: 'false',
      createdAt: new Date(),
    };
    this.testimonials.set(id, newTestimonial);
    return newTestimonial;
  }

  async approveTestimonial(id: string): Promise<Testimonial | undefined> {
    const testimonial = this.testimonials.get(id);
    if (!testimonial) return undefined;
    
    const updated = {
      ...testimonial,
      isApproved: 'true',
    };
    this.testimonials.set(id, updated);
    return updated;
  }

  async deleteTestimonial(id: string): Promise<boolean> {
    return this.testimonials.delete(id);
  }

  // Analytics
  async getBookingsAnalytics(period: 'day' | 'week' | 'month'): Promise<Array<{ date: string; count: number }>> {
    const allBookings = Array.from(this.bookings.values());
    
    // Group bookings by period
    const grouped = new Map<string, number>();
    const now = new Date();
    const cutoffDate = new Date();
    
    if (period === 'day') {
      cutoffDate.setDate(now.getDate() - 30); // Last 30 days
    } else if (period === 'week') {
      cutoffDate.setDate(now.getDate() - 84); // Last 12 weeks
    } else {
      cutoffDate.setMonth(now.getMonth() - 12); // Last 12 months
    }
    
    for (const booking of allBookings) {
      const date = new Date(booking.createdAt);
      if (date < cutoffDate) continue;
      
      let key: string;
      if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
    
    return Array.from(grouped.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getRevenueAnalytics(): Promise<{ totalRevenue: number; averageBookingValue: number; confirmedBookings: number }> {
    const confirmedBookings = Array.from(this.bookings.values()).filter(b => b.status === 'CONFIRMED');
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.estimatedPrice || 0), 0);
    const confirmedCount = confirmedBookings.length;
    const averageBookingValue = confirmedCount > 0 ? totalRevenue / confirmedCount : 0;
    
    return {
      totalRevenue,
      averageBookingValue,
      confirmedBookings: confirmedCount,
    };
  }

  async getPopularCourses(limit: number = 10): Promise<Array<{ courseId: string; courseName: string; bookingCount: number }>> {
    const allBookings = Array.from(this.bookings.values());
    const allCourses = Array.from(this.courses.values());
    
    // Count bookings per course
    const courseCounts = new Map<string, number>();
    for (const booking of allBookings) {
      courseCounts.set(booking.courseId, (courseCounts.get(booking.courseId) || 0) + 1);
    }
    
    // Map to course names and sort
    const popular = Array.from(courseCounts.entries())
      .map(([courseId, bookingCount]) => {
        const course = allCourses.find(c => c.id === courseId);
        return {
          courseId,
          courseName: course?.name || 'Unknown Course',
          bookingCount,
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, limit);
    
    return popular;
  }

  // Commission Analytics
  async getCommissionAnalytics(): Promise<{
    totalCommission: number;
    commissionsPerCourse: Array<{ courseId: string; courseName: string; commission: number; bookingCount: number }>;
  }> {
    const confirmedBookings = Array.from(this.bookings.values()).filter(b => b.status === 'CONFIRMED');
    
    // Group by course and calculate commissions
    const courseCommissions = new Map<string, { courseName: string; commission: number; bookingCount: number }>();
    
    for (const booking of confirmedBookings) {
      if (!booking.estimatedPrice || booking.estimatedPrice <= 0) continue;
      
      const courseKey = booking.courseId ?? 'unknown';
      const course = this.courses.get(booking.courseId);
      const courseName = course?.name || 'Unknown Course';
      const kickback = Number(course?.kickbackPercent ?? 0);
      
      const bookingPrice = Number(booking.estimatedPrice ?? 0);
      const commission = bookingPrice * (kickback / 100);
      const existing = courseCommissions.get(courseKey) || { courseName, commission: 0, bookingCount: 0 };
      
      courseCommissions.set(courseKey, {
        courseName,
        commission: existing.commission + commission,
        bookingCount: existing.bookingCount + 1,
      });
    }
    
    // Calculate total and format results
    let totalCommission = 0;
    const commissionsPerCourse = Array.from(courseCommissions.entries()).map(([courseId, data]) => {
      totalCommission += data.commission;
      return {
        courseId,
        courseName: data.courseName,
        commission: data.commission,
        bookingCount: data.bookingCount,
      };
    });
    
    return {
      totalCommission,
      commissionsPerCourse,
    };
  }

  async getCommissionByPeriod(period: 'day' | 'week' | 'month'): Promise<Array<{ date: string; commission: number }>> {
    const confirmedBookings = Array.from(this.bookings.values()).filter(b => b.status === 'CONFIRMED');
    
    // Group commissions by period
    const grouped = new Map<string, number>();
    const now = new Date();
    const cutoffDate = new Date();
    
    if (period === 'day') {
      cutoffDate.setDate(now.getDate() - 30);
    } else if (period === 'week') {
      cutoffDate.setDate(now.getDate() - 84);
    } else {
      cutoffDate.setMonth(now.getMonth() - 12);
    }
    
    for (const booking of confirmedBookings) {
      const date = new Date(booking.createdAt);
      if (date < cutoffDate) continue;
      
      if (!booking.estimatedPrice || booking.estimatedPrice <= 0) continue;
      
      const course = this.courses.get(booking.courseId);
      const kickback = Number(course?.kickbackPercent ?? 0);
      
      const bookingPrice = Number(booking.estimatedPrice ?? 0);
      const commission = bookingPrice * (kickback / 100);
      
      let key: string;
      if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      grouped.set(key, (grouped.get(key) || 0) + commission);
    }
    
    return Array.from(grouped.entries())
      .map(([date, commission]) => ({ date, commission }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Ad Campaigns CRUD
  async getAllCampaigns(): Promise<AdCampaign[]> {
    return Array.from(this.campaigns.values());
  }

  async getCampaignById(id: string): Promise<AdCampaign | undefined> {
    return this.campaigns.get(id);
  }

  async createCampaign(campaign: InsertAdCampaign): Promise<AdCampaign> {
    const id = randomUUID();
    const newCampaign: AdCampaign = {
      id,
      name: campaign.name,
      platform: campaign.platform,
      startDate: new Date(campaign.startDate),
      endDate: campaign.endDate ? new Date(campaign.endDate) : null,
      totalSpend: campaign.totalSpend ?? 0,
      notes: campaign.notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.campaigns.set(id, newCampaign);
    return newCampaign;
  }

  async updateCampaign(id: string, updates: Partial<AdCampaign>): Promise<AdCampaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = {
      ...campaign,
      ...updates,
      updatedAt: new Date(),
    };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }

  // ROI Analytics
  async getROIAnalytics(): Promise<{
    totalCommission: number;
    totalAdSpend: number;
    netProfit: number;
    roi: number;
  }> {
    // Calculate total commission from confirmed bookings
    const { totalCommission } = await this.getCommissionAnalytics();
    
    // Calculate total ad spend from all campaigns
    const allCampaigns = Array.from(this.campaigns.values());
    const totalAdSpend = allCampaigns.reduce((sum, campaign) => sum + Number(campaign.totalSpend || 0), 0);
    
    // Calculate net profit and ROI
    const netProfit = totalCommission - totalAdSpend;
    const roi = totalAdSpend > 0 ? (netProfit / totalAdSpend) * 100 : 0;
    
    return {
      totalCommission,
      totalAdSpend,
      netProfit,
      roi,
    };
  }

  // Course Onboarding (stub implementation for MemStorage)
  async getAllOnboarding(): Promise<CourseOnboarding[]> {
    return [];
  }

  async getOnboardingByCourseId(courseId: string): Promise<CourseOnboarding | undefined> {
    return undefined;
  }

  async createOnboarding(onboarding: InsertCourseOnboarding): Promise<CourseOnboarding> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateOnboarding(courseId: string, updates: Partial<CourseOnboarding>): Promise<CourseOnboarding | undefined> {
    return undefined;
  }

  async updateOnboardingStage(courseId: string, stage: OnboardingStage): Promise<CourseOnboarding | undefined> {
    return undefined;
  }

  async getOnboardingStats(): Promise<Record<OnboardingStage, number>> {
    return {
      NOT_CONTACTED: 0,
      OUTREACH_SENT: 0,
      INTERESTED: 0,
      NOT_INTERESTED: 0,
      PARTNERSHIP_ACCEPTED: 0,
      CREDENTIALS_RECEIVED: 0,
    };
  }

  // Course Contact Logs (stub implementation for MemStorage)
  async getContactLogsByCourseId(courseId: string): Promise<CourseContactLog[]> {
    return [];
  }

  async createContactLog(log: InsertCourseContactLog): Promise<CourseContactLog> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteContactLog(id: string): Promise<boolean> {
    return false;
  }

  // Course Gallery Images (stub implementation for MemStorage)
  async getImagesByCourseId(courseId: string): Promise<CourseImage[]> {
    return [];
  }

  async createCourseImage(image: InsertCourseImage): Promise<CourseImage> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteCourseImage(id: string): Promise<boolean> {
    return false;
  }

  async reorderCourseImages(courseId: string, imageIds: string[]): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }

  // Unmatched Inbound Emails (stub implementation for MemStorage)
  async getUnmatchedEmails(): Promise<UnmatchedInboundEmail[]> {
    return [];
  }

  async createUnmatchedEmail(email: InsertUnmatchedInboundEmail): Promise<UnmatchedInboundEmail> {
    throw new Error("Not implemented in MemStorage");
  }

  async assignEmailToCourse(emailId: string, courseId: string, assignedByUserId: string): Promise<UnmatchedInboundEmail | undefined> {
    throw new Error("Not implemented in MemStorage");
  }

  async deleteUnmatchedEmail(id: string): Promise<boolean> {
    return false;
  }

  // Inbound Email Threads (stub implementation for MemStorage)
  async getAllInboundThreads(includeDeleted?: boolean): Promise<InboundEmailThread[]> {
    return [];
  }

  async getDeletedInboundThreads(): Promise<InboundEmailThread[]> {
    return [];
  }

  async getInboundThreadById(id: string): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async getInboundThreadByCourseId(courseId: string): Promise<InboundEmailThread[]> {
    return [];
  }

  async getUnansweredThreadsCount(): Promise<number> {
    return 0;
  }

  async getUnansweredThreads(): Promise<InboundEmailThread[]> {
    return [];
  }

  async createInboundThread(thread: InsertInboundEmailThread): Promise<InboundEmailThread> {
    throw new Error("Not implemented in MemStorage");
  }

  async updateInboundThread(id: string, updates: Partial<InboundEmailThread>): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async markThreadAsRead(id: string): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async markThreadAsReplied(id: string, userId: string): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async muteThread(id: string, muted: boolean): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async deleteThread(id: string): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async restoreThread(id: string): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  async permanentlyDeleteThread(id: string): Promise<boolean> {
    return false;
  }

  // Inbound Emails (stub implementation for MemStorage)
  async getEmailsByThreadId(threadId: string): Promise<InboundEmail[]> {
    return [];
  }

  async createInboundEmail(email: InsertInboundEmail): Promise<InboundEmail> {
    throw new Error("Not implemented in MemStorage");
  }

  async findThreadByEmailHeaders(messageId: string | null, inReplyTo: string | null, fromEmail: string): Promise<InboundEmailThread | undefined> {
    return undefined;
  }

  // Admin Alert Settings (stub implementation for MemStorage)
  async getAdminAlertSettings(userId: string): Promise<AdminAlertSettings | undefined> {
    return undefined;
  }

  async upsertAdminAlertSettings(userId: string, settings: Partial<AdminAlertSettings>): Promise<AdminAlertSettings> {
    throw new Error("Not implemented in MemStorage");
  }

  async getAdminsForAlerts(): Promise<{ userId: string; email: string; alertEmail?: string | null }[]> {
    return [];
  }

  async getOverdueThreads(slaHours: number): Promise<InboundEmailThread[]> {
    return [];
  }

  // API Keys (stub implementation for MemStorage)
  async createApiKey(name: string, scopes: string[], createdById: string, expiresAt?: Date): Promise<{ apiKey: ApiKey; rawKey: string }> {
    throw new Error("Not implemented in MemStorage");
  }

  async validateApiKey(rawKey: string): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string }> {
    return { valid: false, error: "Not implemented in MemStorage" };
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return [];
  }

  async revokeApiKey(id: string): Promise<boolean> {
    return false;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {}
}

export class DatabaseStorage implements IStorage {
  // Golf Courses
  async getAllCourses(): Promise<GolfCourse[]> {
    return await db.select().from(golfCourses);
  }

  async getCourseById(id: string): Promise<GolfCourse | undefined> {
    const results = await db.select().from(golfCourses).where(eq(golfCourses.id, id));
    return results[0];
  }

  async createCourse(course: InsertGolfCourse): Promise<GolfCourse> {
    const results = await db.insert(golfCourses).values(course).returning();
    return results[0];
  }

  async updateCourse(id: string, updates: Partial<GolfCourse>): Promise<GolfCourse | undefined> {
    const results = await db
      .update(golfCourses)
      .set(updates)
      .where(eq(golfCourses.id, id))
      .returning();
    return results[0];
  }

  async updateCourseImage(courseId: string, imageUrl: string | null): Promise<GolfCourse | undefined> {
    const results = await db
      .update(golfCourses)
      .set({ imageUrl })
      .where(eq(golfCourses.id, courseId))
      .returning();
    return results[0];
  }

  async getPublicCourses(): Promise<GolfCourse[]> {
    return await db.select().from(golfCourses).where(ne(golfCourses.membersOnly, "true"));
  }

  async setMembersOnly(courseId: string, membersOnly: boolean): Promise<GolfCourse | undefined> {
    const results = await db
      .update(golfCourses)
      .set({ membersOnly: membersOnly ? "true" : "false" })
      .where(eq(golfCourses.id, courseId))
      .returning();
    return results[0];
  }

  // Tee Time Providers
  async getAllProviders(): Promise<TeeTimeProvider[]> {
    return await db.select().from(teeTimeProviders);
  }

  async getProviderById(id: string): Promise<TeeTimeProvider | undefined> {
    const results = await db.select().from(teeTimeProviders).where(eq(teeTimeProviders.id, id));
    return results[0];
  }

  async createProvider(provider: InsertTeeTimeProvider): Promise<TeeTimeProvider> {
    const results = await db.insert(teeTimeProviders).values(provider).returning();
    return results[0];
  }

  // Course Provider Links
  async getAllLinks(): Promise<CourseProviderLink[]> {
    return await db.select().from(courseProviderLinks);
  }

  async getLinksByCourseId(courseId: string): Promise<CourseProviderLink[]> {
    return await db.select().from(courseProviderLinks).where(eq(courseProviderLinks.courseId, courseId));
  }

  async createLink(link: InsertCourseProviderLink): Promise<CourseProviderLink> {
    const results = await db.insert(courseProviderLinks).values(link).returning();
    return results[0];
  }

  async deleteLinksByCourseId(courseId: string): Promise<boolean> {
    await db.delete(courseProviderLinks).where(eq(courseProviderLinks.courseId, courseId));
    return true;
  }

  async setCourseProvider(courseId: string, providerType: string | null, providerCourseCode?: string): Promise<boolean> {
    // First delete existing links for this course
    await this.deleteLinksByCourseId(courseId);
    
    if (!providerType || providerType === "none") {
      return true; // No provider to set
    }
    
    // Find provider based on type
    const allProviders = await this.getAllProviders();
    let provider = allProviders.find(p => {
      if (providerType === "golfmanager_v1") return p.name === "Golfmanager" && p.type === "API";
      if (providerType === "golfmanager_v3") return p.name === "Golfmanager" && p.type === "API";
      if (providerType === "teeone") return p.name === "TeeOne Golf";
      return false;
    });
    
    if (!provider) {
      // Create provider if it doesn't exist
      if (providerType === "teeone") {
        provider = await this.createProvider({ name: "TeeOne Golf", type: "DEEP_LINK", baseUrl: "https://open.teeone.golf" });
      } else if (providerType === "golfmanager_v1" || providerType === "golfmanager_v3") {
        provider = await this.createProvider({ name: "Golfmanager", type: "API", baseUrl: "https://www.golfmanager.app" });
      }
    }
    
    if (provider) {
      // Create the provider course code based on type with correct prefix format
      // The API expects: golfmanager: for V1, golfmanagerv3: for V3, teeone: for TeeOne
      let codePrefix = providerType;
      if (providerType === "golfmanager_v1") codePrefix = "golfmanager";
      else if (providerType === "golfmanager_v3") codePrefix = "golfmanagerv3";
      
      const code = providerCourseCode || `${codePrefix}:${courseId}`;
      await this.createLink({
        courseId,
        providerId: provider.id,
        providerCourseCode: code,
      });
    }
    
    return true;
  }

  // Booking Requests
  async getAllBookings(): Promise<BookingRequest[]> {
    return await db.select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt));
  }

  async getBookingById(id: string): Promise<BookingRequest | undefined> {
    const results = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id));
    return results[0];
  }

  async getBookingsByUserId(userId: string): Promise<(BookingRequest & { courseName?: string })[]> {
    const results = await db
      .select({
        id: bookingRequests.id,
        userId: bookingRequests.userId,
        courseId: bookingRequests.courseId,
        teeTime: bookingRequests.teeTime,
        players: bookingRequests.players,
        customerName: bookingRequests.customerName,
        customerEmail: bookingRequests.customerEmail,
        customerPhone: bookingRequests.customerPhone,
        status: bookingRequests.status,
        estimatedPrice: bookingRequests.estimatedPrice,
        cancelledAt: bookingRequests.cancelledAt,
        cancellationReason: bookingRequests.cancellationReason,
        createdAt: bookingRequests.createdAt,
        courseName: golfCourses.name,
      })
      .from(bookingRequests)
      .leftJoin(golfCourses, eq(bookingRequests.courseId, golfCourses.id))
      .where(eq(bookingRequests.userId, userId))
      .orderBy(desc(bookingRequests.createdAt));
    
    return results.map(result => ({
      ...result,
      courseName: result.courseName ?? undefined
    }));
  }

  async createBooking(booking: InsertBookingRequest): Promise<BookingRequest> {
    const results = await db.insert(bookingRequests).values({
      ...booking,
      teeTime: new Date(booking.teeTime),
    }).returning();
    return results[0];
  }

  async cancelBooking(id: string, reason?: string): Promise<BookingRequest | undefined> {
    const [booking] = await db
      .update(bookingRequests)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      })
      .where(eq(bookingRequests.id, id))
      .returning();
    return booking;
  }

  async updateBookingStatus(id: string, status: string): Promise<BookingRequest | undefined> {
    const [booking] = await db
      .update(bookingRequests)
      .set({ status })
      .where(eq(bookingRequests.id, id))
      .returning();
    return booking;
  }

  // Affiliate Emails
  async getAllAffiliateEmails(): Promise<AffiliateEmail[]> {
    return await db.select().from(affiliateEmails);
  }

  async createAffiliateEmail(email: InsertAffiliateEmail): Promise<AffiliateEmail> {
    const results = await db.insert(affiliateEmails).values(email).returning();
    return results[0];
  }

  async updateAffiliateEmail(id: string, updates: Partial<AffiliateEmail>): Promise<AffiliateEmail | undefined> {
    const results = await db
      .update(affiliateEmails)
      .set(updates)
      .where(eq(affiliateEmails.id, id))
      .returning();
    return results[0];
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: { email: string; firstName: string; lastName: string; phoneNumber?: string; passwordHash: string }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async setUserAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isAdmin: isAdmin ? 'true' : 'false' })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUser(id: string, updates: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string; isAdmin?: string }): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Delete user with cascade - remove all related data first
    try {
      // Delete user's course reviews
      await db.delete(courseReviews).where(eq(courseReviews.userId, id));
      
      // Delete user's testimonials
      await db.delete(testimonials).where(eq(testimonials.userId, id));
      
      // Delete user's blog posts (if they have any)
      await db.delete(blogPosts).where(eq(blogPosts.authorId, id));
      
      // Set booking requests userId to NULL (preserve booking history)
      await db
        .update(bookingRequests)
        .set({ userId: null })
        .where(eq(bookingRequests.userId, id));
      
      // Finally delete the user
      const result = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  // Course Reviews
  async getAllReviewsByCourseId(courseId: string): Promise<CourseReview[]> {
    return await db
      .select()
      .from(courseReviews)
      .where(eq(courseReviews.courseId, courseId));
  }

  async getReviewById(id: string): Promise<CourseReview | undefined> {
    const results = await db
      .select()
      .from(courseReviews)
      .where(eq(courseReviews.id, id));
    return results[0];
  }

  async createReview(review: InsertCourseReview): Promise<CourseReview> {
    const [newReview] = await db
      .insert(courseReviews)
      .values(review)
      .returning();
    return newReview;
  }

  async updateReview(id: string, updates: Partial<CourseReview>): Promise<CourseReview | undefined> {
    const [updated] = await db
      .update(courseReviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courseReviews.id, id))
      .returning();
    return updated;
  }

  async deleteReview(id: string): Promise<boolean> {
    const result = await db
      .delete(courseReviews)
      .where(eq(courseReviews.id, id))
      .returning();
    return result.length > 0;
  }

  // Testimonials
  async getAllTestimonials(): Promise<Testimonial[]> {
    return await db.select().from(testimonials);
  }

  async getApprovedTestimonials(): Promise<Testimonial[]> {
    return await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.isApproved, 'true'));
  }

  async createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial> {
    const [newTestimonial] = await db
      .insert(testimonials)
      .values(testimonial)
      .returning();
    return newTestimonial;
  }

  async approveTestimonial(id: string): Promise<Testimonial | undefined> {
    const [updated] = await db
      .update(testimonials)
      .set({ isApproved: 'true' })
      .where(eq(testimonials.id, id))
      .returning();
    return updated;
  }

  async deleteTestimonial(id: string): Promise<boolean> {
    const result = await db
      .delete(testimonials)
      .where(eq(testimonials.id, id))
      .returning();
    return result.length > 0;
  }

  // Analytics
  async getBookingsAnalytics(period: 'day' | 'week' | 'month'): Promise<Array<{ date: string; count: number }>> {
    const allBookings = await db.select().from(bookingRequests);
    
    // Group bookings by period
    const grouped = new Map<string, number>();
    const now = new Date();
    const cutoffDate = new Date();
    
    if (period === 'day') {
      cutoffDate.setDate(now.getDate() - 30); // Last 30 days
    } else if (period === 'week') {
      cutoffDate.setDate(now.getDate() - 84); // Last 12 weeks
    } else {
      cutoffDate.setMonth(now.getMonth() - 12); // Last 12 months
    }
    
    for (const booking of allBookings) {
      const date = new Date(booking.createdAt);
      if (date < cutoffDate) continue;
      
      let key: string;
      if (period === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
      }
      
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
    
    return Array.from(grouped.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getRevenueAnalytics(): Promise<{ totalRevenue: number; averageBookingValue: number; confirmedBookings: number }> {
    const confirmedBookings = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.status, 'CONFIRMED'));
    
    const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.estimatedPrice || 0), 0);
    const confirmedCount = confirmedBookings.length;
    const averageBookingValue = confirmedCount > 0 ? totalRevenue / confirmedCount : 0;
    
    return {
      totalRevenue,
      averageBookingValue,
      confirmedBookings: confirmedCount,
    };
  }

  async getPopularCourses(limit: number = 10): Promise<Array<{ courseId: string; courseName: string; bookingCount: number }>> {
    const allBookings = await db.select().from(bookingRequests);
    const allCourses = await db.select().from(golfCourses);
    
    // Count bookings per course
    const courseCounts = new Map<string, number>();
    for (const booking of allBookings) {
      courseCounts.set(booking.courseId, (courseCounts.get(booking.courseId) || 0) + 1);
    }
    
    // Map to course names and sort
    const popular = Array.from(courseCounts.entries())
      .map(([courseId, bookingCount]) => {
        const course = allCourses.find(c => c.id === courseId);
        return {
          courseId,
          courseName: course?.name || 'Unknown Course',
          bookingCount,
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, limit);
    
    return popular;
  }

  // Commission Analytics
  async getCommissionAnalytics(): Promise<{
    totalCommission: number;
    commissionsPerCourse: Array<{ courseId: string; courseName: string; commission: number; bookingCount: number }>;
  }> {
    const results = await db
      .select({
        bookingId: bookingRequests.id,
        courseId: bookingRequests.courseId,
        courseName: sql<string>`COALESCE(${golfCourses.name}, 'Unknown Course')`.as('courseName'),
        estimatedPrice: bookingRequests.estimatedPrice,
        kickbackPercent: sql<number>`COALESCE(${golfCourses.kickbackPercent}, 0)`.as('kickbackPercent'),
      })
      .from(bookingRequests)
      .leftJoin(golfCourses, eq(bookingRequests.courseId, golfCourses.id))
      .where(
        sqlFunc`${bookingRequests.status} = 'CONFIRMED' 
        AND ${bookingRequests.estimatedPrice} IS NOT NULL 
        AND ${bookingRequests.estimatedPrice} > 0`
      );
    
    let totalCommission = 0;
    const commissionsMap = new Map<string, { courseName: string; commission: number; bookingCount: number }>();
    
    for (const row of results) {
      const bookingPrice = Number(row.estimatedPrice ?? 0);
      const kickback = Number(row.kickbackPercent ?? 0);
      const commission = bookingPrice * (kickback / 100);
      
      if (!Number.isFinite(commission)) continue;
      
      totalCommission += commission;
      
      const existing = commissionsMap.get(row.courseId);
      if (existing) {
        existing.commission += commission;
        existing.bookingCount += 1;
      } else {
        commissionsMap.set(row.courseId, {
          courseName: row.courseName,
          commission,
          bookingCount: 1
        });
      }
    }
    
    return {
      totalCommission,
      commissionsPerCourse: Array.from(commissionsMap.entries()).map(([courseId, data]) => ({
        courseId,
        ...data
      }))
    };
  }

  async getCommissionByPeriod(period: 'day' | 'week' | 'month'): Promise<Array<{ date: string; commission: number }>> {
    const results = await db
      .select({
        courseId: bookingRequests.courseId,
        courseName: sql<string>`COALESCE(${golfCourses.name}, 'Unknown Course')`.as('courseName'),
        estimatedPrice: bookingRequests.estimatedPrice,
        createdAt: bookingRequests.createdAt,
        kickbackPercent: sql<number>`COALESCE(${golfCourses.kickbackPercent}, 0)`.as('kickbackPercent'),
      })
      .from(bookingRequests)
      .leftJoin(golfCourses, eq(bookingRequests.courseId, golfCourses.id))
      .where(
        sqlFunc`${bookingRequests.status} = 'CONFIRMED' 
        AND ${bookingRequests.estimatedPrice} IS NOT NULL 
        AND ${bookingRequests.estimatedPrice} > 0`
      );
    
    // Group commissions by period
    const grouped = new Map<string, number>();
    const now = new Date();
    const cutoffDate = new Date();
    
    if (period === 'day') {
      cutoffDate.setDate(now.getDate() - 30);
    } else if (period === 'week') {
      cutoffDate.setDate(now.getDate() - 84);
    } else {
      cutoffDate.setMonth(now.getMonth() - 12);
    }
    
    for (const row of results) {
      const date = new Date(row.createdAt);
      if (date < cutoffDate) continue;
      
      const bookingPrice = Number(row.estimatedPrice ?? 0);
      const kickback = Number(row.kickbackPercent ?? 0);
      const commission = bookingPrice * (kickback / 100);
      
      if (!Number.isFinite(commission)) continue;
      
      let key: string;
      if (period === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      grouped.set(key, (grouped.get(key) || 0) + commission);
    }
    
    return Array.from(grouped.entries())
      .map(([date, commission]) => ({ date, commission }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // Ad Campaigns CRUD
  async getAllCampaigns(): Promise<AdCampaign[]> {
    return await db.select().from(adCampaigns);
  }

  async getCampaignById(id: string): Promise<AdCampaign | undefined> {
    const [campaign] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertAdCampaign): Promise<AdCampaign> {
    const [newCampaign] = await db.insert(adCampaigns).values({
      ...campaign,
      startDate: new Date(campaign.startDate),
      endDate: campaign.endDate ? new Date(campaign.endDate) : null,
    }).returning();
    return newCampaign;
  }

  async updateCampaign(id: string, updates: Partial<AdCampaign>): Promise<AdCampaign | undefined> {
    const [updated] = await db
      .update(adCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(adCampaigns.id, id))
      .returning();
    return updated;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db
      .delete(adCampaigns)
      .where(eq(adCampaigns.id, id))
      .returning();
    return result.length > 0;
  }

  // ROI Analytics
  async getROIAnalytics(): Promise<{
    totalCommission: number;
    totalAdSpend: number;
    netProfit: number;
    roi: number;
  }> {
    // Calculate total commission from confirmed bookings
    const { totalCommission } = await this.getCommissionAnalytics();
    
    // Calculate total ad spend from all campaigns
    const allCampaigns = await db.select().from(adCampaigns);
    const totalAdSpend = allCampaigns.reduce((sum, campaign) => sum + Number(campaign.totalSpend || 0), 0);
    
    // Calculate net profit and ROI
    const netProfit = totalCommission - totalAdSpend;
    const roi = totalAdSpend > 0 ? (netProfit / totalAdSpend) * 100 : 0;
    
    return {
      totalCommission,
      totalAdSpend,
      netProfit,
      roi,
    };
  }

  // Course Onboarding
  async getAllOnboarding(): Promise<CourseOnboarding[]> {
    return await db.select().from(courseOnboarding);
  }

  async getOnboardingByCourseId(courseId: string): Promise<CourseOnboarding | undefined> {
    const results = await db.select().from(courseOnboarding).where(eq(courseOnboarding.courseId, courseId));
    return results[0];
  }

  async createOnboarding(onboarding: InsertCourseOnboarding): Promise<CourseOnboarding> {
    const results = await db.insert(courseOnboarding).values(onboarding).returning();
    return results[0];
  }

  async updateOnboarding(courseId: string, updates: Partial<CourseOnboarding>): Promise<CourseOnboarding | undefined> {
    const result = await db
      .update(courseOnboarding)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courseOnboarding.courseId, courseId))
      .returning();
    return result[0];
  }

  async updateOnboardingStage(courseId: string, stage: OnboardingStage): Promise<CourseOnboarding | undefined> {
    const existing = await this.getOnboardingByCourseId(courseId);
    
    if (!existing) {
      // Create new onboarding record if it doesn't exist
      return await this.createOnboarding({ courseId, stage });
    }

    // Update stage and set relevant timestamps
    const updates: Partial<CourseOnboarding> = { stage };
    
    if (stage === "OUTREACH_SENT" && !existing.outreachSentAt) {
      updates.outreachSentAt = new Date();
    } else if ((stage === "INTERESTED" || stage === "NOT_INTERESTED") && !existing.responseReceivedAt) {
      updates.responseReceivedAt = new Date();
    } else if (stage === "PARTNERSHIP_ACCEPTED" && !existing.partnershipAcceptedAt) {
      updates.partnershipAcceptedAt = new Date();
    } else if (stage === "CREDENTIALS_RECEIVED" && !existing.credentialsReceivedAt) {
      updates.credentialsReceivedAt = new Date();
    }

    return await this.updateOnboarding(courseId, updates);
  }

  async getOnboardingStats(): Promise<Record<OnboardingStage, number>> {
    const allOnboarding = await this.getAllOnboarding();
    const allCourses = await this.getAllCourses();
    
    // Count courses without onboarding records as NOT_CONTACTED
    const onboardedCourseIds = new Set(allOnboarding.map(o => o.courseId));
    const notContactedCount = allCourses.filter(c => !onboardedCourseIds.has(c.id)).length;
    
    const stats: Record<OnboardingStage, number> = {
      NOT_CONTACTED: notContactedCount,
      OUTREACH_SENT: 0,
      INTERESTED: 0,
      NOT_INTERESTED: 0,
      PARTNERSHIP_ACCEPTED: 0,
      CREDENTIALS_RECEIVED: 0,
    };

    for (const onboarding of allOnboarding) {
      const stage = onboarding.stage as OnboardingStage;
      if (stage in stats) {
        stats[stage]++;
      }
    }

    return stats;
  }

  // Course Contact Logs
  async getContactLogsByCourseId(courseId: string): Promise<CourseContactLog[]> {
    return await db
      .select()
      .from(courseContactLogs)
      .where(eq(courseContactLogs.courseId, courseId))
      .orderBy(desc(courseContactLogs.loggedAt));
  }

  async createContactLog(log: InsertCourseContactLog): Promise<CourseContactLog> {
    const result = await db.insert(courseContactLogs).values(log).returning();
    return result[0];
  }

  async deleteContactLog(id: string): Promise<boolean> {
    const result = await db.delete(courseContactLogs).where(eq(courseContactLogs.id, id)).returning();
    return result.length > 0;
  }

  // Course Gallery Images
  async getImagesByCourseId(courseId: string): Promise<CourseImage[]> {
    return await db
      .select()
      .from(courseImages)
      .where(eq(courseImages.courseId, courseId))
      .orderBy(courseImages.sortOrder);
  }

  async createCourseImage(image: InsertCourseImage): Promise<CourseImage> {
    const result = await db.insert(courseImages).values(image).returning();
    return result[0];
  }

  async deleteCourseImage(id: string): Promise<boolean> {
    const result = await db.delete(courseImages).where(eq(courseImages.id, id)).returning();
    return result.length > 0;
  }

  async reorderCourseImages(courseId: string, imageIds: string[]): Promise<void> {
    for (let i = 0; i < imageIds.length; i++) {
      await db
        .update(courseImages)
        .set({ sortOrder: i })
        .where(eq(courseImages.id, imageIds[i]));
    }
  }

  // Unmatched Inbound Emails
  async getUnmatchedEmails(): Promise<UnmatchedInboundEmail[]> {
    return await db
      .select()
      .from(unmatchedInboundEmails)
      .orderBy(desc(unmatchedInboundEmails.receivedAt));
  }

  async createUnmatchedEmail(email: InsertUnmatchedInboundEmail): Promise<UnmatchedInboundEmail> {
    const result = await db.insert(unmatchedInboundEmails).values(email).returning();
    return result[0];
  }

  async assignEmailToCourse(emailId: string, courseId: string, assignedByUserId: string): Promise<UnmatchedInboundEmail | undefined> {
    const result = await db
      .update(unmatchedInboundEmails)
      .set({
        assignedToCourseId: courseId,
        assignedByUserId: assignedByUserId,
        assignedAt: new Date(),
      })
      .where(eq(unmatchedInboundEmails.id, emailId))
      .returning();
    return result[0];
  }

  async deleteUnmatchedEmail(id: string): Promise<boolean> {
    const result = await db.delete(unmatchedInboundEmails).where(eq(unmatchedInboundEmails.id, id)).returning();
    return result.length > 0;
  }

  // Inbound Email Threads
  async getAllInboundThreads(includeDeleted: boolean = false): Promise<InboundEmailThread[]> {
    if (includeDeleted) {
      return await db
        .select()
        .from(inboundEmailThreads)
        .orderBy(desc(inboundEmailThreads.lastActivityAt));
    }
    return await db
      .select()
      .from(inboundEmailThreads)
      .where(ne(inboundEmailThreads.status, "DELETED"))
      .orderBy(desc(inboundEmailThreads.lastActivityAt));
  }

  async getDeletedInboundThreads(): Promise<InboundEmailThread[]> {
    return await db
      .select()
      .from(inboundEmailThreads)
      .where(eq(inboundEmailThreads.status, "DELETED"))
      .orderBy(desc(inboundEmailThreads.lastActivityAt));
  }

  async getInboundThreadById(id: string): Promise<InboundEmailThread | undefined> {
    const result = await db.select().from(inboundEmailThreads).where(eq(inboundEmailThreads.id, id));
    return result[0];
  }

  async getInboundThreadByCourseId(courseId: string): Promise<InboundEmailThread[]> {
    return await db
      .select()
      .from(inboundEmailThreads)
      .where(eq(inboundEmailThreads.courseId, courseId))
      .orderBy(desc(inboundEmailThreads.lastActivityAt));
  }

  async getUnansweredThreadsCount(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(inboundEmailThreads)
      .where(
        and(
          eq(inboundEmailThreads.requiresResponse, "true"),
          eq(inboundEmailThreads.status, "OPEN")
        )
      );
    return result[0]?.count ?? 0;
  }

  async getUnansweredThreads(): Promise<InboundEmailThread[]> {
    return await db
      .select()
      .from(inboundEmailThreads)
      .where(
        and(
          eq(inboundEmailThreads.requiresResponse, "true"),
          eq(inboundEmailThreads.status, "OPEN")
        )
      )
      .orderBy(desc(inboundEmailThreads.lastActivityAt));
  }

  async createInboundThread(thread: InsertInboundEmailThread): Promise<InboundEmailThread> {
    const result = await db.insert(inboundEmailThreads).values(thread).returning();
    return result[0];
  }

  async updateInboundThread(id: string, updates: Partial<InboundEmailThread>): Promise<InboundEmailThread | undefined> {
    const result = await db
      .update(inboundEmailThreads)
      .set(updates)
      .where(eq(inboundEmailThreads.id, id))
      .returning();
    return result[0];
  }

  async markThreadAsRead(id: string): Promise<InboundEmailThread | undefined> {
    const result = await db
      .update(inboundEmailThreads)
      .set({ isRead: "true" })
      .where(eq(inboundEmailThreads.id, id))
      .returning();
    return result[0];
  }

  async markThreadAsReplied(id: string, userId: string): Promise<InboundEmailThread | undefined> {
    const result = await db
      .update(inboundEmailThreads)
      .set({
        status: "REPLIED",
        requiresResponse: "false",
        respondedAt: new Date(),
        respondedByUserId: userId,
        lastActivityAt: new Date(),
      })
      .where(eq(inboundEmailThreads.id, id))
      .returning();
    return result[0];
  }

  async muteThread(id: string, muted: boolean): Promise<InboundEmailThread | undefined> {
    const result = await db
      .update(inboundEmailThreads)
      .set({ isMuted: muted ? "true" : "false" })
      .where(eq(inboundEmailThreads.id, id))
      .returning();
    return result[0];
  }

  async deleteThread(id: string): Promise<InboundEmailThread | undefined> {
    const result = await db
      .update(inboundEmailThreads)
      .set({ status: "DELETED" })
      .where(eq(inboundEmailThreads.id, id))
      .returning();
    return result[0];
  }

  async restoreThread(id: string): Promise<InboundEmailThread | undefined> {
    const result = await db
      .update(inboundEmailThreads)
      .set({ status: "OPEN" })
      .where(eq(inboundEmailThreads.id, id))
      .returning();
    return result[0];
  }

  async permanentlyDeleteThread(id: string): Promise<boolean> {
    // First delete all emails in the thread
    await db.delete(inboundEmails).where(eq(inboundEmails.threadId, id));
    // Then delete the thread itself
    const result = await db.delete(inboundEmailThreads).where(eq(inboundEmailThreads.id, id)).returning();
    return result.length > 0;
  }

  // Inbound Emails (messages within threads)
  async getEmailsByThreadId(threadId: string): Promise<InboundEmail[]> {
    return await db
      .select()
      .from(inboundEmails)
      .where(eq(inboundEmails.threadId, threadId))
      .orderBy(inboundEmails.receivedAt);
  }

  async createInboundEmail(email: InsertInboundEmail): Promise<InboundEmail> {
    const result = await db.insert(inboundEmails).values(email).returning();
    
    // Update thread's lastActivityAt
    await db
      .update(inboundEmailThreads)
      .set({ lastActivityAt: new Date() })
      .where(eq(inboundEmailThreads.id, email.threadId));
    
    return result[0];
  }

  async findThreadByEmailHeaders(messageId: string | null, inReplyTo: string | null, fromEmail: string): Promise<InboundEmailThread | undefined> {
    // Try to find existing thread by In-Reply-To header matching our outbound Message-ID
    if (inReplyTo) {
      const emailWithMatchingId = await db
        .select()
        .from(inboundEmails)
        .where(eq(inboundEmails.messageId, inReplyTo))
        .limit(1);
      
      if (emailWithMatchingId.length > 0) {
        const thread = await db
          .select()
          .from(inboundEmailThreads)
          .where(eq(inboundEmailThreads.id, emailWithMatchingId[0].threadId))
          .limit(1);
        return thread[0];
      }
    }

    // Try to find existing open thread from the same email address
    const existingThread = await db
      .select()
      .from(inboundEmailThreads)
      .where(
        and(
          eq(inboundEmailThreads.fromEmail, fromEmail),
          eq(inboundEmailThreads.status, "OPEN")
        )
      )
      .orderBy(desc(inboundEmailThreads.lastActivityAt))
      .limit(1);
    
    return existingThread[0];
  }

  // Admin Alert Settings
  async getAdminAlertSettings(userId: string): Promise<AdminAlertSettings | undefined> {
    const result = await db
      .select()
      .from(adminAlertSettings)
      .where(eq(adminAlertSettings.userId, userId));
    return result[0];
  }

  async upsertAdminAlertSettings(userId: string, settings: Partial<AdminAlertSettings>): Promise<AdminAlertSettings> {
    const existing = await this.getAdminAlertSettings(userId);
    
    if (existing) {
      const result = await db
        .update(adminAlertSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(adminAlertSettings.userId, userId))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(adminAlertSettings)
        .values({ userId, ...settings })
        .returning();
      return result[0];
    }
  }

  async getAdminsForAlerts(): Promise<{ userId: string; email: string; alertEmail?: string | null }[]> {
    // Get all admin users who have email alerts enabled
    const admins = await db
      .select({
        userId: users.id,
        email: users.email,
      })
      .from(users)
      .where(eq(users.isAdmin, "true"));

    // Get their alert settings
    const results = await Promise.all(
      admins.map(async (admin) => {
        const settings = await this.getAdminAlertSettings(admin.userId);
        if (settings?.emailAlerts === "false") {
          return null; // Skip if alerts are disabled
        }
        return {
          userId: admin.userId,
          email: admin.email,
          alertEmail: settings?.alertEmail,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }

  async getOverdueThreads(slaHours: number): Promise<InboundEmailThread[]> {
    const slaDeadline = new Date(Date.now() - slaHours * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(inboundEmailThreads)
      .where(
        and(
          eq(inboundEmailThreads.requiresResponse, "true"),
          eq(inboundEmailThreads.status, "OPEN"),
          // Only include threads where lastActivityAt is not null and is before deadline
          sqlFunc`${inboundEmailThreads.lastActivityAt} IS NOT NULL AND ${inboundEmailThreads.lastActivityAt} < ${slaDeadline}`
        )
      )
      .orderBy(inboundEmailThreads.lastActivityAt);
  }

  // API Keys
  async createApiKey(name: string, scopes: string[], createdById: string, expiresAt?: Date): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const { createHash, randomBytes } = await import("crypto");
    
    // Generate a secure random key: mgt_<32 random bytes as hex>
    const rawKey = `mgt_${randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.substring(0, 12); // Store prefix for identification
    
    // Hash the key using SHA-256 (fast for verification, secure for storage)
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    
    const results = await db.insert(apiKeys).values({
      name,
      keyHash,
      keyPrefix,
      scopes,
      createdById,
      expiresAt,
      isActive: "true",
    }).returning();
    
    return { apiKey: results[0], rawKey };
  }

  async validateApiKey(rawKey: string): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string }> {
    const { createHash } = await import("crypto");
    
    if (!rawKey || !rawKey.startsWith("mgt_")) {
      return { valid: false, error: "Invalid API key format" };
    }
    
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    
    const results = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash));
    
    if (results.length === 0) {
      return { valid: false, error: "API key not found" };
    }
    
    const apiKey = results[0];
    
    if (apiKey.isActive !== "true") {
      return { valid: false, error: "API key has been revoked" };
    }
    
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false, error: "API key has expired" };
    }
    
    return { valid: true, apiKey };
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));
  }

  async revokeApiKey(id: string): Promise<boolean> {
    const results = await db
      .update(apiKeys)
      .set({ isActive: "false" })
      .where(eq(apiKeys.id, id))
      .returning();
    return results.length > 0;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }
}

export async function seedDatabase() {
  // Check if database already has courses
  const existingCourses = await db.select().from(golfCourses);
  if (existingCourses.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database...");

  // Seed golf courses from Costa del Sol
  const seedCourses: InsertGolfCourse[] = [
    // Sotogrande / San Roque area
    {
      name: "Real Club Valderrama",
      city: "Sotogrande",
      province: "Cádiz",
      country: "Spain",
      lat: "36.2950",
      lng: "-5.2870",
      websiteUrl: "https://www.valderrama.com",
      bookingUrl: "https://open.imaster.golf/en/valderrama/disponibilidad",
      email: "greenfees@valderrama.com",
      phone: "+34 956 79 12 00",
      notes: "Host of 1997 Ryder Cup - €500 green fee",
      imageUrl: "/generated_images/Valderrama_aerial_sunset_view_d9530718.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "Real Club de Golf Sotogrande",
      city: "Sotogrande",
      province: "Cádiz",
      country: "Spain",
      lat: "36.2920",
      lng: "-5.2780",
      websiteUrl: "https://www.golfsotogrande.com",
      bookingUrl: "https://www.golfsotogrande.com",
      email: "info@golfsotogrande.com",
      phone: "+34 956 78 50 14",
      notes: "Robert Trent Jones design",
      imageUrl: "/generated_images/Coastal_bunker_ocean_view_a3735d23.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "La Reserva Club Sotogrande",
      city: "Sotogrande",
      province: "Cádiz",
      country: "Spain",
      lat: "36.2985",
      lng: "-5.2645",
      websiteUrl: "https://www.sotogrande.com",
      bookingUrl: "https://www.sotogrande.com/en/golf",
      email: "lareserva@sotogrande.com",
      phone: "+34 956 78 52 52",
      notes: "Modern parkland course",
      imageUrl: "/generated_images/Modern_clubhouse_mountain_view_2032acdf.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "San Roque Club",
      city: "San Roque",
      province: "Cádiz",
      country: "Spain",
      lat: "36.2150",
      lng: "-5.3850",
      websiteUrl: "https://www.sanroqueclub.com",
      bookingUrl: "https://www.sanroqueclub.com",
      email: "info@sanroqueclub.com",
      phone: "+34 956 61 30 30",
      notes: "Two courses: Old and New",
      imageUrl: "/generated_images/Olive_tree_lined_fairway_35bef37a.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "Club de Golf La Cañada",
      city: "Guadiaro",
      province: "Cádiz",
      country: "Spain",
      lat: "36.2780",
      lng: "-5.2980",
      websiteUrl: "https://www.lacanadagolf.com",
      bookingUrl: "https://www.lacanadagolf.com",
      email: "reservas@lacanadagolf.com",
      phone: "+34 956 79 41 00",
      notes: "Family-friendly course",
      imageUrl: "/generated_images/Island_green_water_feature_cba96746.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },

    // Casares / Estepona area
    {
      name: "Finca Cortesín Golf Club",
      city: "Casares",
      province: "Málaga",
      country: "Spain",
      lat: "36.4125",
      lng: "-5.2340",
      websiteUrl: "https://www.fincacortesin.com",
      bookingUrl: "https://www.fincacortesin.com/golf",
      email: "proshop@golfcortesin.es",
      phone: "+34 952 93 78 84",
      notes: "Hosted Volvo World Match Play",
      imageUrl: "/generated_images/Misty_sunrise_fairway_f4daefff.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "Casares Costa Golf",
      city: "Casares",
      province: "Málaga",
      country: "Spain",
      lat: "36.4015",
      lng: "-5.2710",
      websiteUrl: "https://www.casarescostagolf.com",
      bookingUrl: "https://www.casarescostagolf.com",
      email: "info@casarescostagolf.com",
      phone: "+34 952 89 50 00",
      notes: "Coastal views",
      imageUrl: "/generated_images/Elevated_tee_valley_vista_9d043485.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Doña Julia Golf Club",
      city: "Casares",
      province: "Málaga",
      country: "Spain",
      lat: "36.3980",
      lng: "-5.2580",
      websiteUrl: "https://www.donajuliagolf.es",
      bookingUrl: "https://www.donajuliagolf.es",
      email: "reservas@donajuliagolf.es",
      phone: "+34 952 93 77 53",
      notes: "Mountain and sea views",
      imageUrl: "/generated_images/Dunes_green_grass_bunkers_598731ad.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Valle Romano Golf & Resort",
      city: "Estepona",
      province: "Málaga",
      country: "Spain",
      lat: "36.4520",
      lng: "-5.1235",
      websiteUrl: "https://www.valleromano.es",
      bookingUrl: "https://www.valleromano.es/en/golf",
      email: "reservasgolf@valleromano.es",
      phone: "+34 952 80 99 00",
      notes: "Resort with hotel",
      imageUrl: "/generated_images/Resort_pool_golf_view_4e3e8823.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "El Paraíso Golf Club",
      city: "Estepona",
      province: "Málaga",
      country: "Spain",
      lat: "36.4890",
      lng: "-5.0125",
      websiteUrl: "https://elparaisogolf.com",
      bookingUrl: "https://open.teeone.golf/en/paraiso/disponibilidad",
      email: "info@elparaisogolfclub.com",
      phone: "+34 952 88 38 46",
      notes: "Gary Player design",
      imageUrl: "/generated_images/Pine_forest_tree_lined_b311e285.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
      kickbackPercent: 30,
    },
    {
      name: "Estepona Golf",
      city: "Estepona",
      province: "Málaga",
      country: "Spain",
      lat: "36.4650",
      lng: "-5.0980",
      websiteUrl: "https://www.esteponagolf.com",
      bookingUrl: "https://open.teeone.golf/en/esteponagolf/disponibilidad",
      email: "information@esteponagolf.com",
      phone: "+34 952 11 30 82",
      notes: "Municipal course",
      imageUrl: "/generated_images/Cascading_waterfall_feature_35d05b82.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
    },
    {
      name: "Atalaya Golf & Country Club",
      city: "Estepona",
      province: "Málaga",
      country: "Spain",
      lat: "36.4595",
      lng: "-5.0145",
      websiteUrl: "https://www.atalaya-golf.com",
      bookingUrl: "https://open.teeone.golf/en/atalaya/disponibilidad",
      email: "info@atalaya-golf.com",
      phone: "+34 952 88 20 89",
      notes: "Old Course + New Course",
      imageUrl: "/generated_images/Narrow_strategic_fairway_c329dbbf.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "La Resina Golf & Country Club",
      city: "Estepona",
      province: "Málaga",
      country: "Spain",
      lat: "36.4775",
      lng: "-5.0245",
      websiteUrl: "https://www.laresinagolfclub.com",
      bookingUrl: "https://www.laresinagolfclub.com",
      email: "laresinagolf@hotmail.com",
      phone: "+34 952 11 43 81",
      notes: "Challenging layout",
      imageUrl: "/generated_images/Practice_putting_green_0a4cc6df.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Flamingos Golf (Villa Padierna)",
      city: "Benahavís",
      province: "Málaga",
      country: "Spain",
      lat: "36.4920",
      lng: "-4.9850",
      websiteUrl: "https://www.villapadiernagolfclub.com",
      bookingUrl: "https://open.imaster.golf/en/villapadierna/disponibilidad",
      email: "info@villapadiernagolfclub.com",
      phone: "+34 952 88 97 91",
      notes: "Part of luxury hotel resort - 3 courses: Flamingos, Alferini, Tramores",
      imageUrl: "/generated_images/Dogleg_par_5_aerial_f691a2d3.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },

    // Benahavís / Marbella area
    {
      name: "Los Arqueros Golf & Country Club",
      city: "Benahavís",
      province: "Málaga",
      country: "Spain",
      lat: "36.5125",
      lng: "-4.9625",
      websiteUrl: "https://www.losarquerosgolf.com",
      bookingUrl: "https://open.imaster.golf/en/arqueros/disponibilidad",
      email: "caddiemaster@es.taylorwimpey.com",
      phone: "+34 952 78 46 00",
      notes: "Seve Ballesteros design",
      imageUrl: "/generated_images/Vineyard_hillside_course_726f3cbf.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "El Higueral Golf",
      city: "Benahavís",
      province: "Málaga",
      country: "Spain",
      lat: "36.5235",
      lng: "-4.9415",
      websiteUrl: "https://www.elhigueralgolf.com",
      bookingUrl: "https://www.elhigueralgolf.com",
      email: "reservas@elhigueralgolf.com",
      phone: "+34 952 88 64 45",
      notes: "Compact 9-hole course",
      imageUrl: "/generated_images/Dramatic_seaside_cliffs_f029f091.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
    },
    {
      name: "Monte Mayor Golf & Country Club",
      city: "Benahavís",
      province: "Málaga",
      country: "Spain",
      lat: "36.5315",
      lng: "-4.9285",
      websiteUrl: "https://www.montemayorspain.com",
      bookingUrl: "https://www.montemayorspain.com",
      email: "reservations@montemayorspain.com",
      phone: "+34 952 93 70 12",
      notes: "Mountain course",
      imageUrl: "/generated_images/Stone_bridge_stream_crossing_ed5e3c5e.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Marbella Club Golf Resort",
      city: "Benahavís",
      province: "Málaga",
      country: "Spain",
      lat: "36.5425",
      lng: "-4.9185",
      websiteUrl: "https://www.marbellaclubgolf.com",
      bookingUrl: "https://www.marbellaclubgolf.com",
      email: "info@marbellaclubgolf.com",
      phone: "+34 952 85 09 00",
      notes: "Dave Thomas design",
      imageUrl: "/generated_images/Desert_rock_formations_f69c5d18.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "Real Club de Golf Guadalmina",
      city: "San Pedro de Alcántara",
      province: "Málaga",
      country: "Spain",
      lat: "36.4965",
      lng: "-4.9985",
      websiteUrl: "https://www.guadalminagolf.com",
      bookingUrl: "https://www.guadalminagolf.com/en/tee-times",
      email: "reservas@guadalminagolf.com",
      phone: "+34 952 88 33 75",
      notes: "Two courses: North and South",
      imageUrl: "/generated_images/Rainbow_after_storm_green_68eec4eb.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "La Quinta Golf & Country Club",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5215",
      lng: "-4.9545",
      websiteUrl: "https://www.laquintagolf.com",
      bookingUrl: "https://open.imaster.golf/en/quinta/disponibilidad",
      email: "reservas@laquintagolf.com",
      phone: "+34 952 76 24 90",
      notes: "27 holes with lake features - Manuel Piñero design",
      imageUrl: "/generated_images/Lavender_field_cart_path_e4bc5d25.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Los Naranjos Golf Club",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5135",
      lng: "-4.9465",
      websiteUrl: "https://www.losnaranjos.com",
      bookingUrl: "https://open.teeone.golf/en/naranjos/disponibilidad",
      email: "golfclub@losnaranjos.com",
      phone: "+34 952 81 52 06",
      notes: "Part of Golf Valley",
      imageUrl: "/generated_images/Lake_fountain_signature_hole_8bf0b968.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Real Club de Golf Las Brisas",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5165",
      lng: "-4.9395",
      websiteUrl: "https://www.realclubdegolflasbrisas.com",
      bookingUrl: "https://www.realclubdegolflasbrisas.com",
      email: "info@realclubdegolflasbrisas.com",
      phone: "+34 952 81 08 75",
      notes: "Robert Trent Jones Sr. design",
      imageUrl: "/generated_images/Red_rock_canyon_course_377bc8ce.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "Aloha Golf Club",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5185",
      lng: "-4.9325",
      websiteUrl: "https://www.clubdegolfaloha.com",
      bookingUrl: "https://www.clubdegolfaloha.com",
      email: "info@clubdegolfaloha.com",
      phone: "+34 952 90 70 85",
      notes: "Championship course in Nueva Andalucía",
      imageUrl: "/generated_images/Scottish_links_pot_bunkers_6cfb95d6.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Magna Marbella Golf",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5425",
      lng: "-4.8965",
      websiteUrl: "https://www.magnamarbellagolf.com",
      bookingUrl: "https://www.magnamarbellagolf.com",
      email: "info@magnamarbellagolf.com",
      phone: "+34 952 83 08 00",
      notes: "Executive 9-hole course",
      imageUrl: "/generated_images/Snow_mountains_alpine_vista_185e1bfc.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
    },
    {
      name: "Rio Real Golf & Hotel",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5325",
      lng: "-4.8525",
      websiteUrl: "https://www.rioreal.com",
      bookingUrl: "https://www.rioreal.com/en/golf/online-booking",
      email: "reservas@rioreal.com",
      phone: "+34 952 76 57 33",
      notes: "Javier Arana design",
      imageUrl: "/generated_images/Twilight_moonlit_evening_07522490.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Santa Clara Golf Marbella",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5245",
      lng: "-4.8785",
      websiteUrl: "https://www.santaclaragolfmarbella.com",
      bookingUrl: "https://open.teeone.golf/en/santaclaramarbella/disponibilidad",
      email: "reservas@santaclaragolfmarbella.com",
      phone: "+34 952 85 09 11",
      notes: "Enrique Canales design",
      imageUrl: "/generated_images/Japanese_garden_zen_elements_bc1d6523.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Santa Maria Golf & Country Club",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5185",
      lng: "-4.8215",
      websiteUrl: "https://www.santamariagolfclub.com",
      bookingUrl: "https://www.santamariagolfclub.com/en/tee-times",
      email: "caddymaster@santamariagolfclub.com",
      phone: "+34 952 83 10 36",
      notes: "In Elviria area",
      imageUrl: "/generated_images/Windswept_coastal_links_3c1fac7e.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Marbella Golf & Country Club",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5315",
      lng: "-4.8945",
      websiteUrl: "https://www.marbellagolf.com",
      bookingUrl: "https://open.teeone.golf/en/marbella/disponibilidad",
      email: "reservas@marbellagolf.com",
      phone: "+34 952 83 05 00",
      notes: "Historic course established 1989",
      imageUrl: "/generated_images/Cypress_shadows_Tuscan_hills_3f3e9d43.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Greenlife Golf",
      city: "Marbella",
      province: "Málaga",
      country: "Spain",
      lat: "36.5125",
      lng: "-4.8145",
      websiteUrl: "https://www.greenlife-golf.com",
      bookingUrl: "https://www.greenlife-golf.com",
      email: "golf@greenlife-golf.com",
      phone: "+34 952 83 41 43",
      notes: "Pitch & putt and par-3",
      imageUrl: "/generated_images/Wetlands_boardwalk_par_3_ae8169db.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
    },

    // Mijas / Fuengirola / Benalmádena / Málaga
    {
      name: "La Cala Resort",
      city: "Mijas Costa",
      province: "Málaga",
      country: "Spain",
      lat: "36.5625",
      lng: "-4.7125",
      websiteUrl: "https://www.lacala.com",
      bookingUrl: "https://www.lacala.com/en/golf/tee-times",
      email: "golf@lacala.com",
      phone: "+34 952 66 90 33",
      notes: "Three courses: America, Asia, Europa",
      imageUrl: "/generated_images/Red_sand_bunker_feature_30f83d4b.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Bar", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities", "Golf Academy", "Spa", "Conference Rooms"],
    },
    {
      name: "Mijas Golf",
      city: "Mijas",
      province: "Málaga",
      country: "Spain",
      lat: "36.5845",
      lng: "-4.6425",
      websiteUrl: "https://www.mijasgolf.org",
      bookingUrl: "https://open.teeone.golf/en/mijas/disponibilidad",
      email: "teetimes@mijasgolf.org",
      phone: "+34 952 47 68 43",
      notes: "Two courses: Los Lagos and Los Olivos",
      imageUrl: "/generated_images/Golf_academy_driving_range_4506e503.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Santana Golf & Country Club",
      city: "Mijas Costa",
      province: "Málaga",
      country: "Spain",
      lat: "36.5525",
      lng: "-4.6785",
      websiteUrl: "https://www.santanagolf.com",
      bookingUrl: "https://www.santanagolf.com",
      email: "info@santanagolf.com",
      phone: "+34 952 93 33 38",
      notes: "Hill course with views",
      imageUrl: "/generated_images/Championship_tournament_grandstand_cf147fe9.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Calanova Golf Club",
      city: "La Cala de Mijas",
      province: "Málaga",
      country: "Spain",
      lat: "36.5948",
      lng: "-4.6325",
      websiteUrl: "https://calanovagolf.es",
      bookingUrl: "https://www.calanovagolf.es/web/en/reservas.php",
      email: "reservas@calanovagolfclub.com",
      phone: "+34 951 170 194",
      notes: "Par 72 course with buggy included in green fee",
      imageUrl: "/generated_images/Orange_grove_fairway_2750cd17.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "El Chaparral Golf Club",
      city: "Mijas Costa",
      province: "Málaga",
      country: "Spain",
      lat: "36.5235",
      lng: "-4.7565",
      websiteUrl: "https://www.golfelchaparral.com",
      bookingUrl: "https://www.golfelchaparral.com/en/book-online",
      email: "reservas@golfelchaparral.com",
      phone: "+34 952 58 70 08",
      notes: "Coastal location - Pepe Gancedo design",
      imageUrl: "/generated_images/Sunset_silhouette_putting_6142b7a3.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Miraflores Golf",
      city: "Mijas Costa",
      province: "Málaga",
      country: "Spain",
      lat: "36.5415",
      lng: "-4.7225",
      websiteUrl: "https://www.miraflores-golf.com",
      bookingUrl: "https://www.miraflores-golf.com",
      email: "info@miraflores-golf.com",
      phone: "+34 952 93 19 60",
      notes: "Family-friendly",
      imageUrl: "/generated_images/Clubhouse_veranda_mountain_a00733a5.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "La Noria Golf & Resort",
      city: "La Cala de Mijas",
      province: "Málaga",
      country: "Spain",
      lat: "36.6125",
      lng: "-4.6685",
      websiteUrl: "https://www.lanoriagolf.com",
      bookingUrl: "https://www.lanoriagolf.com",
      email: "info@lanoriagolf.net",
      phone: "+34 952 58 96 92",
      notes: "Resort facilities",
      imageUrl: "/generated_images/Eucalyptus_forest_corridor_791aa351.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "La Siesta Golf",
      city: "Mijas Costa",
      province: "Málaga",
      country: "Spain",
      lat: "36.5325",
      lng: "-4.6945",
      websiteUrl: "https://www.lasiestagolf.com",
      bookingUrl: "https://www.lasiestagolf.com",
      email: "lasiestagolf@gmail.com",
      phone: "+34 952 93 31 51",
      notes: "Short course",
      imageUrl: "/generated_images/Flamingos_water_hazard_504cdf6e.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
    },
    {
      name: "Cerrado del Águila Golf",
      city: "Mijas Costa",
      province: "Málaga",
      country: "Spain",
      lat: "36.5685",
      lng: "-4.6325",
      websiteUrl: "https://www.cerradodelaguila.com",
      bookingUrl: "https://www.cerradodelaguila.com/en/booking",
      email: "info@cerradodelaguila.com",
      phone: "+34 952 58 96 00",
      notes: "Mountain views",
      imageUrl: "/generated_images/Night_golf_dramatic_lighting_1f4a3df9.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Lauro Golf",
      city: "Alhaurín de la Torre",
      province: "Málaga",
      country: "Spain",
      lat: "36.6745",
      lng: "-4.5625",
      websiteUrl: "https://www.laurogolf.com",
      bookingUrl: "https://www.laurogolf.com",
      email: "info@laurogolf.com",
      phone: "+34 952 41 27 67",
      notes: "27 holes",
      imageUrl: "/generated_images/Terrace_panoramic_coastline_4558abef.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Torrequebrada Golf",
      city: "Benalmádena",
      province: "Málaga",
      country: "Spain",
      lat: "36.5985",
      lng: "-4.5425",
      websiteUrl: "https://www.golftorrequebrada.com",
      bookingUrl: "https://open.teeone.golf/en/torrequebrada/disponibilidad",
      email: "bookings@golftorrequebrada.com",
      phone: "+34 952 44 27 42",
      notes: "José María Olazábal design",
      imageUrl: "/generated_images/Castle_historic_background_1a975ee0.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Guadalhorce Club de Golf",
      city: "Campanillas",
      province: "Málaga",
      country: "Spain",
      lat: "36.7515",
      lng: "-4.5185",
      websiteUrl: "https://www.guadalhorce.com",
      bookingUrl: "https://www.guadalhorce.com",
      email: "reservas@guadalhorce.com",
      phone: "+34 952 17 93 78",
      notes: "Municipal course near Málaga",
      imageUrl: "/generated_images/Wildflower_meadow_borders_0d5abb75.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Bar", "Cart Rental", "Putting Green"],
    },
    {
      name: "Parador de Málaga Golf",
      city: "Málaga",
      province: "Málaga",
      country: "Spain",
      lat: "36.6785",
      lng: "-4.4825",
      websiteUrl: "https://www.parador.es",
      bookingUrl: "https://www.parador.es/en/paradores/parador-de-malaga-golf",
      email: "malaga@parador.es",
      phone: "+34 952 38 12 55",
      notes: "Part of Parador hotel chain",
      imageUrl: "/generated_images/Minimalist_modern_architecture_a6f85524.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
    {
      name: "Baviera Golf",
      city: "Caleta de Vélez",
      province: "Málaga",
      country: "Spain",
      lat: "36.7397",
      lng: "-4.0997",
      websiteUrl: "https://www.bavieragolf.com",
      bookingUrl: "https://www.bavieragolf.com",
      email: "info@bavieragolf.com",
      phone: "+34 952 555 015",
      notes: "José María Cañizares design with TopTracer driving range",
      imageUrl: "/generated_images/Island_par_3_bridge_63fb85b9.png",
      facilities: ["Clubhouse", "Pro Shop", "Driving Range", "Restaurant", "Putting Green", "Cart Rental", "Locker Rooms", "Practice Facilities"],
    },
  ];

  // Insert all courses
  const insertedCourses = await db.insert(golfCourses).values(seedCourses).returning();
  console.log(`Inserted ${insertedCourses.length} golf courses`);

  // Seed providers
  const providers: InsertTeeTimeProvider[] = [
    {
      name: "Golfmanager",
      baseUrl: "https://www.golfmanager.app",
      type: "API",
      config: null,
    },
    {
      name: "iMasterGolf",
      baseUrl: "https://www.imastergolf.com",
      type: "API",
      config: null,
    },
    {
      name: "Direct Club Site",
      baseUrl: null,
      type: "DEEP_LINK_ONLY",
      config: null,
    },
  ];

  const insertedProviders = await db.insert(teeTimeProviders).values(providers).returning();
  console.log(`Inserted ${insertedProviders.length} tee time providers`);

  // Get Golfmanager provider ID for linking
  const golfmanagerProvider = insertedProviders.find((p) => p.name === "Golfmanager");

  if (golfmanagerProvider) {
    // Add provider links for Golfmanager/TeeOne Golf courses (18 total)
    const golfmanagerCourseLinks = [
      { courseName: "La Reserva Club Sotogrande", tenant: "lareserva" },
      { courseName: "Finca Cortesín Golf Club", tenant: "fincacortesin" },
      { courseName: "Real Club de Golf Sotogrande", tenant: "rcgsotogrande" },
      { courseName: "San Roque Club", tenant: "sanroque" },
      { courseName: "El Paraíso Golf Club", tenant: "paraiso" },
      { courseName: "Marbella Golf & Country Club", tenant: "marbella" },
      { courseName: "Estepona Golf", tenant: "estepona" },
      { courseName: "Atalaya Golf & Country Club", tenant: "atalaya" },
      { courseName: "Santa Clara Golf Marbella", tenant: "santaclara" },
      { courseName: "Los Naranjos Golf Club", tenant: "naranjos" },
      { courseName: "Mijas Golf", tenant: "mijas" },
      { courseName: "Torrequebrada Golf", tenant: "torrequebrada" },
      { courseName: "Real Club Valderrama", tenant: "valderrama" },
      { courseName: "Flamingos Golf (Villa Padierna)", tenant: "villapadierna" },
      { courseName: "Los Arqueros Golf & Country Club", tenant: "arqueros" },
      { courseName: "La Quinta Golf & Country Club", tenant: "quinta" },
      { courseName: "La Cala Resort", tenant: "lacala" },
      { courseName: "Valle Romano Golf & Resort", tenant: "valleromano" },
    ];

    const linksToInsert: InsertCourseProviderLink[] = [];
    for (const { courseName, tenant } of golfmanagerCourseLinks) {
      const course = insertedCourses.find((c) => c.name === courseName);
      if (course) {
        linksToInsert.push({
          courseId: course.id,
          providerId: golfmanagerProvider.id,
          bookingUrl: `https://open.teeone.golf/en/${tenant}/disponibilidad`,
          providerCourseCode: `golfmanager:${tenant}`,
        });
      }
    }

    if (linksToInsert.length > 0) {
      await db.insert(courseProviderLinks).values(linksToInsert);
      console.log(`Inserted ${linksToInsert.length} Golfmanager provider links`);
    }
  }

  // Get Direct Club Site provider ID for linking
  const directBookingProvider = insertedProviders.find((p) => p.name === "Direct Club Site");

  if (directBookingProvider) {
    // Add provider links for direct booking courses (deep-link only)
    const directBookingCourseNames = [
      "Club de Golf La Cañada",
      "El Chaparral Golf Club",
      "Calanova Golf Club",
      "Baviera Golf",
    ];

    const directLinksToInsert: InsertCourseProviderLink[] = [];
    for (const courseName of directBookingCourseNames) {
      const course = insertedCourses.find((c) => c.name === courseName);
      if (course) {
        directLinksToInsert.push({
          courseId: course.id,
          providerId: directBookingProvider.id,
          bookingUrl: course.bookingUrl || course.websiteUrl || "",
          providerCourseCode: `direct:${course.id}`,
        });
      }
    }

    if (directLinksToInsert.length > 0) {
      await db.insert(courseProviderLinks).values(directLinksToInsert);
      console.log(`Inserted ${directLinksToInsert.length} direct booking provider links`);
    }
  }

  // Seed testimonials (demonstration data - replace with real customer testimonials post-launch)
  const seedTestimonials: InsertTestimonial[] = [
    {
      userId: null,
      customerName: "James Mitchell",
      content: "Outstanding service from start to finish. Fridas Golf secured us tee times at Valderrama during peak season - something we couldn't achieve on our own. The concierge approach makes all the difference.",
      rating: 5,
      location: "London, UK",
    },
    {
      userId: null,
      customerName: "Sofia Andersson",
      content: "We used Fridas Golf for our annual golf trip to Costa del Sol. The platform showed real availability across all the premium courses, and booking was seamless. Highly recommend for serious golfers.",
      rating: 5,
      location: "Stockholm, Sweden",
    },
    {
      userId: null,
      customerName: "Michael Rasmussen",
      content: "Exceptional experience. The team helped us plan a perfect week of golf, from Sotogrande to Málaga. Real-time availability and personal service - exactly what we were looking for.",
      rating: 5,
      location: "Copenhagen, Denmark",
    },
    {
      userId: null,
      customerName: "Elena Rodriguez",
      content: "As a local, I've tried many booking platforms. Fridas Golf stands out for their curated selection and genuine expertise. Perfect for visitors who want the best Costa del Sol has to offer.",
      rating: 5,
      location: "Marbella, Spain",
    },
    {
      userId: null,
      customerName: "Thomas Wagner",
      content: "First-class service. The platform is modern and efficient, but it's the personal touch that sets Fridas Golf apart. They helped us secure dream tee times at courses we'd only read about.",
      rating: 5,
      location: "Munich, Germany",
    },
  ];

  await db.insert(testimonials).values(seedTestimonials);
  console.log(`Inserted ${seedTestimonials.length} testimonials`);

  console.log("Database seeding completed!");
}

export const storage = new DatabaseStorage();
