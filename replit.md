# Fridas Golf

## Overview

Fridas Golf is a boutique-premium golf tee-time service for the Costa del Sol, Spain. It offers real tee-time availability checking across 40+ premier courses from Sotogrande to Málaga, a curated course selection, geolocation-based search, and a complete booking flow with personal concierge-quality service. The platform aims to provide a modern, efficient, and user-friendly experience for booking golf tee times.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, using Vite for fast development and production builds. Wouter is used for client-side routing with pages for Home, CourseDetail (`/course/:id`), and Admin. The UI leverages `shadcn/ui` (Radix UI + Tailwind CSS) for components, inspired by `TeeTimesBooking.com` for a compact layout. Typography includes Inter (primary) and Playfair Display (accent). State management is handled by TanStack Query for server state and local React state for UI interactions. Key features include a Golfee-inspired course listing with inline tee times, a list/map view toggle (Leaflet), 4-way sorting, and smart filtering (date, players, time, holes, course name). The CourseDetail page provides breadcrumb navigation, responsive tabs (overview, facilities, gallery, reviews), and booking integration. An Admin dashboard provides tools for managing bookings, courses, images, and affiliate emails. The platform supports full internationalization (i18n) with 5 languages (English, Spanish, Danish, Swedish, Russian), including locale-aware placeholders, proper pluralization, and a Globe-icon language switcher.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript, using ESM modules. It provides RESTful APIs under the `/api` prefix, handling JSON requests/responses and error handling. Data storage uses Drizzle ORM with PostgreSQL for both development and production environments via the `DatabaseStorage` class. The core API routes manage golf courses, tee time searches (including a functional `holes` filter), booking requests, and affiliate email campaigns. An admin endpoint allows updating course images with validation and secure file deletion. Database seeding runs automatically on startup with 43 Costa del Sol golf courses.

### Data Storage Solutions

The schema, defined using Drizzle ORM for PostgreSQL, includes tables for `golf_courses`, `tee_time_providers`, `course_provider_links`, `booking_requests`, and `affiliate_emails`. Each golf course has a unique `imageUrl`. UUIDs are used for primary keys.

### Authentication and Authorization

The application uses Replit Auth (OpenID Connect) for authentication with sessions stored in PostgreSQL. Admin routes (bookings management, course editing, affiliate emails) are protected with the `isAuthenticated` middleware, while public endpoints (course browsing, tee-time search, booking requests) remain accessible without authentication. The auth system includes automatic token refresh, return path preservation for post-login redirects, and conditional secure cookie flags for production deployment.

### Email System

The email system uses Nodemailer with SMTP transport for sending bulk affiliate partnership proposals and individual course outreach. It supports environment-based configuration and uses templates with placeholders.

### Geolocation System

Client-side geolocation uses the Browser Geolocation API, with Haversine formula for distance calculations. It provides current location detection, fallback to manual city selection, and course sorting by proximity.

## External Dependencies

### Third-Party Services

-   **Email Service (SMTP)**: Configurable via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`).
-   **Database**: Neon Serverless PostgreSQL, connected via `@neondatabase/serverless` using the `DATABASE_URL` environment variable.
-   **Authentication**: Replit Auth (OpenID Connect) using `ISSUER_URL` and `REPL_ID` environment variables, with `SESSION_SECRET` for session encryption.

### Core Libraries

-   **UI & Styling**: Tailwind CSS, Radix UI primitives, `class-variance-authority`, Lucide React.
-   **Data & Forms**: Drizzle ORM, Zod, React Hook Form, `date-fns`.
-   **Development Tools**: Vite, `tsx`, `esbuild`.

### API Integration Points

-   **Tee Time Availability Search**: Integrates with external APIs to fetch real-time tee times based on user criteria.
-   **Golfmanager API**: Production-ready integration for real-time tee-time availability, with support for `DEMO` (falls back to mock), `PRODUCTION`, and `MOCK` modes. Authentication uses an API key. Integrated with 16 courses, including premium ones like Real Club Valderrama.
-   **Direct Booking Integration (DEEP_LINK_ONLY)**: Active for 4 courses (e.g., Club de Golf La Cañada), allowing users to book directly on the club's website. These courses display a "Direct" badge.
-   **Tee Time Provider Integration**: A flexible system supporting web scraping (`SCRAPER`), REST APIs (`API`), and direct booking links (`DEEP_LINK_ONLY`) for various providers.
-   **Weather Integration (Open-Meteo)**: Real-time weather data displayed on course detail pages using Open-Meteo's free API. Shows temperature, conditions, wind speed, and humidity. No API key required - fully functional out of the box.
-   **Geolocation Services**: Utilizes the browser's native Geolocation API; no external service required.