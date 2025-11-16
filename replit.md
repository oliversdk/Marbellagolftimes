# Fridas Golf

## Overview

Fridas Golf is a boutique-premium golf tee-time service for Costa del Sol, Spain, covering 40+ premier courses from Sotogrande to Málaga. The platform provides **real tee-time availability checking** (not just booking forms), curated course selection, geolocation-based search, and a complete booking flow with personal concierge-quality service.

**Core Features:**
- ✅ **Real-time tee time availability** - Shows actual available times within your search window (e.g., 10:00-12:00 tomorrow)
- ✅ **Expandable time slots** - Shows first 3 tee times by default with "Se flere tider" button to reveal all available times per course
- ✅ **Geolocation-based discovery** - Find nearest courses automatically or search by city
- ✅ **Smart filtering** - Date, players, time windows with distance sorting
- ✅ **Complete booking flow** - Click a time slot → Pre-filled booking form → Request submitted
- ✅ **Affiliate email system** - Bulk email management for golf club partnership proposals (20% commission)
- ✅ **Admin dashboard** - Manage bookings and track email campaigns
- ✅ **Premium UI** - Golf-themed design (Playfair Display + Inter fonts, green accent colors)

**Current Status (November 2025):**
- All core functionality implemented and tested
- ✅ **Golfmanager API integration with 3 modes:**
  - **DEMO mode** (default): Attempts sandbox API calls for Marbella Golf, falls back to mock data (current: sandbox returns 401, uses mock)
  - **PRODUCTION mode**: Real tee-times when GOLFMANAGER_API_KEY is configured - infrastructure ready
  - **MOCK mode**: Test data only (explicit GOLFMANAGER_MODE=mock)
- Ready for additional providers (iMasterGolf, direct club sites)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript
- Vite for development and production builds
- Wouter for client-side routing (lightweight alternative to React Router)

**UI Component System:**
- shadcn/ui component library (Radix UI primitives + Tailwind CSS)
- Custom design system based on premium booking platforms (Booking.com structure + Airbnb aesthetics)
- Typography: Inter (primary) and Playfair Display (accent serif for golf elegance)
- Responsive grid layouts with Tailwind CSS utilities

**State Management:**
- TanStack Query (React Query) for server state and caching
- Local React state for UI interactions
- Custom hooks for geolocation and toast notifications

**Key Pages:**
- Home: Hero section with location search, course cards, and tee time slots
- Admin: Two-tab interface for viewing booking requests and managing affiliate emails
- Not Found: 404 error page

### Backend Architecture

**Server Framework:**
- Node.js with Express
- TypeScript with ESM modules
- Custom Vite middleware integration for development HMR

**API Design:**
- RESTful endpoints under `/api` prefix
- JSON request/response format
- Error handling with appropriate HTTP status codes

**Data Layer:**
- In-memory storage implementation (MemStorage class) for development
- Drizzle ORM schema defined for PostgreSQL (production-ready)
- UUID-based primary keys for all entities

**Core Routes:**
- `GET /api/courses` - List all golf courses
- `GET /api/courses/:id` - Get single course details
- `GET /api/slots/search?lat=X&lng=Y&date=ISO&players=N&fromTime=HH:MM&toTime=HH:MM` - Search tee times with filters
  - **NOW FUNCTIONAL**: Returns available tee times within specified time window (e.g., 10:00-12:00)
  - Sorts courses by distance from user location using Haversine formula
  - Generates 3-5 mock slots per course within requested time window
  - Returns: `[{ courseId, courseName, distanceKm, slots: [{ teeTime, greenFee, players }], note }]`
- `POST /api/bookings` - Create booking request
- `GET /api/bookings` - List all booking requests (admin view)
- `POST /api/affiliate-emails/send` - Send bulk affiliate partnership emails
- `GET /api/affiliate-emails` - List all sent affiliate emails

### Data Storage Solutions

**Schema Design (Drizzle ORM + PostgreSQL):**

1. **golf_courses** - Core course directory
   - Location data (lat/lng, city, province)
   - Contact information (email, phone, website)
   - Booking URLs and notes

2. **tee_time_providers** - External booking systems
   - Provider types: SCRAPER, API, DEEP_LINK_ONLY
   - Base URLs and JSON configuration storage

3. **course_provider_links** - Many-to-many relationships
   - Links courses to their booking providers
   - Stores provider-specific course codes

4. **booking_requests** - User booking submissions
   - Customer details and tee time selections
   - Status tracking (PENDING, CONFIRMED, CANCELLED)

5. **affiliate_emails** - Email campaign tracking
   - Subject/body templates
   - Delivery status and timestamps
   - Course-specific targeting

**Implementation Strategy:**
- Development: In-memory Map-based storage for rapid iteration
- Production: PostgreSQL via Neon serverless driver
- Migration path: Drizzle Kit for schema management

### Authentication and Authorization

**Current Implementation:**
- No authentication system implemented
- Admin panel is publicly accessible
- Session management configured via `connect-pg-simple` (prepared for future use)

