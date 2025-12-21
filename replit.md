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

A secure external REST API (`/api/v1/external/*`) provides comprehensive business data for integration with AI CEO and other trusted systems.

#### Authentication & Scopes
- **API Key Authentication**: Bearer token in `Authorization` header, SHA-256 hashed keys
- **Scopes**: `read:courses`, `read:bookings`, `write:bookings`, `read:analytics`, `read:users`

#### Core Endpoints
- **GET /api/v1/external/courses** - Golf course data (scope: `read:courses`)
- **GET /api/v1/external/bookings** - Booking requests with filters (scope: `read:bookings`)
- **GET /api/v1/external/bookings/:id** - Single booking details
- **POST /api/v1/external/bookings** - Create booking (scope: `write:bookings`)
- **GET /api/v1/external/slots** - Available tee times (scope: `read:courses`)
- **GET /api/v1/external/users** - User list (scope: `read:users`)

#### Analytics Endpoints (scope: `read:analytics`)

**GET /api/v1/external/analytics** - Comprehensive business analytics:
- Revenue (total, by status, by course, by month)
- Bookings (counts, conversion rate, avg value)
- Customers (total, repeat rate, top customers)
- Financial KPIs (gross revenue, commission, projected monthly)
- Marketing summary (spend, ROAS, CPA, top channels)
- Profitability summary (gross profit, margin %, loss-making count)
- Accepts `from` and `to` date range query params

**GET /api/v1/external/marketing** - Full marketing analytics:
- Traffic (sessions, users, bounce rate, by channel, by day)
- Acquisition (channel mix, top campaigns, source/medium)
- Campaign performance (spend, revenue, ROAS, CPA per campaign)
- ROI (overall ROAS, CPA, LTV/CAC ratio, by channel)
- Marketing goals progress and alerts
- Accepts `from` and `to` date range query params

**GET /api/v1/external/profitability** - Profitability analysis for CEO AI:
- Summary: total revenue, cost, gross profit, profit margin %, loss count
- By product type: tee_time, buggy, clubs, trolley (revenue, cost, profit, margin)
- By course: per-course profitability with avg profit per booking
- Loss-making transactions: detailed breakdown with reasons
- Recommendations: focus areas, reduce focus items, price adjustments
- Accepts `from` and `to` date range query params

#### Data Model
- UTM tracking on bookings: `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`
- Add-ons include `costCents` for profit calculation
- Rate periods store `rackRate` (selling) and `netRate` (cost) for margin analysis

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