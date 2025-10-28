# TC-S Network Foundation Platform - Design Guidelines

## Design Approach
Custom tech-forward design system inspired by platforms like Vercel, Linear, and modern fintech dashboards. The aesthetic combines cyberpunk-influenced color treatments with professional enterprise UI patterns. This is a data-centric platform interface, not a marketing site.

## Typography System

**Font Families:**
- Primary: Inter (Google Fonts) - all UI elements, body text, data displays
- Monospace: JetBrains Mono (Google Fonts) - code snippets, technical identifiers, satellite IDs

**Type Scale:**
- Hero Headline: 4xl to 6xl, font-weight 700
- Section Headers: 2xl to 3xl, font-weight 600
- Card Titles: xl, font-weight 600
- Body Text: base, font-weight 400
- Data Labels: sm, font-weight 500
- Technical Text (monospace): sm to base

## Layout System

**Spacing Primitives:**
Use Tailwind units: 2, 4, 6, 8, 12, 16, 24 for consistent rhythm throughout.

**Grid Structure:**
- Maximum container width: max-w-7xl
- Dashboard grid: 12-column responsive grid
- Card layouts: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Data panels: Single column for detailed views, multi-column for overview metrics

## Component Library

### Navigation
Top navigation bar with semi-transparent black background (bg-black/80), backdrop blur effect. Logo left, main nav center (Dashboard, Services, Protocols, Insights), user profile/settings right. Height: h-16, fixed positioning.

### Hero Section
**Layout:** Full-width hero with large background image showing satellite/renewable energy infrastructure overlaid with gradient (black/60 to black/90). Height: 60vh on desktop, 50vh mobile.

**Content Positioning:** Centered vertically, max-w-4xl container
- Headline: "Global Economic Systems Through Renewable Intelligence"
- Subheading: Technical description of platform capabilities
- CTA buttons (2): Primary "Access Dashboard" with blur background, Secondary "View Documentation"

**Image Description:** Wide shot of solar panel arrays with satellite dish installations during twilight/night, showing illuminated tech infrastructure with visible stars. High-tech, professional photography with cool blue tones.

### Dashboard Cards (Main Features)

**Solar Reserve Dashboard Card:**
- Semi-transparent black background (bg-black/60) with border (border-cyan-500/20)
- Icon: Solar panel graphic (use icon library)
- Cyan heading: "Solar Reserve Dashboard"
- Metrics display: Grid showing kWh Generated, Network Capacity, Active Sites
- Real-time status indicator with neon green pulse
- Padding: p-6, rounded-lg

**Satellite ID Anywhere Card:**
- Same container treatment as above
- Icon: Satellite/location marker
- Cyan heading: "Satellite ID Anywhere"
- Service description and active connection count
- Input field for satellite ID lookup with neon green focus state
- Padding: p-6, rounded-lg

**UIM Handshake Protocol Card:**
- Same container treatment
- Icon: Network nodes/handshake
- Cyan heading: "UIM Handshake Protocol"
- Protocol status, active handshakes, latency metrics
- Connection log preview
- Padding: p-6, rounded-lg

### Data Visualization Panels

**Chart Containers:**
Background: bg-black/40, border: border-white/10
Charts use: Cyan for primary data lines, neon green for highlights, white gridlines at 10% opacity
Padding: p-8, rounded-lg

**Metrics Grid:**
Small stat cards in 4-column grid (lg:grid-cols-4 md:grid-cols-2)
Each card: bg-black/50, border-l-4 border-cyan-500, p-4
Large number display with small label underneath

### Forms & Interactive Elements

**Input Fields:**
- Background: bg-black/30, border: border-white/20
- Focus state: border-neon-green, ring-neon-green/20
- Text: text-white, placeholder: text-white/40
- Padding: px-4 py-3, rounded

**Buttons:**
Primary (neon green): Solid neon green background, black text, px-6 py-3, rounded, font-weight 600
Secondary (cyan): Border-2 border-cyan-500, cyan text, bg-transparent, px-6 py-3, rounded
Buttons on images: backdrop-blur-md, bg-white/10

**Tables:**
Header row: bg-cyan-500/10, cyan text, font-weight 600
Data rows: bg-black/20, alternating with bg-black/30
Cell padding: px-4 py-3
Borders: border-white/10

### AI Insights Section

**Layout:** Two-column grid (lg:grid-cols-2)
Left: Real-time insights feed with timestamped entries
Right: AI recommendation cards

**Insight Cards:**
- bg-black/50, border-l-4 border-neon-green
- Timestamp in monospace font
- Insight text with "AI Generated" badge
- Action buttons if applicable
- Padding: p-4, space-y-2

### Footer

Multi-column layout (grid-cols-4) with:
- Column 1: Foundation info and logo
- Column 2: Platform links (Dashboard, Services, Protocols)
- Column 3: Resources (Documentation, API, Support)
- Column 4: Contact and social links
Background: bg-black/90, border-top: border-white/10
Padding: py-12

## Icon Library
Use Heroicons for all interface icons - outline style for navigation, solid for status indicators.

## Images

**Hero Image:** Required large background image as described above - satellite/solar infrastructure at night/twilight

**Optional Decorative Elements:** 
- Subtle grid pattern overlays on dark backgrounds
- Glowing orbs/points at section corners using CSS gradients
- Satellite orbital path visualizations as SVG backgrounds

## Accessibility
- Maintain 4.5:1 contrast ratio with white text on dark backgrounds
- Cyan and neon green meet WCAG AA standards for interactive elements
- Focus indicators using neon green rings (ring-2 ring-neon-green)
- All data tables include proper headers and labels

## Animations
Minimal, purposeful animations only:
- Smooth transitions on hover states (duration-200)
- Pulse effect on real-time status indicators
- Fade-in for data updates
- No scroll-based animations