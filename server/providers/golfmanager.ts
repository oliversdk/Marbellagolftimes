import axios from "axios";
import type { TeeTimeSlot } from "@shared/schema";

export type GolfmanagerMode = "production" | "demo" | "mock";
export type GolfmanagerVersion = "v1" | "v3";

export interface GolfmanagerConfig {
  mode: GolfmanagerMode;
  version: GolfmanagerVersion;
  user: string;
  password: string;
  baseUrl: string;
  tenant: string;
}

export interface GolfmanagerResource {
  id: number;
  name: string;
  description?: string;
}

export interface GolfmanagerAvailabilityType {
  id: number;
  name: string;
  price?: number;
}

export interface GolfmanagerSlot {
  idResource: number;
  idType: number;
  start: string;
  end?: string;
  price: number;
  pricePerSlot?: number;
  max?: number;
  min?: number;
  slots?: number;
  available?: boolean;
}

export interface GolfmanagerReservation {
  idResource: number;
  start: string;
  name: string;
  email: string;
  idType: number;
  timeout?: string;
  phone?: string;
  slots?: number;
}

export interface GolfmanagerReservationResponse {
  id: number;
  idResource: number;
  start: string;
  status: string;
}

/**
 * Golfmanager API Client for Costa del Sol golf courses
 * Supports both V1 and V3 APIs with full booking flow
 */
export class GolfmanagerProvider {
  private config: GolfmanagerConfig;

