import OpenAI from "openai";
import puppeteer from "puppeteer";
import { db } from "../db";
import { companyProfile } from "../../shared/schema";
import { ObjectStorageService } from "../objectStorage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const FORM_ANALYSIS_PROMPT = `You are an expert at analyzing form templates and mapping them to company data.
Given a form template text and company profile data, generate HTML that replicates the form with all fields filled in.

The company profile has these fields:
- commercialName: Legal company name
- tradingName: Trading/brand name (Razón social)
- cifVat: CIF or VAT number
- website: Company website
- businessStreet: Business address street
- businessPostalCode: Postal code
- businessCity: City
- businessCountry: Country
- invoiceStreet, invoicePostalCode, invoiceCity, invoiceCountry: Invoice address (or use business address if same)
- invoiceSameAsBusiness: If "true", use business address for invoicing
- reservationsName, reservationsEmail, reservationsPhone: Reservations contact
- contractsName, contractsEmail, contractsPhone: Contracts contact
- invoicingName, invoicingEmail, invoicingPhone: Invoicing contact

IMPORTANT INSTRUCTIONS:
1. Analyze the form structure (sections, labels, field positions)
2. Map each form field to the appropriate company profile field
3. Generate clean HTML that looks like the original form with fields filled in
4. Use a professional, printable layout suitable for PDF
5. Include both Spanish and English labels as shown in the original form
6. Leave signature areas EMPTY for the user to sign manually
7. Keep the golf course logo/footer if mentioned in the form

Return a JSON object with:
{
  "html": "Complete HTML document with inline CSS styling",
  "fieldsMatched": ["list of fields that were filled"],
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

export class FormFillerService {
  private objectStorage: ObjectStorageService;

  constructor() {
    this.objectStorage = new ObjectStorageService();
  }

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

  async generateFilledFormHtml(formText: string, profile: CompanyProfileData): Promise<{
    html: string;
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
          content: `Form template text:\n\n${formText}\n\n---\n\nCompany profile data:\n${profileJson}\n\nPlease generate the filled HTML form.`
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
      html: parsed.html,
      fieldsMatched: parsed.fieldsMatched || [],
      fieldsUnmatched: parsed.fieldsUnmatched || []
    };
  }

  async convertHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
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

    // Extract form text
    console.log("Extracting text from PDF form...");
    const formText = await this.extractTextFromPdf(pdfBuffer);
    console.log(`Extracted ${formText.length} characters from form`);

    // Generate filled HTML
    console.log("Generating filled form with AI...");
    const { html, fieldsMatched, fieldsUnmatched } = await this.generateFilledFormHtml(formText, profile);
    console.log(`Matched fields: ${fieldsMatched.join(", ")}`);
    if (fieldsUnmatched.length > 0) {
      console.log(`Unmatched fields: ${fieldsUnmatched.join(", ")}`);
    }

    // Convert to PDF
    console.log("Converting to PDF...");
    const filledPdfBuffer = await this.convertHtmlToPdf(html);
    console.log(`Generated PDF: ${filledPdfBuffer.length} bytes`);

    return {
      pdfBuffer: filledPdfBuffer,
      fieldsMatched,
      fieldsUnmatched
    };
  }
}

export const formFiller = new FormFillerService();
