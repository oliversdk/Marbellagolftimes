# Design Guidelines: Marbella Golf Times

## Design Approach
**Boutique-Premium**: Marbella Golf Times positions itself as a personal concierge for Costa del Sol's finest golf experiences. Drawing inspiration from luxury hospitality brands and curated travel services, we blend the efficiency of modern booking platforms with the warmth and personal touch of a dedicated golf advisor.

**Core Principle**: Marbella Golf Times is your trusted guide—not just a search tool, but a carefully curated selection of premier tee times delivered with personal service and local expertise. Every interaction should feel warm, premium, and effortlessly elegant.

---

## Brand Identity

**Voice & Tone**:
- Warm and welcoming, like a knowledgeable friend
- Premium without pretension
- Personal and attentive (concierge-quality service)
- Sophisticated yet approachable

**Brand Promise**: We curate the finest tee times across Costa del Sol's premier courses, offering real-time availability with the personal touch of a dedicated golf concierge.

---

## Color Palette

**Boutique-Premium Palette**:
The color system reflects the natural beauty of Costa del Sol golf—olive groves, sage-covered hillsides, warm sand bunkers, and sunset skies.

### Primary Colors
- **Deep Olive** `#2F4C3A` (HSL: 143° 24% 24%)
  - Use for: Primary actions, navigation highlights, brand elements
  - Represents: Lush fairways, Mediterranean vegetation, premium quality
  
- **Sunlit Sage** `#8FAE8D` (HSL: 116° 17% 62%)
  - Use for: Secondary elements, hover states in dark mode, lighter accents
  - Represents: Morning dew on greens, coastal vegetation

### Accent Colors
- **Warm Sand** `#D8C4A3` (HSL: 37° 40% 74%)
  - Use for: Accent backgrounds, highlights, secondary CTAs
  - Represents: Bunkers, beach sand, golden hour light
  
- **Soft Rose** `#F2D4C8` (HSL: 17° 62% 87%)
  - Use for: Subtle highlights, sidebar accents, gentle emphasis
  - Represents: Sunset skies, warm hospitality

### Text & Neutrals
- **Charcoal** `#1E1E1E` (HSL: 0° 0% 12%)
  - Use for: Body text, headings, primary content
  - Represents: Sophistication, clarity, premium quality

**Color Usage Guidelines**:
- Maintain proper contrast ratios (4.5:1 minimum for text)
- Use Deep Olive for primary actions and brand moments
- Apply Warm Sand and Soft Rose sparingly for warmth and elegance
- Dark mode: Sunlit Sage becomes primary, creating a lighter, more approachable feel

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
**Hero Section** (60vh+):
- Full-bleed background image: Stunning Costa del Sol golf course at golden hour
- Centered overlay with warm, welcoming messaging
- Blurred background behind search box (backdrop-blur-md bg-white/95)
- Primary messaging: "Your Personal Guide to Costa del Sol Golf"

**Sections** (in order):
1. **Hero with Search** - Welcome message, geolocation input, search filters
2. **Featured Courses** - 3-column grid showcasing premium courses with curated descriptions
3. **Our Service** - Personal touch: How Marbella Golf Times curates your experience
4. **Benefits** - Real-time availability, local expertise, premium course access
5. **Course Statistics** - Premium courses across Sotogrande to Málaga
6. **Testimonials** - Customer experiences with personal touch
7. **Call-to-Action** - "Let us find your perfect tee time"
8. **Footer** - Course regions, quick links, contact, newsletter

### Course Search/Discovery Page (Dual Layout System)

**When location is selected (filtered results):**
- TeeTimesBooking.com-style compact list for efficient tee time scanning
- **Search filters** - Non-sticky filter section with date, players, time window selectors
- **Sorting controls** - 4 buttons for distance and price (ascending/descending) with active state highlighting (bg-primary when selected)
- **Expandable course rows** - Click any course row to expand/collapse and see individual tee times:
  - **Collapsed state** (default):
    - Course name + badges, "TEE 1" info, time range, price "from €XX", distance badge, chevron icon
    - Shows aggregated time range (e.g., "8:00 - 14:00") and cheapest price
  - **Expanded state** (after clicking):
    - Reveals ALL individual available tee times sorted chronologically
    - Each slot displays: specific time (e.g., "14:30"), green fee, and individual "Book" button
    - 2-column grid on desktop (sm:grid-cols-2), single column on mobile
    - Click any slot's "Book" button to open pre-filled booking modal with that exact time
  - **Provider badges**: "Direct" outline badge appears ONLY for DEEP_LINK courses (intentionally absent for API-based courses)
  - **Empty state**: Shows "No availability" text when no slots
  - **Responsive design**: Stacks vertically on mobile, horizontal flex row on desktop
  - **Visual feedback**: ChevronDown/ChevronUp icons indicate expand/collapse state
