# Design Guidelines: Costa del Sol Golf Tee-Time Finder

## Design Approach
**Reference-Based**: Drawing inspiration from premium booking platforms (Booking.com structure + Airbnb card aesthetics + GolfNow golf-specific patterns) to create a trustworthy, efficient golf discovery and booking experience.

**Core Principle**: Blend the functionality of travel booking platforms with the aspirational, premium feel appropriate for golf enthusiasts.

---

## Typography System

**Font Families** (via Google Fonts):
- Primary: Inter (clean, modern sans-serif for UI and body text)
- Accent: Playfair Display (elegant serif for hero headlines and course names)

**Hierarchy**:
- Hero Headline: Playfair Display, 3.5rem (desktop) / 2.5rem (mobile), font-weight 700
- Section Headers: Inter, 2rem, font-weight 700
- Course Names: Playfair Display, 1.5rem, font-weight 600
- Body Text: Inter, 1rem, font-weight 400
- Small Text/Labels: Inter, 0.875rem, font-weight 500

---

## Layout System

**Spacing Units**: Consistently use Tailwind spacing: `2, 4, 6, 8, 12, 16, 20, 24, 32` (as in p-4, gap-8, my-12)

**Container Widths**:
- Full-width sections: `max-w-7xl mx-auto px-4`
- Content sections: `max-w-6xl mx-auto px-4`
- Forms/narrow content: `max-w-2xl mx-auto px-4`

**Grid Systems**:
- Course cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Search filters: `grid-cols-1 md:grid-cols-4 gap-4`
- Dashboard stats: `grid-cols-2 lg:grid-cols-4 gap-4`

---

## Page Structures

### Landing/Marketing Page
**Hero Section** (80vh):
- Full-bleed background image: Stunning golf course at golden hour (lush fairways, Mediterranean backdrop)
- Centered overlay with search widget
- Blurred background behind search box (backdrop-blur-md bg-white/90)
- Primary CTA: "Find Your Perfect Tee Time"

**Sections** (in order):
1. **Hero with Search** - Geolocation input, date picker, player count, time preference filters
2. **Featured Courses** - 3-column grid showcasing premium courses with images and quick stats
3. **How It Works** - 3-step process with icons (Search → Select → Book)
4. **Benefits** - 2-column layout highlighting real-time availability, best prices, local expertise
5. **Course Statistics** - 4-column stats (40+ Courses, Sotogrande to Málaga, Real-time Availability, Commission Partnership)
6. **Testimonials** - 2-column customer quotes with golfer photos
7. **Call-to-Action** - Centered CTA with secondary search widget
8. **Footer** - Course categories, quick links, contact info, newsletter signup

### Course Search/Directory Page
- **Sticky search bar** at top with filters (location, date, players, time)
- **Map view toggle** - Side-by-side map and list view option
- **Course cards** in 3-column grid:
  - Course image (16:9 aspect ratio)
  - Course name (Playfair Display)
  - Location with distance indicator
  - Quick stats (holes, par, rating)
  - "View Tee Times" CTA button
  - Price indicator if available

### Course Detail Page
- **Hero gallery** - Large image with thumbnail gallery below
- **Two-column layout**:
  - Left: Course details, description, amenities, contact info
  - Right: Sticky booking widget with tee-time selection
- **Location map** - Embedded map showing course location
- **Booking providers** - Cards showing different booking options (Golfmanager, iMasterGolf, direct)

### Booking Flow
- **Multi-step form** with progress indicator (1. Select Time → 2. Player Details → 3. Confirmation)
- **Summary sidebar** - Sticky on desktop showing selected course, time, players, price estimate
- **Form sections**: Player info, contact details, special requests
- **Confirmation page**: Booking reference, course details, next steps, email confirmation notice

### Admin Dashboard (Email Management)
- **Stats overview** - Card grid showing total courses, emails sent, response rate, partnerships
- **Email composer** - Split view: Template editor (left) + Preview (right)
- **Bulk send interface** - Course selection with checkboxes, merge field helpers
- **Email tracking table** - Sortable table with course name, subject, status, sent date, actions

---

## Component Library

### Navigation
- **Sticky header**: White background, subtle shadow on scroll
- Logo (left), main nav links (center), "Find Courses" CTA button (right)
- Mobile: Hamburger menu with slide-out drawer

### Cards
- **Course Card**: Rounded corners (rounded-lg), subtle shadow, hover lift effect (transform)
- Image with gradient overlay at bottom for text readability
- Badge overlays for "Featured" or "Premium" courses
- Heart icon for favorites (top-right)

### Search & Filters
- **Search input**: Large, rounded, with location icon prefix
- **Filter chips**: Rounded-full pills that toggle active state
- **Date picker**: Calendar dropdown with range selection
- **Dropdown selects**: Custom styled with icons

### Buttons
- **Primary CTA**: Solid, rounded-lg, medium padding (px-6 py-3), bold text
- **Secondary**: Outline style with border
- **On images**: Blurred background (backdrop-blur-md bg-white/20), no hover blur changes, standard hover state only

### Forms
- **Input fields**: Rounded borders, consistent padding (p-3), focus state with ring
- **Labels**: Above inputs, medium weight, small text
- **Validation**: Inline error messages below fields

### Data Display
- **Stats cards**: Large number (text-3xl font-bold), small label below
- **Tables**: Striped rows, sortable headers, action buttons in last column
- **Maps**: Rounded corners, markers for course locations, info popups on click

---

## Images

### Required Images:
1. **Hero Background**: Pristine golf course at sunrise/sunset, wide landscape view showing fairway, greens, and coastal backdrop
2. **Featured Course Cards** (3-6): Various Costa del Sol courses - mix of coastal views, mountain backdrops, and signature holes
3. **Course Detail Galleries**: 4-6 images per course showing different angles, clubhouse, facilities
4. **Testimonial Photos**: 2-3 diverse golfers (casual golfer headshots)
5. **How It Works Section**: Simple iconography or small illustrative images for each step

### Image Treatment:
- All course images: 16:9 aspect ratio for consistency
- Subtle gradient overlays on cards for text legibility
- Lazy loading for performance
- Responsive srcset for mobile optimization

---

## Special Considerations

**Geolocation UX**: 
- Clear prompt for location permission
- Fallback to manual location input
- Visual indicator of "distance from you" on course cards

**Mobile Optimization**:
- Bottom sheet for filters on mobile
- Simplified single-column layouts
- Touch-friendly button sizes (min 44px height)
- Collapsible sections to reduce scrolling

**Trust Signals**:
- Display partner logos (golf course affiliations)
- Real-time availability indicators
- Contact information prominently displayed
- Secure booking badges