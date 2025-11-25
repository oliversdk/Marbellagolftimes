# Golfmanager API Setup Guide

## Per-Tenant Authentication System

Systemet understøtter nu **individuelle API credentials for hver golfbane**. Dette gør det muligt at få real-time tee times fra Golfmanager-koblede baner.

## Hvordan Det Virker

### 1. Tenant-Specifikke Credentials (Anbefalet til Production)

For hver golfbane kan du tilføje separate API credentials som Secrets i Replit:

**Format:**
- `GM_{TENANT}_USER` - API username for en specifik bane
- `GM_{TENANT}_PASS` - API password for en specifik bane

**Eksempler:**
- `GM_PARAISO_USER` + `GM_PARAISO_PASS` for El Paraíso Golf
- `GM_LARESERVA_USER` + `GM_LARESERVA_PASS` for La Reserva
- `GM_FINCACORTESIN_USER` + `GM_FINCACORTESIN_PASS` for Finca Cortesín
- `GM_LACALA_USER` + `GM_LACALA_PASS` for La Cala Resort
- `GM_VALLEROMANO_USER` + `GM_VALLEROMANO_PASS` for Valle Romano

### 2. Globale Credentials (Fallback)

Hvis en bane **ikke** har tenant-specifikke credentials, bruger systemet globale credentials:

- `GOLFMANAGER_V1_USER` - Global username for V1 API
- `GOLFMANAGER_V1_PASSWORD` - Global password for V1 API

## Tilføj Credentials i Replit

### Via Replit Secrets UI:

1. Åbn dit Repl
2. Klik på **Tools** → **Secrets**
3. Tilføj hver credential som en ny Secret:
   - **Key:** `GM_PARAISO_USER`
   - **Value:** `[din API username fra Golfmanager]`
   - Tryk **Add Secret**
4. Gentag for password:
   - **Key:** `GM_PARAISO_PASS`
   - **Value:** `[din API password fra Golfmanager]`
   - Tryk **Add Secret**

### Via `.env` Fil (Kun til lokal udvikling):

```bash
# El Paraíso Golf Club
GM_PARAISO_USER=your_username_here
GM_PARAISO_PASS=your_password_here

# La Reserva Club Sotogrande
GM_LARESERVA_USER=your_username_here
GM_LARESERVA_PASS=your_password_here

# Finca Cortesín Golf Club
GM_FINCACORTESIN_USER=your_username_here
GM_FINCACORTESIN_PASS=your_password_here

# La Cala Resort
GM_LACALA_USER=your_username_here
GM_LACALA_PASS=your_password_here

# Valle Romano Golf & Resort
GM_VALLEROMANO_USER=your_username_here
GM_VALLEROMANO_PASS=your_password_here
```

## Costa del Sol Baner Med Golfmanager

### Direkte Golfmanager Integration (4 baner)

Disse baner bruger Golfmanager **direkte** og kan få real-time tee times:

| Bane | Tenant ID | Credentials Needed |
|------|-----------|-------------------|
| Finca Cortesín Golf Club | `fincacortesin` | `GM_FINCACORTESIN_USER` + `GM_FINCACORTESIN_PASS` |
| La Cala Resort | `lacala` | `GM_LACALA_USER` + `GM_LACALA_PASS` |
| La Reserva Club Sotogrande | `lareserva` | `GM_LARESERVA_USER` + `GM_LARESERVA_PASS` |
| Valle Romano Golf & Resort | `valleromano` | `GM_VALLEROMANO_USER` + `GM_VALLEROMANO_PASS` |

### TeeOne Golf System (9 baner)

Disse baner bruger **TeeOne Golf** (separat system fra Golfmanager):

- Marbella Golf & Country Club
- Santa Clara Golf Marbella  
- Los Naranjos Golf Club
- La Quinta Golf & Country Club
- Los Arqueros Golf & Country Club
- Atalaya Golf & Country Club
- Mijas Golf
- Torrequebrada Golf
- Flamingos Golf (Villa Padierna)

**Note:** TeeOne kræver separat API integration (ikke implementeret endnu).

## Modes

Systemet kører i forskellige modes:

### 1. MOCK Mode (Current)
```bash
GOLFMANAGER_MODE=mock
```
- Viser simulerede tee times
- Perfekt til demo og udvikling
- Kræver ingen API credentials

### 2. DEMO Mode
```bash
GOLFMANAGER_MODE=demo
```
- Bruger demo tenant til test
- Demo credentials virker ikke på `.app` server
- Begrænset funktionalitet

### 3. PRODUCTION Mode
```bash
GOLFMANAGER_MODE=production
```
- Bruger rigtige API credentials
- Får real-time tee times
- Aktiveres automatisk når tenant-specifikke credentials findes

## Auto-Detection

Systemet **auto-detecterer** production mode:

```typescript
// Hvis du tilføjer GM_PARAISO_USER + GM_PARAISO_PASS
// → El Paraíso skifter automatisk til PRODUCTION mode
// → Andre baner forbliver i MOCK/DEMO mode
```

Dette betyder at du kan **gradvist aktivere baner** efterhånden som du får API adgang!

## Få Golfmanager Credentials

### Kontakt Golfmanager Support:

1. **Email:** `support@golfmanager.com`
2. **In-App Chat:** Via Golfmanager dashboard

### Hvad Skal Du Bede Om:

```
Subject: API Access for Marbella Golf Times Integration

Hi Golfmanager Support,

I'm building a golf tee-time aggregator for Costa del Sol (marbellagolftimes.com) 
and would like API access for the following courses:

1. Finca Cortesín Golf Club (tenant: fincacortesin)
2. La Cala Resort (tenant: lacala)
3. La Reserva Club Sotogrande (tenant: lareserva)
4. Valle Romano Golf & Resort (tenant: valleromano)

Please provide API credentials (username + password) for each tenant.

Thank you!
```

## Test Din Setup

Efter at have tilføjet credentials:

1. **Genstart serveren:**
   ```bash
   npm run dev
   ```

2. **Check logs:**
   ```
   [Golfmanager] Using tenant-specific credentials for paraiso
   [Golfmanager] Initialized in PRODUCTION mode (V1)
   ```

3. **Søg efter tider** på frontend - du vil nu se rigtige tider!

## Troubleshooting

### "Missing API credentials for course"
→ Tilføj `GM_{TENANT}_USER` og `GM_{TENANT}_PASS` som Secrets

### "Unauthorized Key. CODE 11"
→ Credentials er forkerte - tjek med Golfmanager

### "ApiKey: Invalid tenant"
→ Tenant ID er forkert - kontakt Golfmanager

### Banen viser stadig mock data
→ Sørg for at `GOLFMANAGER_MODE` er sat til `production` eller fjern den helt

## Support

Spørgsmål? Kontakt:
- **Golfmanager Support:** support@golfmanager.com
- **TeeOne Golf:** info@teeone.golf
