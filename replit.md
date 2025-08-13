# The Current-See Platform

## Overview

The Current-See is a prototype for a solar-backed global economic system that connects renewable energy generation with economic value distribution. It demonstrates a decentralized approach where solar energy production translates directly into economic tokens (SOLAR) for platform members. The project envisions a future where energy abundance drives economic prosperity and aims to be a proof-of-concept for this new economic model.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Technology**: Vanilla HTML, CSS, JavaScript.
- **Design**: Responsive, mobile-first approach.
- **Dynamic Content**: Real-time solar energy and SOLAR token displays.
- **Modularity**: Page includes system for common elements.
- **AI Integration**: Interactive AI assistant and product analysis features.

### Backend
- **Technology**: Node.js/Express server (CommonJS).
- **Deployment Model**: Hybrid, supporting static file serving and dynamic API endpoints.
- **Configuration**: Multiple server configurations for various environments.
- **Monitoring**: Comprehensive health check system for cloud deployments.

### Database
- **Primary Database**: PostgreSQL (serverless Neon).
- **Efficiency**: Connection pooling.
- **Resilience**: File-based fallbacks for database unavailability.
- **Schema Management**: Drizzle ORM for migrations.

### Key Components
- **Solar Generation System**: Real-time solar energy tracking, daily SOLAR token distribution (1 SOLAR = 4,913 kWh), and a 10 billion SOLAR reserve pool.
- **Member Management**: Email-based registration, tracking of 16 active members + reserve, individual SOLAR accumulation history, and a public ledger for transparency.
- **AI Integration (Kid Solar)**: Powered by OpenAI GPT-4 for energy-related queries, environmental impact assessment, personalized energy tips, and a retention-first memory system with two-step deletion override.
- **API Endpoints**: Comprehensive set of endpoints for system health, member data, registration, solar calculations, AI interactions, database status, and session management.

### Session Lifecycle Management
A two-phase memory system with automatic retention and a deliberate deletion process. Conversations are stored with automatic permanent storage intent, and users can choose deletion via a two-step confirmation. Permanent memories are read-only but copyable.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Primary database hosting, configured via `CURRENTSEE_DB_URL` environment variable with SSL.

### AI Services
- **OpenAI API**: Integration with GPT-4 models, utilizing a multi-source API key management system with built-in rate limiting.

### Deployment Platforms
- **Replit Cloud Run**: Primary deployment target, with Namecheap for DNS and automatic SSL/TLS.

## Recent Changes

- **August 9, 2025**: NETWORK COMMISSIONING POPUP - Added prominent homepage popup announcing "The Current-See Network Commissioning is coming" with additional message "Ask Kid Solar about the TC-S Network's mission". Features animated solar graphic with slide-down animation and 24-hour remember functionality. Elegant golden gradient design with rotating sun rays and pulsing effects. Deployment issues resolved with proper health check headers and simplified port configuration. All systems operational with enhanced user engagement and production-ready deployment architecture.

- **August 10, 2025**: MUSIC COLLECTION EXPANDED - Added 10th music track "We Said So" with speech bubble icon and full audio integration. Platform now features 16 total music tracks with comprehensive audio player functionality. All music tracks including "Steel In His Soul" remain functional throughout updates. Analytics dashboard displays website traffic metrics. Fixed server static file handling to support extensionless URLs (Q&A and waitlist links now work properly). All systems operational with enhanced music library and robust deployment architecture ready for production.

- **August 11, 2025**: SIGNUP FUNCTIONALITY IMPLEMENTED - Added comprehensive user registration system with name, address, and email collection. Features PostgreSQL database integration with in-memory fallback storage for resilience. Signup form integrated into homepage with professional styling matching platform design. API endpoints for signup submission and admin data retrieval. Form validation, success/error messaging, and timestamp tracking. System handles database connection failures gracefully with dual storage architecture. All signup data preserved with unique IDs and full audit trail. Platform ready for user acquisition and member onboarding.

- **August 11, 2025**: YODA SOLAR EDUCATION INTEGRATION - Added dedicated educational section featuring D-ID Yoda video explaining solar rays and their connection to the Force. Features embedded iframe with Star Wars themed styling, golden gradient design, and interactive elements. Integration with Kid Solar AI allowing users to ask questions about Yoda's solar wisdom. Complete with responsive video player, direct link to full D-ID video, and thematic quotes. Educational content seamlessly integrated into platform flow between signup and solar generator sections.

