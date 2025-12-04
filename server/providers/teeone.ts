import axios from "axios";
import type { TeeTimeSlot } from "@shared/schema";

const TEEONE_API_URL = "https://devapi.teeone.golf/MGClubApp/v1";

export interface TeeOneCredentials {
  idEmpresa: number;
  idTeeSheet: number;
  apiUser: string;
  apiPassword: string;
}

export interface TeeOneAuthResponse {
  token: string;
  idInicioSesion: number;
  cod: number;
  msg: string;
}

export interface TeeOneAvailabilityRequest {
  idUsuario: number;
  idTeeSheet: number;
  codigoRecorrido: string;
  fecha: string;
  hora: number;
  token: string;
  idInicioSesion: number;
  idEmpresa: number;
}

export interface TeeOneAvailabilityResponse {
  disponibilidadTotal: number;
  cod: number;
  msg: string;
}

export interface TeeOneSlot {
  hora: number;
  disponibilidad: number;
  precio?: number;
}

export interface TeeOneTimeSlot {
  fecha: string;
  hora: string;
  precio: number;
  disponible: boolean;
  jugadores: number;
  hoyos: number;
}

/**
 * TeeOne Golf API Client
 * Real API integration with TeeOne golf management system
 * Used by 12 Costa del Sol courses including El Paraíso, Marbella Golf & CC, etc.
 * 
 * API Documentation: https://devapi.teeone.golf/MGClubApp/v1/Help
 */
export class TeeOneClient {
  private baseUrl: string;
  private tokenCache: Map<number, { token: string; idInicioSesion: number; expiresAt: number }> = new Map();