- **Flexible booking flow**:
  - Users can browse aggregated info when collapsed
  - Expand to see ALL specific available times
  - Click specific slot to book that exact time

**When no location is selected (browsing all courses):**
- Traditional 3-column grid layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- CourseCard components showing all 40+ Costa del Sol courses
- No sorting controls or time aggregation (no tee time search yet)

### Course Detail Page
- **Hero gallery** - Premium imagery showcasing the course
- **Two-column layout**:
  - Left: Course story, amenities, local insights
  - Right: Sticky booking widget with curated tee times
- **Location context** - Map showing course within Costa del Sol
- **Booking options** - Transparent presentation of available providers

### Booking Experience
- **Streamlined flow** with clear progress (Time Selection → Details → Confirmation)
- **Summary sidebar** - Always visible booking details
- **Personal touches**: Special requests, course recommendations, local tips
- **Confirmation**: Warm thank-you message, next steps, personal contact

### Admin Dashboard
- **Overview stats** - Courses, partnerships, guest satisfaction
- **Email management** - Professional correspondence with course partners
- **Booking tracking** - Monitor and manage reservations
- **Partnership tools** - Maintain relationships with premier courses

---

## Component Library

### Navigation
- **Sticky header**: Clean background with subtle elevation
- Marbella Golf Times logo (left), navigation links (center), primary CTA (right)
- Mobile: Elegant slide-out menu

### Cards
- **Course Card**: Rounded corners (rounded-lg), subtle shadow, elegant hover effect
- Premium imagery with gentle gradient for text legibility
- Tasteful badges for featured courses or special availability
- Clean, organized information hierarchy

### Search & Filters
- **Search input**: Refined appearance, location icon, smooth interactions
- **Filter controls**: Elegant toggles and selects
- **Date picker**: Calendar with clear selection and availability indicators
- **Results**: Organized by relevance and distance

### Buttons
- **Primary CTA**: Deep Olive, confident and inviting
- **Secondary**: Outline style with Warm Sand accent
- **On images**: Soft backgrounds with proper contrast
- All interactions smooth and refined

### Forms
- **Input fields**: Clean borders, generous padding, clear focus states
- **Labels**: Descriptive and helpful
- **Validation**: Gentle, constructive feedback
- **Overall feel**: Effortless and welcoming

### Data Display
- **Stats cards**: Clear numbers with context
- **Tables**: Clean, scannable information
- **Maps**: Integrated seamlessly with refined markers

---

## Images

### Photography Style:
- **Premium quality**: High-resolution, professionally shot
- **Golden hour preference**: Warm, inviting lighting
- **Course diversity**: Showcase coastal, mountain, and valley courses
- **Lifestyle moments**: Elegant golfers enjoying the experience
- **Local context**: Mediterranean landscape, Spanish architecture

### Required Images:
1. **Hero Background**: Sunrise/sunset on pristine Costa del Sol course
2. **Featured Courses** (6-8): Diverse course selections showing variety
3. **Course Details**: 4-6 images per course (signature holes, clubhouse, views)
4. **Testimonials**: Authentic golfer experiences
5. **Regional beauty**: Costa del Sol landscape contexts

### Image Treatment:
- 16:9 aspect ratio for consistency and premium feel
- Subtle overlays for text legibility
- Responsive images for all devices
- Thoughtful cropping highlighting course features

---

## Special Considerations

**Personal Touch**:
- Language emphasizes curation and expertise
- Course descriptions include local insights
- Recommendations feel personalized, not algorithmic
- Communication is warm and helpful

**Premium Experience**:
- Interface is refined and sophisticated
- Interactions are smooth and delightful
- Information architecture is intuitive
- Trust signals are subtle but present

**Geographic Focus**:
- Costa del Sol remains the core region
- Sotogrande to Málaga coverage
- Local knowledge and expertise emphasized
- Regional characteristics celebrated

**Mobile Experience**:
- Touch-optimized interfaces
- Streamlined navigation
- Essential information prioritized
- Booking process simplified

**Trust & Credibility**:
- Real-time availability clearly indicated
- Transparent pricing and booking terms
- Professional course partnerships highlighted
- Responsive customer service emphasized
