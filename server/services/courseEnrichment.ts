import OpenAI from "openai";
import puppeteer from "puppeteer";
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

interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export class CourseEnrichmentService {
  
  private async searchWeb(query: string): Promise<WebSearchResult[]> {
    console.log(`[WebSearch] Searching for: ${query}`);
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      await page.waitForSelector('div#search', { timeout: 10000 }).catch(() => null);
      
      const results = await page.evaluate(() => {
        const items: { title: string; snippet: string; url: string }[] = [];
        const searchResults = document.querySelectorAll('div.g');
        
        searchResults.forEach((result, index) => {
          if (index >= 5) return;
          
          const titleEl = result.querySelector('h3');
          const snippetEl = result.querySelector('div[data-sncf], div.VwiC3b, span.aCOpRe');
          const linkEl = result.querySelector('a');
          
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent || '',
              snippet: snippetEl?.textContent || '',
              url: linkEl.href || ''
            });
          }
        });
        
        return items;
      });
      
      console.log(`[WebSearch] Found ${results.length} results`);
      return results;
      
    } catch (error) {
      console.error('[WebSearch] Search error:', error);
      return [];
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async scrapeWebPage(url: string): Promise<string> {
    console.log(`[WebScrape] Scraping: ${url}`);
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      const content = await page.evaluate(() => {
        const selectors = ['main', 'article', '.content', '#content', '.main-content', 'body'];
        let text = '';
        
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            text = el.textContent || '';
            break;
          }
        }
        
        return text
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim()
          .substring(0, 8000);
      });
      
      console.log(`[WebScrape] Extracted ${content.length} characters`);
      return content;
      
    } catch (error) {
      console.error('[WebScrape] Scrape error:', error);
      return '';
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async enrichCourse(courseId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const course = await storage.getCourseById(courseId);
      if (!course) {
        return { success: false, error: "Course not found" };
      }

      await storage.updateCourse(courseId, { enrichmentStatus: "processing" });
      console.log(`[CourseEnrichment] Starting enrichment for: ${course.name}`);

      const searchQueries = [
        `"${course.name}" golf course ${course.city} Spain facilities`,
        `"${course.name}" golf ${course.city} restaurant pro shop amenities`,
      ];

      let webContext = '';
      
      for (const query of searchQueries) {
        const searchResults = await this.searchWeb(query);
        
        for (const result of searchResults.slice(0, 2)) {
          webContext += `\n--- From: ${result.title} ---\n`;
          webContext += `${result.snippet}\n`;
          
          if (result.url && !result.url.includes('google.com') && !result.url.includes('facebook.com')) {
            const pageContent = await this.scrapeWebPage(result.url);
            if (pageContent) {
              webContext += pageContent.substring(0, 3000) + '\n';
            }
          }
        }
      }

      console.log(`[CourseEnrichment] Collected ${webContext.length} characters of web context`);

      const prompt = `You are a golf course research assistant. Analyze the following web search results about "${course.name}" golf course in ${course.city}, ${course.province}, Spain.

WEB SEARCH RESULTS:
${webContext || 'No web results found. Please provide typical information for a Costa del Sol golf course.'}

Based on this information, provide comprehensive details about the course. Extract real information from the web results when available.

Respond in JSON format with three sections:

1. "overview" - Course description including:
   - description: A compelling 2-3 paragraph description of the course based on the web info
   - designer: Course architect name if found
   - yearOpened: Year the course opened if found
   - holes: Number of holes (default 18)
   - par: Course par (default 72)
   - length: Course length if found
   - courseType: Type (links, parkland, mountain, etc.)
   - uniqueFeatures: Array of notable features mentioned
   - tournaments: Array of any notable tournaments mentioned

2. "facilities" - Available amenities found:
   - drivingRange: { name, description, hours? }
   - puttingGreen: { name, description }
   - chippingArea: { name, description }
   - proShop: { name, description, hours? }
   - restaurant: { name, description, hours? }
   - hotel: { name, description } if on-site accommodation mentioned
   - clubRental: { name, description }
   - buggyRental: { name, description }
   - golfAcademy: { name, description } if mentioned
   - spa: { name, description } if mentioned
   - otherAmenities: Array of other amenities found

3. "bookingRules" - Standard policies (use web info or typical golf course policies):
   - arrivalTime: When players should arrive
   - dressCode: Clothing requirements
   - buggyPolicy: Buggy/cart rules
   - handicapRequirements: Handicap rules
   - cancellationPolicy: Cancellation terms
   - weatherPolicy: Weather-related policies
   - groupBookings: Group booking terms

Respond ONLY with valid JSON, no markdown or extra text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a knowledgeable golf course expert. Extract and synthesize information from web search results to provide accurate course details." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 3000,
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
      
      const hasValidOverview = parsed.overview && typeof parsed.overview === 'object';
      const hasValidFacilities = parsed.facilities && typeof parsed.facilities === 'object';
      const hasValidBookingRules = parsed.bookingRules && typeof parsed.bookingRules === 'object';
      
      const overview: CourseOverview = hasValidOverview ? parsed.overview : {};
      const facilities: EnrichedFacilities = hasValidFacilities ? parsed.facilities : {};
      const bookingRules: BookingRules = hasValidBookingRules ? parsed.bookingRules : {};

      const updatedNotes = hasValidOverview && overview.description ? overview.description : course.notes;
      
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
      if (facilities.otherAmenities && Array.isArray(facilities.otherAmenities)) {
        facilitiesArray.push(...facilities.otherAmenities);
      }

      const updateData: Record<string, any> = {
        enrichmentStatus: "complete",
        lastEnrichedAt: new Date(),
      };
      
      if (hasValidOverview && overview.description) {
        updateData.notes = updatedNotes;
      }
      if (facilitiesArray.length > 0) {
        updateData.facilities = facilitiesArray;
      }
      if (hasValidFacilities) {
        updateData.facilitiesJson = JSON.stringify(facilities);
      }
      if (hasValidBookingRules) {
        updateData.bookingRulesJson = JSON.stringify(bookingRules);
      }

      await storage.updateCourse(courseId, updateData);

      console.log(`[CourseEnrichment] Successfully enriched course: ${course.name} with web data`);
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
