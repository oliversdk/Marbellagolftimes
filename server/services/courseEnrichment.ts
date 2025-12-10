import OpenAI from "openai";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FacilityInfo {
  name: string;
  description: string;
  hours?: string;
  phone?: string;
}

interface EnrichedFacilities {
  drivingRange?: FacilityInfo;
  puttingGreen?: FacilityInfo;
  chippingArea?: FacilityInfo;
  proShop?: FacilityInfo;
  restaurant?: FacilityInfo;
  hotel?: FacilityInfo;
  clubRental?: FacilityInfo;
  buggyRental?: FacilityInfo;
  golfAcademy?: FacilityInfo;
  spa?: FacilityInfo;
  pool?: FacilityInfo;
  otherAmenities?: string[];
}

interface CourseOverview {
  description: string;
  designer?: string;
  yearOpened?: number;
  holes: number;
  par: number;
  length?: string;
  courseType?: string;
  notablePlayers?: string[];
  tournaments?: string[];
  uniqueFeatures?: string[];
}

interface BookingRules {
  arrivalTime?: string;
  dressCode?: string;
  buggyPolicy?: string;
  handicapRequirements?: string;
  cancellationPolicy?: string;
  weatherPolicy?: string;
  groupBookings?: string;
}

export class CourseEnrichmentService {
  
  async enrichCourse(courseId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return { success: false, error: "Course not found" };
      }

      await storage.updateCourse(courseId, { enrichmentStatus: "processing" });

      const searchQuery = `${course.name} ${course.city} Spain golf course facilities amenities restaurant pro shop driving range`;
      
      const prompt = `You are a golf course research assistant. Based on your knowledge about "${course.name}" golf course in ${course.city}, ${course.province}, Spain, provide comprehensive information.

If you don't have specific information about this course, provide typical information for a quality Costa del Sol golf course.

Respond in JSON format with three sections:

1. "overview" - Course description including:
   - description: A compelling 2-3 paragraph description of the course
   - designer: Course architect name if known
   - yearOpened: Year the course opened if known
   - holes: Number of holes (default 18)
   - par: Course par (default 72)
   - length: Course length if known
   - courseType: Type (links, parkland, mountain, etc.)
   - uniqueFeatures: Array of notable features
   - tournaments: Array of any notable tournaments held here

2. "facilities" - Available amenities:
   - drivingRange: { name, description, hours? }
   - puttingGreen: { name, description }
   - chippingArea: { name, description }
   - proShop: { name, description, hours?, phone? }
   - restaurant: { name, description, hours?, phone? }
   - hotel: { name, description, phone? } if on-site accommodation exists
   - clubRental: { name, description }
   - buggyRental: { name, description }
   - golfAcademy: { name, description } if exists
   - spa: { name, description } if exists
   - otherAmenities: Array of other amenities

3. "bookingRules" - Standard policies:
   - arrivalTime: When players should arrive before their tee time (e.g., "30 minutes before tee time")
   - dressCode: Clothing requirements (e.g., "Smart casual golf attire required. Collared shirts mandatory, denim not permitted on course")
   - buggyPolicy: Buggy/cart rules (e.g., "Buggies available for rental. Cart path only during wet conditions")
   - handicapRequirements: Handicap rules (e.g., "Maximum handicap 36 for men, 40 for ladies. Certificate may be required")
   - cancellationPolicy: Cancellation terms (e.g., "Free cancellation 48 hours before. 50% charge within 48 hours")
   - weatherPolicy: Weather-related policies (e.g., "Rain voucher issued if course closed. Valid for 12 months")
   - groupBookings: Group booking terms (e.g., "Groups of 8+ players: 1 plays free. Advance booking required for societies")

Respond ONLY with valid JSON, no markdown or extra text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a knowledgeable golf course expert with detailed information about Costa del Sol golf courses in Spain." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      let cleanedContent = content.trim();
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.slice(7);
      }
      if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.slice(3);
      }
      if (cleanedContent.endsWith("```")) {
        cleanedContent = cleanedContent.slice(0, -3);
      }
      cleanedContent = cleanedContent.trim();

      const parsed = JSON.parse(cleanedContent);
      
      const overview: CourseOverview = parsed.overview || {};
      const facilities: EnrichedFacilities = parsed.facilities || {};
      const bookingRules: BookingRules = parsed.bookingRules || {};

      const updatedNotes = overview.description || course.notes;
      
      const facilitiesArray: string[] = [];
      if (facilities.drivingRange) facilitiesArray.push("Driving Range");
      if (facilities.puttingGreen) facilitiesArray.push("Putting Green");
      if (facilities.chippingArea) facilitiesArray.push("Chipping Area");
      if (facilities.proShop) facilitiesArray.push("Pro Shop");
      if (facilities.restaurant) facilitiesArray.push("Restaurant");
      if (facilities.hotel) facilitiesArray.push("Hotel");
      if (facilities.clubRental) facilitiesArray.push("Club Rental");
      if (facilities.buggyRental) facilitiesArray.push("Buggy Rental");
      if (facilities.golfAcademy) facilitiesArray.push("Golf Academy");
      if (facilities.spa) facilitiesArray.push("Spa");
      if (facilities.pool) facilitiesArray.push("Swimming Pool");
      if (facilities.otherAmenities) {
        facilitiesArray.push(...facilities.otherAmenities);
      }

      await storage.updateCourse(courseId, {
        notes: updatedNotes,
        facilities: facilitiesArray.length > 0 ? facilitiesArray : course.facilities,
        facilitiesJson: JSON.stringify(facilities),
        bookingRulesJson: JSON.stringify(bookingRules),
        enrichmentStatus: "complete",
        lastEnrichedAt: new Date(),
      });

      console.log(`[CourseEnrichment] Successfully enriched course: ${course.name}`);
      return { success: true };

    } catch (error: any) {
      console.error(`[CourseEnrichment] Error enriching course ${courseId}:`, error);
      await storage.updateCourse(courseId, { 
        enrichmentStatus: "failed" 
      });
      return { success: false, error: error.message };
    }
  }

  async enrichBookingRules(courseId: string, extractedRules: BookingRules): Promise<void> {
    try {
      await storage.updateCourse(courseId, {
        bookingRulesJson: JSON.stringify(extractedRules),
      });
      console.log(`[CourseEnrichment] Updated booking rules for course: ${courseId}`);
    } catch (error) {
      console.error(`[CourseEnrichment] Error updating booking rules:`, error);
    }
  }
}

export const courseEnrichmentService = new CourseEnrichmentService();
