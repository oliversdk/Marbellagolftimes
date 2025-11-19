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
  golfCourses,
  teeTimeProviders,
  courseProviderLinks,
  bookingRequests,
  affiliateEmails,
  users,
  courseReviews,
  testimonials,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql as sqlFunc, count, sum } from "drizzle-orm";

export interface IStorage {
  // Golf Courses
  getAllCourses(): Promise<GolfCourse[]>;
  getCourseById(id: string): Promise<GolfCourse | undefined>;
  createCourse(course: InsertGolfCourse): Promise<GolfCourse>;
  updateCourseImage(courseId: string, imageUrl: string | null): Promise<GolfCourse | undefined>;

  // Tee Time Providers
  getAllProviders(): Promise<TeeTimeProvider[]>;
  getProviderById(id: string): Promise<TeeTimeProvider | undefined>;
  createProvider(provider: InsertTeeTimeProvider): Promise<TeeTimeProvider>;

  // Course Provider Links
  getLinksByCourseId(courseId: string): Promise<CourseProviderLink[]>;
  createLink(link: InsertCourseProviderLink): Promise<CourseProviderLink>;

  // Booking Requests
  getAllBookings(): Promise<BookingRequest[]>;
  getBookingById(id: string): Promise<BookingRequest | undefined>;
  getBookingsByUserId(userId: string): Promise<(BookingRequest & { courseName?: string })[]>;
  createBooking(booking: InsertBookingRequest): Promise<BookingRequest>;
  cancelBooking(id: string, reason?: string): Promise<BookingRequest | undefined>;

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

  constructor() {
    this.courses = new Map();
    this.providers = new Map();
    this.links = new Map();
    this.bookings = new Map();
    this.affiliateEmails = new Map();
    this.users = new Map();
    this.courseReviews = new Map();
    this.testimonials = new Map();
    
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
    };
    this.courses.set(id, course);
    return course;
  }

  async updateCourseImage(courseId: string, imageUrl: string | null): Promise<GolfCourse | undefined> {
    const course = this.courses.get(courseId);
    if (!course) return undefined;

    const updatedCourse = { ...course, imageUrl };
    this.courses.set(courseId, updatedCourse);
    return updatedCourse;
  }

  // Tee Time Providers
  async getAllProviders(): Promise<TeeTimeProvider[]> {
    return Array.from(this.providers.values());
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

  async updateCourseImage(courseId: string, imageUrl: string | null): Promise<GolfCourse | undefined> {
    const results = await db
      .update(golfCourses)
      .set({ imageUrl })
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
  async getLinksByCourseId(courseId: string): Promise<CourseProviderLink[]> {
    return await db.select().from(courseProviderLinks).where(eq(courseProviderLinks.courseId, courseId));
  }

  async createLink(link: InsertCourseProviderLink): Promise<CourseProviderLink> {
    const results = await db.insert(courseProviderLinks).values(link).returning();
    return results[0];
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
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0;
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
    // Add provider links for Golfmanager/iMaster/teeone courses
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
