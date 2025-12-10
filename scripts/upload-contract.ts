import { db } from "../server/db";
import { courseDocuments } from "../shared/schema";
import { ObjectStorageService } from "../server/objectStorage";
import fs from "fs";

async function uploadContract() {
  const courseId = "56d5b84c-a097-4438-adbb-864de1af6609";
  const pdfPath = "attached_assets/alhaurin_golf_contract_2026.pdf";
  
  const buffer = fs.readFileSync(pdfPath);
  
  const objectStorage = new ObjectStorageService();
  const fileName = `courses/${courseId}/documents/${Date.now()}-Alhaurin_Golf_Contract_2026.pdf`;
  const fileUrl = await objectStorage.uploadPrivateFile(fileName, buffer, "application/pdf");
  
  console.log("Uploaded to:", fileUrl);
  
  const result = await db.insert(courseDocuments).values({
    courseId,
    name: "Collaboration Contract 2026",
    fileName: "Alhaurin_Golf_Contract_2026.pdf",
    fileUrl,
    fileType: "application/pdf",
    fileSize: buffer.length,
    category: "contract",
    notes: "Alhaurin Golf collaboration contract with 20% kickback (Net TO rates). Valid seasons: Low (Jan, Jul-Aug, Dec), Medium (Feb, May-Jun, Sep 1-15), High (Mar-May 15, Sep 16-Nov). Group discount: 1 free per 8 paying.",
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
  }).returning();
  
  console.log("Document created:", result[0].id);
}

uploadContract().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
