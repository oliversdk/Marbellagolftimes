# Marbella Golf Times

## Overview

Marbella Golf Times is a boutique-premium golf tee-time service for the Costa del Sol, Spain. It provides real tee-time availability across over 40 premier courses, curated course selection, geolocation search, and a complete booking flow with concierge-quality service. The platform aims to offer a modern, efficient, and user-friendly experience for booking golf tee times, enhancing the golf tourism market in the region.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18, TypeScript, and Vite. It uses Wouter for routing and `shadcn/ui` (Radix UI + Tailwind CSS) for a compact and responsive user interface, inspired by `TeeTimesBooking.com`. Typography utilizes Inter and Playfair Display. State management relies on TanStack Query for server state and local React state for UI. Key features include a Golfee-inspired course listing with inline tee times, list/map view toggle (Leaflet), advanced sorting and filtering (date, players, time, holes, course name), and comprehensive CourseDetail pages with responsive tabs and booking integration. User authentication is handled via Login and Signup pages with i18n support.

The Profile page offers advanced booking management, including "Upcoming" and "Past" booking tabs, an option to cancel bookings (with a 24-hour rule validation), and a "Book Again" feature for rebooking past tee times.

An Admin dashboard provides tools for managing bookings, courses, images, and affiliate emails. The Courses tab displays all courses in a table layout with name, location, image thumbnail, kickback percentage, and a unified "Edit Course" button. The Edit Course dialog combines image management (upload/URL/delete) and commission percentage editing in a single interface with proper cache synchronization. The platform supports full internationalization (i18n) across 5 languages (English, Spanish, Danish, Swedish, Russian) with a language switcher.

A comprehensive reviews and social proof system allows authenticated users to submit course reviews with star ratings and optional photo uploads. "Top Rated" badges are displayed for highly-rated courses, and a testimonials carousel showcases customer feedback.

The Admin dashboard includes an Analytics Dashboard for revenue metrics, booking trends (daily, weekly, monthly), and popular courses, visualized with Recharts. It also features a User Management system for full CRUD operations on user accounts with role-based access control, the ability to view a user's booking history, and cascade delete functionality that safely removes users along with their reviews, testimonials, and blog posts while preserving booking history.

A Commission & ROI Tracking System in the Admin interface monitors affiliate earnings based on course kickback percentages (editable via unified Edit Course dialog) and tracks advertising campaign performance, calculating ROI. Course commission percentages are stored in the database and persist correctly with optimistic UI updates for instant feedback.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript (ESM modules), providing RESTful APIs under the `/api` prefix with JSON handling and error management. Data is stored using Drizzle ORM with PostgreSQL. Core API routes manage golf courses, tee time searches (including a `holes` filter), booking requests, and affiliate email campaigns. An admin endpoint allows secure course image updates. The database is automatically seeded with 43 Costa del Sol golf courses on startup.

### Data Storage Solutions

The Drizzle ORM schema includes tables for `users`, `sessions`, `golf_courses`, `tee_time_providers`, `course_provider_links`, `booking_requests`, and `affiliate_emails`. `users` store `email`, `passwordHash`, `firstName`, `lastName`, `phoneNumber`, and `stripeCustomerId`. `golf_courses` have a unique `imageUrl` and a `kickbackPercent` field. `booking_requests` link to `userId` and include an `estimatedPrice` for revenue tracking. UUIDs are used for primary keys.

### Authentication and Authorization

Custom email/password authentication is implemented with bcrypt hashing and PostgreSQL-backed sessions using `connect-pg-simple`. Users can sign up or log in via an `AuthDialog` or dedicated pages. Authenticated users see a profile menu and benefit from auto-filled booking forms. Sessions are stored in PostgreSQL with a 7-day TTL, httpOnly cookies, and a secure flag in production. `isAuthenticated` middleware protects admin and user profile routes, while public endpoints remain accessible. Admin routes also utilize `isAdmin` middleware for role-based access control.

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

-   **TeeOne/Golfmanager Integration**: 16+ premium courses use TeeOne booking system (Golfmanager backend) displayed as direct booking links (`DEEP_LINK` type) to TeeOne's frontend at `https://open.teeone.golf/en/{tenant}/disponibilidad`. Notable courses include Marbella Golf, Santa Clara, Finca Cortesín, Real Club Valderrama, Los Naranjos, La Quinta, Los Arqueros, Estepona Golf, Torrequebrada, La Reserva Sotogrande, and Real Club de Golf Sotogrande. When Golfmanager API credentials become available, this can be upgraded to show real-time availability directly in the platform.
-   **Tee Time Provider Integration**: Flexible system supporting REST APIs (`API`), direct booking links (`DEEP_LINK`), and web scraping (`SCRAPER`).
-   **Golfmanager Operating Modes**: System supports DEMO mode (no API key, fallback to direct links), MOCK mode (simulated data for testing), and PRODUCTION mode (real-time API when credentials available).
-   **Open-Meteo API**: For real-time weather data on course detail pages (no API key required).
-   **Browser Geolocation API**: Used for client-side geolocation services.