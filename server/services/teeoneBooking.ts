import axios, { AxiosError } from "axios";
import type { TeeTimeSlot } from "@shared/schema";

const TEEONE_DEV_API_URL = "https://devapi.teeone.golf/TOBookingEngine/v1";
const TEEONE_PROD_API_URL = "https://api.teeone.golf/TOBookingEngine/v1";

export interface TeeOneSession {
  sessionID: number;
  vendorID: number;
  accessToken: string;
  expiration: Date;
}

export interface TeeOneProvider {
  providerID: number;
  providerName: string;
  isClub: boolean;
  tourOperatorID: number;
  tourOperatorName: string;
}

export interface TeeOneCourse {
  courseID: string;
  courseName: string;
  holes: number;
  latitude: string;
  longitude: string;
}

export interface TeeOneRate {
  rateID: number;
  rateTimeID: number;
  rateTypeID: number;
  packagePriceMultiplier: number;
  promoCodeId?: number;
  rateName: string;
  rateComments: string;
  sellPrice: number;
  rackPrice: number;
  discountPercentage: number;
  bookablePlayers: number[];
  bookablePlayersCount: number;
  servicesIncluded: string[];
  servicesIncludedCount: number;
  yieldDiscountId?: number;
}

export interface TeeOneTeeTime {
  time: string;
  courseID: number;
  playersAvailable: number;
  ratesList: TeeOneRate[];
  ratesCount: number;
}

export interface TeeOneAvailabilityResponse {
  code: number;
  msg: string;
  data?: {
    promoCodeMsg: string;
    promoCodeValid: boolean;
    fee: number;
    totalCharge: boolean;
    teeTimesAvailable: TeeOneTeeTime[];
    teeTimesAvailableCount: number;
  };
}

export interface TeeOnePreBookingResponse {
  code: number;
  msg: string;
  data?: {
    orderReference: string;
  };
}

export interface TeeOneBookingDetails {
  providerID: number;
  tourOperatorID: number;
  providerName: string;
  courseID: number;
  courseName: string;
  playDateTime: string;
  rateName: string;
  cancelDateTime: string;
  players: number;
  bookingDetailsID: number;
}

const RATE_TYPE_NAMES: Record<number, string> = {
  1: "18 Holes",
  2: "9 Holes",
  3: "2 GF + Buggy",
  4: "4 GF + 2 Buggies",
  5: "18 Holes (Hotel Guest)",
  6: "9 Holes (Hotel Guest)",
  7: "2 GF + Buggy (Hotel Guest)",
  8: "4 GF + 2 Buggies (Hotel Guest)",
  9: "1 GF + 1 Buggy",
  10: "1 GF + 1 Buggy (Hotel Guest)",
};

function priceFromApi(apiPrice: number): number {
  return apiPrice / 100;
}

function priceToApi(euroPrice: number): number {
  return Math.round(euroPrice * 100);
}

export class TeeOneBookingService {
  private baseUrl: string;
  private username: string;
  private password: string;
  private session: TeeOneSession | null = null;
  private providerCache: Map<number, TeeOneProvider[]> = new Map();
  private courseCache: Map<string, TeeOneCourse[]> = new Map();

  constructor(options?: {
    username?: string;
    password?: string;
    useProduction?: boolean;
  }) {
    this.username = options?.username || process.env.TEEONE_USERNAME || "";
    this.password = options?.password || process.env.TEEONE_PASSWORD || "";
    this.baseUrl = options?.useProduction ? TEEONE_PROD_API_URL : TEEONE_DEV_API_URL;

    if (!this.username || !this.password) {
      console.log("[TeeOne Booking] No credentials configured - will use mock data");
    } else {
      console.log(`[TeeOne Booking] Initialized with ${options?.useProduction ? "PRODUCTION" : "DEVELOPMENT"} API`);
    }
  }

  hasCredentials(): boolean {
    return !!(this.username && this.password);
  }

