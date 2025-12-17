# Marbella Golf Times

## Overview

Marbella Golf Times is a boutique-premium golf tee-time service for the Costa del Sol, Spain. It provides real tee-time availability across over 40 premier courses, curated course selection, geolocation search, and a complete booking flow with concierge-quality service. The platform aims to offer a modern, efficient, and user-friendly experience for booking golf tee times, enhancing the golf tourism market in the region. The project also has ambitions to integrate AI for enhanced contract processing and an external API for AI CEO integration, positioning itself as a leader in golf tourism technology.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend uses React 18, TypeScript, Vite, Wouter for routing, and `shadcn/ui` (Radix UI + Tailwind CSS) for a responsive UI. State management uses TanStack Query and local React state. Key features include a Golfee-inspired course listing with inline tee times, list/map view toggle (Leaflet), advanced sorting and filtering, and comprehensive CourseDetail pages. User authentication includes Login/Signup with i18n support. The Profile page offers advanced booking management (Upcoming/Past bookings, cancellation with Zest API integration, "Book Again"). A **Multi-Search** feature at `/search` allows users to select multiple courses and date ranges (up to 7 days), searching all combinations in parallel with results grouped by facility.

An Admin dashboard provides tools for managing bookings, courses, images, affiliate emails, and an **Inbox** for course email conversations with thread management, status filters, and reply functionality. It also includes a comprehensive reviews and social proof system, an Analytics Dashboard (revenue, booking trends, popular courses) visualized with Recharts, and a User Management system with full CRUD and role-based access control. A Commission & ROI Tracking System monitors affiliate earnings and campaign performance.

The **AI Contract Processing** feature leverages OpenAI GPT-4o and unpdf for automated extraction of golf course contract data, including kickback rates, package types, time restrictions, group discounts, seasonal rates, and contact information. This data is used to display customer package selections in the booking modal.

### Backend

The backend is built with Node.js and Express in TypeScript, providing RESTful APIs with JSON handling and error management. Drizzle ORM with PostgreSQL is used for data storage. Core API routes manage golf courses, tee time searches, booking requests, and affiliate email campaigns. The database is automatically seeded with 43 Costa del Sol golf courses.

### Data Storage

The Drizzle ORM schema includes tables for `users`, `sessions`, `golf_courses`, `tee_time_providers`, `course_provider_links`, `booking_requests`, `affiliate_emails`, `inbound_email_threads`, and `inbound_email_messages`. `golf_courses` include `imageUrl` and `kickbackPercent`. UUIDs are used for primary keys.

### Authentication and Authorization

Custom email/password authentication uses bcrypt hashing and PostgreSQL-backed sessions. `isAuthenticated` middleware protects user and admin routes, while `isAdmin` middleware enforces role-based access control for admin functionalities.

### External API (AI CEO Integration)

A secure external REST API (`/api/v1/external/*`) is available for integration with AI CEO and other trusted systems. It features API Key Authentication with SHA-256 hashed keys and scope-based access control (`read:courses`, `read:bookings`, `write:bookings`, `read:analytics`, `read:users`). Endpoints exist for courses, bookings, available slots, analytics, and users.

### OnTee-inspired Booking API (TeeOne Integration)

A complete booking flow API for TeeOne golf courses is implemented, supporting real-time tee time retrieval, order creation with 15-minute holds, and booking confirmation. The flow involves calling `/bookings/available`, then `/orders/items`, and finally `/bookings/confirm` after payment.

### Email System

Nodemailer with SMTP transport is used for sending bulk affiliate proposals and individual course outreach, supporting templating.

### Geolocation System

Client-side geolocation uses the Browser Geolocation API for proximity-based course sorting, with a fallback to manual city selection.

## External Dependencies

### Third-Party Services

-   **SMTP Email Service**: Configurable via environment variables.
-   **Neon Serverless PostgreSQL**: Database connection.
-   **OpenAI GPT-4o**: Used for AI Contract Processing.
-   **unpdf**: Used for PDF data extraction in AI Contract Processing.

### Core Libraries

-   **UI & Styling**: Tailwind CSS, Radix UI primitives, `class-variance-authority`, Lucide React.
-   **Data & Forms**: Drizzle ORM, Zod, React Hook Form, `date-fns`.
-   **Development Tools**: Vite, `tsx`, `esbuild`.

### API Integration Points

