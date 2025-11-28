import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureScreenshots() {
  console.log('Capturing final screenshots with correct URLs...');
  
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
    // First, get course list to find valid IDs
    console.log('Fetching course data...');
    const response = await page.goto(`${baseUrl}/api/courses`, { waitUntil: 'networkidle2' });
    const coursesText = await response?.text();
    const courses = JSON.parse(coursesText || '[]');
    
    // Find courses with images
    const coursesWithImages = courses.filter((c: any) => c.imageUrl);
    console.log(`Found ${coursesWithImages.length} courses with images`);
    
    // Take the first few courses with images
    const selectedCourses = coursesWithImages.slice(0, 3);
    
    // 1. Homepage fresh view
    console.log('1. Capturing homepage...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: path.join(screenshotsDir, 'final-01-homepage.png'), fullPage: false });
    
    // 2. Scroll homepage to show more courses
    console.log('2. Capturing more courses...');
    await page.evaluate(() => window.scrollBy(0, 600));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, 'final-02-more-courses.png'), fullPage: false });
    
    // 3. Course detail pages
    for (let i = 0; i < selectedCourses.length; i++) {
      const course = selectedCourses[i];
      console.log(`${i + 3}. Capturing course: ${course.name}...`);
      await page.goto(`${baseUrl}/course/${course.id}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.screenshot({ path: path.join(screenshotsDir, `final-0${i + 3}-course-${i + 1}.png`), fullPage: false });
      
      // Scroll to see tee times section
      await page.evaluate(() => window.scrollBy(0, 500));
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.screenshot({ path: path.join(screenshotsDir, `final-0${i + 3}-course-${i + 1}-scroll.png`), fullPage: false });
    }
    
    // 6. Spanish version
    console.log('6. Capturing Spanish homepage...');
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Click language switcher if it exists
    try {
      await page.evaluate(() => {
        localStorage.setItem('i18nextLng', 'es');
      });
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {}
    await page.screenshot({ path: path.join(screenshotsDir, 'final-06-spanish.png'), fullPage: false });
    
    // 7. Login page
    console.log('7. Capturing login page...');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, 'final-07-login.png'), fullPage: false });
    
    // 8. Signup page
    console.log('8. Capturing signup page...');
    await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, 'final-08-signup.png'), fullPage: false });
    
    // 9. Mobile view
    console.log('9. Capturing mobile view...');
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'final-09-mobile.png'), fullPage: false });
    
    // 10. Mobile course detail
    console.log('10. Capturing mobile course detail...');
    if (selectedCourses.length > 0) {
      await page.goto(`${baseUrl}/course/${selectedCourses[0].id}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.screenshot({ path: path.join(screenshotsDir, 'final-10-mobile-course.png'), fullPage: false });
    }
    
    console.log('\nFinal screenshots complete!');
    
  } catch (error) {
    console.error('Error during screenshot capture:', error);
  }
  
  await browser.close();
  
  // List final screenshots
  const files = fs.readdirSync(screenshotsDir).filter(f => f.startsWith('final'));
  console.log('\nFinal screenshots:');
  files.forEach(f => {
    const stats = fs.statSync(path.join(screenshotsDir, f));
    console.log(`  - ${f} (${Math.round(stats.size / 1024)}KB)`);
  });
}

captureScreenshots();
