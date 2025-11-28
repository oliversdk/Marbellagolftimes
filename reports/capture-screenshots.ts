import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScreenshots() {
  console.log('Starting screenshot capture...');
  
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  const baseUrl = 'http://localhost:5000';
  
  try {
    // 1. Homepage with course list
    console.log('Capturing homepage...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, '01-homepage.png'), fullPage: false });
    
    // 2. Course search with filters
    console.log('Capturing search filters...');
    await page.screenshot({ path: path.join(screenshotsDir, '02-search-filters.png'), fullPage: false });
    
    // 3. Admin login page
    console.log('Capturing admin login...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, '03-login.png'), fullPage: false });
    
    // 4. Admin dashboard - try to access
    console.log('Capturing admin area...');
    await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, '04-admin-dashboard.png'), fullPage: false });
    
    // 5. Try to capture different parts of the page
    console.log('Capturing map view...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click map view if available
    const mapButton = await page.$('[data-testid="view-toggle-map"]');
    if (mapButton) {
      await mapButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.screenshot({ path: path.join(screenshotsDir, '05-map-view.png'), fullPage: false });
    }
    
    console.log('Screenshots captured successfully!');
    
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  }
  
  await browser.close();
}

captureScreenshots();