  constructor(baseUrl: string = TEEONE_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Authenticate with TeeOne API and get session token
   * @param credentials - TeeOne API credentials for specific course
   * @returns Authentication response with token and session ID
   */
  async authenticate(credentials: TeeOneCredentials): Promise<TeeOneAuthResponse | null> {
    try {
      const cacheKey = credentials.idEmpresa;
      const cached = this.tokenCache.get(cacheKey);
      
      if (cached && cached.expiresAt > Date.now()) {
        console.log(`[TeeOne] Using cached token for idEmpresa ${cacheKey}`);
        return {
          token: cached.token,
          idInicioSesion: cached.idInicioSesion,
          cod: 0,
          msg: "cached",
        };
      }

      console.log(`[TeeOne] Authenticating for idEmpresa ${credentials.idEmpresa}...`);
      
      const response = await axios.post<TeeOneAuthResponse>(
        `${this.baseUrl}/App/Acceso/Token`,
        {
          idEmpresa: credentials.idEmpresa,
          usuario: credentials.apiUser,
          password: credentials.apiPassword,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      if (response.data?.token) {
        this.tokenCache.set(cacheKey, {
          token: response.data.token,
          idInicioSesion: response.data.idInicioSesion,
          expiresAt: Date.now() + 3600000,
        });
        console.log(`[TeeOne] Authentication successful for idEmpresa ${cacheKey}`);
        return response.data;
      }

      console.warn(`[TeeOne] Authentication failed: ${response.data?.msg}`);
      return null;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[TeeOne] Auth error:`, error.message);
        if (error.response) {
          console.error(`[TeeOne] Response status:`, error.response.status);
        }
      } else {
        console.error(`[TeeOne] Unexpected auth error:`, error);
      }
      return null;
    }
  }

  /**
   * Get availability for a specific hour
   * @param credentials - Course credentials
   * @param date - Date in YYYY-MM-DD format
   * @param hour - Hour (decimal, e.g., 9.5 for 9:30)
   * @param codigoRecorrido - Course code (usually "A" for main course)
   */
  async getAvailabilityForHour(
    credentials: TeeOneCredentials,
    date: string,
    hour: number,
    codigoRecorrido: string = "A"
  ): Promise<TeeOneAvailabilityResponse | null> {
    try {
      const auth = await this.authenticate(credentials);
      if (!auth) {
        console.warn(`[TeeOne] Cannot get availability - authentication failed`);
        return null;
      }

      const request: TeeOneAvailabilityRequest = {
        idUsuario: 0,
        idTeeSheet: credentials.idTeeSheet,
        codigoRecorrido,
        fecha: `${date}T00:00:00`,
        hora: hour,
        token: auth.token,
        idInicioSesion: auth.idInicioSesion,
        idEmpresa: credentials.idEmpresa,
      };

      console.log(`[TeeOne] Fetching availability for hour ${hour} on ${date}`);

      const response = await axios.post<TeeOneAvailabilityResponse>(
        `${this.baseUrl}/App/Salidas/ObtenerDisponibilidadHora`,
        request,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[TeeOne] Availability error:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get all available tee times for a date
   * Fetches availability for each hour from 7:00 to 18:00
   */
  async getAvailability(
    credentials: TeeOneCredentials,
    date: string,
    players: number = 2
  ): Promise<TeeTimeSlot[]> {
    const slots: TeeTimeSlot[] = [];
    
    const auth = await this.authenticate(credentials);
    if (!auth) {
      console.warn(`[TeeOne] Cannot get availability - no authentication`);
      return this.getMockSlots(date, players);
    }

    console.log(`[TeeOne] Fetching full day availability for ${date}...`);

    const hours: number[] = [];
    for (let h = 7; h <= 18; h += 0.5) {
      hours.push(h);
    }

    for (const hour of hours) {
      try {
        const availability = await this.getAvailabilityForHour(credentials, date, hour);
        
        if (availability && availability.disponibilidadTotal > 0) {
          const hourInt = Math.floor(hour);
          const minutes = (hour % 1) * 60;
          const timeStr = `${hourInt.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
          
          slots.push({
            teeTime: `${date}T${timeStr}:00`,
            greenFee: 0,
            currency: "EUR",
            players: Math.min(availability.disponibilidadTotal, players),
            holes: 18,
            source: "TeeOne API",
          });
        }
      } catch (error) {
        console.error(`[TeeOne] Error fetching hour ${hour}:`, error);
      }
    }

    console.log(`[TeeOne] Found ${slots.length} available slots`);
    return slots;
  }

  /**
   * Search for available tee times with time filtering
   */
  async searchAvailability(
    credentials: TeeOneCredentials | null,
    date: string,
    players: number = 2,
    holes: number = 18,
    fromTime?: string,
    toTime?: string
  ): Promise<TeeTimeSlot[]> {
    if (!credentials || !credentials.idEmpresa) {
      console.log(`[TeeOne] No credentials - returning mock data`);
      return this.getMockSlots(date, players, holes, fromTime, toTime);
    }

    let slots = await this.getAvailability(credentials, date, players);

    if (fromTime || toTime) {
      slots = slots.filter(slot => {
        const slotTime = slot.teeTime.split("T")[1]?.substring(0, 5);
        if (!slotTime) return true;
        if (fromTime && slotTime < fromTime) return false;
        if (toTime && slotTime > toTime) return false;
        return true;
      });
    }

    return slots;
  }

  /**
   * Generate mock slots when credentials are not available
   * This allows the booking flow to be tested without real API access
   */
  getMockSlots(
    date: string,
    players: number = 2,
    holes: number = 18,
    fromTime?: string,
    toTime?: string
  ): TeeTimeSlot[] {
    console.log(`[TeeOne] Generating MOCK slots for ${date}`);
    
    const slots: TeeTimeSlot[] = [];
    const basePrice = holes === 9 ? 45 : 85;
    
    for (let hour = 7; hour <= 17; hour++) {
      for (const minutes of [0, 10, 20, 30, 40, 50]) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        
        if (fromTime && timeStr < fromTime) continue;
        if (toTime && timeStr > toTime) continue;
        
        const morningBonus = hour < 10 ? 15 : 0;
        const afternoonDiscount = hour >= 14 ? -10 : 0;
        const price = basePrice + morningBonus + afternoonDiscount + Math.floor(Math.random() * 20);
        
        const isAvailable = Math.random() > 0.3;
        if (!isAvailable) continue;
        
        slots.push({
          teeTime: `${date}T${timeStr}:00`,
          greenFee: price,
          currency: "EUR",
          players,
          holes,
          source: "TeeOne MOCK",
        });
      }
    }
    
    return slots;
  }

  /**
   * Check if credentials are valid (has required fields)
   */
  hasValidCredentials(credentials: Partial<TeeOneCredentials> | null): credentials is TeeOneCredentials {
    return !!(
      credentials &&
      credentials.idEmpresa &&
      credentials.idTeeSheet &&
      credentials.apiUser &&
      credentials.apiPassword
    );
  }
}

export const teeoneClient = new TeeOneClient();

export const TEEONE_COURSES: Record<string, { 
  name: string; 
  tenant: string;
  expectedIdEmpresa?: number;
}> = {
  "paraiso": { name: "El Paraíso Golf Club", tenant: "paraiso" },
  "marbellagolf": { name: "Marbella Golf & Country Club", tenant: "marbellagolf" },
  "estepona": { name: "Estepona Golf", tenant: "estepona" },
  "atalaya": { name: "Atalaya Golf & Country Club", tenant: "atalaya" },
  "santaclara": { name: "Santa Clara Golf Marbella", tenant: "santaclara" },
  "losnaranjos": { name: "Los Naranjos Golf Club", tenant: "losnaranjos" },
  "mijas": { name: "Mijas Golf Club", tenant: "mijas" },
  "torrequebrada": { name: "Torrequebrada Golf", tenant: "torrequebrada" },
  "valderrama": { name: "Real Club Valderrama", tenant: "valderrama" },
  "villapadierna": { name: "Villa Padierna Golf Club", tenant: "villapadierna" },
  "losarqueros": { name: "Los Arqueros Golf & Country Club", tenant: "losarqueros" },
  "laquinta": { name: "La Quinta Golf & Country Club", tenant: "laquinta" },
};

export function getTeeOneTenant(courseName: string): string | null {
  const normalized = courseName.toLowerCase();
  
  for (const [tenant, info] of Object.entries(TEEONE_COURSES)) {
    if (normalized.includes(tenant) || normalized.includes(info.name.toLowerCase())) {
      return tenant;
    }
  }
  
  if (normalized.includes("paraíso") || normalized.includes("paraiso")) return "paraiso";
  if (normalized.includes("marbella golf")) return "marbellagolf";
  if (normalized.includes("santa clara")) return "santaclara";
  if (normalized.includes("los naranjos") || normalized.includes("naranjos")) return "losnaranjos";
  if (normalized.includes("la quinta") || normalized.includes("laquinta")) return "laquinta";
  if (normalized.includes("los arqueros") || normalized.includes("arqueros")) return "losarqueros";
  if (normalized.includes("villa padierna") || normalized.includes("flamingos")) return "villapadierna";
  
  return null;
}