  async authenticate(lifeSpanSeconds: number = 3600): Promise<TeeOneSession | null> {
    if (!this.hasCredentials()) {
      console.log("[TeeOne Booking] No credentials - skipping authentication");
      return null;
    }

    if (this.session && new Date(this.session.expiration) > new Date()) {
      return this.session;
    }

    try {
      console.log("[TeeOne Booking] Authenticating...");

      const response = await axios.post(
        `${this.baseUrl}/api/External/Access/Token`,
        `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&lifeSpanSeconds=${lifeSpanSeconds}&culture=en-GB`,
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 15000,
        }
      );

      if (response.data?.code === 1 && response.data?.data) {
        this.session = {
          sessionID: response.data.data.sessionID,
          vendorID: response.data.data.vendorID,
          accessToken: response.data.data.accessToken,
          expiration: new Date(response.data.data.expiration),
        };
        console.log(`[TeeOne Booking] Authenticated successfully - Session expires: ${this.session.expiration}`);
        return this.session;
      }

      console.error(`[TeeOne Booking] Authentication failed: ${response.data?.msg}`);
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Auth error: ${axiosError.message}`);
      return null;
    }
  }

  async getProviders(): Promise<TeeOneProvider[]> {
    const session = await this.authenticate();
    if (!session) return [];

    const cacheKey = session.vendorID;
    if (this.providerCache.has(cacheKey)) {
      return this.providerCache.get(cacheKey)!;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/External/Vendors/Providers`,
        {
          sessionID: session.sessionID,
          vendorID: session.vendorID,
          accessToken: session.accessToken,
          culture: "en-GB",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      if (response.data?.code === 1 && response.data?.data?.providersList) {
        const providers = response.data.data.providersList;
        this.providerCache.set(cacheKey, providers);
        console.log(`[TeeOne Booking] Found ${providers.length} providers`);
        return providers;
      }

      return [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Get providers error: ${axiosError.message}`);
      return [];
    }
  }

  async getProviderCourses(providerID: number, tourOperatorID: number = -1): Promise<TeeOneCourse[]> {
    const session = await this.authenticate();
    if (!session) return [];

    const cacheKey = `${providerID}-${tourOperatorID}`;
    if (this.courseCache.has(cacheKey)) {
      return this.courseCache.get(cacheKey)!;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/External/Vendors/ProviderCourses`,
        {
          vendorID: session.vendorID,
          providerID,
          tourOperatorID,
          sessionID: session.sessionID,
          accessToken: session.accessToken,
          culture: "en-GB",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      if (response.data?.code === 1 && response.data?.data?.coursesList) {
        const courses = response.data.data.coursesList;
        this.courseCache.set(cacheKey, courses);
        console.log(`[TeeOne Booking] Found ${courses.length} courses for provider ${providerID}`);
        return courses;
      }

      return [];
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Get courses error: ${axiosError.message}`);
      return [];
    }
  }

  async getDayAvailability(
    providerID: number,
    courseID: number,
    playDate: string,
    players: number = -1,
    tourOperatorID: number = -1
  ): Promise<TeeOneAvailabilityResponse | null> {
    const session = await this.authenticate();
    if (!session) return null;

    try {
      console.log(`[TeeOne Booking] Fetching availability for course ${courseID} on ${playDate}`);

      const response = await axios.post<TeeOneAvailabilityResponse>(
        `${this.baseUrl}/api/External/Availability/DayAvailability`,
        {
          vendorID: session.vendorID,
          providerID,
          sessionID: session.sessionID,
          tourOperatorID,
          accessToken: session.accessToken,
          culture: "en-GB",
          courseID,
          playDate: `${playDate}T00:00`,
          fromTime: `${playDate}T07:00`,
          toTime: `${playDate}T18:00`,
          players,
          fromPrice: 0,
          toPrice: 99999,
          promoCode: "",
          pageSize: 100,
          pageNum: 1,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      if (response.data?.code === 1) {
        console.log(`[TeeOne Booking] Found ${response.data.data?.teeTimesAvailableCount || 0} tee times`);
        return response.data;
      }

      console.warn(`[TeeOne Booking] Availability error: ${response.data?.msg}`);
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Availability error: ${axiosError.message}`);
      return null;
    }
  }

  async getTeeTimes(
    providerID: number,
    courseID: number,
    date: string,
    players: number = 2,
    tourOperatorID: number = -1
  ): Promise<TeeTimeSlot[]> {
    if (!this.hasCredentials()) {
      return this.getMockSlots(date, players);
    }

    const availability = await this.getDayAvailability(providerID, courseID, date, players, tourOperatorID);
    if (!availability?.data?.teeTimesAvailable) {
      return this.getMockSlots(date, players);
    }

    const slots: TeeTimeSlot[] = [];

    for (const teeTime of availability.data.teeTimesAvailable) {
      for (const rate of teeTime.ratesList) {
        if (rate.bookablePlayers.includes(players) || rate.bookablePlayers.length === 0) {
          const pricePerPlayer = priceFromApi(rate.sellPrice);
          const rackPricePerPlayer = priceFromApi(rate.rackPrice);

          slots.push({
            teeTime: teeTime.time,
            greenFee: pricePerPlayer,
            currency: "EUR",
            players: Math.min(teeTime.playersAvailable, players),
            holes: rate.rateTypeID === 2 || rate.rateTypeID === 6 ? 9 : 18,
            source: "TeeOne",
            packages: [{
              id: `${rate.rateID}-${rate.rateTimeID}`,
              name: rate.rateName || RATE_TYPE_NAMES[rate.rateTypeID] || "Green Fee",
              description: rate.rateComments || rate.servicesIncluded.join(", "),
              price: pricePerPlayer,
              includesBuggy: rate.servicesIncluded.some(s => 
                s.toLowerCase().includes("buggy") || s.toLowerCase().includes("cart")
              ),
            }],
          });
        }
      }
    }

    console.log(`[TeeOne Booking] Converted ${slots.length} tee time slots`);
    return slots;
  }

  async createPreBooking(
    providerID: number,
    courseID: number,
    tourOperatorID: number,
    playDateTime: string,
    rate: {
      rateID: number;
      rateTimeID: number;
      rateTypeID: number;
      players: number;
      price: number;
      rateName: string;
      promoCodeId?: number;
      yieldDiscountId?: number;
    },
    customer: {
      firstName: string;
      lastName: string;
      email: string;
    }
  ): Promise<{ orderReference: string } | null> {
    const session = await this.authenticate();
    if (!session) {
      console.error("[TeeOne Booking] Cannot create prebooking - not authenticated");
      return null;
    }

    try {
      console.log(`[TeeOne Booking] Creating prebooking for ${customer.email} at ${playDateTime}`);

      const response = await axios.post<TeeOnePreBookingResponse>(
        `${this.baseUrl}/api/External/PreBooking/PreBookingRequest`,
        {
          vendorID: session.vendorID,
          sessionID: session.sessionID,
          accessToken: session.accessToken,
          culture: "en-GB",
          userFirstName: customer.firstName,
          userLastName: customer.lastName,
          userEmail: customer.email,
          teeTimesList: [{
            tourOperatorID,
            providerID,
            playDateTime,
            courseID,
            ratesList: [{
              rateID: rate.rateID,
              rateTimeID: rate.rateTimeID,
              rateTypeID: rate.rateTypeID,
              players: rate.players,
              price: priceToApi(rate.price),
              promoCodeId: rate.promoCodeId || 0,
              rateName: rate.rateName,
              yieldDiscountId: rate.yieldDiscountId || 0,
            }],
          }],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      if (response.data?.code === 1 && response.data?.data?.orderReference) {
        console.log(`[TeeOne Booking] Prebooking created: ${response.data.data.orderReference}`);
        return { orderReference: response.data.data.orderReference };
      }

      console.error(`[TeeOne Booking] Prebooking failed: ${response.data?.msg}`);
      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Prebooking error: ${axiosError.message}`);
      return null;
    }
  }

  async confirmBooking(
    orderRef: string,
    customer?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  ): Promise<boolean> {
    const session = await this.authenticate();
    if (!session) {
      console.error("[TeeOne Booking] Cannot confirm booking - not authenticated");
      return false;
    }

    try {
      console.log(`[TeeOne Booking] Confirming booking ${orderRef}`);

      const response = await axios.post(
        `${this.baseUrl}/api/External/Booking/BookingConfirmationRequest`,
        {
          vendorID: session.vendorID,
          sessionID: session.sessionID,
          accessToken: session.accessToken,
          culture: "en-GB",
          orderRef,
          userFirstName: customer?.firstName || "",
          userLastName: customer?.lastName || "",
          userEmail: customer?.email || "",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      if (response.data?.code === 1) {
        console.log(`[TeeOne Booking] Booking confirmed: ${orderRef}`);
        return true;
      }

      console.error(`[TeeOne Booking] Booking confirmation failed: ${response.data?.msg}`);
      return false;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Confirmation error: ${axiosError.message}`);
      return false;
    }
  }

  async getBookingDetails(orderRef: string): Promise<TeeOneBookingDetails[] | null> {
    const session = await this.authenticate();
    if (!session) return null;

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/External/Booking/BookingDetails`,
        {
          vendorID: session.vendorID,
          sessionID: session.sessionID,
          accessToken: session.accessToken,
          culture: "en-GB",
          orderRef,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      if (response.data?.code === 1 && response.data?.data?.bookingDetails) {
        return response.data.data.bookingDetails;
      }

      return null;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Get booking details error: ${axiosError.message}`);
      return null;
    }
  }

