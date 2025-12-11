import axios, { AxiosInstance } from "axios";

const ZEST_BASE_URL = "https://cm.zest.golf";
const ZEST_SANDBOX_URL = "https://sandbox-cm.zest.golf";

export interface ZestCountry {
  name: string;
}

export interface ZestFacilityAddress {
  address1: string;
  address2?: string;
  number: string;
  addition?: string;
  zipcode: string;
  place: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface ZestFacility {
  id: number;
  name: string;
  website?: string;
  email?: string;
  address: ZestFacilityAddress;
}

export interface ZestFacilityDetails extends ZestFacility {
  latitude: number;
  longitude: number;
  phoneNumber?: string;
  foundedIn?: number;
  description?: string;
  services?: {
    drivingRange: boolean;
    chippingArea: boolean;
    puttingGreen: boolean;
    proShop: boolean;
    golfSchool: boolean;
    golfBuggy: boolean;
    pushTrolley: boolean;
    electricTrolley: boolean;
    golfClubRentals: boolean;
    caddies: boolean;
    restaurant: boolean;
    bar: boolean;
    lockerRoom: boolean;
    wifi: boolean;
    shuttleService: boolean;
  };
  logo?: string;
  images?: string[];
  reservationsContact?: {
    name: string;
    email: string;
    phoneNumber: string;
  };
}

export interface ZestPrice {
  amount: number;
  currency: string;
}

export interface ZestProduct {
  mid: number;
  name: string;
  category: string;
  available?: number;
  pricing?: Array<{
    quantity: number;
    price: ZestPrice;
    netRate: ZestPrice;
    publicRate: ZestPrice;
  }>;
  price?: ZestPrice;
  netRate?: ZestPrice;
  publicRate?: ZestPrice;
}

export interface ZestTeeTime {
  teeid: number;
  time: string;
  course: string;
  holes: number;
  products: ZestProduct[];
  extraProducts?: ZestProduct[];
}

export interface ZestCancellationPolicy {
  minimumPlayer: number;
  maximumPlayer: number;
  timePeriod: number; // hours before tee time
}

export interface ZestTeeTimeResponse {
  teeTimeV3: ZestTeeTime[];
  facilityCancellationPolicyRange: ZestCancellationPolicy[];
}

export interface ZestBookingRequest {
  facilityId: number;
  teetime: string; // "yyyy-mm-dd HH:MM:ss"
  course: string;
  players: number;
  teeId: number;
  holes: number;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string;
  contactEmail: string;
  netRate?: number;
  extraProduct?: Array<{ mid: number; quantity: number }>;
  comments?: string;
}

export interface ZestBookingResponse {
  bookingId: string;
}

export class ZestGolfService {
  private client: AxiosInstance;
  private isProduction: boolean;

  constructor(useSandbox: boolean = false) {
    const username = process.env.ZEST_GOLF_USERNAME;
    const password = process.env.ZEST_GOLF_PASSWORD;

    if (!username || !password) {
      throw new Error("Zest Golf credentials not configured");
    }

    this.isProduction = !useSandbox;
    const baseURL = useSandbox ? ZEST_SANDBOX_URL : ZEST_BASE_URL;

    this.client = axios.create({
      baseURL,
      auth: {
        username,
        password,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get list of countries with available golf facilities
   */
  async getCountries(connectedOnly: boolean = false): Promise<string[]> {
    const params = connectedOnly ? { connected: "true" } : {};
    const response = await this.client.get("/api/v5/countries", { params });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error("Failed to fetch countries");
  }

  /**
   * Get list of facilities in a country
   */
  async getFacilities(country: string, connectedOnly: boolean = false): Promise<ZestFacility[]> {
    const params: Record<string, string> = { country };
    if (connectedOnly) {
      params.connected = "true";
    }
    
    const response = await this.client.get("/api/v5/facilities", { params });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error("Failed to fetch facilities");
  }

  /**
   * Get facility details by ID
   */
  async getFacilityDetails(facilityId: number): Promise<ZestFacilityDetails> {
    const response = await this.client.get(`/api/v5/facilities/details/${facilityId}`);
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error("Failed to fetch facility details");
  }

  /**
   * Get available tee times for a facility
   */
  async getTeeTimes(
    facilityId: number,
    bookingDate: Date,
    players: number,
    holes: 9 | 18 = 18
  ): Promise<ZestTeeTimeResponse> {
    // Format date as DD-MM-YYYY
    const day = String(bookingDate.getDate()).padStart(2, "0");
    const month = String(bookingDate.getMonth() + 1).padStart(2, "0");
    const year = bookingDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    const response = await this.client.get(`/api/v4/teetimes/${facilityId}`, {
      params: {
        bookingDate: formattedDate,
        players,
        holes,
      },
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error("Failed to fetch tee times");
  }

  /**
   * Create a booking
   */
  async createBooking(booking: ZestBookingRequest): Promise<ZestBookingResponse> {
    // Format teetime as yyyy-mm-dd HH:MM:ss
    const response = await this.client.post("/api/v3/bookings", booking);
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error("Failed to create booking");
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: string): Promise<boolean> {
    try {
      const response = await this.client.delete(`/api/v3/bookings/${bookingId}`);
      return response.data.success === true;
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      return false;
    }
  }

  /**
   * Get all Spanish facilities (for Marbella Golf Times)
   */
  async getSpanishFacilities(connectedOnly: boolean = true): Promise<ZestFacility[]> {
    return this.getFacilities("Spain", connectedOnly);
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; mode: string; countries: string[] }> {
    try {
      const countries = await this.getCountries(true);
      return {
        success: true,
        mode: this.isProduction ? "production" : "sandbox",
        countries,
      };
    } catch (error) {
      return {
        success: false,
        mode: this.isProduction ? "production" : "sandbox",
        countries: [],
      };
    }
  }
}

// Singleton instance
let zestGolfInstance: ZestGolfService | null = null;

export function getZestGolfService(useSandbox: boolean = false): ZestGolfService {
  if (!zestGolfInstance) {
    zestGolfInstance = new ZestGolfService(useSandbox);
  }
  return zestGolfInstance;
}
