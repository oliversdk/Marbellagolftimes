# Marbella Golf Times

## Overview

Marbella Golf Times is a boutique tee-time booking service for the Costa del Sol, Spain. It provides real-time tee-time availability across over 40 premier golf courses, offering a curated selection, geolocation search, and a complete booking flow with concierge-quality service. The platform aims to modernize golf tourism booking, with future ambitions for AI integration in contract processing and an external API for AI CEO integration, positioning itself as a leader in the golf tourism technology market.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, Vite, Wouter for routing, and `shadcn/ui` (Radix UI + Tailwind CSS) for a responsive UI. State management utilizes TanStack Query and local React state. Key features include Golfee-inspired course listings with inline tee times, a list/map view toggle, advanced sorting/filtering, comprehensive `CourseDetail` pages, and multi-search functionality. User authentication supports Login/Signup with i18n. An Admin dashboard provides tools for booking, course, image, and affiliate email management, including an Inbox for course email conversations, a reviews system, an Analytics Dashboard (Recharts), and User Management with RBAC. A Commission & ROI Tracking System is also included. The AI Contract Processing feature uses OpenAI GPT-4o and unpdf for automated extraction of golf course contract data.

### Backend
The backend is built with Node.js and Express in TypeScript, providing RESTful APIs. Drizzle ORM with PostgreSQL is used for data storage, automatically seeded with 43 Costa del Sol golf courses. Core API routes manage golf courses, tee time searches, booking requests, and affiliate email campaigns. Custom email/password authentication uses bcrypt and PostgreSQL-backed sessions, with `isAuthenticated` and `isAdmin` middleware for authorization.

### Data Storage
The Drizzle ORM schema includes tables for `users`, `sessions`, `golf_courses`, `tee_time_providers`, `course_provider_links`, `booking_requests`, `affiliate_emails`, `inbound_email_threads`, and `inbound_email_messages`. `golf_courses` includes `imageUrl` and `kickbackPercent`. UUIDs are used for primary keys.

### External API v1 (AI CEO Integration)
A secure external REST API (`/api/v1/external/*`) provides comprehensive business data for integration with AI CEO and other trusted systems. It uses API Key Authentication with SHA-256 hashed keys and granular scopes (`read:courses`, `read:bookings`, `write:bookings`, `read:analytics`, `read:users`). Endpoints provide access to courses, bookings, analytics (revenue, bookings, customers, marketing data), and user information. UTM tracking data (`utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`) is recorded for bookings.

### Stripe Payment Integration
The platform integrates Stripe Checkout for secure payments. It employs a server-side price cache with a 30-minute expiry to prevent client-side price manipulation. The checkout flow validates add-ons and ensures server-computed amounts are used to create Stripe Checkout sessions. `paymentStatus`, `stripeSessionId`, `totalAmountCents`, and `addOnsJson` are stored in the `bookingRequests` table. Add-ons are dynamic and stored in the database, with intelligent logic for mutual exclusivity (e.g., buggy vs. trolley) and package inclusions.

### Optimized Image CDN
A responsive image system converts original PNGs to WebP in desktop, mobile, and thumbnail sizes. Images are served from a CDN route (`/cdn/images/:imagePath`) with aggressive caching. An `OptimizedImage` component auto-detects device size to serve the appropriate image, significantly reducing image payload.

## External Dependencies

### Third-Party Services
-   **SMTP Email Service**: Configurable via environment variables.
-   **Neon Serverless PostgreSQL**: Database connection.
-   **OpenAI GPT-4o**: For AI Contract Processing.
-   **unpdf**: For PDF data extraction in AI Contract Processing.

### Core Libraries
-   **UI & Styling**: Tailwind CSS, Radix UI primitives, `class-variance-authority`, Lucide React.
-   **Data & Forms**: Drizzle ORM, Zod, React Hook Form, `date-fns`.
-   **Development Tools**: Vite, `tsx`, `esbuild`.

### API Integration Points
-   **Golfmanager Integration**: Supports Golfmanager API V1/V3 for 14 courses, with course-specific credentials stored in the database.
-   **TeeOne Golf System**: Integrates with TeeOne Online Booking Engine API v1.12 for 12 courses, using token-based authentication and a full prebooking/confirmation flow.
-   **Zest Golf Integration**: Supports Zest Golf API for real-time tee times, bulk booking, and cancellation.
-   **Tee Time Provider Integration**: Flexible system supporting REST APIs, direct booking links, and web scraping.
-   **Open-Meteo API**: Provides real-time weather data.
-   **Browser Geolocation API**: Used for client-side location services.