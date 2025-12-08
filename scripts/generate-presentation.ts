import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:5000";

async function takeScreenshots() {
  console.log("Launching browser for screenshots...");
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const screenshotsDir = "scripts/screenshots";
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Screenshot 1: Homepage with course listing
  console.log("Taking screenshot of homepage...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 3000));
  await page.screenshot({ path: `${screenshotsDir}/homepage.png`, fullPage: false });

  // Screenshot 2: Course detail page - navigate to a known course
  console.log("Taking screenshot of course detail...");
  try {
    // Look for course cards or links
    const allLinks = await page.$$eval('a', links => 
      links.map(link => link.getAttribute('href')).filter(h => h && h.includes('/course/'))
    );
    
    console.log(`Found ${allLinks.length} course links`);
    
    if (allLinks.length > 0) {
      const courseUrl = allLinks[0];
      console.log(`Navigating to: ${BASE_URL}${courseUrl}`);
      await page.goto(`${BASE_URL}${courseUrl}`, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.screenshot({ path: `${screenshotsDir}/course-detail.png`, fullPage: false });
      console.log("Course detail screenshot taken!");
    } else {
      // Try to find any clickable course element
      console.log("Trying to click on a course card...");
      const cards = await page.$$('[data-testid*="course"], .course-card, [class*="course"]');
      if (cards.length > 0) {
        await cards[0].click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.screenshot({ path: `${screenshotsDir}/course-detail.png`, fullPage: false });
        console.log("Course detail screenshot taken via card click!");
      } else {
        console.log("No course elements found");
      }
    }
  } catch (e) {
    console.log("Could not capture course detail:", e);
  }

  // Screenshot 3: Map view - try clicking the map toggle
  console.log("Taking screenshot of map view...");
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try different approaches to find map button
    let mapTaken = false;
    
    // Method 1: data-testid
    const mapButton1 = await page.$('[data-testid="button-map-view"]');
    if (mapButton1) {
      await mapButton1.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.screenshot({ path: `${screenshotsDir}/map-view.png`, fullPage: false });
      console.log("Map view screenshot taken!");
      mapTaken = true;
    }
    
    // Method 2: Search for buttons with map text
    if (!mapTaken) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
        if (text.includes('map') || text.includes('mapa')) {
          await btn.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          await page.screenshot({ path: `${screenshotsDir}/map-view.png`, fullPage: false });
          console.log("Map view screenshot taken via text search!");
          mapTaken = true;
          break;
        }
      }
    }
    
    // Method 3: Look for Map icon in segmented control
    if (!mapTaken) {
      const toggles = await page.$$('[role="tablist"] button, [class*="toggle"] button');
      if (toggles.length > 1) {
        await toggles[1].click(); // Usually second toggle is map
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.screenshot({ path: `${screenshotsDir}/map-view.png`, fullPage: false });
        console.log("Map view screenshot taken via toggle!");
      }
    }
  } catch (e) {
    console.log("Could not capture map view:", e);
  }

  await browser.close();
  console.log("Screenshots completed!");
  
  return screenshotsDir;
}