  constructor(config: GolfmanagerConfig) {
    this.config = config;
    
    console.log(`[Golfmanager] Initialized in ${config.mode.toUpperCase()} mode (${config.version.toUpperCase()})`);
    console.log(`[Golfmanager] Base URL: ${config.baseUrl}`);
    console.log(`[Golfmanager] Tenant: ${config.tenant}`);
    console.log(`[Golfmanager] User: ${config.user}`);
    console.log(`[Golfmanager] Has Password: ${!!config.password}`);
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      const response = await axios.get<T>(url, {
        params: {
          tenant: this.config.tenant,
          ...params,
        },
        auth: {
          username: this.config.user,
          password: this.config.password,
        },
        timeout: 15000, // 15 second timeout
      });

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[Golfmanager] API error for ${endpoint}:`, error.message);
        if (error.response) {
          console.error(`[Golfmanager] Response status:`, error.response.status);
          console.error(`[Golfmanager] Response data:`, error.response.data);
        }
        throw new Error(`Golfmanager API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get tenant information (course details)
   */
  async getTenant(): Promise<any> {
    const endpoint = this.config.version === "v3" ? "/model/tenant" : "/getTenant";
    return this.apiRequest(endpoint);
  }

  /**
   * Get available resources (tees) for the course
   */
  async getResources(): Promise<GolfmanagerResource[]> {
    const endpoint = this.config.version === "v3" ? "/bookings/resources" : "/resources";
    const data = await this.apiRequest<any>(endpoint);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get availability types (booking options/fares)
   */
  async getAvailabilityTypes(): Promise<GolfmanagerAvailabilityType[]> {
    const endpoint = this.config.version === "v3" ? "/bookings/availabilityTypes" : "/availabilityTypes";
    const data = await this.apiRequest<any>(endpoint);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Search for available tee times
   * @param start - Start date/time (ISO 8601 format)
   * @param end - End date/time (ISO 8601 format)
   * @param idResource - Resource ID (tee number)
   * @param slots - Number of slots/players (optional)
   * @param tags - Filter tags like ["18holes"] or ["9holes"] (optional)
   */
  async searchAvailability(
    start: string,
    end: string,
    idResource?: number,
    slots?: number,
    tags?: string[]
  ): Promise<GolfmanagerSlot[]> {
    const endpoint = this.config.version === "v3" 
      ? "/bookings/searchAvailability" 
      : "/searchAvailability";
    
    const params: Record<string, any> = {
      start,
      end,
    };

    if (idResource !== undefined) params.idResource = idResource;
    if (slots !== undefined) params.slots = slots;
    if (tags && tags.length > 0) params.tags = JSON.stringify(tags);

    const data = await this.apiRequest<any>(endpoint, params);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Make a reservation (pre-reserve)
   * @param reservations - Array of reservation objects
   * @returns Array of reservation responses with IDs
   */
  async makeReservation(
    reservations: GolfmanagerReservation[]
  ): Promise<GolfmanagerReservationResponse[]> {
    const endpoint = this.config.version === "v3" 
      ? "/bookings/makeReservation" 
      : "/makeReservation";
    
    const params = {
      reservations: JSON.stringify(reservations),
    };

    const data = await this.apiRequest<any>(endpoint, params);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Confirm a reservation
   * @param ids - Array of reservation IDs to confirm
   */
  async confirmReservation(ids: number[]): Promise<any> {
    const endpoint = this.config.version === "v3" 
      ? "/bookings/confirmReservation" 
      : "/confirmReservation";
    
    const params = {
      ids: JSON.stringify(ids),
    };

    return this.apiRequest(endpoint, params);
  }

  /**
   * Cancel a reservation
   * @param ids - Array of reservation IDs to cancel
   */
  async cancelReservation(ids: number[]): Promise<any> {
    const endpoint = this.config.version === "v3" 
      ? "/bookings/cancelReservation" 
      : "/cancelReservation";
    
    const params = {
      ids: JSON.stringify(ids),
    };

    return this.apiRequest(endpoint, params);
  }

  /**
   * Get bookings by date range
   * @param start - Start date (YYYY-MM-DD)
   * @param end - End date (YYYY-MM-DD)
   */
  async getBookings(start: string, end: string): Promise<any[]> {
    const endpoint = this.config.version === "v3" 
      ? "/bookings/bookings" 
      : "/bookings";
    
    const params = { start, end };
    const data = await this.apiRequest<any>(endpoint, params);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Convert Golfmanager slots to our TeeTimeSlot format
   */
  convertSlotsToTeeTime(
    golfmanagerSlots: GolfmanagerSlot[],
    players: number,
    holes: number = 18
  ): TeeTimeSlot[] {
    return golfmanagerSlots
      .filter(slot => slot.available !== false && slot.start) // Only available slots with start time
      .map((slot) => ({
        teeTime: slot.start,
        greenFee: slot.pricePerSlot || slot.price || 0,
        currency: "EUR",
        players: slot.slots || players,
        holes: holes,
        source: `Golfmanager ${this.config.version.toUpperCase()}`,
      }))
      .sort((a, b) => (a.teeTime || "").localeCompare(b.teeTime || ""));
  }

  /**
   * Full booking flow: search → reserve → confirm
   * @param start - Tee time start (ISO 8601)
   * @param idResource - Resource ID
   * @param idType - Availability type ID
   * @param name - Customer name
   * @param email - Customer email
   * @param phone - Customer phone (optional)
   * @param slots - Number of players
   * @returns Confirmed reservation ID
   */
  async createBooking(
    start: string,
    idResource: number,
    idType: number,
    name: string,
    email: string,
    phone?: string,
    slots: number = 2
  ): Promise<number> {
    console.log(`[Golfmanager] Creating booking for ${name} at ${start}`);

    // Step 1: Make reservation (pre-reserve)
    const timeout = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min timeout
    const reservation: GolfmanagerReservation = {
      idResource,
      start,
      name,
      email,
      idType,
      timeout,
      slots,
    };
    if (phone) reservation.phone = phone;

    const reservations = await this.makeReservation([reservation]);
    
    if (!reservations || reservations.length === 0) {
      throw new Error("Failed to make reservation");
    }

    const reservationId = reservations[0].id;
    console.log(`[Golfmanager] Reservation created with ID: ${reservationId}`);

    // Step 2: Confirm reservation
    await this.confirmReservation([reservationId]);
    console.log(`[Golfmanager] Reservation confirmed: ${reservationId}`);

    return reservationId;
  }
}

/**
 * Get Golfmanager configuration from environment variables
 * @param version - API version (v1 or v3)
 * @param tenant - Course-specific tenant ID (overrides env var)
 */
export function getGolfmanagerConfig(version: GolfmanagerVersion = "v1", tenant?: string): GolfmanagerConfig {
  const {
    GOLFMANAGER_MODE,
    GOLFMANAGER_TENANT,
    GOLFMANAGER_V1_URL,
    GOLFMANAGER_V1_USER,
    GOLFMANAGER_V1_PASSWORD,
    GOLFMANAGER_V3_URL,
    GOLFMANAGER_V3_USER,
    GOLFMANAGER_V3_PASSWORD,
  } = process.env;

  // Determine mode
  const explicitMode = GOLFMANAGER_MODE?.toLowerCase();
  let mode: GolfmanagerMode = "demo";
  
  if (explicitMode === "mock") {
    mode = "mock";
  } else if (explicitMode === "demo") {
    mode = "demo"; // Explicitly set to demo mode
  } else if (explicitMode === "production") {
    mode = "production";
  } else if (version === "v1" && GOLFMANAGER_V1_USER && GOLFMANAGER_V1_PASSWORD) {
    mode = "production";
  } else if (version === "v3" && GOLFMANAGER_V3_USER && GOLFMANAGER_V3_PASSWORD) {
    mode = "production";
  }

  // Use provided tenant or fallback to env var or demo
  const tenantId = tenant || GOLFMANAGER_TENANT || "demo";
  
  // Get credentials based on version and tenant
  // Demo tenant uses .app server for testing
  let baseUrl: string;
  if (version === "v1") {
    if (tenantId === "demo" && mode === "demo") {
      baseUrl = "https://mt.golfmanager.app/api";
    } else {
      baseUrl = GOLFMANAGER_V1_URL || "https://mt-aws-europa.golfmanager.com/api";
    }
  } else {
    baseUrl = GOLFMANAGER_V3_URL || "https://eu.golfmanager.com/main/apimt";
  }

  const user = version === "v1"
    ? (GOLFMANAGER_V1_USER || "SZc5XNpGd0")
    : (GOLFMANAGER_V3_USER || "wagner@freeway.dk");

  const password = version === "v1"
    ? (GOLFMANAGER_V1_PASSWORD || "")
    : (GOLFMANAGER_V3_PASSWORD || "");

  return {
    mode,
    version,
    user,
    password,
    baseUrl,
    tenant: tenantId,
  };
}

/**
 * Create a Golfmanager provider instance for a specific tenant
 * @param tenant - Course-specific tenant ID
 * @param version - API version (defaults to v1)
 */
export function createGolfmanagerProvider(tenant: string, version: GolfmanagerVersion = "v1"): GolfmanagerProvider {
  const config = getGolfmanagerConfig(version, tenant);
  return new GolfmanagerProvider(config);
}

// Export default demo instances for backward compatibility
export const golfmanagerV1 = new GolfmanagerProvider(getGolfmanagerConfig("v1"));
export const golfmanagerV3 = new GolfmanagerProvider(getGolfmanagerConfig("v3"));
