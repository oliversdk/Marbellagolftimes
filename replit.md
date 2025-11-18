# Fridas Golf

## Overview

Fridas Golf is a boutique-premium golf tee-time service for the Costa del Sol, Spain. It offers real tee-time availability checking across 40+ premier courses from Sotogrande to Málaga, a curated course selection, geolocation-based search, and a complete booking flow with personal concierge-quality service. The platform aims to provide a modern, efficient, and user-friendly experience for booking golf tee times.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, using Vite for fast development and production builds. Wouter is used for client-side routing with pages for Home, CourseDetail (`/course/:id`), Login (`/login`), Signup (`/signup`), Profile (`/profile`), and Admin. The UI leverages `shadcn/ui` (Radix UI + Tailwind CSS) for components, inspired by `TeeTimesBooking.com` for a compact layout. Typography includes Inter (primary) and Playfair Display (accent). State management is handled by TanStack Query for server state and local React state for UI interactions. Key features include a Golfee-inspired course listing with inline tee times, a list/map view toggle (Leaflet), 4-way sorting, and smart filtering (date, players, time, holes, course name). The CourseDetail page provides breadcrumb navigation, responsive tabs (overview, facilities, gallery, reviews), and booking integration. The Login and Signup pages provide email/password authentication forms with validation and i18n support. The Profile page displays user information and complete booking history with course names, tee times, player counts, and status badges. An Admin dashboard provides tools for managing bookings, courses, images, and affiliate emails. The platform supports full internationalization (i18n) with 5 languages (English, Spanish, Danish, Swedish, Russian), including locale-aware placeholders, proper pluralization, auth success messages, and a Globe-icon language switcher.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript, using ESM modules. It provides RESTful APIs under the `/api` prefix, handling JSON requests/responses and error handling. Data storage uses Drizzle ORM with PostgreSQL for both development and production environments via the `DatabaseStorage` class. The core API routes manage golf courses, tee time searches (including a functional `holes` filter), booking requests, and affiliate email campaigns. An admin endpoint allows updating course images with validation and secure file deletion. Database seeding runs automatically on startup with 43 Costa del Sol golf courses.

### Data Storage Solutions

The schema, defined using Drizzle ORM for PostgreSQL, includes tables for `users`, `sessions`, `golf_courses`, `tee_time_providers`, `course_provider_links`, `booking_requests`, and `affiliate_emails`. The `users` table stores `email` (unique), `passwordHash` (bcrypt), `firstName`, `lastName`, `phoneNumber` (optional), and `stripeCustomerId` (for future Stripe integration). Each golf course has a unique `imageUrl`. The `booking_requests` table includes a `userId` field (nullable foreign key) to link bookings to authenticated users. UUIDs are used for primary keys.

### Authentication and Authorization

The application uses custom email/password authentication with bcrypt password hashing (10 salt rounds) and PostgreSQL-backed sessions (via `connect-pg-simple`). Users can sign up or log in via the `AuthDialog` component (a popup dialog opened from Header buttons) or directly navigate to `/signup` and `/login` pages. The Header displays "Log In" and "Sign Up" buttons when unauthenticated, which open the AuthDialog popup with background images visible. When authenticated, the Header shows a user menu with Profile and Logout options. The AuthDialog uses CSS display toggling (not conditional rendering) to maintain both login and signup forms mounted simultaneously, ensuring react-hook-form field registrations remain intact. All form inputs have unique data-testid attributes prefixed by mode (e.g., `input-login-email`, `input-signup-first-name`). Sessions are stored in PostgreSQL with a 7-day TTL, httpOnly cookies, and secure flag enabled in production. Admin routes (bookings management, course editing, affiliate emails, user management) and user profile routes are protected with the `isAuthenticated` middleware (checking `req.session.userId`), while public endpoints (course browsing, tee-time search, booking requests) remain accessible without authentication. Authenticated users benefit from auto-filled booking forms (name and email pre-populated from session) and can view their complete booking history on the Profile page (`/profile`), which displays all bookings with course names, tee times, player counts, and status badges. All booking requests link to the authenticated user via `userId` foreign key.

#### Admin User Management

The Admin dashboard includes a comprehensive User Management system for viewing, editing, and deleting user accounts. The system provides full CRUD operations with role-based access control:

- **User List**: Displays all users in a table showing name, email, phone, role badge (Admin/User), and action buttons
- **Edit User**: Dialog form with validation for updating user information (first name, last name, email, phone)
- **Delete User**: Confirmation dialog showing complete user details (name, email, role) before deletion
- **Self-Protection**: Admins cannot edit or delete their own account (backend returns 403)
- **Duplicate Email Validation**: Backend validates email uniqueness and returns 409 if email already exists
- **API Endpoints**: 
  - `GET /api/admin/users` - Fetch all users
  - `PATCH /api/admin/users/:id` - Update user information
  - `DELETE /api/admin/users/:id` - Delete user account
- **Error Handling**: Frontend displays specific error messages for self-protection (403) and duplicate emails (409)
- **Cache Invalidation**: UI automatically updates after successful edit/delete operations

Note: All `apiRequest` calls throughout the application use the signature `apiRequest(url, method, data)`. Error responses include `status` and `statusCode` fields for proper client-side error handling.

### Email System

The email system uses Nodemailer with SMTP transport for sending bulk affiliate partnership proposals and individual course outreach. It supports environment-based configuration and uses templates with placeholders.

### Geolocation System

Client-side geolocation uses the Browser Geolocation API, with Haversine formula for distance calculations. It provides current location detection, fallback to manual city selection, and course sorting by proximity.

## External Dependencies

### Third-Party Services

-   **Email Service (SMTP)**: Configurable via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`).
-   **Database**: Neon Serverless PostgreSQL, connected via `@neondatabase/serverless` using the `DATABASE_URL` environment variable.
-   **Authentication**: Custom email/password system with bcrypt hashing. Sessions stored in PostgreSQL using `connect-pg-simple`. Requires `SESSION_SECRET` environment variable for session encryption.

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