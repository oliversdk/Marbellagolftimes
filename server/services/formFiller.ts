import OpenAI from "openai";
import puppeteer from "puppeteer";
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

  extractFooterInfo(formText: string): { courseName: string; address: string; phone: string; email: string; website: string } {
    // Try to extract footer info from the form
    const lines = formText.split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-10);
    
    let courseName = "Golf Course";
    let address = "";
    let phone = "";
    let email = "";
    let website = "";
    
    for (const line of lastLines) {
      if (line.includes("C/.") || line.includes("Calle")) {
        address = line.trim();
      }
      if (line.includes("Tel.") || line.includes("+34")) {
        const match = line.match(/Tel\.\s*([+\d\s]+)/);
        if (match) phone = match[1].trim();
        const emailMatch = line.match(/E-mail:\s*([^\s]+)/);
        if (emailMatch) email = emailMatch[1].trim();
      }
      if (line.includes("www.")) {
        website = line.trim();
      }
      if (line.includes("29630") || line.includes("Málaga")) {
        address = line.trim();
      }
    }
    
    // Check for Golf Torrequebrada specifically
    if (formText.toLowerCase().includes("torrequebrada")) {
      courseName = "Golf Torrequebrada";
      address = "C/. Club de Golf, 1 - 29630 Benalmádena Costa (Málaga) – Spain";
      phone = "+34 952 442 742";
      email = "bookings@golftorrequebrada.com";
      website = "www.golftorrequebrada.com";
    }
    
    return { courseName, address, phone, email, website };
  }

  generateFilledFormHtml(profile: CompanyProfileData, footer: { courseName: string; address: string; phone: string; email: string; website: string }): string {
    const useBusinessForInvoice = profile.invoiceSameAsBusiness === "true";
    
    const invoiceStreet = useBusinessForInvoice ? profile.businessStreet : profile.invoiceStreet;
    const invoicePostalCode = useBusinessForInvoice ? profile.businessPostalCode : profile.invoicePostalCode;
    const invoiceCity = useBusinessForInvoice ? profile.businessCity : profile.invoiceCity;
    const invoiceCountry = useBusinessForInvoice ? profile.businessCountry : profile.invoiceCountry;
    
    const businessFullAddress = [
      profile.businessStreet,
      [profile.businessPostalCode, profile.businessCity].filter(Boolean).join(", "),
      profile.businessCountry
    ].filter(Boolean).join(", ");
    
    const invoiceFullAddress = [
      invoiceStreet,
      [invoicePostalCode, invoiceCity].filter(Boolean).join(", "),
      invoiceCountry
    ].filter(Boolean).join(", ");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 15mm 20mm 25mm 20mm; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 100%;
    }
    h1 {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 20px;
      border-bottom: 1px solid #000;
      padding-bottom: 8px;
    }
    h2 {
      font-size: 11pt;
      font-weight: bold;
      margin: 20px 0 12px 0;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
    }
    .field-row {
      display: flex;
      margin-bottom: 8px;
    }
    .label {
      width: 200px;
      flex-shrink: 0;
      font-weight: normal;
    }
    .value {
      flex: 1;
      font-weight: normal;
    }
    .contact-section {
      margin-bottom: 15px;
    }
    .contact-title {
      font-weight: bold;
      margin-bottom: 6px;
    }
    .signature-area {
      margin-top: 40px;
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .signature-line {
      margin-top: 40px;
      border-top: 1px solid #000;
      width: 200px;
      text-align: center;
      padding-top: 5px;
      font-size: 10pt;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      border-top: 1px solid #ccc;
      padding-top: 10px;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Datos de la empresa ‐ Business details</h1>
    
    <div class="field-row">
      <div class="label">Nombre comercial / Commercial name:</div>
      <div class="value">${profile.commercialName || ''}</div>
    </div>
    
    <div class="field-row">
      <div class="label">Razón social / Trading name:</div>
      <div class="value">${profile.tradingName || ''}</div>
    </div>
    
    <div class="field-row">
      <div class="label">CIF / CIF or VAT number:</div>
      <div class="value">${profile.cifVat || ''}</div>
    </div>
    
    <div class="field-row">
      <div class="label">Web / Web page:</div>
      <div class="value">${profile.website || ''}</div>
    </div>
    
    <h2>Direcciones ‐ Addresses</h2>
    
    <div class="field-row">
      <div class="label">Domicilio social / Business address:</div>
      <div class="value">${businessFullAddress}</div>
    </div>
    
    <div class="field-row">
      <div class="label">Dirección de facturación / Invoice address:</div>
      <div class="value">${invoiceFullAddress}</div>
    </div>
    
    <h2>Personas de contacto ‐ Contact persons</h2>
    
    <div class="contact-section">
      <div class="contact-title">Reservas / Reservations:</div>
      <div class="field-row">
        <div class="value">${[profile.reservationsName, profile.reservationsEmail, profile.reservationsPhone].filter(Boolean).join(', ')}</div>
      </div>
    </div>
    
    <div class="contact-section">
      <div class="contact-title">Facturación / Invoicing:</div>
      <div class="field-row">
        <div class="value">${[profile.invoicingName, profile.invoicingEmail, profile.invoicingPhone].filter(Boolean).join(', ')}</div>
      </div>
    </div>
    
    <div class="contact-section">
      <div class="contact-title">Contratación / Contracts:</div>
      <div class="field-row">
        <div class="value">${[profile.contractsName, profile.contractsEmail, profile.contractsPhone].filter(Boolean).join(', ')}</div>
      </div>
    </div>
    
    <div class="signature-area">
      <p><strong>Firma / Signature</strong></p>
      <div class="signature-line">Firma / Signature</div>
    </div>
  </div>
  
  <div class="footer">
    ${footer.address}<br>
    Tel. ${footer.phone} * E-mail: ${footer.email}<br>
    ${footer.website}
  </div>
</body>
</html>`;
  }

  async convertHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '15mm',
          right: '20mm',
          bottom: '25mm',
          left: '20mm'
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
    const profile = await this.getCompanyProfile();
    if (!profile) {
      throw new Error("Company profile not found. Please set up your company details in Admin Settings first.");
    }

    console.log("Extracting form text to identify source...");
    const formText = await this.extractTextFromPdf(pdfBuffer);
    
    console.log("Extracting footer info from original form...");
    const footer = this.extractFooterInfo(formText);
    console.log(`Detected course: ${footer.courseName}`);

    console.log("Generating filled form HTML...");
    const html = this.generateFilledFormHtml(profile, footer);

    console.log("Converting to PDF...");
    const filledPdfBuffer = await this.convertHtmlToPdf(html);
    console.log(`Generated PDF: ${filledPdfBuffer.length} bytes`);

    const fieldsMatched = [
      "commercialName", "tradingName", "cifVat", "website",
      "businessAddress", "invoiceAddress",
      "reservationsContact", "invoicingContact", "contractsContact"
    ];

    return {
      pdfBuffer: filledPdfBuffer,
      fieldsMatched,
      fieldsUnmatched: []
    };
  }
}

export const formFiller = new FormFillerService();
