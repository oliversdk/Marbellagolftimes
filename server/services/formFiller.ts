import OpenAI from "openai";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../db";
import { companyProfile } from "../../shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const FORM_ANALYSIS_PROMPT = `You are an expert at analyzing PDF forms and determining where to place text values.

Given:
1. The text content extracted from a PDF form
2. The page dimensions (width x height in points)
3. Company profile data to fill in

Your task is to determine the exact X,Y coordinates where each piece of company data should be placed on the PDF.

The coordinate system is:
- Origin (0,0) is at the BOTTOM-LEFT corner of the page
- X increases to the right
- Y increases upward
- Standard A4 page is approximately 595 x 842 points

The company profile has these fields:
- commercialName: Legal company name (Nombre comercial)
- tradingName: Trading/brand name (Razón social)
- cifVat: CIF or VAT number
- website: Company website
- businessStreet: Business address street
- businessPostalCode: Postal code
- businessCity: City  
- businessCountry: Country
- invoiceStreet, invoicePostalCode, invoiceCity, invoiceCountry: Invoice address
- invoiceSameAsBusiness: If "true", use business address for invoicing
- reservationsName, reservationsEmail, reservationsPhone: Reservations contact
- contractsName, contractsEmail, contractsPhone: Contracts contact
- invoicingName, invoicingEmail, invoicingPhone: Invoicing contact

IMPORTANT: 
- Analyze the form layout and find the RIGHT side of each label where the value should go
- For forms with label...value layout, place text to the RIGHT of the label
- Look for patterns like "Nombre comercial" followed by blank space - that's where the value goes
- Standard forms usually have labels on the left (around x=50-150) and values on the right (around x=200-400)
- Each section (Business details, Addresses, Contact persons) is typically vertically separated

Return a JSON object with:
{
  "textPlacements": [
    {
      "text": "the text value to place",
      "x": 250,
      "y": 750,
      "fontSize": 10,
      "fieldName": "which field this fills"
    }
  ],
  "fieldsMatched": ["list of profile fields that were used"],
  "fieldsUnmatched": ["list of form fields that couldn't be matched"]
}`;

interface CompanyProfileData {
  commercialName: string;
  tradingName?: string | null;
  cifVat: string;
  website?: string | null;
  businessStreet?: string | null;
  businessPostalCode?: string | null;
  businessCity?: string | null;
  businessCountry?: string | null;
  invoiceStreet?: string | null;
  invoicePostalCode?: string | null;
  invoiceCity?: string | null;
  invoiceCountry?: string | null;
  invoiceSameAsBusiness?: string | null;
  reservationsName?: string | null;
  reservationsEmail?: string | null;
  reservationsPhone?: string | null;
  contractsName?: string | null;
  contractsEmail?: string | null;
  contractsPhone?: string | null;
  invoicingName?: string | null;
  invoicingEmail?: string | null;
  invoicingPhone?: string | null;
}

interface TextPlacement {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fieldName: string;
}

export class FormFillerService {
  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
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

  async getCompanyProfile(): Promise<CompanyProfileData | null> {
    const [profile] = await db.select().from(companyProfile).limit(1);
    return profile || null;
  }

  async analyzeFormAndGetPlacements(
    formText: string, 
    profile: CompanyProfileData,
    pageWidth: number,
    pageHeight: number
  ): Promise<{
    textPlacements: TextPlacement[];
    fieldsMatched: string[];
    fieldsUnmatched: string[];
  }> {
    const profileJson = JSON.stringify(profile, null, 2);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: FORM_ANALYSIS_PROMPT },
        { 
          role: "user", 
          content: `Form text content:\n\n${formText}\n\n---\n\nPage dimensions: ${pageWidth} x ${pageHeight} points (A4)\n\n---\n\nCompany profile data:\n${profileJson}\n\nAnalyze this form and provide the exact coordinates for placing each value.`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      textPlacements: parsed.textPlacements || [],
      fieldsMatched: parsed.fieldsMatched || [],
      fieldsUnmatched: parsed.fieldsUnmatched || []
    };
  }

  async fillFormWithOverlay(pdfBuffer: Buffer, profile: CompanyProfileData): Promise<{
    pdfBuffer: Buffer;
    fieldsMatched: string[];
    fieldsUnmatched: string[];
  }> {
    // Load the original PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    console.log(`PDF page size: ${width} x ${height} points`);

    // Extract text to understand form structure
    const formText = await this.extractTextFromPdf(pdfBuffer);
    console.log(`Extracted ${formText.length} characters from form`);

    // Get AI to analyze and determine text placements
    console.log("Analyzing form structure with AI...");
    const { textPlacements, fieldsMatched, fieldsUnmatched } = await this.analyzeFormAndGetPlacements(
      formText,
      profile,
      width,
      height
    );

    console.log(`AI suggested ${textPlacements.length} text placements`);

    // Embed a font for writing text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Place each text on the PDF
    for (const placement of textPlacements) {
      if (placement.text && placement.text.trim()) {
        firstPage.drawText(placement.text, {
          x: placement.x,
          y: placement.y,
          size: placement.fontSize || 10,
          font: font,
          color: rgb(0, 0, 0),
        });
        console.log(`Placed "${placement.text}" at (${placement.x}, ${placement.y})`);
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    return {
      pdfBuffer: Buffer.from(modifiedPdfBytes),
      fieldsMatched,
      fieldsUnmatched
    };
  }

  async fillForm(pdfBuffer: Buffer): Promise<{
    pdfBuffer: Buffer;
    fieldsMatched: string[];
    fieldsUnmatched: string[];
  }> {
    // Get company profile
    const profile = await this.getCompanyProfile();
    if (!profile) {
      throw new Error("Company profile not found. Please set up your company details in Admin Settings first.");
    }

    console.log("Filling form by overlaying text on original PDF...");
    return this.fillFormWithOverlay(pdfBuffer, profile);
  }
}

export const formFiller = new FormFillerService();
