# Golfmanager API Ansøgning

## 📋 Trin 1: Download Autorisationsformular

Download PDF'en her:
https://www.golfmanager.com/multicourse-api-authorization/

## ✉️ Trin 2: Send denne email til Daniel Sillari

**Email til:** dsillari@golfmanager.com  
**Kopi til:** support@golfmanager.com  
**Emne:** API Access Request - Consumer API for Costa del Sol Tee-Time Platform

---

**Email indhold (på engelsk):**

```
Dear Daniel,

I am developing a tee-time booking platform for Costa del Sol golf courses and would like to request Consumer API access to integrate with the Golfmanager system.

PROJECT DETAILS:
- Platform Name: Costa del Sol Golf Tee-Time Finder
- Purpose: Real-time tee-time availability search and booking for golfers
- Target Market: Costa del Sol, Spain (40+ golf courses)
- Platform Type: Web-based booking aggregator

API ACCESS REQUESTED:
- Type: Consumer API (read-only tee-time availability)
- Endpoints needed:
  * /searchAvailability - Search available tee times
  * /tenant - Get course information
  * /resources - Get course resources

GOLF COURSES TO INTEGRATE:
I would like to integrate with the following Golfmanager/iMaster/teeone courses:

1. La Reserva Club Sotogrande (tenant: lareserva)
2. Finca Cortesín Golf Club (tenant: fincacortesin)
3. Real Club de Golf Sotogrande (tenant: rcgsotogrande)
4. San Roque Club (tenant: sanroque)
5. El Paraíso Golf Club (tenant: paraiso)
6. Marbella Golf & Country Club (tenant: marbella)
7. Estepona Golf (tenant: estepona)
8. Santa Clara Golf Marbella (tenant: santaclara)
9. Mijas Golf Internacional (tenant: mijas)

TECHNICAL DETAILS:
- Authentication: API key via header (key: YOUR_API_KEY)
- Expected request volume: ~1,000-5,000 requests/day initially
- IP addresses: Dynamic (cloud-hosted on Replit platform)
- Integration timeline: Immediate (code already prepared)

BUSINESS MODEL:
- Free platform for golfers to search tee times
- Drives bookings to partner golf courses
- No commission on bookings (affiliate partnership model)

I have attached the completed authorization form as requested.

Could you please provide:
1. API key for Consumer API access
2. Confirmation of which tenant names to use for each course
3. API documentation access
4. Rate limits and usage guidelines

I understand the cost is €25/month per tenant and am prepared to proceed with the subscription.

Thank you for your assistance. I look forward to integrating with Golfmanager to provide better tee-time discovery for golfers on Costa del Sol.

Best regards,
[DIT NAVN]
[DIN EMAIL]
[DIN TELEFON]
```

---

## 📄 Trin 3: Udfyld Autorisationsformularen

Når du udfylder PDF'en, angiv:

**Section 1 - Golf Club Information:**
- Dette er IKKE relevant for dig (du er ikke en golfklub)
- Skriv "N/A - Booking Platform Integration"

**Section 2 - Contact Person:**
- Dit navn
- Din titel (f.eks. "Platform Owner" eller "Developer")
- Din email og telefon

**Section 3 - Company Information:**
- Firmanavn (hvis relevant)
- CVR nummer (hvis relevant)
- Adresse

**Section 4 - Type of API Access:**
- ✅ Check "Consumer API"
- Skriv: "Tee-time availability search for booking platform"

**Section 5 - API Functions Required:**
- ✅ searchAvailability
- ✅ tenant
- ✅ resources

**Section 6 - IP Addresses:**
- Skriv: "Dynamic IPs - Cloud-hosted on Replit platform"

**Section 7 - Signature:**
- Dit navn
- Dato
- Underskrift

---

## 💰 Trin 4: Forvent Svar

**Hvad sker der nu:**
1. Daniel Sillari svarer normalt inden for 1-3 hverdage
2. Han sender dig en API key
3. Han bekræfter tenant navne for hver bane
4. Du modtager faktura for €25/måned × antal baner

**Hvis du ikke hører fra dem:**
- Vent 3-4 dage
- Send en påmindelse
- Prøv også support@golfmanager.com

---

## ✅ Trin 5: Når du modtager API key

Tilføj den i Replit Secrets:
- Secret navn: `GOLFMANAGER_API_KEY`
- Secret værdi: Den API key du modtager

Systemet vil automatisk skifte fra mock data til rigtige tee-times! 🎉

---

## 🔧 Teknisk Information (til reference)

**API Endpoints vi bruger:**
```
GET https://eu.golfmanager.com/api/bookings/searchAvailability
Headers:
  key: YOUR_API_KEY
  tenant: COURSE_TENANT_NAME

Parameters:
  start: 2025-11-14T07:00:00
  end: 2025-11-14T20:00:00
  slots: 2
```

**Courses vi har konfigureret:**
- 9 baner med tenant links klar
- Virker med både Golfmanager og iMaster/teeone platforme
- Automatisk switch mellem mock og real data

---

## 📞 Support Kontakt

**Golfmanager API Team:**
- Email: dsillari@golfmanager.com
- Support: support@golfmanager.com
- Help Center: https://intercom.help/golfmanager

**Hvad kan gå galt:**
- De beder om mere information → Bare svar på deres spørgsmål
- De siger nej → Spørg om demo/test adgang først
- De vil have mere dokumentation → Vis dem denne platform

**Held og lykke! 🏌️**
