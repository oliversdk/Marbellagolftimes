import OpenAI from "openai";
import { db } from "../db";
import { 
  contractIngestions, 
  courseRatePeriods, 
  courseContacts, 
  courseDocuments,
  golfCourses,
  type ParsedContractData 
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import { ObjectStorageService } from "../objectStorage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are an expert at analyzing golf course collaboration contracts and extracting pricing information. 
Your task is to extract structured data from contract text, specifically:

1. **Contract Period**: Valid from/until dates
2. **Contact Information**: Names, roles, emails, phone numbers of contact people
3. **Rate Periods/Seasons**: Each pricing season with:
   - Season name/label (e.g., "Low Season", "Season 1", "Temporada Baja")
   - Date ranges (months or specific dates)
   - Rack Rate (public price / PVP / Tarifa Oficial)
   - Net Rate (our price / Neto TO / Precio Neto)
   - Calculate kickback percentage: ((Rack - Net) / Rack) * 100

4. **Special Terms**: Group discounts, early bird offers, buggy included, etc.

IMPORTANT:
- Contracts may be in Spanish or English
- "PVP" or "Rack" = public price
- "Neto TO" or "Net" = our negotiated price  
- "Tarifa" = rate/price
- "Temporada" = season
- Always calculate kickback as percentage difference between rack and net
- If prices are per person, note that in the response

Return your analysis as valid JSON matching this structure:
{
  "validFrom": "2026-01-01",
  "validUntil": "2026-12-31", 
  "courseName": "Name of golf course",
  "partnerName": "Marbella Golf Times or similar",
  "contacts": [
    {"name": "Juan Luis Mowinckel", "role": "Commercial Director", "email": "email@golf.com", "phone": "+34..."}
  ],
  "ratePeriods": [
    {
      "seasonLabel": "Low Season",
      "startDate": "January, July-August, December",
      "endDate": "January, July-August, December",
      "rackRate": 80,
      "netRate": 64,
      "kickbackPercent": 20,
      "currency": "EUR",
      "notes": "Green fee 18 holes"
    }
  ],
  "specialTerms": [
    {"type": "GROUP_DISCOUNT", "description": "1 free player per 8 paying players", "value": 8}
  ],
  "currency": "EUR",
  "rawTerms": ["Any other important terms found in the contract"]
}`;

export class ContractParserService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

  async extractTextFromPdf(fileUrl: string): Promise<string> {
    try {
      const buffer = await this.objectStorage.getPrivateFile(fileUrl);
      const { extractText, getDocumentProxy } = await import("unpdf");
      const uint8array = new Uint8Array(buffer);
      const pdf = await getDocumentProxy(uint8array);
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    } catch (error) {
      console.error("Error extracting PDF text:", error);
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }

  async parseContractWithAI(text: string): Promise<ParsedContractData> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Please analyze this golf course contract and extract the pricing and contact information:\n\n${text}` }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const parsed = JSON.parse(content) as ParsedContractData;
      return parsed;
    } catch (error) {
      console.error("Error parsing contract with AI:", error);
      throw new Error(`AI parsing failed: ${error}`);
    }
  }

  async processDocument(documentId: string): Promise<{
    ingestionId: string;
    parsedData: ParsedContractData;
    ratePeriods: number;
    contacts: number;
  }> {
    const [document] = await db.select().from(courseDocuments).where(eq(courseDocuments.id, documentId));
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Delete existing rate periods and contacts from previous ingestions of this document
    const existingIngestions = await db.select({ id: contractIngestions.id })
      .from(contractIngestions)
      .where(eq(contractIngestions.documentId, documentId));
    
    for (const existing of existingIngestions) {
      await db.delete(courseRatePeriods).where(eq(courseRatePeriods.ingestionId, existing.id));
      await db.delete(courseContacts).where(eq(courseContacts.ingestionId, existing.id));
      await db.delete(contractIngestions).where(eq(contractIngestions.id, existing.id));
    }

    const [ingestion] = await db.insert(contractIngestions).values({
      documentId: document.id,
      courseId: document.courseId,
      status: "PROCESSING",
    }).returning();

    try {
      console.log(`Processing document: ${document.name}`);
      
      const rawText = await this.extractTextFromPdf(document.fileUrl);
      console.log(`Extracted ${rawText.length} characters from PDF`);

      await db.update(contractIngestions)
        .set({ rawText })
        .where(eq(contractIngestions.id, ingestion.id));

      const parsedData = await this.parseContractWithAI(rawText);
      console.log("AI parsed data:", JSON.stringify(parsedData, null, 2));

      let ratePeriodsCreated = 0;
      let contactsCreated = 0;

      if (parsedData.ratePeriods && parsedData.ratePeriods.length > 0) {
        for (const period of parsedData.ratePeriods) {
          // Validate rate period data before storing
          const rackRate = Number(period.rackRate) || 0;
          const netRate = Number(period.netRate) || 0;
          
          if (rackRate <= 0 || netRate <= 0 || !period.seasonLabel) {
            console.warn(`Skipping invalid rate period: ${JSON.stringify(period)}`);
            continue;
          }
          
          // Calculate kickback with validation (clamp to 0-100%)
          let kickbackPercent = period.kickbackPercent;
          if (!kickbackPercent || isNaN(kickbackPercent)) {
            kickbackPercent = rackRate > 0 ? ((rackRate - netRate) / rackRate) * 100 : 0;
          }
          kickbackPercent = Math.max(0, Math.min(100, kickbackPercent));
          
          await db.insert(courseRatePeriods).values({
            courseId: document.courseId,
            ingestionId: ingestion.id,
            seasonLabel: period.seasonLabel,
            startDate: period.startDate || "",
            endDate: period.endDate || "",
            rackRate: rackRate,
            netRate: netRate,
            kickbackPercent: kickbackPercent,
            currency: period.currency || "EUR",
            notes: period.notes || null,
            year: parsedData.validFrom ? parseInt(parsedData.validFrom.split("-")[0]) : null,
          });
          ratePeriodsCreated++;
        }

        const avgKickback = parsedData.ratePeriods.reduce((sum, p) => sum + p.kickbackPercent, 0) / parsedData.ratePeriods.length;
        await db.update(golfCourses)
          .set({ kickbackPercent: Math.round(avgKickback * 10) / 10 })
          .where(eq(golfCourses.id, document.courseId));
        console.log(`Updated course kickback to ${avgKickback.toFixed(1)}%`);
      }

      if (parsedData.contacts && parsedData.contacts.length > 0) {
        for (let i = 0; i < parsedData.contacts.length; i++) {
          const contact = parsedData.contacts[i];
          await db.insert(courseContacts).values({
            courseId: document.courseId,
            ingestionId: ingestion.id,
            name: contact.name,
            role: contact.role || null,
            email: contact.email || null,
            phone: contact.phone || null,
            isPrimary: i === 0 ? "true" : "false",
          });
          contactsCreated++;
        }
      }

      if (parsedData.validFrom || parsedData.validUntil) {
        await db.update(courseDocuments)
          .set({
            validFrom: parsedData.validFrom ? new Date(parsedData.validFrom) : null,
            validUntil: parsedData.validUntil ? new Date(parsedData.validUntil) : null,
          })
          .where(eq(courseDocuments.id, documentId));
      }

      await db.update(contractIngestions)
        .set({
          status: "COMPLETED",
          parsedData: parsedData,
          confidenceScore: 0.85,
          processedAt: new Date(),
        })
        .where(eq(contractIngestions.id, ingestion.id));

      return {
        ingestionId: ingestion.id,
        parsedData,
        ratePeriods: ratePeriodsCreated,
        contacts: contactsCreated,
      };
    } catch (error) {
      console.error("Contract processing failed:", error);
      
      await db.update(contractIngestions)
        .set({
          status: "FAILED",
          errorMessage: String(error),
          processedAt: new Date(),
        })
        .where(eq(contractIngestions.id, ingestion.id));

      throw error;
    }
  }

  async getIngestionStatus(ingestionId: string) {
    const [ingestion] = await db.select().from(contractIngestions).where(eq(contractIngestions.id, ingestionId));
    return ingestion;
  }

  async getCourseRatePeriods(courseId: string) {
    return db.select().from(courseRatePeriods).where(eq(courseRatePeriods.courseId, courseId));
  }

  async getCourseContacts(courseId: string) {
    return db.select().from(courseContacts).where(eq(courseContacts.courseId, courseId));
  }
}

export const contractParser = new ContractParserService();
