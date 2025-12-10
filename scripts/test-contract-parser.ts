import { contractParser } from "../server/services/contractParser";

async function main() {
  const documentId = "9d5b5c1c-a6c7-48a9-87de-832d94bd9708";
  
  console.log("Processing contract...");
  try {
    const result = await contractParser.processDocument(documentId);
    console.log("\n=== Contract Processing Results ===\n");
    console.log("Ingestion ID:", result.ingestionId);
    console.log("Rate Periods Created:", result.ratePeriods);
    console.log("Contacts Created:", result.contacts);
    console.log("\n=== Parsed Data ===\n");
    console.log(JSON.stringify(result.parsedData, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