**Future Considerations:**
- Cookie-based sessions ready for integration
- SMTP credentials stored in environment variables
- Email sending capabilities already implemented via Nodemailer

### Email System

**Architecture:**
- Nodemailer with SMTP transport
- Environment-based configuration (host, port, credentials)
- Template system with placeholder replacement:
  - `[COURSE_NAME]` - Golf course name
  - `[SENDER_NAME]` - Email sender identity

**Use Cases:**
- Bulk affiliate partnership proposals (20% commission model)
- Individual course outreach
- Bilingual templates (English/Spanish) for Costa del Sol market

**Error Handling:**
- Validates course email addresses before sending
- Returns success/error status to client
- Transactional email pattern (one email per API call)

### Geolocation System

**Client-Side Implementation:**
- Browser Geolocation API with permission handling
- Haversine formula for distance calculations
- Predefined city coordinates for manual selection

**Features:**
- Current location detection with 10-second timeout
- Fallback to manual city selection (Marbella, Málaga, Sotogrande, etc.)
- Distance calculation in kilometers
- Course sorting by proximity to user

## External Dependencies

### Third-Party Services

**Email Service (SMTP):**
- Configurable SMTP server (credentials via environment variables)
- Required variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`

**Database:**
- Neon Serverless PostgreSQL (via `@neondatabase/serverless`)
- Connection string: `DATABASE_URL` environment variable
- WebSocket-based driver for serverless compatibility

### Core Libraries

**UI & Styling:**
- Tailwind CSS v3 with custom design tokens
- Radix UI primitives (20+ component packages)
- class-variance-authority for component variants
- Lucide React for iconography

**Data & Forms:**
- Drizzle ORM v0.39 with Zod schema validation
- React Hook Form with Zod resolvers
- date-fns for date manipulation

**Development Tools:**
- Vite plugins: runtime error overlay, cartographer (Replit integration)
- tsx for TypeScript execution
- esbuild for server bundling

### API Integration Points

**Tee Time Availability Search:**
- User selects location (geolocation, manual city selection, or "All Costa del Sol")
- Sets search criteria: date, number of players, time window (e.g., 10:00-12:00)
- Backend queries Golfmanager API for real-time availability (if API key configured)
- Falls back to mock data (3-5 slots per course) if Golfmanager API not configured
- Results displayed as clickable time slot cards with green fees sorted by distance
- User clicks specific time → Booking modal pre-fills with exact slot data

**Golfmanager API Integration:**
- **Status**: Production-ready integration implemented
- **Authentication**: API key via header (`key: YOUR_API_KEY`)
- **Base URL**: https://eu.golfmanager.com/api
- **Important Discovery**: iMaster.golf and teeone.golf use the same Golfmanager API!
- **How to get API key**:
  1. Download authorization form: https://www.golfmanager.com/multicourse-api-authorization/
  2. Email completed form to dsillari@golfmanager.com (Daniel Sillari - API Integration Manager)
  3. Request "Consumer API" access for tee-time availability
  4. Cost: €25/month per golf course tenant
- **Environment Variable**: `GOLFMANAGER_API_KEY`
- **Integrated Courses (16 with provider links ready)**:
  - La Reserva Club Sotogrande (tenant: lareserva)
  - Finca Cortesín Golf Club (tenant: fincacortesin)
  - Real Club de Golf Sotogrande (tenant: rcgsotogrande)
  - San Roque Club (tenant: sanroque)
  - El Paraíso Golf Club (tenant: paraiso) - via iMaster/teeone
  - Marbella Golf & Country Club (tenant: marbella) - via iMaster/teeone
  - Estepona Golf (tenant: estepona) - via iMaster/teeone
  - Atalaya Golf & Country Club (tenant: atalaya) - via iMaster/teeone
  - Santa Clara Golf Marbella (tenant: santaclara) - via iMaster/teeone
  - Los Naranjos Golf Club (tenant: naranjos) - via iMaster/teeone
  - Mijas Golf (tenant: mijas) - via iMaster/teeone
  - Torrequebrada Golf (tenant: torrequebrada) - via iMaster/teeone
  - **Real Club Valderrama (tenant: valderrama)** - Premium €500, #1 Continental Europe, 1997 Ryder Cup host
  - **Flamingos Golf / Villa Padierna (tenant: villapadierna)** - Luxury resort with 3 courses (Flamingos, Alferini, Tramores)
  - **Los Arqueros Golf (tenant: arqueros)** - Seve Ballesteros design
  - **La Quinta Golf (tenant: quinta)** - 27 holes, Manuel Piñero design

**Tee Time Provider Integration (Future):**
- Provider type system supports:
  - Web scraping (SCRAPER type) - For courses without APIs
  - REST APIs (API type) - For Golfmanager, iMasterGolf, etc.
  - Direct booking links (DEEP_LINK_ONLY type) - Deep links to club sites
- Configuration stored as JSON in database
- Adapter pattern ready for multiple provider implementations

**Geolocation Services:**
- Browser-native Geolocation API (no external service required)
- Costa del Sol city coordinates hardcoded in application