import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000';
const OUTPUT_DIR = path.join(__dirname, 'docs-screenshots');

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshots() {
  console.log('Starting screenshot capture for documentation...');
  
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  
  // Helper function to take full page screenshot
  async function takeScreenshot(name: string, url?: string) {
    if (url) {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle0' });
      await delay(1000);
    }
    await page.screenshot({ 
      path: path.join(OUTPUT_DIR, `${name}.png`),
      fullPage: false
    });
    console.log(`Captured: ${name}`);
  }
  
  // Helper function to capture element screenshot (cropped)
  async function captureElement(name: string, selector: string) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`) });
        console.log(`Captured element: ${name}`);
      } else {
        console.log(`Element not found: ${selector}`);
      }
    } catch (err) {
      console.log(`Failed to capture element ${name}: ${err}`);
    }
  }
  
  // Helper to capture a region by coordinates
  async function captureRegion(name: string, x: number, y: number, width: number, height: number) {
    await page.screenshot({
      path: path.join(OUTPUT_DIR, `${name}.png`),
      clip: { x, y, width, height }
    });
    console.log(`Captured region: ${name}`);
  }

  try {
    // ===== HOMEPAGE =====
    console.log('\n--- Homepage Screenshots ---');
    await takeScreenshot('01-homepage-hero', '/');
    
    // Scroll down to see more courses
    await page.evaluate(() => window.scrollBy(0, 600));
    await delay(500);
    await takeScreenshot('02-homepage-courses');
    
    // Capture search filters
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await delay(500);
    await captureRegion('03-search-filters', 0, 0, 1400, 200);
    
    // Capture a single course card
    await captureElement('04-course-card', '[data-testid^="course-card"]');
    
    // ===== COURSE DETAIL PAGE =====
    console.log('\n--- Course Detail Screenshots ---');
    await takeScreenshot('10-course-detail', '/course/1');
    
    // Scroll to see more
    await page.evaluate(() => window.scrollBy(0, 400));
    await delay(500);
    await takeScreenshot('11-course-detail-scroll');
    
    // Capture booking form if visible
    await captureElement('12-booking-form', '[data-testid="booking-form"]');
    
    // ===== LOGIN/SIGNUP =====
    console.log('\n--- Auth Screenshots ---');
    await takeScreenshot('20-login-page', '/login');
    await takeScreenshot('21-signup-page', '/signup');
    
    // ===== ADMIN DASHBOARD =====
    console.log('\n--- Admin Dashboard Screenshots ---');
    
    // First login as admin
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await delay(500);
    
    // Try to login
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    
    if (emailInput && passwordInput) {
      await emailInput.type('admin@marbellagolftimes.com');
      await passwordInput.type('admin123');
      
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
        await delay(2000);
      }
    }
    
    // Navigate to admin
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle0' });
    await delay(1000);
    await takeScreenshot('30-admin-dashboard');
    
    // Capture admin tabs
    // Bookings tab
    const bookingsTab = await page.$('[data-testid="admin-tab-bookings"]');
    if (bookingsTab) {
      await bookingsTab.click();
      await delay(500);
      await takeScreenshot('31-admin-bookings');
    }
    
    // Courses tab
    const coursesTab = await page.$('[data-testid="admin-tab-courses"]');
    if (coursesTab) {
      await coursesTab.click();
      await delay(500);
      await takeScreenshot('32-admin-courses');
      
      // Capture course table
      await captureElement('33-courses-table', 'table');
    }
    
    // Inbox tab
    const inboxTab = await page.$('[data-testid="admin-tab-inbox"]');
    if (inboxTab) {
      await inboxTab.click();
      await delay(500);
      await takeScreenshot('40-admin-inbox');
      
      // Capture inbox list
      await captureElement('41-inbox-list', '[data-testid="inbox-list"]');
      
      // Try to capture status filters
      await captureElement('42-inbox-filters', '[data-testid="inbox-filters"]');
    }
    
    // Users tab
    const usersTab = await page.$('[data-testid="admin-tab-users"]');
    if (usersTab) {
      await usersTab.click();
      await delay(500);
      await takeScreenshot('50-admin-users');
    }
    
    // Analytics tab
    const analyticsTab = await page.$('[data-testid="admin-tab-analytics"]');
    if (analyticsTab) {
      await analyticsTab.click();
      await delay(500);
      await takeScreenshot('60-admin-analytics');
    }
    
    // ===== PROFILE PAGE =====
    console.log('\n--- Profile Screenshots ---');
    await takeScreenshot('70-profile-page', '/profile');
    
    // ===== MOBILE VIEW =====
    console.log('\n--- Mobile Screenshots ---');
    await page.setViewport({ width: 390, height: 844 });
    await takeScreenshot('80-mobile-homepage', '/');
    
    await page.evaluate(() => window.scrollBy(0, 300));
    await delay(500);
    await takeScreenshot('81-mobile-courses');
    
    await takeScreenshot('82-mobile-course-detail', '/course/1');
    await takeScreenshot('83-mobile-login', '/login');
    
    // ===== LANGUAGE VARIANTS =====
    console.log('\n--- Language Screenshots ---');
    await page.setViewport({ width: 1400, height: 900 });
    
    // Danish
    await page.goto(`${BASE_URL}/?lang=da`, { waitUntil: 'networkidle0' });
    await delay(500);
    await takeScreenshot('90-danish-homepage');
    
    // Swedish
    await page.goto(`${BASE_URL}/?lang=sv`, { waitUntil: 'networkidle0' });
    await delay(500);
    await takeScreenshot('91-swedish-homepage');
    
    // Spanish
    await page.goto(`${BASE_URL}/?lang=es`, { waitUntil: 'networkidle0' });
    await delay(500);
    await takeScreenshot('92-spanish-homepage');
    
    console.log('\n✅ All screenshots captured successfully!');
    
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