async function generatePDF() {
  console.log("Generating PDF presentation...");
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Check which screenshots exist
  const screenshotsDir = "scripts/screenshots";
  const homepageExists = fs.existsSync(`${screenshotsDir}/homepage.png`);
  const courseDetailExists = fs.existsSync(`${screenshotsDir}/course-detail.png`);
  const mapViewExists = fs.existsSync(`${screenshotsDir}/map-view.png`);

  const homepageBase64 = homepageExists 
    ? fs.readFileSync(`${screenshotsDir}/homepage.png`).toString("base64")
    : "";
  const courseDetailBase64 = courseDetailExists
    ? fs.readFileSync(`${screenshotsDir}/course-detail.png`).toString("base64")
    : "";
  const mapViewBase64 = mapViewExists
    ? fs.readFileSync(`${screenshotsDir}/map-view.png`).toString("base64")
    : "";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 0;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    
    .page:last-child {
      page-break-after: avoid;
    }
    
    /* Cover Page */
    .cover {
      background: linear-gradient(135deg, #0c4a2f 0%, #1a6b45 50%, #0d5533 100%);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      position: relative;
    }
    
    .cover::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      opacity: 0.5;
    }
    
    .cover-content {
      position: relative;
      z-index: 1;
      padding: 60px;
    }
    
    .logo-badge {
      width: 120px;
      height: 120px;
      background: rgba(255,255,255,0.1);
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 40px;
      font-size: 48px;
    }
    
    .cover h1 {
      font-family: 'Playfair Display', serif;
      font-size: 48px;
      font-weight: 600;
      margin-bottom: 16px;
      letter-spacing: 2px;
    }
    
    .cover .tagline {
      font-size: 20px;
      font-weight: 300;
      opacity: 0.9;
      margin-bottom: 60px;
      letter-spacing: 4px;
      text-transform: uppercase;
    }
    
    .cover .subtitle {
      font-size: 18px;
      font-weight: 400;
      opacity: 0.85;
      max-width: 500px;
      line-height: 1.8;
    }
    
    .gold-line {
      width: 80px;
      height: 3px;
      background: linear-gradient(90deg, #d4af37, #f4d03f, #d4af37);
      margin: 40px auto;
    }
    
    .cover-footer {
      position: absolute;
      bottom: 40px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 14px;
      opacity: 0.7;
    }
    
    /* Content Pages */
    .content-page {
      background: #fafafa;
      padding: 50px;
    }
    
    .page-header {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .page-header h2 {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      color: #0c4a2f;
      margin-bottom: 8px;
    }
    
    .page-header .subtitle {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    
    .section {
      margin-bottom: 40px;
    }
    
    .section h3 {
      font-family: 'Playfair Display', serif;
      font-size: 22px;
      color: #0c4a2f;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #d4af37;
      display: inline-block;
    }
    
    .section p {
      font-size: 14px;
      color: #444;
      line-height: 1.8;
      margin-bottom: 12px;
    }
    
    .screenshot {
      width: 100%;
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
      margin: 20px 0;
      border: 1px solid #e0e0e0;
    }
    
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      margin-top: 24px;
    }
    
    .feature-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-left: 4px solid #d4af37;
    }
    
    .feature-card h4 {
      font-size: 16px;
      color: #0c4a2f;
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .feature-card p {
      font-size: 13px;
      color: #666;
      line-height: 1.6;
      margin: 0;
    }
    
    .stats-row {
      display: flex;
      justify-content: space-around;
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin: 30px 0;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    
    .stat {
      text-align: center;
    }
    
    .stat .number {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      color: #0c4a2f;
      font-weight: 600;
    }
    
    .stat .label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    
    .benefits-list {
      list-style: none;
      padding: 0;
    }
    
    .benefits-list li {
      padding: 12px 0;
      padding-left: 32px;
      position: relative;
      font-size: 14px;
      color: #444;
      border-bottom: 1px solid #eee;
    }
    
    .benefits-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #0c4a2f;
      font-weight: bold;
      font-size: 16px;
    }
    
    /* Contact Page */
    .contact-page {
      background: linear-gradient(135deg, #0c4a2f 0%, #1a6b45 100%);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 60px;
    }
    
    .contact-page h2 {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      margin-bottom: 20px;
    }
    
    .contact-info {
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 40px 60px;
      margin-top: 30px;
    }
    
    .contact-info p {
      font-size: 18px;
      margin: 12px 0;
      opacity: 0.95;
    }
    
    .contact-info .email {
      font-size: 24px;
      color: #d4af37;
      font-weight: 500;
    }
    
    /* Language Divider */
    .language-divider {
      background: #1a1a1a;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    
    .language-divider h2 {
      font-family: 'Playfair Display', serif;
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    .language-divider p {
      font-size: 18px;
      opacity: 0.7;
    }
  </style>
</head>
<body>

<!-- ENGLISH SECTION -->

<!-- Cover Page -->
<div class="page cover">
  <div class="cover-content">
    <div class="logo-badge">⛳</div>
    <h1>MARBELLA GOLF TIMES</h1>
    <p class="tagline">Costa del Sol's Premier Tee Time Service</p>
    <div class="gold-line"></div>
    <p class="subtitle">
      Partner with us to showcase your golf course to thousands of international golfers 
      seeking the finest tee times on the Costa del Sol.
    </p>
  </div>
  <div class="cover-footer">
    www.marbellagolftimes.com | Partnership Proposal 2025
  </div>
</div>

<!-- About Us -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Introduction</p>
    <h2>About Marbella Golf Times</h2>
  </div>
  
  <div class="section">
    <p>
      <strong>Marbella Golf Times</strong> is a boutique-premium tee time booking service 
      exclusively focused on the Costa del Sol region. We connect international golfers 
      with the finest courses in Andalusia, providing a seamless booking experience 
      with concierge-quality service.
    </p>
  </div>
  
  <div class="stats-row">
    <div class="stat">
      <div class="number">43+</div>
      <div class="label">Premier Courses</div>
    </div>
    <div class="stat">
      <div class="number">5</div>
      <div class="label">Languages</div>
    </div>
    <div class="stat">
      <div class="number">24/7</div>
      <div class="label">Booking Access</div>
    </div>
  </div>
  
  ${homepageBase64 ? `<img src="data:image/png;base64,${homepageBase64}" class="screenshot" alt="Platform Homepage" />` : ''}
  
  <div class="section">
    <h3>Our Mission</h3>
    <p>
      To deliver an exceptional golf booking experience that matches the world-class 
      quality of Costa del Sol's finest courses, while driving high-value international 
      visitors to our partner golf clubs.
    </p>
  </div>
</div>

<!-- Platform Features -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Technology</p>
    <h2>Platform Features</h2>
  </div>
  
  <div class="feature-grid">
    <div class="feature-card">
      <h4>Real-Time Availability</h4>
      <p>Direct API integration with Golfmanager and TeeOne systems for live tee time availability and instant booking confirmation.</p>
    </div>
    <div class="feature-card">
      <h4>Multi-Language Support</h4>
      <p>Full platform localization in English, Spanish, Danish, Swedish, and Russian to reach international golf tourists.</p>
    </div>
    <div class="feature-card">
      <h4>Geolocation Search</h4>
      <p>Visitors can find courses near their hotel or current location, sorted by distance for maximum convenience.</p>
    </div>
    <div class="feature-card">
      <h4>Premium Course Profiles</h4>
      <p>Beautiful course pages with photos, reviews, weather data, and detailed facility information.</p>
    </div>
  </div>
  
  ${courseDetailExists ? `<img src="data:image/png;base64,${courseDetailBase64}" class="screenshot" alt="Course Detail Page" />` : ''}
</div>

<!-- Partnership Benefits -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Collaboration</p>
    <h2>Partnership Benefits</h2>
  </div>
  
  <div class="section">
    <h3>Why Partner With Us?</h3>
    <ul class="benefits-list">
      <li>Access to high-value international golf tourists from Northern Europe and beyond</li>
      <li>Zero upfront costs - commission-based model aligned with your success</li>
      <li>Real-time integration with your existing booking system (Golfmanager/TeeOne)</li>
      <li>Premium brand positioning alongside the finest Costa del Sol courses</li>
      <li>Dedicated course profile with professional photography and reviews</li>
      <li>Multi-language marketing reaching Scandinavian, British, and Russian golfers</li>
      <li>Detailed analytics and booking reports for revenue tracking</li>
      <li>Direct communication channel for special offers and promotions</li>
    </ul>
  </div>
  
  ${mapViewExists ? `<img src="data:image/png;base64,${mapViewBase64}" class="screenshot" alt="Interactive Map View" />` : ''}
  
  <div class="section">
    <h3>Integration Process</h3>
    <p>
      Our technical team handles the entire integration process. Simply provide your 
      booking system credentials, and we'll connect your real-time availability 
      within 24-48 hours. No development work required from your side.
    </p>
  </div>
</div>

<!-- Contact English -->
<div class="page contact-page">
  <h2>Let's Partner Together</h2>
  <p style="font-size: 18px; opacity: 0.9; max-width: 500px;">
    Join the Costa del Sol's most exclusive golf booking platform and connect 
    with international golfers seeking premium tee times.
  </p>
  <div class="gold-line"></div>
  <div class="contact-info">
    <p>Contact us to discuss partnership opportunities:</p>
    <p class="email">partnerships@marbellagolftimes.com</p>
    <p style="margin-top: 20px; opacity: 0.8;">+34 XXX XXX XXX</p>
  </div>
</div>

<!-- Language Divider -->
<div class="page language-divider">
  <h2>🇪🇸 ESPAÑOL</h2>
  <p>Spanish Version / Versión en Español</p>
  <div class="gold-line"></div>
</div>

<!-- SPANISH SECTION -->

<!-- Cover Page Spanish -->
<div class="page cover">
  <div class="cover-content">
    <div class="logo-badge">⛳</div>
    <h1>MARBELLA GOLF TIMES</h1>
    <p class="tagline">El Servicio Premier de Tee Times de la Costa del Sol</p>
    <div class="gold-line"></div>
    <p class="subtitle">
      Colabore con nosotros para mostrar su campo de golf a miles de golfistas 
      internacionales que buscan los mejores horarios de salida en la Costa del Sol.
    </p>
  </div>
  <div class="cover-footer">
    www.marbellagolftimes.com | Propuesta de Colaboración 2025
  </div>
</div>

<!-- About Us Spanish -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Introducción</p>
    <h2>Sobre Marbella Golf Times</h2>
  </div>
  
  <div class="section">
    <p>
      <strong>Marbella Golf Times</strong> es un servicio boutique-premium de reserva 
      de horarios de salida enfocado exclusivamente en la región de la Costa del Sol. 
      Conectamos golfistas internacionales con los mejores campos de Andalucía, 
      proporcionando una experiencia de reserva impecable con servicio de calidad concierge.
    </p>
  </div>
  
  <div class="stats-row">
    <div class="stat">
      <div class="number">43+</div>
      <div class="label">Campos Premier</div>
    </div>
    <div class="stat">
      <div class="number">5</div>
      <div class="label">Idiomas</div>
    </div>
    <div class="stat">
      <div class="number">24/7</div>
      <div class="label">Acceso a Reservas</div>
    </div>
  </div>
  
  ${homepageBase64 ? `<img src="data:image/png;base64,${homepageBase64}" class="screenshot" alt="Página Principal" />` : ''}
  
  <div class="section">
    <h3>Nuestra Misión</h3>
    <p>
      Ofrecer una experiencia excepcional de reserva de golf que iguale la calidad 
      de clase mundial de los mejores campos de la Costa del Sol, mientras atraemos 
      visitantes internacionales de alto valor a nuestros clubes de golf asociados.
    </p>
  </div>
</div>

<!-- Platform Features Spanish -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Tecnología</p>
    <h2>Características de la Plataforma</h2>
  </div>
  
  <div class="feature-grid">
    <div class="feature-card">
      <h4>Disponibilidad en Tiempo Real</h4>
      <p>Integración directa con sistemas Golfmanager y TeeOne para disponibilidad en vivo y confirmación instantánea de reservas.</p>
    </div>
    <div class="feature-card">
      <h4>Soporte Multiidioma</h4>
      <p>Plataforma completa en inglés, español, danés, sueco y ruso para alcanzar turistas de golf internacionales.</p>
    </div>
    <div class="feature-card">
      <h4>Búsqueda por Geolocalización</h4>
      <p>Los visitantes pueden encontrar campos cerca de su hotel o ubicación actual, ordenados por distancia.</p>
    </div>
    <div class="feature-card">
      <h4>Perfiles Premium de Campos</h4>
      <p>Páginas elegantes con fotos, reseñas, datos meteorológicos e información detallada de instalaciones.</p>
    </div>
  </div>
  
  ${courseDetailExists ? `<img src="data:image/png;base64,${courseDetailBase64}" class="screenshot" alt="Página de Detalle del Campo" />` : ''}
</div>

<!-- Partnership Benefits Spanish -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Colaboración</p>
    <h2>Beneficios de la Asociación</h2>
  </div>
  
  <div class="section">
    <h3>¿Por Qué Asociarse Con Nosotros?</h3>
    <ul class="benefits-list">
      <li>Acceso a turistas de golf internacionales de alto valor del norte de Europa y más allá</li>
      <li>Sin costes iniciales - modelo basado en comisiones alineado con su éxito</li>
      <li>Integración en tiempo real con su sistema de reservas existente (Golfmanager/TeeOne)</li>
      <li>Posicionamiento premium junto a los mejores campos de la Costa del Sol</li>
      <li>Perfil dedicado del campo con fotografía profesional y reseñas</li>
      <li>Marketing multiidioma alcanzando golfistas escandinavos, británicos y rusos</li>
      <li>Análisis detallados e informes de reservas para seguimiento de ingresos</li>
      <li>Canal de comunicación directo para ofertas especiales y promociones</li>
    </ul>
  </div>
  
  ${mapViewExists ? `<img src="data:image/png;base64,${mapViewBase64}" class="screenshot" alt="Vista del Mapa Interactivo" />` : ''}
  
  <div class="section">
    <h3>Proceso de Integración</h3>
    <p>
      Nuestro equipo técnico gestiona todo el proceso de integración. Simplemente 
      proporcione sus credenciales del sistema de reservas y conectaremos su 
      disponibilidad en tiempo real en 24-48 horas. No se requiere trabajo de 
      desarrollo por su parte.
    </p>
  </div>
</div>

<!-- Contact Spanish -->
<div class="page contact-page">
  <h2>Colaboremos Juntos</h2>
  <p style="font-size: 18px; opacity: 0.9; max-width: 500px;">
    Únase a la plataforma de reservas de golf más exclusiva de la Costa del Sol 
    y conecte con golfistas internacionales que buscan horarios de salida premium.
  </p>
  <div class="gold-line"></div>
  <div class="contact-info">
    <p>Contáctenos para discutir oportunidades de colaboración:</p>
    <p class="email">partnerships@marbellagolftimes.com</p>
    <p style="margin-top: 20px; opacity: 0.8;">+34 XXX XXX XXX</p>
  </div>
</div>

</body>
</html>
`;

  await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Wait for fonts to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate PDF
  const pdfPath = "Marbella_Golf_Times_Partnership_Presentation.pdf";
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  console.log(`PDF generated: ${pdfPath}`);
  return pdfPath;
}

async function main() {
  try {
    await takeScreenshots();
    const pdfPath = await generatePDF();
    console.log(`\n✅ Presentation created successfully: ${pdfPath}`);
  } catch (error) {
    console.error("Error generating presentation:", error);
    process.exit(1);
  }
}

main();
