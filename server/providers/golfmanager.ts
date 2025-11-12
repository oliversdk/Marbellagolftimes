import type { GolfCourse } from "@shared/schema";

export interface GolfmanagerConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface GolfmanagerSlot {
  idType: number;
  max: number;
  min: number | null;
  multiple: number | null;
  name: string;
  price: number;
  start: string;
  idResource: number;
  resourceName: string;
  resourceTags: string[];
  tags: string[];
}

export interface TeeTimeSlot {
  teeTime: string;
  greenFee: number;
  currency: string;
  players: number;
  source: string;
}

export interface CourseWithSlots {
  courseId: string;
  courseName: string;
  distanceKm: number;
  bookingUrl?: string;
  slots: TeeTimeSlot[];
  note?: string;
}

export class GolfmanagerProvider {
  private baseUrl: string;
  private auth: string;

  constructor(config: GolfmanagerConfig) {
    this.baseUrl = config.baseUrl;
    this.auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  }

  async searchAvailability(
    tenant: string,
    startDate: string,
    endDate: string,
    slots: number
  ): Promise<GolfmanagerSlot[]> {
    const formData = new URLSearchParams();
    formData.append("tenant", tenant);
    formData.append("start", startDate);
    formData.append("end", endDate);
    formData.append("slots", slots.toString());

    const response = await fetch(`${this.baseUrl}/searchAvailability`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Golfmanager API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getTenantInfo(tenant: string): Promise<any> {
    const formData = new URLSearchParams();
    formData.append("tenant", tenant);

    const response = await fetch(`${this.baseUrl}/tenantInfo`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Golfmanager API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getResources(tenant: string): Promise<any[]> {
    const formData = new URLSearchParams();
    formData.append("tenant", tenant);

    const response = await fetch(`${this.baseUrl}/resources`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
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
  const { GOLFMANAGER_URL, GOLFMANAGER_USER, GOLFMANAGER_PASSWORD } = process.env;

  if (!GOLFMANAGER_URL || !GOLFMANAGER_USER || !GOLFMANAGER_PASSWORD) {
    return null;
  }

  return {
    baseUrl: GOLFMANAGER_URL,
    username: GOLFMANAGER_USER,
    password: GOLFMANAGER_PASSWORD,
  };
}
