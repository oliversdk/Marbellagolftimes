import OpenAI from "openai";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../db";
import { companyProfile } from "../../shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// For standard "Datos empresa / Company details" forms, use fixed coordinates
// These are calibrated for the Golf Torrequebrada form layout (A4 size: 595 x 842 points)
const STANDARD_COMPANY_DETAILS_PLACEMENTS = {
  // Y coordinates from TOP of page (will be converted to bottom-origin)
  pageHeight: 842,
  fields: [
    { field: "commercialName", x: 245, yFromTop: 95, label: "Nombre comercial" },
    { field: "tradingName", x: 245, yFromTop: 115, label: "Razón social" },
    { field: "cifVat", x: 245, yFromTop: 135, label: "CIF" },
    { field: "website", x: 245, yFromTop: 220, label: "Web" },
    // Business address
    { field: "businessStreet", x: 245, yFromTop: 180, label: "Calle (business)" },
    { field: "businessPostalCity", x: 245, yFromTop: 200, label: "Codigo postal y Ciudad" },
    { field: "businessCountry", x: 245, yFromTop: 218, label: "Pais (business)" },
    // Invoice address  
    { field: "invoiceStreet", x: 245, yFromTop: 262, label: "Calle (invoice)" },
    { field: "invoicePostalCity", x: 245, yFromTop: 282, label: "Codigo postal y Ciudad (invoice)" },
    { field: "invoiceCountry", x: 245, yFromTop: 300, label: "Pais (invoice)" },
    // Reservations contact
    { field: "reservationsName", x: 245, yFromTop: 358, label: "Nombre (reservas)" },
    { field: "reservationsEmail", x: 245, yFromTop: 378, label: "E-mail (reservas)" },
    { field: "reservationsPhone", x: 245, yFromTop: 398, label: "Telefono (reservas)" },
    // Contracts contact
    { field: "contractsName", x: 245, yFromTop: 450, label: "Nombre (contratos)" },
    { field: "contractsEmail", x: 245, yFromTop: 470, label: "E-mail (contratos)" },
    { field: "contractsPhone", x: 245, yFromTop: 490, label: "Telefono (contratos)" },
    // Invoicing contact
    { field: "invoicingName", x: 245, yFromTop: 545, label: "Nombre (facturacion)" },
    { field: "invoicingEmail", x: 245, yFromTop: 565, label: "E-mail (facturacion)" },
    { field: "invoicingPhone", x: 245, yFromTop: 585, label: "Telefono (facturacion)" },
  ]
};

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

  isStandardCompanyDetailsForm(formText: string): boolean {
    // Check if this is the standard "Datos empresa / Company details" form
    const indicators = [
      "Datos de la empresa",
      "Business details",
      "Nombre comercial",
      "Commercial name",
      "Razón social",
      "Trading name",
      "CIF or VAT",
      "Direcciones",
      "Addresses",
      "Personas de contacto",
      "Contact persons"
    ];
    
    const matchCount = indicators.filter(i => formText.toLowerCase().includes(i.toLowerCase())).length;
    return matchCount >= 6; // At least 6 indicators match
  }

  getFieldValue(profile: CompanyProfileData, fieldName: string): string {
    const useBusinessForInvoice = profile.invoiceSameAsBusiness === "true";
    
    switch (fieldName) {
      case "commercialName":
        return profile.commercialName || "";
      case "tradingName":
        return profile.tradingName || "";
      case "cifVat":
        return profile.cifVat || "";
      case "website":
        return profile.website || "";
      case "businessStreet":
        return profile.businessStreet || "";
      case "businessPostalCity":
        return `${profile.businessPostalCode || ""} ${profile.businessCity || ""}`.trim();
      case "businessCountry":
        return profile.businessCountry || "";
      case "invoiceStreet":
        return useBusinessForInvoice ? (profile.businessStreet || "") : (profile.invoiceStreet || "");
      case "invoicePostalCity":
        if (useBusinessForInvoice) {
          return `${profile.businessPostalCode || ""} ${profile.businessCity || ""}`.trim();
        }
        return `${profile.invoicePostalCode || ""} ${profile.invoiceCity || ""}`.trim();
      case "invoiceCountry":
        return useBusinessForInvoice ? (profile.businessCountry || "") : (profile.invoiceCountry || "");
      case "reservationsName":
        return profile.reservationsName || "";
      case "reservationsEmail":
        return profile.reservationsEmail || "";
      case "reservationsPhone":
        return profile.reservationsPhone || "";
      case "contractsName":
        return profile.contractsName || "";
      case "contractsEmail":
        return profile.contractsEmail || "";
      case "contractsPhone":
        return profile.contractsPhone || "";
      case "invoicingName":
        return profile.invoicingName || "";
      case "invoicingEmail":
        return profile.invoicingEmail || "";
      case "invoicingPhone":
        return profile.invoicingPhone || "";
      default:
        return "";
    }
  }

  getStandardFormPlacements(profile: CompanyProfileData, pageHeight: number): TextPlacement[] {
    const placements: TextPlacement[] = [];
    const config = STANDARD_COMPANY_DETAILS_PLACEMENTS;
    
    for (const field of config.fields) {
      const value = this.getFieldValue(profile, field.field);
      if (value) {
        // Convert from top-origin to bottom-origin coordinate system
        const y = pageHeight - field.yFromTop;
        placements.push({
          text: value,
          x: field.x,
          y: y,
          fontSize: 9,
          fieldName: field.label
        });
      }
    }
    
    return placements;
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

    let textPlacements: TextPlacement[];
    let fieldsMatched: string[] = [];
    let fieldsUnmatched: string[] = [];

    // Check if this is a standard company details form
    if (this.isStandardCompanyDetailsForm(formText)) {
      console.log("Detected standard 'Datos empresa / Company details' form - using calibrated placements");
      textPlacements = this.getStandardFormPlacements(profile, height);
      fieldsMatched = textPlacements.map(p => p.fieldName);
    } else {
      console.log("Unknown form type - would need AI analysis (not implemented for this form)");
      textPlacements = [];
      fieldsUnmatched = ["Form type not recognized"];
    }

    console.log(`Placing ${textPlacements.length} text values`);

    // Embed a font for writing text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Place each text on the PDF
    for (const placement of textPlacements) {
      if (placement.text && placement.text.trim()) {
        firstPage.drawText(placement.text, {
          x: placement.x,
          y: placement.y,
          size: placement.fontSize || 9,
          font: font,
          color: rgb(0, 0, 0),
        });
        console.log(`Placed "${placement.text}" at (${placement.x}, ${placement.y}) for ${placement.fieldName}`);
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
