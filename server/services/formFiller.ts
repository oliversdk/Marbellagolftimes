import OpenAI from "openai";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../db";
import { companyProfile } from "../../shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// For standard "Datos empresa / Company details" forms, use fixed coordinates
// Calibrated for Golf Torrequebrada form layout (A4: 595 x 842 points)
// Y coordinates are from TOP of page, will be converted to bottom-origin
const STANDARD_COMPANY_DETAILS_PLACEMENTS = {
  pageHeight: 842,
  fields: [
    // Section 1: Business details (after "Datos de la empresa" header ~line 1-2)
    { field: "commercialName", x: 170, yFromTop: 128, label: "Nombre comercial" },
    { field: "tradingName", x: 170, yFromTop: 160, label: "Razón social" },
    { field: "cifVat", x: 170, yFromTop: 192, label: "CIF" },
    
    // Section 2: Addresses (after "Direcciones - Addresses" header)
    // Business address
    { field: "businessStreet", x: 170, yFromTop: 280, label: "Calle (domicilio)" },
    { field: "businessPostalCity", x: 170, yFromTop: 312, label: "Codigo postal y Ciudad" },
    { field: "businessCountry", x: 170, yFromTop: 344, label: "Pais" },
    { field: "website", x: 170, yFromTop: 376, label: "Web" },
    
    // Invoice address
    { field: "invoiceStreet", x: 170, yFromTop: 424, label: "Calle (facturacion)" },
    { field: "invoicePostalCity", x: 170, yFromTop: 456, label: "Codigo postal (facturacion)" },
    { field: "invoiceCountry", x: 170, yFromTop: 488, label: "Pais (facturacion)" },
    
    // Section 3: Contact persons (after "Personas de contacto" header)
    // Reservations
    { field: "reservationsName", x: 170, yFromTop: 560, label: "Nombre (reservas)" },
    { field: "reservationsEmail", x: 170, yFromTop: 592, label: "E-mail (reservas)" },
    { field: "reservationsPhone", x: 170, yFromTop: 624, label: "Telefono (reservas)" },
    
    // Contracts
    { field: "contractsName", x: 170, yFromTop: 680, label: "Nombre (contratos)" },
    { field: "contractsEmail", x: 170, yFromTop: 712, label: "E-mail (contratos)" },
    { field: "contractsPhone", x: 170, yFromTop: 744, label: "Telefono (contratos)" },
    
    // Invoicing - these may be on page 2 or very bottom
    { field: "invoicingName", x: 170, yFromTop: 800, label: "Nombre (facturacion)" },
    { field: "invoicingEmail", x: 170, yFromTop: 832, label: "E-mail (facturacion)" },
    { field: "invoicingPhone", x: 170, yFromTop: 864, label: "Telefono (facturacion)" },
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
    return matchCount >= 6;
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
        // Only place if y is positive (on the page)
        if (y > 0) {
          placements.push({
            text: value,
            x: field.x,
            y: y,
            fontSize: 9,
            fieldName: field.label
          });
        }
      }
    }
    
    return placements;
  }

  async fillFormWithOverlay(pdfBuffer: Buffer, profile: CompanyProfileData): Promise<{
    pdfBuffer: Buffer;
    fieldsMatched: string[];
    fieldsUnmatched: string[];
  }> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    console.log(`PDF page size: ${width} x ${height} points`);

    const formText = await this.extractTextFromPdf(pdfBuffer);
    console.log(`Extracted ${formText.length} characters from form`);

    let textPlacements: TextPlacement[];
    let fieldsMatched: string[] = [];
    let fieldsUnmatched: string[] = [];

    if (this.isStandardCompanyDetailsForm(formText)) {
      console.log("Detected standard 'Datos empresa / Company details' form");
      textPlacements = this.getStandardFormPlacements(profile, height);
      fieldsMatched = textPlacements.map(p => p.fieldName);
    } else {
      console.log("Unknown form type");
      textPlacements = [];
      fieldsUnmatched = ["Form type not recognized"];
    }

    console.log(`Placing ${textPlacements.length} text values on page (height: ${height})`);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
    const profile = await this.getCompanyProfile();
    if (!profile) {
      throw new Error("Company profile not found. Please set up your company details in Admin Settings first.");
    }

    console.log("Filling form by overlaying text on original PDF...");
    return this.fillFormWithOverlay(pdfBuffer, profile);
  }
}

export const formFiller = new FormFillerService();
