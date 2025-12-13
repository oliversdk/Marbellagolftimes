import OpenAI from "openai";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "../db";
import { companyProfile } from "../../shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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

// Field name mappings - maps common form field names to profile fields
const FIELD_MAPPINGS: Record<string, (p: CompanyProfileData) => string> = {
  // Spanish field names
  "nombre_comercial": (p) => p.commercialName || "",
  "nombrecomercial": (p) => p.commercialName || "",
  "razon_social": (p) => p.tradingName || "",
  "razonsocial": (p) => p.tradingName || "",
  "cif": (p) => p.cifVat || "",
  "nif": (p) => p.cifVat || "",
  "vat": (p) => p.cifVat || "",
  "web": (p) => p.website || "",
  "website": (p) => p.website || "",
  "pagina_web": (p) => p.website || "",
  
  // Address fields
  "calle": (p) => p.businessStreet || "",
  "street": (p) => p.businessStreet || "",
  "direccion": (p) => p.businessStreet || "",
  "domicilio": (p) => p.businessStreet || "",
  "codigo_postal": (p) => p.businessPostalCode || "",
  "cp": (p) => p.businessPostalCode || "",
  "postal": (p) => p.businessPostalCode || "",
  "ciudad": (p) => p.businessCity || "",
  "city": (p) => p.businessCity || "",
  "pais": (p) => p.businessCountry || "",
  "country": (p) => p.businessCountry || "",
  
  // Invoice address
  "calle_facturacion": (p) => p.invoiceSameAsBusiness === "true" ? (p.businessStreet || "") : (p.invoiceStreet || ""),
  "cp_facturacion": (p) => p.invoiceSameAsBusiness === "true" ? (p.businessPostalCode || "") : (p.invoicePostalCode || ""),
  "ciudad_facturacion": (p) => p.invoiceSameAsBusiness === "true" ? (p.businessCity || "") : (p.invoiceCity || ""),
  "pais_facturacion": (p) => p.invoiceSameAsBusiness === "true" ? (p.businessCountry || "") : (p.invoiceCountry || ""),
  
  // Contact fields - Reservations
  "nombre_reservas": (p) => p.reservationsName || "",
  "email_reservas": (p) => p.reservationsEmail || "",
  "telefono_reservas": (p) => p.reservationsPhone || "",
  
  // Contact fields - Contracts
  "nombre_contratos": (p) => p.contractsName || "",
  "email_contratos": (p) => p.contractsEmail || "",
  "telefono_contratos": (p) => p.contractsPhone || "",
  
  // Contact fields - Invoicing
  "nombre_facturacion": (p) => p.invoicingName || "",
  "email_facturacion": (p) => p.invoicingEmail || "",
  "telefono_facturacion": (p) => p.invoicingPhone || "",
  
  // English field names
  "commercial_name": (p) => p.commercialName || "",
  "trading_name": (p) => p.tradingName || "",
  "business_name": (p) => p.commercialName || "",
  "company_name": (p) => p.commercialName || "",
};

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

  findFieldValue(fieldName: string, profile: CompanyProfileData): string | null {
    const normalizedName = fieldName.toLowerCase().replace(/[\s\-_.]/g, "_").replace(/__+/g, "_");
    
    // Direct mapping
    if (FIELD_MAPPINGS[normalizedName]) {
      return FIELD_MAPPINGS[normalizedName](profile);
    }
    
    // Fuzzy matching
    for (const [key, getter] of Object.entries(FIELD_MAPPINGS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return getter(profile);
      }
    }
    
    return null;
  }

  async fillFormFields(pdfBuffer: Buffer, profile: CompanyProfileData): Promise<{
    pdfBuffer: Buffer;
    fieldsMatched: string[];
    fieldsUnmatched: string[];
    hasFormFields: boolean;
  }> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log(`Found ${fields.length} form fields in PDF`);
    
    if (fields.length === 0) {
      return {
        pdfBuffer: pdfBuffer,
        fieldsMatched: [],
        fieldsUnmatched: [],
        hasFormFields: false
      };
    }

    const fieldsMatched: string[] = [];
    const fieldsUnmatched: string[] = [];

    for (const field of fields) {
      const fieldName = field.getName();
      const fieldType = field.constructor.name;
      
      console.log(`Field: "${fieldName}" (${fieldType})`);
      
      const value = this.findFieldValue(fieldName, profile);
      
      if (value !== null && fieldType === 'PDFTextField') {
        try {
          const textField = form.getTextField(fieldName);
          textField.setText(value);
          fieldsMatched.push(fieldName);
          console.log(`Filled "${fieldName}" with "${value}"`);
        } catch (e) {
          console.error(`Could not fill field "${fieldName}":`, e);
          fieldsUnmatched.push(fieldName);
        }
      } else {
        fieldsUnmatched.push(fieldName);
      }
    }

    // Flatten the form to make it non-editable
    form.flatten();
    
    const modifiedPdfBytes = await pdfDoc.save();
    
    return {
      pdfBuffer: Buffer.from(modifiedPdfBytes),
      fieldsMatched,
      fieldsUnmatched,
      hasFormFields: true
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

    console.log("Checking for fillable form fields...");
    const result = await this.fillFormFields(pdfBuffer, profile);
    
    if (result.hasFormFields) {
      console.log(`Filled ${result.fieldsMatched.length} form fields`);
      return {
        pdfBuffer: result.pdfBuffer,
        fieldsMatched: result.fieldsMatched,
        fieldsUnmatched: result.fieldsUnmatched
      };
    }
    
    // If no form fields, the PDF is not a fillable form
    console.log("No fillable form fields found - this PDF is not an interactive form");
    throw new Error("This PDF does not have fillable form fields. Please request a fillable PDF form from the golf course, or fill it manually.");
  }
}

export const formFiller = new FormFillerService();
