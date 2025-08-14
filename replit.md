# The Current-See Platform

## Overview
The Current-See is a prototype for a solar-backed global economic system that connects renewable energy generation with economic value distribution. It demonstrates a decentralized approach where solar energy production translates directly into economic tokens (SOLAR) for platform members. The project envisions a future where energy abundance drives economic prosperity and aims to be a proof-of-concept for this new economic model. Key capabilities include real-time solar energy tracking, SOLAR token distribution, member management, and AI integration for energy-related queries and personalized tips.

## User Preferences
Preferred communication style: Simple, everyday language.

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