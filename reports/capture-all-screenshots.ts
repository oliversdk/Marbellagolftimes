import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScreenshots() {
  console.log('Starting comprehensive screenshot capture...');
  
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
    // 1. Homepage - List View
    console.log('1. Capturing homepage list view...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(screenshotsDir, '01-homepage-list.png'), fullPage: false });
    
    // 2. Homepage - try to click map view
    console.log('2. Capturing map view...');
    try {
      const mapButton = await page.$('[data-testid="view-toggle-map"]');
      if (mapButton) {
        await mapButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await page.screenshot({ path: path.join(screenshotsDir, '02-homepage-map.png'), fullPage: false });
      }
    } catch (e) {
      console.log('Map view not available, skipping...');
    }
    
    // 3. Search filters expanded
    console.log('3. Capturing search with filters...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Try to interact with date picker
    try {
      const datePicker = await page.$('[data-testid="date-picker"]');
      if (datePicker) {
        await datePicker.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.screenshot({ path: path.join(screenshotsDir, '03-date-picker.png'), fullPage: false });
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      console.log('Date picker not found');
    }
    
    // 4. Course detail page - find first course link
    console.log('4. Capturing course detail page...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to click on a course
    try {
      const courseLinks = await page.$$('a[href^="/course/"]');
      if (courseLinks.length > 0) {
        await courseLinks[0].click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.screenshot({ path: path.join(screenshotsDir, '04-course-detail-top.png'), fullPage: false });
        
        // Scroll down to see more
        await page.evaluate(() => window.scrollBy(0, 600));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.screenshot({ path: path.join(screenshotsDir, '05-course-detail-middle.png'), fullPage: false });
        
        // Scroll to booking section
        await page.evaluate(() => window.scrollBy(0, 600));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.screenshot({ path: path.join(screenshotsDir, '06-course-detail-booking.png'), fullPage: false });
      }
    } catch (e) {
      console.log('Could not navigate to course detail:', e);
    }
    
    // 5. Login page
    console.log('5. Capturing login page...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '07-login-page.png'), fullPage: false });
    
    // 6. Signup page
    console.log('6. Capturing signup page...');
    await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '08-signup-page.png'), fullPage: false });
    
    // 7. Try admin page (might redirect to login)
    console.log('7. Capturing admin page...');
    await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, '09-admin-page.png'), fullPage: false });
    
    // 8. Language toggle - show language options
    console.log('8. Capturing language switcher...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try to click language switcher
    try {
      const langButton = await page.$('[data-testid="language-switcher"]');
      if (langButton) {
        await langButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.screenshot({ path: path.join(screenshotsDir, '10-language-switcher.png'), fullPage: false });
      }
    } catch (e) {
      console.log('Language switcher not found');
    }
    
    // 9. Mobile viewport
    console.log('9. Capturing mobile view...');
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, '11-mobile-view.png'), fullPage: false });
    
    // 10. Reset to desktop and capture a course in Spanish
    console.log('10. Capturing in Spanish...');
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/?lang=es`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, '12-spanish-view.png'), fullPage: false });
    
    console.log('\nScreenshot capture complete!');
    console.log('Files saved to:', screenshotsDir);
    
  } catch (error) {
    console.error('Error during screenshot capture:', error);
  }
  
  await browser.close();
  
  // List all screenshots
  const files = fs.readdirSync(screenshotsDir);
  console.log('\nCaptured screenshots:');
  files.forEach(f => console.log('  -', f));
}

captureScreenshots();
