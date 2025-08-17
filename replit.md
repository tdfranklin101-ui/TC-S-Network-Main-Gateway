# The Current-See Platform

## Overview
The Current-See is a prototype for a solar-backed global economic system that connects renewable energy generation with economic value distribution. It demonstrates a decentralized approach where solar energy production translates directly into economic tokens (SOLAR) for platform members. The project envisions a future where energy abundance drives economic prosperity and aims to be a proof-of-concept for this new economic model. Key capabilities include real-time solar energy tracking, SOLAR token distribution, member management, and AI integration for energy-related queries and personalized tips.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (August 2025)
- Implemented stable frame system to eliminate site floating/movement issues
- Enhanced dual Pika AI atomic animation system with controlled opacity and blur
- Added professional container structure with max-width constraints
- Improved text stability with stronger backdrop filters and positioning
- Successfully deployed with atomic multiplication effect (1→2→4→16→64) clearly visible
- Added "Staying Alive" section with links to 1028atoms.com and OpenAI Longevity Pathways Advisor
- Integrated dual longevity resources: main website and specialized AI advisor on OpenAI API
- Updated GPT link to correct 10^28 Atoms Longevity Pathways Advisor (g-iO2B1JFMJ)
- Fine-tuned 10^28 area with transparent background and bold neon orange lettering
- Added "Longer Life for Everyone" main heading above longevity resources
- Updated GPT link to correct 10^28 Atoms Longevity Pathways Advisor (g-iO2B1JFMJ)
- Fine-tuned 10^28 area with transparent background and bold neon orange lettering
- Added "Longer Life for Everyone" main heading above longevity resources
- Moved navigation links above 10^28 area for improved flow
- Changed 10^28 area to neon blue with fully transparent background
- Converted to dropdown with "So you want to live forever?" as clickable title
- Updated text below 10^28 area to neon green for visual flow consistency
- Eliminated entry distraction with clear color-coded navigation paths
- Added collapse arrow functionality to 10^28 dropdown section
- Reduced green glow intensity for better readability while maintaining atomic energy aesthetic
- Updated all headings to neon green theme except Music Now sections (preserved orange)
- Achieved consistent visual hierarchy with proper color-coded navigation paths
- Fine-tuned font styling: main titles keep glow, feature links use clean green font
- Extended clean green font treatment to all sections below Music Now through Public Members Log
- Final readability optimization: converted main features box title to clean green font
- Relocated LIVE Solar Generation section above Join The Current-See Network for improved flow
- Updated homepage note to reference Kid Solar as "21st Century polymath" about TC-S mission
- Finalized visual hierarchy with distinct color coding for all platform sections
- Production deployment ready with polished UI and stable performance

## System Architecture

### Frontend
- **Technology**: Vanilla HTML, CSS, JavaScript.
- **Design**: Responsive, mobile-first approach with a focus on a professional aesthetic, including neon green branding and golden gradients. Features dynamic content displays, modular page elements, and interactive AI integration. Includes dual Pika AI atomic animations showing 1→2→4→16→64 molecular multiplication: full-screen stretched background and dedicated title video background.

### Backend
- **Technology**: Node.js/Express server (CommonJS).
- **Deployment Model**: Hybrid, supporting static file serving and dynamic API endpoints.
- **Configuration**: Multiple server configurations with a comprehensive health check system.

### Database
- **Primary Database**: PostgreSQL (serverless Neon).
- **Efficiency**: Connection pooling.
- **Resilience**: File-based fallbacks for database unavailability and in-memory fallback storage for signup functionality.
- **Schema Management**: Drizzle ORM for migrations.

### Key Components
- **Solar Generation System**: Tracks real-time solar energy, distributes SOLAR tokens (1 SOLAR = 4,913 kWh), and manages a 10 billion SOLAR reserve pool.
- **Member Management**: Email-based registration, tracking of members, individual SOLAR accumulation history, and a public ledger.
- **AI Integration (Kid Solar)**: Powered by OpenAI GPT-4 for energy-related queries, environmental impact assessment, personalized energy tips, and a retention-first memory system with two-step deletion override.
- **API Endpoints**: Comprehensive set of endpoints for system health, member data, registration, solar calculations, AI interactions, database status, and session management.
- **Session Lifecycle Management**: Two-phase memory system with automatic retention and deliberate deletion process.
- **Generator Protocol Prototype**: A beta prototype page for renewable energy generator registration, REC/Carbon Credit split configuration, commissioner settings, payout options, and mock sale calculation, including canvas signature pads for agreements.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Primary database hosting, configured via `CURRENTSEE_DB_URL` environment variable with SSL.

### AI Services
- **OpenAI API**: Integration with GPT-4 models, utilizing a multi-source API key management system with built-in rate limiting.
- **D-ID**: Used for educational video content (e.g., Yoda video).

### Deployment Platforms
- **Replit Cloud Run**: Primary deployment target.
- **Namecheap**: DNS management.

### Cloud & Other Services
- **AWS**
- **Supabase**
- **Pika**
- **AiSongs**