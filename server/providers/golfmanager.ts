import axios from "axios";
import type { TeeTimeSlot, TeeTimePackage } from "@shared/schema";

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = DEFAULT_RETRIES,
  delay = DEFAULT_RETRY_DELAY
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = 
        error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNABORTED' ||
        (error.response?.status >= 500 && error.response?.status < 600);
      
      if (!isRetryable || i === retries - 1) {
        throw error;
      }
      
      console.log(`[Golfmanager] Retry ${i + 1}/${retries} after ${delay * (i + 1)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

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
 * Clean package names by removing TTOO (Tour Operator) codes
 * These are internal wholesale codes that shouldn't be shown to customers
 * Examples: "Greenfee + Buggy TTOO 25" → "Greenfee + Buggy"
 *           "GREENFEE + BUGGY TWILIGHT 25" → "GREENFEE + BUGGY TWILIGHT"
 */
function cleanPackageName(name: string): string {
  if (!name) return "Green Fee";
  
  // Remove TTOO codes and variations (case insensitive)
  let cleaned = name
    .replace(/\s*TTOO\s*\d*\s*/gi, " ")   // "TTOO 25", "TTOO", etc.
    .replace(/\s*TO\s+\d+\s*/gi, " ")      // "TO 25" pattern
    .replace(/\s+\d{1,2}\s*$/g, "")        // Trailing " 25", " 30" at end
    .replace(/\s+/g, " ")                   // Normalize spaces
    .trim();
  
  // If name becomes empty or just numbers, use default
  if (!cleaned || /^\d+$/.test(cleaned)) {
    return "Green Fee";
  }
  
  return cleaned;
}

/**
 * Get package slug for price target lookup
 * Maps cleaned package names to slugs: "standard", "earlybird", "twilight", "lunch", "2player"
 */
function getPackageSlug(name: string): string {
  const lower = name.toLowerCase();
  
  if (lower.includes("earlybird") || lower.includes("early bird")) {
    return "earlybird";
  }
  if (lower.includes("twilight") || lower.includes("tarde")) {
    return "twilight";
  }
  if (lower.includes("lunch") || lower.includes("almuerzo")) {
    return "lunch";
  }
  if (lower.includes("2 greenfee") || lower.includes("2greenfee") || lower.includes("2 green fee")) {
    return "2player";
  }
  
  return "standard";
}

/**
 * Price targets interface for package-specific customer prices
 */
interface PriceTargets {
  standard?: number;
  earlybird?: number;
  twilight?: number;
  lunch?: number;
  "2player"?: number;
  [key: string]: number | undefined;
}

/**
 * Rate period from contract data
 */
interface RatePeriod {
  packageType: string;
  rackRate: number;
  netRate: number;
  kickbackPercent: number;
  seasonLabel: string;
  isEarlyBird: string;
  isTwilight: string;
  includesLunch: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get customer price from rate periods (contract data)
 * Matches package name to rate period and returns rack rate
 */
function getCustomerPriceFromRatePeriods(
  ttooPrice: number,
  packageName: string,
  ratePeriods: RatePeriod[],
  fallbackKickback: number = 20
): number {
  if (!ratePeriods || ratePeriods.length === 0) {
    // No rate periods - use fallback markup
    return Math.round(ttooPrice * (1 + fallbackKickback / 100) * 100) / 100;
  }
  
  const nameLower = packageName.toLowerCase();
  
  // Find matching rate period based on package characteristics
  let matchedPeriod: RatePeriod | undefined;
  
  if (nameLower.includes("earlybird") || nameLower.includes("early bird")) {
    matchedPeriod = ratePeriods.find(rp => rp.isEarlyBird === "true");
  } else if (nameLower.includes("twilight") || nameLower.includes("tarde")) {
    matchedPeriod = ratePeriods.find(rp => rp.isTwilight === "true");
  } else if (nameLower.includes("lunch") || nameLower.includes("almuerzo")) {
    matchedPeriod = ratePeriods.find(rp => rp.includesLunch === "true" && rp.isEarlyBird !== "true" && rp.isTwilight !== "true");
  } else {
    // Standard greenfee - find one without special flags
    matchedPeriod = ratePeriods.find(rp => 
      rp.isEarlyBird !== "true" && 
      rp.isTwilight !== "true" && 
      rp.includesLunch !== "true"
    );
  }
  
  if (matchedPeriod) {
    // Use rack rate directly from contract
    console.log(`[Golfmanager] Using rack rate €${matchedPeriod.rackRate} for "${packageName}" (from contract: ${matchedPeriod.seasonLabel})`);
    return matchedPeriod.rackRate;
  }
  
  // Fallback: use kickback markup
  return Math.round(ttooPrice * (1 + fallbackKickback / 100) * 100) / 100;
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
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async apiRequest<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    return withRetry(async () => {
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
          timeout: DEFAULT_TIMEOUT,
        });

        return response.data;
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.error(`[Golfmanager] API error for ${endpoint}:`, error.message);
          if (error.response) {
            console.error(`[Golfmanager] Response status:`, error.response.status);
            console.error(`[Golfmanager] Response data:`, error.response.data);
          }
          throw error;
        }
        throw error;
      }
    });
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
   * Handles both flat format (legacy) and nested format (current API response)
   * 
   * Nested format: [{ date: "...", slots: 2, types: [{ name, price, start, ... }] }]
   * Flat format: [{ start: "...", price: ..., slots: ... }]
   * 
   * @param ratePeriods - Array of rate periods from contract data with rack rates
   * @param kickbackPercent - Fallback markup percentage if no rate period matches
   */
  convertSlotsToTeeTime(
    golfmanagerSlots: any[],
    players: number,
    holes: number = 18,
    ratePeriods: RatePeriod[] = [],
    kickbackPercent: number = 20
  ): TeeTimeSlot[] {
    // Helper to get customer price using rate periods (contract rack rates)
    const getCustomerPrice = (ttooPrice: number, packageName: string): number => {
      return getCustomerPriceFromRatePeriods(ttooPrice, packageName, ratePeriods, kickbackPercent);
    };
    const results: TeeTimeSlot[] = [];
    
    for (const slot of golfmanagerSlots) {
      // Handle nested format: { date, slots, types: [...] }
      if (slot.types && Array.isArray(slot.types)) {
        // Filter valid types based on requested holes (9 or 18)
        const holesTag = holes === 9 ? "9holes" : "18holes";
        const validTypes = slot.types.filter((t: any) => 
          t.price !== undefined && 
          !t.onlyMembers &&
          (!t.tags || t.tags.length === 0 || t.tags?.includes(holesTag))
        );
        
        if (validTypes.length > 0) {
          // Convert all valid types to packages with customer prices
          const packages: TeeTimePackage[] = validTypes.map((t: any) => {
            const cleanedName = cleanPackageName(t.name);
            const nameLower = cleanedName.toLowerCase();
            const customerPrice = getCustomerPrice(t.price || 0, cleanedName);
            return {
              id: t.id || t.idType || 0,
              name: cleanedName,
              price: customerPrice, // Use customer price, not TTOO price
              description: t.description || undefined,
              includesBuggy: nameLower.includes("buggy"),
              includesLunch: nameLower.includes("lunch") || nameLower.includes("almuerzo"),
              isEarlyBird: nameLower.includes("earlybird") || nameLower.includes("early bird"),
              isTwilight: nameLower.includes("twilight") || nameLower.includes("tarde"),
              maxPlayers: t.max || 4,
              minPlayers: t.min || 1,
              isRackRate: true, // Price is already rack rate from contract, no markup needed
            };
          });
          
          // Sort by customer price (lowest first)
          packages.sort((a, b) => a.price - b.price);
          const lowestPricePackage = packages[0];
          const lowestPriceType = validTypes.find((t: any) => 
            cleanPackageName(t.name) === lowestPricePackage.name
          ) || validTypes[0];
          
          results.push({
            teeTime: slot.date || lowestPriceType.start,
            greenFee: lowestPricePackage.price, // Show lowest customer price as main price
            currency: "EUR",
            players: slot.slots || players,
            holes: holes,
            source: `Golfmanager ${this.config.version.toUpperCase()}`,
            slotsAvailable: lowestPriceType.max ? Math.min(lowestPriceType.max, 4) : (slot.slots || 4),
            packageName: lowestPricePackage.name,
            packages: packages, // Include ALL packages with customer prices
            teeName: slot.resourceName || slot.resource || lowestPriceType.resourceName || "TEE 1",
          });
        }
      } 
      // Handle flat format: { start, price, slots, ... }
      else if (slot.start) {
        if (slot.available !== false) {
          const ttooPrice = slot.pricePerSlot || slot.price || 0;
          const customerPrice = getCustomerPrice(ttooPrice, "standard");
          results.push({
            teeTime: slot.start,
            greenFee: customerPrice, // Use customer price
            currency: "EUR",
            players: slot.slots || players,
            holes: holes,
            source: `Golfmanager ${this.config.version.toUpperCase()}`,
            slotsAvailable: slot.max ? Math.min(slot.max, 4) : (slot.slots || 4),
            teeName: slot.resourceName || slot.resource || "TEE 1",
          });
        }
      }
    }
    
    return results.sort((a, b) => (a.teeTime || "").localeCompare(b.teeTime || ""));
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
 * Get Golfmanager configuration from environment variables or database
 * 
 * Credential priority order:
 * 1. Database credentials (course.golfmanagerUser/Password)
 * 2. Tenant-specific env vars (GM_{TENANT}_USER/PASS)
 * 3. Global env vars (GOLFMANAGER_V1_USER/PASSWORD)
 * 4. Default demo credentials
 * 
 * @param version - API version (v1 or v3)
 * @param tenant - Course-specific tenant ID (overrides env var)
 * @param dbCredentials - Optional database credentials from course record
 */
export function getGolfmanagerConfig(
  version: GolfmanagerVersion = "v1", 
  tenant?: string,
  dbCredentials?: { user: string | null; password: string | null }
): GolfmanagerConfig {
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

  // Use provided tenant or fallback to env var or demo
  const tenantId = tenant || GOLFMANAGER_TENANT || "demo";
  
  // Credential priority system
  let user: string;
  let password: string;
  let credentialSource: string;
  
  // Priority 1: Database credentials (highest priority)
  if (dbCredentials?.user && dbCredentials?.password) {
    user = dbCredentials.user;
    password = dbCredentials.password;
    credentialSource = "database";
    console.log(`[Golfmanager] Using database credentials for ${tenantId}`);
  } else {
    // Priority 2: Tenant-specific environment variables
    // Format: GM_{TENANT}_USER and GM_{TENANT}_PASS (e.g. GM_PARAISO_USER, GM_PARAISO_PASS)
    const tenantUpperCase = tenantId.toUpperCase();
    const tenantUserKey = `GM_${tenantUpperCase}_USER`;
    const tenantPassKey = `GM_${tenantUpperCase}_PASS`;
    
    const tenantUser = process.env[tenantUserKey];
    const tenantPassword = process.env[tenantPassKey];
    
    if (tenantUser && tenantPassword) {
      user = tenantUser;
      password = tenantPassword;
      credentialSource = "tenant-env";
      console.log(`[Golfmanager] Using tenant-specific env credentials for ${tenantId}`);
    } else {
      // Priority 3: Global credentials
      user = version === "v1"
        ? (GOLFMANAGER_V1_USER || "SZc5XNpGd0")
        : (GOLFMANAGER_V3_USER || "wagner@freeway.dk");
      
      password = version === "v1"
        ? (GOLFMANAGER_V1_PASSWORD || "")
        : (GOLFMANAGER_V3_PASSWORD || "");
      
      credentialSource = password ? "global-env" : "demo";
      if (!password) {
        console.log(`[Golfmanager] Using demo credentials for ${tenantId}`);
      }
    }
  }

  // Determine mode
  const explicitMode = GOLFMANAGER_MODE?.toLowerCase();
  let mode: GolfmanagerMode = "demo";
  
  if (explicitMode === "mock") {
    mode = "mock";
  } else if (explicitMode === "demo") {
    mode = "demo";
  } else if (explicitMode === "production") {
    mode = "production";
  } else if (credentialSource === "database" || credentialSource === "tenant-env") {
    // If using database or tenant-specific credentials, auto-enable production mode
    mode = "production";
  } else if (version === "v1" && GOLFMANAGER_V1_USER && GOLFMANAGER_V1_PASSWORD) {
    mode = "production";
  } else if (version === "v3" && GOLFMANAGER_V3_USER && GOLFMANAGER_V3_PASSWORD) {
    mode = "production";
  }
  
  // Get base URL based on version and tenant
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
 * @param dbCredentials - Optional database credentials from course record
 */
export function createGolfmanagerProvider(
  tenant: string, 
  version: GolfmanagerVersion = "v1",
  dbCredentials?: { user: string | null; password: string | null }
): GolfmanagerProvider {
  const config = getGolfmanagerConfig(version, tenant, dbCredentials);
  return new GolfmanagerProvider(config);
}

// Export default demo instances for backward compatibility
export const golfmanagerV1 = new GolfmanagerProvider(getGolfmanagerConfig("v1"));
export const golfmanagerV3 = new GolfmanagerProvider(getGolfmanagerConfig("v3"));
