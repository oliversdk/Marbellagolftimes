import type { GolfCourse } from "@shared/schema";

export type GolfmanagerMode = "production" | "demo" | "mock";

export interface GolfmanagerConfig {
  mode: GolfmanagerMode;
  apiKey: string;
  baseUrl: string;
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
  private mode: GolfmanagerMode;

  constructor(config: GolfmanagerConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.mode = config.mode;
    
    console.log(`[Golfmanager] Initialized in ${config.mode.toUpperCase()} mode`);
    console.log(`[Golfmanager] Base URL: ${config.baseUrl}`);
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

export function getGolfmanagerConfig(): GolfmanagerConfig {
  const { GOLFMANAGER_API_KEY, GOLFMANAGER_MODE } = process.env;
  
  // Check if user explicitly set mode
  const explicitMode = GOLFMANAGER_MODE?.toLowerCase();
  
  if (explicitMode === "mock") {
    return {
      mode: "mock",
      apiKey: "",
      baseUrl: "",
    };
  }
  
  // If API key is set, use production mode
  if (GOLFMANAGER_API_KEY) {
    return {
      mode: "production",
      apiKey: GOLFMANAGER_API_KEY,
      baseUrl: "https://eu.golfmanager.com/api",
    };
  }
  
  // Default to demo mode (no API key configured)
  return {
    mode: "demo",
    apiKey: "key",
    baseUrl: "https://mt.golfmanager.app/api",
  };
}
