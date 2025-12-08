import puppeteer from "puppeteer";
import fs from "fs";

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

  // Screenshot 2: Course detail page
  console.log("Taking screenshot of course detail...");
  try {
    const cards = await page.$$('[data-testid*="course"], .course-card, [class*="course"]');
    if (cards.length > 0) {
      await cards[0].click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.screenshot({ path: `${screenshotsDir}/course-detail.png`, fullPage: false });
      console.log("Course detail screenshot taken!");
    }
  } catch (e) {
    console.log("Could not capture course detail:", e);
  }

  // Screenshot 3: Map view
  console.log("Taking screenshot of map view...");
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const toggles = await page.$$('[role="tablist"] button, [class*="toggle"] button');
    if (toggles.length > 1) {
      await toggles[1].click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.screenshot({ path: `${screenshotsDir}/map-view.png`, fullPage: false });
      console.log("Map view screenshot taken!");
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

  // Load screenshots
  const screenshotsDir = "scripts/screenshots";
  const homepageBase64 = fs.existsSync(`${screenshotsDir}/homepage.png`) 
    ? fs.readFileSync(`${screenshotsDir}/homepage.png`).toString("base64") : "";
  const courseDetailBase64 = fs.existsSync(`${screenshotsDir}/course-detail.png`)
    ? fs.readFileSync(`${screenshotsDir}/course-detail.png`).toString("base64") : "";
  const mapViewBase64 = fs.existsSync(`${screenshotsDir}/map-view.png`)
    ? fs.readFileSync(`${screenshotsDir}/map-view.png`).toString("base64") : "";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      padding: 0;
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
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
    }
    
    .cover::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      opacity: 0.5;
    }
    
    .cover-content { position: relative; z-index: 1; padding: 60px; }
    
    .logo-badge {
      width: 100px; height: 100px;
      background: rgba(255,255,255,0.1);
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 30px;
      font-size: 40px;
    }
    
    .cover h1 {
      font-family: 'Playfair Display', serif;
      font-size: 44px;
      font-weight: 600;
      margin-bottom: 12px;
      letter-spacing: 2px;
    }
    
    .cover .tagline {
      font-size: 16px;
      font-weight: 300;
      opacity: 0.9;
      margin-bottom: 40px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    
    .cover .subtitle {
      font-size: 16px;
      font-weight: 400;
      opacity: 0.85;
      max-width: 480px;
      line-height: 1.7;
    }
    
    .gold-line {
      width: 80px;
      height: 3px;
      background: linear-gradient(90deg, #d4af37, #f4d03f, #d4af37);
      margin: 30px auto;
    }
    
    .cover-footer {
      position: absolute;
      bottom: 30px;
      left: 0; right: 0;
      text-align: center;
      font-size: 12px;
      opacity: 0.7;
    }
    
    /* Content Pages */
    .content-page {
      background: #fafafa;
      padding: 40px 50px;
    }
    
    .page-header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .page-header h2 {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      color: #0c4a2f;
      margin-bottom: 6px;
    }
    
    .page-header .subtitle {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    
    .section { margin-bottom: 25px; }
    
    .section h3 {
      font-family: 'Playfair Display', serif;
      font-size: 18px;
      color: #0c4a2f;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #d4af37;
      display: inline-block;
    }
    
    .section p {
      font-size: 13px;
      color: #444;
      line-height: 1.7;
      margin-bottom: 10px;
    }
    
    .screenshot {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      object-position: top;
      border-radius: 8px;
      box-shadow: 0 15px 40px rgba(0,0,0,0.12);
      margin: 15px 0;
      border: 1px solid #e0e0e0;
    }
    
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-top: 16px;
    }
    
    .feature-card {
      background: white;
      border-radius: 10px;
      padding: 18px;
      box-shadow: 0 3px 15px rgba(0,0,0,0.06);
      border-left: 3px solid #d4af37;
    }
    
    .feature-card h4 {
      font-size: 14px;
      color: #0c4a2f;
      margin-bottom: 6px;
      font-weight: 600;
    }
    
    .feature-card p {
      font-size: 11px;
      color: #666;
      line-height: 1.5;
      margin: 0;
    }
    
    .stats-row {
      display: flex;
      justify-content: space-around;
      background: white;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 3px 15px rgba(0,0,0,0.06);
    }
    
    .stat { text-align: center; }
    
    .stat .number {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      color: #0c4a2f;
      font-weight: 600;
    }
    
    .stat .label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    
    .benefits-list {
      list-style: none;
      padding: 0;
      columns: 2;
      column-gap: 30px;
    }
    
    .benefits-list li {
      padding: 8px 0 8px 24px;
      position: relative;
      font-size: 12px;
      color: #444;
      break-inside: avoid;
    }
    
    .benefits-list li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #0c4a2f;
      font-weight: bold;
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
      padding: 50px;
    }
    
    .contact-page h2 {
      font-family: 'Playfair Display', serif;
      font-size: 32px;
      margin-bottom: 16px;
    }
    
    .contact-info {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 30px 50px;
      margin-top: 25px;
    }
    
    .contact-info p {
      font-size: 16px;
      margin: 8px 0;
      opacity: 0.95;
    }
    
    .contact-info .email {
      font-size: 22px;
      color: #d4af37;
      font-weight: 500;
    }
    
    /* Language Header */
    .lang-header {
      background: #1a1a1a;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    
    .lang-header h2 {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      margin-bottom: 12px;
    }
    
    .lang-header p {
      font-size: 16px;
      opacity: 0.7;
    }
  </style>
</head>
<body>

<!-- ==================== ENGLISH SECTION ==================== -->

<!-- Page 1: Cover -->
<div class="page cover">
  <div class="cover-content">
    <div class="logo-badge">⛳</div>
    <h1>MARBELLA GOLF TIMES</h1>
    <p class="tagline">Costa del Sol's Premier Tee Time Service</p>
    <div class="gold-line"></div>
    <p class="subtitle">
      Partner with us to showcase your golf course to thousands of international golfers 
      seeking premium tee times on the Costa del Sol.
    </p>
  </div>
  <div class="cover-footer">www.marbellagolftimes.com | Partnership Proposal 2025</div>
</div>

<!-- Page 2: About Us -->
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

<!-- Page 3: Platform Features -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Technology</p>
    <h2>Platform Features</h2>
  </div>
  
  <div class="feature-grid">
    <div class="feature-card">
      <h4>Real-Time Availability</h4>
      <p>Direct API integration with Golfmanager and TeeOne systems for live tee time availability.</p>
    </div>
    <div class="feature-card">
      <h4>Multi-Language Support</h4>
      <p>Full localization in English, Spanish, Danish, Swedish, and Russian.</p>
    </div>
    <div class="feature-card">
      <h4>Geolocation Search</h4>
      <p>Visitors find courses near their hotel, sorted by distance for convenience.</p>
    </div>
    <div class="feature-card">
      <h4>Premium Course Profiles</h4>
      <p>Beautiful pages with photos, reviews, weather data, and facility information.</p>
    </div>
  </div>
  
  ${courseDetailBase64 ? `<img src="data:image/png;base64,${courseDetailBase64}" class="screenshot" alt="Course Detail" />` : ''}
  
  ${mapViewBase64 ? `<img src="data:image/png;base64,${mapViewBase64}" class="screenshot" alt="Map View" />` : ''}
</div>

<!-- Page 4: Partnership Benefits -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Collaboration</p>
    <h2>Partnership Benefits</h2>
  </div>
  
  <div class="section">
    <h3>Why Partner With Us?</h3>
    <ul class="benefits-list">
      <li>Access to high-value international golf tourists</li>
      <li>Zero upfront costs - commission-based model</li>
      <li>Real-time integration with your booking system</li>
      <li>Premium brand positioning</li>
      <li>Professional photography and reviews</li>
      <li>Multi-language marketing reach</li>
      <li>Detailed analytics and booking reports</li>
      <li>Direct communication for promotions</li>
    </ul>
  </div>
  
  <div class="section">
    <h3>Integration Process</h3>
    <p>
      Our technical team handles the entire integration. Simply provide your 
      booking system credentials (Golfmanager/TeeOne), and we'll connect your real-time 
      availability within 24-48 hours. No development work required from your side.
    </p>
  </div>
  
  <div class="section">
    <h3>Commission Structure</h3>
    <p>
      We operate on a transparent commission model. You only pay when we deliver 
      confirmed bookings. Commission rates are negotiable based on volume and 
      exclusivity arrangements.
    </p>
  </div>
</div>

<!-- Page 5: Contact (English) -->
<div class="page contact-page">
  <h2>Let's Partner Together</h2>
  <p style="font-size: 16px; opacity: 0.9; max-width: 480px;">
    Join the Costa del Sol's most exclusive golf booking platform and connect 
    with international golfers seeking premium tee times.
  </p>
  <div class="gold-line"></div>
  <div class="contact-info">
    <p>Contact us to discuss partnership opportunities:</p>
    <p class="email">partnerships@marbellagolftimes.com</p>
    <p style="margin-top: 16px; opacity: 0.8;">+34 XXX XXX XXX</p>
  </div>
</div>

<!-- ==================== SPANISH SECTION ==================== -->

<!-- Page 6: Language Divider -->
<div class="page lang-header">
  <h2>🇪🇸 VERSIÓN EN ESPAÑOL</h2>
  <p>Spanish Version</p>
  <div class="gold-line"></div>
</div>

<!-- Page 7: Cover Spanish -->
<div class="page cover">
  <div class="cover-content">
    <div class="logo-badge">⛳</div>
    <h1>MARBELLA GOLF TIMES</h1>
    <p class="tagline">El Servicio Premier de Tee Times de la Costa del Sol</p>
    <div class="gold-line"></div>
    <p class="subtitle">
      Colabore con nosotros para mostrar su campo de golf a miles de golfistas 
      internacionales que buscan horarios de salida premium en la Costa del Sol.
    </p>
  </div>
  <div class="cover-footer">www.marbellagolftimes.com | Propuesta de Colaboración 2025</div>
</div>

<!-- Page 8: About Us Spanish -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Introducción</p>
    <h2>Sobre Marbella Golf Times</h2>
  </div>
  
  <div class="section">
    <p>
      <strong>Marbella Golf Times</strong> es un servicio boutique-premium de reserva 
      de horarios de salida enfocado exclusivamente en la Costa del Sol. 
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
      visitantes internacionales de alto valor a nuestros clubes asociados.
    </p>
  </div>
</div>

<!-- Page 9: Platform Features Spanish -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Tecnología</p>
    <h2>Características de la Plataforma</h2>
  </div>
  
  <div class="feature-grid">
    <div class="feature-card">
      <h4>Disponibilidad en Tiempo Real</h4>
      <p>Integración directa con sistemas Golfmanager y TeeOne para disponibilidad en vivo.</p>
    </div>
    <div class="feature-card">
      <h4>Soporte Multiidioma</h4>
      <p>Plataforma completa en inglés, español, danés, sueco y ruso.</p>
    </div>
    <div class="feature-card">
      <h4>Búsqueda por Geolocalización</h4>
      <p>Los visitantes encuentran campos cerca de su hotel, ordenados por distancia.</p>
    </div>
    <div class="feature-card">
      <h4>Perfiles Premium de Campos</h4>
      <p>Páginas elegantes con fotos, reseñas, datos meteorológicos e información.</p>
    </div>
  </div>
  
  ${courseDetailBase64 ? `<img src="data:image/png;base64,${courseDetailBase64}" class="screenshot" alt="Detalle del Campo" />` : ''}
  
  ${mapViewBase64 ? `<img src="data:image/png;base64,${mapViewBase64}" class="screenshot" alt="Vista del Mapa" />` : ''}
</div>

<!-- Page 10: Partnership Benefits Spanish -->
<div class="page content-page">
  <div class="page-header">
    <p class="subtitle">Colaboración</p>
    <h2>Beneficios de la Asociación</h2>
  </div>
  
  <div class="section">
    <h3>¿Por Qué Asociarse Con Nosotros?</h3>
    <ul class="benefits-list">
      <li>Acceso a turistas de golf internacionales de alto valor</li>
      <li>Sin costes iniciales - modelo basado en comisiones</li>
      <li>Integración en tiempo real con su sistema de reservas</li>
      <li>Posicionamiento premium de marca</li>
      <li>Fotografía profesional y reseñas</li>
      <li>Marketing multiidioma</li>
      <li>Análisis detallados e informes de reservas</li>
      <li>Comunicación directa para promociones</li>
    </ul>
  </div>
  
  <div class="section">
    <h3>Proceso de Integración</h3>
    <p>
      Nuestro equipo técnico gestiona todo el proceso. Simplemente proporcione sus 
      credenciales del sistema de reservas (Golfmanager/TeeOne), y conectaremos su 
      disponibilidad en tiempo real en 24-48 horas. No se requiere trabajo de 
      desarrollo por su parte.
    </p>
  </div>
  
  <div class="section">
    <h3>Estructura de Comisiones</h3>
    <p>
      Operamos con un modelo de comisiones transparente. Solo paga cuando entregamos 
      reservas confirmadas. Las tasas de comisión son negociables según el volumen 
      y acuerdos de exclusividad.
    </p>
  </div>
</div>

<!-- Page 11: Contact Spanish -->
<div class="page contact-page">
  <h2>Colaboremos Juntos</h2>
  <p style="font-size: 16px; opacity: 0.9; max-width: 480px;">
    Únase a la plataforma de reservas de golf más exclusiva de la Costa del Sol 
    y conecte con golfistas internacionales que buscan horarios premium.
  </p>
  <div class="gold-line"></div>
  <div class="contact-info">
    <p>Contáctenos para discutir oportunidades de colaboración:</p>
    <p class="email">partnerships@marbellagolftimes.com</p>
    <p style="margin-top: 16px; opacity: 0.8;">+34 XXX XXX XXX</p>
  </div>
</div>

</body>
</html>
`;

  await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 2000));

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
