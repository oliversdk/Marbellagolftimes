import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScreenshots() {
  console.log('Capturing course detail screenshots...');
  
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
    // Go directly to a course detail page - use slug format
    console.log('1. Capturing Finca Cortesin course page...');
    await page.goto(`${baseUrl}/course/finca-cortesin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(screenshotsDir, '20-course-finca-cortesin.png'), fullPage: false });
    
    // Scroll to see more content
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, '21-course-details-scroll.png'), fullPage: false });
    
    // Try another course
    console.log('2. Capturing Valderrama course page...');
    await page.goto(`${baseUrl}/course/valderrama`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(screenshotsDir, '22-course-valderrama.png'), fullPage: false });
    
    // Try La Cala
    console.log('3. Capturing La Cala Resort course page...');
    await page.goto(`${baseUrl}/course/la-cala-resort`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(screenshotsDir, '23-course-la-cala.png'), fullPage: false });
    
    // Full page scroll of homepage
    console.log('4. Capturing full homepage scroll...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Scroll down to see more courses
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, '24-homepage-more-courses.png'), fullPage: false });
    
    // Header area with filters
    console.log('5. Capturing header and search area...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.setViewport({ width: 1400, height: 400 });
    await page.screenshot({ path: path.join(screenshotsDir, '25-header-filters.png'), fullPage: false });
    
    // Reset viewport
    await page.setViewport({ width: 1400, height: 900 });
    
    // Booking form - try to find it on course page
    console.log('6. Capturing booking form on course page...');
    await page.goto(`${baseUrl}/course/marbella-club-golf-resort`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    // Scroll to booking section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 900));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, '26-booking-form.png'), fullPage: false });
    
    console.log('\nCourse detail screenshots complete!');
    
  } catch (error) {
    console.error('Error during screenshot capture:', error);
  }
  
  await browser.close();
  
  // List all new screenshots
  const files = fs.readdirSync(screenshotsDir).filter(f => f.startsWith('2'));
  console.log('\nNew screenshots:');
  files.forEach(f => console.log('  -', f));
}

captureScreenshots();
