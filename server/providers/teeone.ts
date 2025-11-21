import axios from "axios";
import type { TeeTimeSlot } from "@shared/schema";

const TEEONE_BASE_URL = "https://open.teeone.golf/es";

export interface TeeOneAvailabilitySlot {
  fecha: string; // ISO date-time
  precio?: number;
  disponible?: boolean;
  jugadores?: number;
  hoyos?: number;
}

export interface TeeOnePriceSlot {
  fecha: string;
  precio: number;
  moneda?: string;
}

/**
 * TeeOne API Client for Costa del Sol golf courses
 * Integrates with TeeOne booking platform (used by Golfmanager courses)
 */
export class TeeOneClient {
  private baseUrl: string;

  constructor(baseUrl: string = TEEONE_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get available tee times for a course
   * @param tenant - Course tenant code (e.g., "paraiso", "atalaya")
   * @param date - Date in YYYY-MM-DD format
   * @param players - Number of players (1-4)
   * @returns Array of available time slots
   */
  async getAvailability(
    tenant: string,
    date: string,
    players: number = 2
  ): Promise<TeeOneAvailabilitySlot[]> {
    try {
      const url = `${this.baseUrl}/${tenant}/disponibilidad`;
      
      console.log(`[TeeOne] Fetching availability for ${tenant} on ${date} for ${players} players`);
      
      const response = await axios.get(url, {
        params: {
          fecha: date,
          jugadores: players,
        },
        timeout: 10000, // 10 second timeout
      });

      if (!response.data) {
        console.warn(`[TeeOne] No data returned for ${tenant}`);
        return [];
      }

      // TeeOne returns array of time slots
      const slots = Array.isArray(response.data) ? response.data : [];
      console.log(`[TeeOne] Retrieved ${slots.length} slots for ${tenant}`);
      
      return slots;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error(`[TeeOne] API error for ${tenant}:`, error.message);
        if (error.response) {
          console.error(`[TeeOne] Response status:`, error.response.status);
        }
      } else {
        console.error(`[TeeOne] Unexpected error for ${tenant}:`, error);
      }
      return [];
    }
  }

  /**
   * Get pricing information for available slots
   * @param tenant - Course tenant code
   * @param date - Date in YYYY-MM-DD format
   * @param players - Number of players
   * @returns Array of price slots
   */
  async getPrices(
    tenant: string,
    date: string,
    players: number = 2
  ): Promise<TeeOnePriceSlot[]> {
    try {
      const url = `${this.baseUrl}/${tenant}/precios`;
      
      const response = await axios.get(url, {
        params: {
          fecha: date,
          jugadores: players,
        },
        timeout: 10000,
      });

      return Array.isArray(response.data) ? response.data : [];
    } catch (error: unknown) {
      console.error(`[TeeOne] Price fetch error for ${tenant}:`, error);
      return [];
    }
  }

  /**
   * Convert TeeOne slots to our TeeTimeSlot format
   * @param slots - Raw TeeOne availability slots
   * @param prices - Optional price data to merge
   * @param players - Number of players
   * @param holes - Number of holes (18 or 9)
   * @returns Formatted TeeTimeSlot array
   */
  convertToTeeTimeSlots(
    slots: TeeOneAvailabilitySlot[],
    prices: TeeOnePriceSlot[] = [],
    players: number = 2,
    holes: number = 18
  ): TeeTimeSlot[] {
    // Create price lookup map
    const priceMap = new Map<string, number>();
    prices.forEach(p => {
      priceMap.set(p.fecha, p.precio);
    });

    return slots
      .filter(slot => slot.disponible !== false) // Only available slots
      .map(slot => {
        const teeTime = slot.fecha;
        const price = priceMap.get(teeTime) || slot.precio || 0;

        return {
          teeTime,
          greenFee: price,
          currency: "EUR",
          players: slot.jugadores || players,
          holes: slot.hoyos || holes,
          source: "TeeOne API",
        };
      })
      .sort((a, b) => a.teeTime.localeCompare(b.teeTime)); // Sort by time
  }

  /**
   * Search for available tee times with pricing
   * @param tenant - Course tenant code
   * @param date - Date in YYYY-MM-DD format
   * @param players - Number of players
   * @param holes - Number of holes
   * @param fromTime - Start time (HH:MM format)
   * @param toTime - End time (HH:MM format)
   * @returns Formatted tee time slots
   */
  async searchAvailability(
    tenant: string,
    date: string,
    players: number = 2,
    holes: number = 18,
    fromTime?: string,
    toTime?: string
  ): Promise<TeeTimeSlot[]> {
    try {
      // Fetch availability and prices in parallel
      const [availabilitySlots, priceSlots] = await Promise.all([
        this.getAvailability(tenant, date, players),
        this.getPrices(tenant, date, players),
      ]);

      let slots = this.convertToTeeTimeSlots(
        availabilitySlots,
        priceSlots,
        players,
        holes
      );

      // Filter by time range if specified
      if (fromTime || toTime) {
        slots = slots.filter(slot => {
          const slotTime = slot.teeTime.split("T")[1]?.substring(0, 5); // Extract HH:MM
          if (!slotTime) return true;

          if (fromTime && slotTime < fromTime) return false;
          if (toTime && slotTime > toTime) return false;
          return true;
        });
      }

      return slots;
    } catch (error: unknown) {
      console.error(`[TeeOne] Search error for ${tenant}:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const teeoneClient = new TeeOneClient();
