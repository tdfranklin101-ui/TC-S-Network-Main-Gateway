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