  async cancelBooking(
    orderRef: string,
    bookingDetailsID: number,
    providerID: number,
    playDateTime: string
  ): Promise<boolean> {
    const session = await this.authenticate();
    if (!session) return false;

    try {
      const preCancelResponse = await axios.post(
        `${this.baseUrl}/api/External/PreCancellation/PreCancellationRequest`,
        {
          vendorID: session.vendorID,
          sessionID: session.sessionID,
          accessToken: session.accessToken,
          culture: "en-GB",
          orderRef,
          teeTimesList: [{
            providerID,
            playDateTime,
            bookingDetailsID,
          }],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      if (preCancelResponse.data?.code !== 1 || !preCancelResponse.data?.data?.orderReference) {
        console.error(`[TeeOne Booking] Pre-cancellation failed: ${preCancelResponse.data?.msg}`);
        return false;
      }

      const cancellationOrderRef = preCancelResponse.data.data.orderReference;

      const confirmResponse = await axios.post(
        `${this.baseUrl}/api/External/Cancellation/CancellationConfirmationRequest`,
        {
          vendorID: session.vendorID,
          sessionID: session.sessionID,
          accessToken: session.accessToken,
          culture: "en-GB",
          orderRef,
          cancellationOrderRef,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      if (confirmResponse.data?.code === 1) {
        console.log(`[TeeOne Booking] Booking cancelled: ${orderRef}`);
        return true;
      }

      console.error(`[TeeOne Booking] Cancellation confirmation failed: ${confirmResponse.data?.msg}`);
      return false;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`[TeeOne Booking] Cancellation error: ${axiosError.message}`);
      return false;
    }
  }

  getMockSlots(date: string, players: number = 2, holes: number = 18): TeeTimeSlot[] {
    console.log(`[TeeOne Booking] Generating MOCK slots for ${date}`);

    const slots: TeeTimeSlot[] = [];
    const basePrice = holes === 9 ? 45 : 85;

    for (let hour = 7; hour <= 17; hour++) {
      for (const minutes of [0, 10, 20, 30, 40, 50]) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        const isAvailable = Math.random() > 0.3;
        if (!isAvailable) continue;

        const morningBonus = hour < 10 ? 15 : 0;
        const afternoonDiscount = hour >= 14 ? -10 : 0;
        const price = basePrice + morningBonus + afternoonDiscount + Math.floor(Math.random() * 20);

        slots.push({
          teeTime: `${date}T${timeStr}:00`,
          greenFee: price,
          currency: "EUR",
          players,
          holes,
          source: "TeeOne MOCK",
          packages: [{
            id: `mock-${hour}-${minutes}`,
            name: "Green Fee",
            description: "18 holes green fee",
            price: price,
            includesBuggy: false,
          }],
        });
      }
    }

    return slots;
  }
}

let teeoneBookingService: TeeOneBookingService | null = null;

export function getTeeOneBookingService(): TeeOneBookingService {
  if (!teeoneBookingService) {
    teeoneBookingService = new TeeOneBookingService();
  }
  return teeoneBookingService;
}

export function initTeeOneBookingService(options?: {
  username?: string;
  password?: string;
  useProduction?: boolean;
}): TeeOneBookingService {
  teeoneBookingService = new TeeOneBookingService(options);
  return teeoneBookingService;
}