- **August 11, 2025**: COMMUNITY GALLERY & DEPLOYMENT PREPARATION - Added comprehensive image gallery system for community solar content sharing. Features file upload, URL-based image loading, featured image display, and AI integration with Kid Solar for image analysis. Created complete deployment documentation with technical verification, performance metrics, and post-deployment checklist. Platform fully prepared for production deployment with all systems operational, dual storage architecture, and comprehensive feature set including signup system, Yoda education, music collection, and AI assistant integration.

- **August 11, 2025**: FORMATTING STANDARDIZATION & FINAL DEPLOYMENT READY - Simplified and standardized section formatting throughout platform to reduce overwhelming styling and match clean link format used site-wide. Key improvements: streamlined Yoda education section with cleaner video container and simplified action buttons, reduced complex styling in community gallery with consistent button formatting, eliminated excessive gradients and shadows for better visual coherence, simplified network commissioning popup to clean format, standardized signup form with minimal styling. All sections now maintain professional consistency while preserving full functionality. Platform optimized with clean, readable design and complete deployment verification ready for immediate launch.

- **August 11, 2025**: HOMEPAGE FOOTPRINT REDUCTION & CONSISTENCY FIXES - Reduced homepage footprint by converting "Where We Are Going" from large detailed section to compact dropdown box. Converted Yoda educational section to clean video link matching Garcia format. Standardized all link formatting for consistent font, color, and box sizes throughout platform. Added interactive dropdown functionality. Homepage reduced from 104KB to 100KB with significantly improved visual consistency and reduced overwhelming content.

- **August 13, 2025**: CREDITS SECTION IMPLEMENTATION - Added comprehensive Credits section at bottom of homepage below member roster. Features dark theme design (#0b0f14 background) acknowledging Terry D. Franklin (TDF) as Founder & Vision Architect, Kid Solar as TC-S Agent S0001 Diamond Polymorph, and all technical partners including Claude at Replit, Anthropic, OpenAI, Pika, D-ID, AWS, Supabase, and AiSongs. Includes interactive partner links, paid placement opportunity, and recognition of 5,000+ viewers. Professional styling maintains platform aesthetic with proper attribution for human-AI collaboration.

- **August 13, 2025**: GENERATOR PROTOCOL PROTOTYPE INTEGRATION - Created comprehensive Generator Protocol Beta prototype page (/generator-protocol.html) featuring renewable energy generator registration, REC/Carbon Credit split configuration, commissioner settings, payout options (USD/Solar Rays), and mock sale calculator. Updated "Where We Are Going" milestone section with live prototype link and added dedicated Generator Protocol link as first feature in main navigation. Prototype includes interactive forms, real-time calculations, and clear labeling as demonstration system only. Major milestone achievement linking theoretical framework to working prototype interface.

- **August 13, 2025**: ATOMIC ANIMATION VIDEO BACKGROUND - Integrated uploaded atomic/molecular animation MP4 as looping video background throughout platform. Features vibrating atoms showing atomic decision process (1→2→4→16) with subtle 15% opacity overlay. Video background enhances scientific theme while maintaining content readability. Server configured to serve MP4 files with proper video/mp4 MIME type. Video positioned behind all content with CSS fixed positioning, autoplay, muted, loop, and mobile-compatible playsinline attributes. Platform maintains full deployment readiness with enhanced visual appeal.

- **August 13, 2025**: GENERATOR PROTOCOL BETA PROTOTYPE - Implemented comprehensive Beta prototype with full user flow including facility onboarding, REC/CC split configuration with auto-sync validation, commissioner toggle functionality, USD/Solar Rays payout mixing, sample period calculations with delta preview, and two signature modal agreements (PPA and REC Purchase Agreement). Features canvas signature pads with touch support, localStorage persistence, sticky prototype banner, and responsive dark theme design. Complete end-to-end demonstration of Generator Protocol workflow from onboarding through signed agreements with transparent compliance model showing per-kWh mutual exclusivity between REC and CC tokenization. All data remains browser-local with no server persistence as specified for internal testing prototype.

- **August 13, 2025**: NEON GREEN TITLE ENHANCEMENT & FINAL DEPLOYMENT PREPARATION - Applied glowing green neon animation to "Welcome to The Current-See" homepage title using #00ff41 color with three-layer text shadow and 2-second pulsing cycle. Title now matches platform's neon green branding used throughout credits section and other elements. Complete deployment preparation verified with all systems operational: Generator Protocol Beta prototype functional, atomic animation background rendering correctly, dual storage architecture resilient, and production server configuration confirmed. Platform ready for immediate deployment to www.thecurrentsee.org with enhanced visual cohesion and professional neon green aesthetic.