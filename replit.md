# Marbella Golf Times

## Overview

Marbella Golf Times is a boutique-premium golf tee-time service for the Costa del Sol, Spain. It provides real tee-time availability across over 40 premier courses, curated course selection, geolocation search, and a complete booking flow with concierge-quality service. The platform aims to offer a modern, efficient, and user-friendly experience for booking golf tee times, enhancing the golf tourism market in the region.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18, TypeScript, and Vite. It uses Wouter for routing and `shadcn/ui` (Radix UI + Tailwind CSS) for a compact and responsive user interface, inspired by `TeeTimesBooking.com`. Typography utilizes Inter and Playfair Display. State management relies on TanStack Query for server state and local React state for UI. Key features include a Golfee-inspired course listing with inline tee times, list/map view toggle (Leaflet), advanced sorting and filtering (date, players, time, holes, course name), and comprehensive CourseDetail pages with responsive tabs and booking integration. User authentication is handled via Login and Signup pages with i18n support.

The Profile page offers advanced booking management, including "Upcoming" and "Past" booking tabs, an option to cancel bookings (with a 24-hour rule validation), and a "Book Again" feature for rebooking past tee times.

An Admin dashboard provides tools for managing bookings, courses, images, affiliate emails, and an **Inbox** for course email conversations. The Courses tab displays all courses in a table layout with name, location, image thumbnail, kickback percentage, and a unified "Edit Course" button. The Edit Course dialog combines image management (upload/URL/delete) and commission percentage editing in a single interface with proper cache synchronization. The platform supports full internationalization (i18n) across 5 languages (English, Spanish, Danish, Swedish, Russian) with a language switcher.

The **Admin Inbox** tab provides a complete email thread management system for course communications. Features include:
- Thread list with status filters (All, Unanswered, Open, Replied, Closed, Archived)
- Visual indicators for unread threads and unanswered messages (red badge showing count)
- Conversation view showing full email thread history
- Reply functionality with inline compose
- Thread status management (archive, close, reopen)
- Course linking to associate threads with specific golf courses
- Alert settings dialog for configuring email notifications on unanswered messages
- Red notification badge in header showing unanswered email count (visible to admins only)

A comprehensive reviews and social proof system allows authenticated users to submit course reviews with star ratings and optional photo uploads. "Top Rated" badges are displayed for highly-rated courses, and a testimonials carousel showcases customer feedback.

The Admin dashboard includes an Analytics Dashboard for revenue metrics, booking trends (daily, weekly, monthly), and popular courses, visualized with Recharts. It also features a User Management system for full CRUD operations on user accounts with role-based access control, the ability to view a user's booking history, and cascade delete functionality that safely removes users along with their reviews, testimonials, and blog posts while preserving booking history.

A Commission & ROI Tracking System in the Admin interface monitors affiliate earnings based on course kickback percentages (editable via unified Edit Course dialog) and tracks advertising campaign performance, calculating ROI. Course commission percentages are stored in the database and persist correctly with optimistic UI updates for instant feedback.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript (ESM modules), providing RESTful APIs under the `/api` prefix with JSON handling and error management. Data is stored using Drizzle ORM with PostgreSQL. Core API routes manage golf courses, tee time searches (including a `holes` filter), booking requests, and affiliate email campaigns. An admin endpoint allows secure course image updates. The database is automatically seeded with 43 Costa del Sol golf courses on startup.

### Data Storage Solutions

The Drizzle ORM schema includes tables for `users`, `sessions`, `golf_courses`, `tee_time_providers`, `course_provider_links`, `booking_requests`, `affiliate_emails`, `inbound_email_threads`, and `inbound_email_messages`. `users` store `email`, `passwordHash`, `firstName`, `lastName`, `phoneNumber`, and `stripeCustomerId`. `golf_courses` have a unique `imageUrl` and a `kickbackPercent` field. `booking_requests` link to `userId` and include an `estimatedPrice` for revenue tracking. The inbox system uses `inbound_email_threads` to track conversation threads (with status, courseId link, and requiresResponse flags) and `inbound_email_messages` for individual emails with direction (IN/OUT) tracking. UUIDs are used for primary keys.

### Authentication and Authorization

Custom email/password authentication is implemented with bcrypt hashing and PostgreSQL-backed sessions using `connect-pg-simple`. Users can sign up or log in via an `AuthDialog` or dedicated pages. Authenticated users see a profile menu and benefit from auto-filled booking forms. Sessions are stored in PostgreSQL with a 7-day TTL, httpOnly cookies, and a secure flag in production. `isAuthenticated` middleware protects admin and user profile routes, while public endpoints remain accessible. Admin routes also utilize `isAdmin` middleware for role-based access control.

