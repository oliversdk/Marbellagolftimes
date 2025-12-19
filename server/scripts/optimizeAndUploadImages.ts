import sharp from "sharp";
import * as fs from "fs/promises";
import * as path from "path";
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
const PUBLIC_DIR = "public/course-images";

interface ImageVersions {
  original: string;
  desktop: string;
  mobile: string;
  thumbnail: string;
}

async function optimizeImage(inputPath: string, filename: string): Promise<ImageVersions> {
  const baseName = path.basename(filename, path.extname(filename));
  const inputBuffer = await fs.readFile(inputPath);
  
  const desktopBuffer = await sharp(inputBuffer)
    .resize(1200, 800, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
  
  const mobileBuffer = await sharp(inputBuffer)
    .resize(600, 400, { fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer();
  
  const thumbnailBuffer = await sharp(inputBuffer)
    .resize(300, 200, { fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();

  const bucket = storage.bucket(BUCKET_ID);
  
  const desktopPath = `${PUBLIC_DIR}/${baseName}-desktop.webp`;
  const mobilePath = `${PUBLIC_DIR}/${baseName}-mobile.webp`;
  const thumbnailPath = `${PUBLIC_DIR}/${baseName}-thumb.webp`;

  await bucket.file(desktopPath).save(desktopBuffer, {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  console.log(`Uploaded: ${desktopPath} (${Math.round(desktopBuffer.length / 1024)}KB)`);

  await bucket.file(mobilePath).save(mobileBuffer, {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  console.log(`Uploaded: ${mobilePath} (${Math.round(mobileBuffer.length / 1024)}KB)`);

  await bucket.file(thumbnailPath).save(thumbnailBuffer, {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  console.log(`Uploaded: ${thumbnailPath} (${Math.round(thumbnailBuffer.length / 1024)}KB)`);

  return {
    original: filename,
    desktop: `/object-storage/${desktopPath}`,
    mobile: `/object-storage/${mobilePath}`,
    thumbnail: `/object-storage/${thumbnailPath}`,
  };
}

async function processAllImages() {
  const sourceDir = path.join(process.cwd(), "client/public/generated_images");
  const files = await fs.readdir(sourceDir);
  const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
  
  console.log(`Found ${imageFiles.length} images to process`);
  
  const results: Record<string, ImageVersions> = {};
  
  for (const file of imageFiles) {
    const inputPath = path.join(sourceDir, file);
    try {
      const versions = await optimizeImage(inputPath, file);
      results[file] = versions;
      console.log(`Processed: ${file}`);
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
    }
  }
  
  const outputPath = path.join(process.cwd(), "server/data/imageVersions.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nMapping saved to ${outputPath}`);
  console.log(`Total images processed: ${Object.keys(results).length}`);
}

processAllImages().catch(console.error);
