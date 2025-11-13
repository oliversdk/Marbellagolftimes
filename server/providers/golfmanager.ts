import type { GolfCourse } from "@shared/schema";

export interface GolfmanagerConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface GolfmanagerSlot {
  area: number;
  areaName: string;
  typeName: string;
  start: string;
  price: number;
  max?: number;
  min?: number;
  slots?: number;
}

export interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  source: string;
}

export class GolfmanagerProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: GolfmanagerConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://eu.golfmanager.com/api";
  }

  async searchAvailability(
    tenant: string,
    startDate: string,
    endDate: string,
    slots: number
  ): Promise<GolfmanagerSlot[]> {
    const url = new URL(`${this.baseUrl}/bookings/searchAvailability`);
    url.searchParams.append("start", startDate);
    url.searchParams.append("end", endDate);
    url.searchParams.append("slots", slots.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "key": this.apiKey,
        "tenant": tenant,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Golfmanager API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async getTenant(tenant: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/model/tenant`, {
      method: "GET",
      headers: {
        "key": this.apiKey,
        "tenant": tenant,
      },
    });

    if (!response.ok) {
      throw new Error(`Golfmanager API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  convertSlotsToTeeTime(golfmanagerSlots: GolfmanagerSlot[], players: number): TeeTimeSlot[] {
    return golfmanagerSlots.map((slot) => ({
      teeTime: slot.start,
      greenFee: slot.price,
      currency: "EUR",
      players: players,
      source: "golfmanager",
    }));
  }
}

export function getGolfmanagerConfig(): GolfmanagerConfig | null {
  const { GOLFMANAGER_API_KEY } = process.env;

  if (!GOLFMANAGER_API_KEY) {
    return null;
  }

  return {
    apiKey: GOLFMANAGER_API_KEY,
  };
}
