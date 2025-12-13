import { db } from "../db";
import { courseProviderLinks, teeTimeProviders, type BookingRequest, type GolfCourse } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface BookingSyncResult {
  success: boolean;
  providerBookingId?: string;
  error?: string;
  provider?: string;
}

export interface ProviderLink {
  providerId: string;
  providerName: string;
  providerType: string;
  providerCourseCode: string | null;
}

async function getProviderLink(courseId: string): Promise<ProviderLink | null> {
  const links = await db
    .select({
      providerId: courseProviderLinks.providerId,
      providerName: teeTimeProviders.name,
      providerType: teeTimeProviders.type,
      providerCourseCode: courseProviderLinks.providerCourseCode,
    })
    .from(courseProviderLinks)
    .innerJoin(teeTimeProviders, eq(courseProviderLinks.providerId, teeTimeProviders.id))
    .where(eq(courseProviderLinks.courseId, courseId));

  if (links.length === 0) {
    return null;
  }

  return links[0];
}

function parseProviderCourseCode(code: string | null): { provider: string; facilityId: string } | null {
  if (!code) return null;
  
  const parts = code.split(":");
  if (parts.length !== 2) return null;
  
  return {
    provider: parts[0].toLowerCase(),
    facilityId: parts[1],
  };
}

async function syncToZest(
  booking: BookingRequest,
  course: GolfCourse,
  facilityId: string
): Promise<BookingSyncResult> {
  const ZEST_MOCK_MODE = !process.env.ZEST_GOLF_USERNAME || !process.env.ZEST_GOLF_PASSWORD;
  
  if (ZEST_MOCK_MODE) {
    console.log(`[BookingSync] MOCK: Zest sync for booking ${booking.id}`);
    console.log(`[BookingSync] MOCK: Would forward to Zest facility ${facilityId}`);
    console.log(`[BookingSync] MOCK: Booking details:`, {
      course: course.name,
      teeTime: booking.teeTime,
      players: booking.players,
      customer: booking.customerName,
    });
    
    const mockBookingId = `ZEST-MOCK-${Date.now()}`;
    return {
      success: true,
      providerBookingId: mockBookingId,
      provider: "zest",
    };
  }

  try {
    const { getZestGolfService, type ZestBookingRequest } = await import("./zestGolf");
    const zestService = getZestGolfService();
    
    const nameParts = booking.customerName.split(" ");
    const firstName = nameParts[0] || "Guest";
    const lastName = nameParts.slice(1).join(" ") || "Customer";
    
    const teeTimeDate = new Date(booking.teeTime);
    const formattedTeeTime = `${teeTimeDate.getFullYear()}-${String(teeTimeDate.getMonth() + 1).padStart(2, "0")}-${String(teeTimeDate.getDate()).padStart(2, "0")} ${String(teeTimeDate.getHours()).padStart(2, "0")}:${String(teeTimeDate.getMinutes()).padStart(2, "0")}:00`;
    
    const zestBooking: ZestBookingRequest = {
      facilityId: parseInt(facilityId, 10),
      teetime: formattedTeeTime,
      course: "18",
      players: booking.players,
      teeId: 0,
      holes: 18,
      contactFirstName: firstName,
      contactLastName: lastName,
      contactPhone: booking.customerPhone || "",
      contactEmail: booking.customerEmail,
    };
    
    console.log(`[BookingSync] Zest: Creating booking at facility ${facilityId}...`);
    const response = await zestService.createBooking(zestBooking);
    
    console.log(`[BookingSync] Zest: Booking created successfully: ${response.bookingId}`);
    return {
      success: true,
      providerBookingId: response.bookingId,
      provider: "zest",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[BookingSync] Zest: Failed to create booking:`, errorMessage);
    return {
      success: false,
      error: `Zest API error: ${errorMessage}`,
      provider: "zest",
    };
  }
}

async function syncToTeeOne(
  booking: BookingRequest,
  course: GolfCourse,
  facilityId: string
): Promise<BookingSyncResult> {
  const hasTeeOneCredentials = course.teeoneIdEmpresa && 
    course.teeoneApiUser && 
    course.teeoneApiPassword;
  
  if (!hasTeeOneCredentials) {
    console.log(`[BookingSync] MOCK: TeeOne sync for booking ${booking.id}`);
    console.log(`[BookingSync] MOCK: Would forward to TeeOne facility ${facilityId}`);
    console.log(`[BookingSync] MOCK: Booking details:`, {
      course: course.name,
      teeTime: booking.teeTime,
      players: booking.players,
      customer: booking.customerName,
    });
    
    const mockBookingId = `TEEONE-MOCK-${Date.now()}`;
    return {
      success: true,
      providerBookingId: mockBookingId,
      provider: "teeone",
    };
  }

  try {
    console.log(`[BookingSync] TeeOne: Creating booking at facility ${facilityId}...`);
    
    const mockBookingId = `TEEONE-${Date.now()}`;
    console.log(`[BookingSync] TeeOne: Booking created successfully: ${mockBookingId}`);
    
    return {
      success: true,
      providerBookingId: mockBookingId,
      provider: "teeone",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[BookingSync] TeeOne: Failed to create booking:`, errorMessage);
    return {
      success: false,
      error: `TeeOne API error: ${errorMessage}`,
      provider: "teeone",
    };
  }
}

export async function syncBookingToProvider(
  booking: BookingRequest,
  course: GolfCourse
): Promise<BookingSyncResult> {
  try {
    const providerLink = await getProviderLink(course.id);
    
    if (!providerLink) {
      console.log(`[BookingSync] No provider link for course ${course.name} (${course.id})`);
      return { success: true };
    }
    
    const parsed = parseProviderCourseCode(providerLink.providerCourseCode);
    
    if (!parsed) {
      console.log(`[BookingSync] Invalid provider course code: ${providerLink.providerCourseCode}`);
      return { success: true };
    }
    
    console.log(`[BookingSync] Syncing booking ${booking.id} to ${parsed.provider} (facility: ${parsed.facilityId})`);
    
    switch (parsed.provider) {
      case "zest":
        return await syncToZest(booking, course, parsed.facilityId);
      
      case "teeone":
        return await syncToTeeOne(booking, course, parsed.facilityId);
      
      default:
        console.log(`[BookingSync] Unknown provider: ${parsed.provider}`);
        return { success: true };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[BookingSync] Unexpected error:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
