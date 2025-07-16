# The Current-See Platform

## Overview

The Current-See is a solar-backed global economic system prototype that demonstrates a novel approach to connecting renewable energy generation with economic value distribution. The platform serves as a proof-of-concept for a decentralized system where solar energy production directly translates to economic tokens (SOLAR) that are distributed to platform members.

## System Architecture

### Frontend Architecture
- **Static Website**: Built with vanilla HTML, CSS, and JavaScript
- **Responsive Design**: Mobile-first approach with progressive enhancement
- **Real-time Counters**: Dynamic solar energy and SOLAR token displays
- **Page Includes System**: Modular header/footer management across pages
- **AI Integration**: Interactive AI assistant and product analysis features

### Backend Architecture
- **Node.js/Express Server**: CommonJS-based server architecture for maximum compatibility
- **Hybrid Deployment Model**: Supports both static file serving and dynamic API endpoints
- **Multiple Server Configurations**: Various deployment-ready server files for different environments
- **Health Check System**: Comprehensive health monitoring for cloud deployments

### Database Layer
- **PostgreSQL Database**: Primary data storage using Neon serverless PostgreSQL
- **Connection Pooling**: Efficient database connection management
- **Fallback System**: File-based fallbacks for database unavailability
- **Migration Support**: Drizzle ORM integration for schema management

## Key Components

### Solar Generation System
- **Real-time Calculations**: Continuous solar energy generation tracking
- **Distribution Mechanism**: Daily SOLAR token distribution to members
- **Value Conversion**: Energy-to-token conversion (1 SOLAR = 4,913 kWh)
- **Reserve Management**: 10 billion SOLAR reserve pool management

### Member Management
- **Registration System**: Email-based member signup with validation
- **Member Tracking**: 16 active members + reserve entries
- **Distribution History**: Individual member SOLAR accumulation tracking
- **Public Ledger**: Transparent member balance display

### AI Integration
- **OpenAI GPT-4**: AI assistant for energy-related queries
- **Product Analysis**: Environmental impact assessment tool
- **Energy Tips**: Personalized energy recommendations
- **Fallback System**: Graceful degradation when AI services unavailable

### API Endpoints
- `/health` - System health monitoring
- `/api/members` - Member list retrieval
- `/api/member/:id` - Individual member data
- `/api/signup` - New member registration
- `/api/solar-clock` - Real-time solar calculations
- `/api/ai/assistant` - AI assistant interactions
- `/api/database/status` - Database connectivity status

## Data Flow

1. **Solar Generation**: Continuous calculation of global solar energy production
2. **Value Assignment**: 1% of calculated solar energy allocated to platform
3. **Token Distribution**: Daily distribution of 1 SOLAR per member
4. **Member Updates**: Database updates with new SOLAR balances
5. **Display Updates**: Real-time counter updates on frontend
6. **API Responses**: Dynamic data serving to client applications

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Primary database hosting
- **Connection String**: `CURRENTSEE_DB_URL` environment variable
- **SSL Configuration**: Required for secure connections

### AI Services
- **OpenAI API**: GPT-4 model integration
- **API Key Management**: Multiple key source priority system
- **Rate Limiting**: Built-in request throttling and retry logic

### Deployment Platforms
- **Replit Cloud Run**: Primary deployment target
- **Domain Management**: Namecheap DNS configuration
- **SSL/TLS**: Automatic certificate management

## Deployment Strategy

### Environment Configuration
- **Production Variables**: Database URLs, API keys, port configurations
- **Feature Flags**: JSON-based feature toggle system
- **Health Checks**: Multiple endpoint monitoring for uptime

### Build Process
- **CommonJS Architecture**: Maximum compatibility across Node.js versions
- **Static Asset Optimization**: Efficient file serving configuration
- **Multiple Entry Points**: Various server configurations for different scenarios

### Monitoring and Logging
- **Application Logs**: Comprehensive logging system with timestamps
- **Error Handling**: Graceful degradation and error recovery
- **Performance Tracking**: Request monitoring and response time logging

## Recent Changes

- **July 16, 2025**: System health check completed - all knowledge base files present and properly configured
- **July 16, 2025**: D-ID AI agent configuration verified - properly configured but temporarily unavailable (service-side issue)
- **July 16, 2025**: Fixed QA link routing - added /qa-meaning-purpose route to main.js server  
- **July 16, 2025**: Comprehensive link testing completed - all internal files exist and are properly configured
- **July 16, 2025**: Server routing enhanced with all essential pages (wallet, declaration, founder_note, whitepapers, business_plan)
- **July 14, 2025**: Added contact information header to homepage with company details and email
- **July 14, 2025**: Added D-ID AI agent to homepage with interactive avatar and voice capabilities
- **July 14, 2025**: Created ultra-reliable deployment server (main.js) after 1+ hour deployment delay
- **July 14, 2025**: Simplified server architecture to resolve Replit deployment port configuration issues
- **June 29, 2025**: Added development progress section to private network page with commission interface screenshot
- **June 29, 2025**: Added TC-SVR Game link #6 to homepage connecting to Pika video for immersive solar gaming
- **June 29, 2025**: Added image compression (2MB -> 50KB) for wallet photo analysis efficiency
- **June 29, 2025**: Added image analysis API endpoint for wallet "Identify Anything" feature with KWh/Solar conversion
- **June 29, 2025**: Updated homepage mission statement to "Where We Are Going" with generator protocol focus
- **June 27, 2025**: Final deployment preparation completed - all systems operational
- **June 24, 2025**: Added prominent mission statement "This is Where We're Going" to homepage first view
- **June 24, 2025**: Homepage expanded to 10 features (Q&AI + 9 numbered links)
- **June 24, 2025**: Added TC-S Cast Anyone as feature #9 with tagline "CurrentSee your self in the movies"
- **June 24, 2025**: Fixed Q&A page routing issue - now properly accessible via /qa-meaning-purpose
- **June 24, 2025**: Added "Q & AI - Meaning and Purpose" philosophical discussion page
- **June 24, 2025**: Updated messaging from "Apply now" to "Join the waitlist" 
- **June 24, 2025**: Added TC-S Identify Anyone as feature #8 with AI-powered person identification
- **June 24, 2025**: Enhanced feature #7 with "Join waitlist now!" call-to-action
- **June 24, 2025**: Fixed server routing for private-network and qa-meaning-purpose pages

## Changelog

- June 24, 2025. Initial setup and feature implementation

## User Preferences

Preferred communication style: Simple, everyday language.