### External API (AI CEO Integration)

A complete external REST API is available at `/api/v1/external/*` for integration with AI CEO and other trusted systems. Features:
- **API Key Authentication**: Secure SHA-256 hashed keys managed via Admin UI ("API Keys" tab). Keys use header-based auth (`X-API-Key`).
- **Scope-based Access Control**: Five permission scopes (`read:courses`, `read:bookings`, `write:bookings`, `read:analytics`, `read:users`) allow fine-grained access.
- **Available Endpoints**:
  - `GET /api/v1/external/courses` - List all courses with images and management tool info
  - `GET /api/v1/external/courses/:id` - Single course with reviews and management tool info
  - `GET /api/v1/external/bookings` - List all bookings (supports status/date filters)
  - `GET /api/v1/external/bookings/:id` - Single booking details
  - `POST /api/v1/external/bookings` - Create new booking
  - `PATCH /api/v1/external/bookings/:id/status` - Update booking status
  - `GET /api/v1/external/slots` - Search available tee times
  - `GET /api/v1/external/analytics` - Full revenue and ROI data (trusted integrations only)
  - `GET /api/v1/external/users` - User list (safe fields only)
- **Management Tool Field**: Course endpoints include `managementTool` field with values: `golfmanager_v1`, `golfmanager_v3`, `teeone`, or `null` (for courses without API integration).
- **Security Notes**: The `read:analytics` scope exposes sensitive business data (revenue, ROI, commissions). Only grant this scope to trusted internal systems.
- **Admin Management**: API keys can be created, viewed, and revoked from the Admin dashboard's "API Keys" tab. Raw keys are displayed only once at creation.

### Email System

The email system uses Nodemailer with SMTP transport for sending bulk affiliate proposals and individual course outreach, supporting templating and environment-based configuration.

### Geolocation System

Client-side geolocation uses the Browser Geolocation API for current location detection, falling back to manual city selection, and enabling course sorting by proximity using the Haversine formula.

## External Dependencies

### Third-Party Services

-   **SMTP Email Service**: Configurable via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`).
-   **Neon Serverless PostgreSQL**: Database connection via `@neondatabase/serverless` using `DATABASE_URL`.

### Core Libraries

-   **UI & Styling**: Tailwind CSS, Radix UI primitives, `class-variance-authority`, Lucide React.
-   **Data & Forms**: Drizzle ORM, Zod, React Hook Form, `date-fns`.
-   **Development Tools**: Vite, `tsx`, `esbuild`.

### API Integration Points

-   **Golfmanager Integration**: ⚠️ MOCK MODE - Golfmanager API V1/V3 code is implemented and ready for production (November 25, 2025). System now supports **per-tenant authentication** with individual credentials stored per course in the database. Currently in MOCK mode showing simulated tee times.
    -   **Confirmed Golfmanager V1 courses (12)**: Finca Cortesín, La Cala Resort, La Reserva Club Sotogrande, Valle Romano, San Roque Club, El Higueral Golf, Lauro Golf, Guadalhorce Club de Golf, Marbella Club Golf Resort, Alhaurin Golf Country Club, Benalmádena Golf, Cabopino Golf Marbella
    -   **Confirmed Golfmanager V3 courses (2)**: Real Club de Golf Sotogrande, Greenlife Golf Marbella
    -   **To activate real-time data**: Add credentials via Admin UI (Edit Course dialog) or as Secrets (e.g., `GM_FINCACORTESIN_USER`, `GM_FINCACORTESIN_PASS`). System auto-detects and switches to PRODUCTION mode for courses with valid credentials.
-   **TeeOne Golf System**: Separate booking platform (teeone.golf - Madrid-based) used by 12 Costa del Sol courses (Marbella Golf & CC, Santa Clara, Los Naranjos, La Quinta, Los Arqueros, Atalaya, Mijas, Torrequebrada, Villa Padierna/Flamingos, Estepona Golf, El Paraíso, Valderrama). This is a DISTINCT system from Golfmanager and requires separate API integration.
-   **Tee Time Provider Integration**: Flexible system supporting REST APIs (`API`), direct booking links (`DEEP_LINK`), and web scraping (`SCRAPER`).
-   **Golfmanager Operating Modes**: System supports three modes: **MOCK** (simulated data - current), **DEMO** (demo tenant with test data - credentials incompatible), and **PRODUCTION** (real-time API with course-specific tenant credentials - awaiting access).
-   **Open-Meteo API**: For real-time weather data on course detail pages (no API key required).
-   **Browser Geolocation API**: Used for client-side geolocation services.