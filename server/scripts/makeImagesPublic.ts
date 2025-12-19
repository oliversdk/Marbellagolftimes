import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "replit-objstore-aea3adce-6f25-4c36-994b-6f6cc7eccc35";

async function makeImagesPublic() {
  const bucket = storage.bucket(BUCKET_ID);
  const [files] = await bucket.getFiles({ prefix: "public/course-images/" });
  
  console.log(`Found ${files.length} files to make public`);
  
  for (const file of files) {
    try {
      await file.makePublic();
      console.log(`Made public: ${file.name}`);
    } catch (error: any) {
      console.error(`Failed to make public ${file.name}:`, error.message);
    }
  }
  
  console.log("Done!");
}

makeImagesPublic().catch(console.error);
