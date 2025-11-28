import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generatePDF() {
  console.log('Starting PDF generation...');
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  
  // Load the HTML file
  const htmlPath = path.join(__dirname, 'update-report-nov2025.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
  
  // Wait for fonts to load
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Generate PDF
  const pdfPath = path.join(__dirname, 'Marbella-Golf-Times-Opdateringer-Nov2025.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  });
  
  console.log(`PDF generated successfully: ${pdfPath}`);
  
  await browser.close();
}

generatePDF().catch(console.error);
