import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePDF(htmlFile: string, pdfName: string) {
  console.log(`Generating ${pdfName}...`);
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  
  const htmlPath = path.join(__dirname, htmlFile);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const pdfPath = path.join(__dirname, pdfName);
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '25px',
      right: '25px',
      bottom: '25px',
      left: '25px'
    }
  });
  
  console.log(`✅ Generated: ${pdfPath}`);
  
  await browser.close();
}

async function main() {
  console.log('Generating System Documentation PDFs...\n');
  
  await generatePDF('system-docs-english.html', 'Marbella-Golf-Times-System-Documentation-EN.pdf');
  await generatePDF('system-docs-danish.html', 'Marbella-Golf-Times-System-Documentation-DA.pdf');
  await generatePDF('system-docs-swedish.html', 'Marbella-Golf-Times-System-Documentation-SV.pdf');
  
  console.log('\n✅ All PDFs generated successfully!');
}

main().catch(console.error);