-   **Golfmanager Integration**: Supports Golfmanager API V1/V3 for 14 courses (e.g., Finca Cortesín, La Cala Resort). Features per-tenant authentication with **course-specific credentials stored in the database** (`golfmanagerV1User`, `golfmanagerV1Password` for V1, `golfmanagerUser`, `golfmanagerPassword` for V3). Admin can manage credentials via Courses → Credentials tab with copy-to-clipboard buttons. Alhaurin Golf is LIVE with real tee times and packages.
-   **TeeOne Golf System**: Integrates with TeeOne API for 12 courses (e.g., El Paraíso, Marbella Golf & CC). Features per-tenant authentication and operates in MOCK mode, with production readiness awaiting credentials.
-   **Zest Golf Integration**: Supports Zest Golf API for real-time tee times, bulk booking (multiple tee times in one request), and cancellation with policy enforcement. Features `POST /api/zest/bookings/bulk` for multi-booking requests returning groupId.
-   **Tee Time Provider Integration**: Flexible system supporting REST APIs, direct booking links, and web scraping.
-   **Open-Meteo API**: Provides real-time weather data for course detail pages.
-   **Browser Geolocation API**: Used for client-side location services.
-   **Stripe Payment Integration**: Secure payment processing with server-side price validation.

### Stripe Payment Integration

The platform integrates with Stripe Checkout for secure payment processing:

-   **Server-Side Price Cache**: Tee time prices are cached server-side when fetched from APIs (Zest, TeeOne) or generated (mock data). The cache uses a Map with 30-minute expiry and prevents client-side price manipulation.
-   **Secure Checkout Flow**: 
    1. User views tee times → prices cached server-side
    2. User selects slot and add-ons → frontend sends only IDs, no prices
    3. Server retrieves authoritative price from cache
    4. If cache miss/expired → checkout fails (no fallback to client values)
    5. Add-ons validated against database pricing
    6. Stripe Checkout session created with server-computed amounts
-   **Add-ons System**: Dynamic add-ons (buggy, clubs, trolley) stored in database with per-player or per-buggy pricing
-   **Payment Confirmation**: BookingSuccess page displays only confirmed database booking data
-   **Database Fields**: `paymentStatus`, `stripeSessionId`, `totalAmountCents`, `addOnsJson` in bookingRequests table

### Recent Improvements (December 2024)

-   **Smart Add-on Logic**: PackageSelectionDialog implements intelligent add-on handling:
    - Buggy and trolley are mutually exclusive (transport conflict group)
    - When package includes buggy, buggy add-ons are hidden and info banner shown
    - Trolley add-ons show "Buggy already selected" conflict message when buggy is in cart
    - Club Rental remains independently selectable
    - Quantity-based selection with +/- buttons for each add-on
-   **Add-ons in Multi-Search Response**: The `/api/teetimes/multi-search` endpoint now includes add-ons from database (`storage.getAddOnsByCourseId()`) for all providers (Zest and Golfmanager)
-   **Package Deduplication**: Enhanced deduplication ensures discounted variants (Early Bird, Twilight, or seasonal like "invierno/verano") supersede their regular equivalents. When a time-restricted package is available, the regular version is hidden. Supports both Spanish and English seasonal keywords.
-   **Player Name Input**: Golfmanager-style booking flow requires player names after package selection (minimum 2 characters), with per-field validation and inline error feedback
-   **Commission Sync Service**: Centralized `commissionSync.ts` service ensures kickback percentages stay synchronized across `golf_courses.kickbackPercent`, `course_onboarding.agreedCommission`, and `courseRatePeriods`. Automatically upserts onboarding rows when missing.
-   **Persistent Booking Holds**: `bookingHolds` table stores tee time holds in database with TTL, including full order payload as JSON. Survives server restarts with unique constraint on (sessionId, courseId, teeTime).
-   **API Retry Logic**: Both `zestGolf.ts` and `golfmanager.ts` services now include retry logic with exponential backoff for transient network errors (ECONNRESET, ETIMEDOUT, 5xx responses). 30-second timeout configured.
-   **Database Performance Indexes**: Added composite indexes for `courseRatePeriods(courseId, seasonLabel)`, `zestPricingData(courseId, zestFacilityId)`, and `bookingRequests(courseId, teeTime)`.
-   **Loading States**: Admin dashboard uses Skeleton components for loading states on bookings, users, follow-ups, and course management sections.
-   **Image Serving Fallback**: Static route serves `/generated_images` from both `client/public/generated_images` and `attached_assets/generated_images` as fallback
-   **Contract-Driven Pricing (December 2024)**: Price matching now correctly uses contract rack rates from `courseRatePeriods` table instead of TTOO+20% fallback markup. Key fixes:
    - Rate period date filtering matches tee time dates to applicable season periods (startDate/endDate)
    - Boolean flags (isTwilight, isEarlyBird, includesLunch) correctly compared as strings ("true"/"false") matching DB text type
    - Package type matching: Twilight packages match `isTwilight=true` periods, Lunch matches `includesLunch=true`, Regular matches no special flags
    - Winter 2025 rates populated: Twilight €62, Regular €72, Lunch €95 for Alhaurin Golf