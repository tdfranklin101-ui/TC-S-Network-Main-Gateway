# Overview

The Current-See is a solar-backed global economic platform that implements a comprehensive ecosystem featuring real-time solar energy tracking, member management, AI assistants, and digital marketplace functionality. The system demonstrates a vision for a renewable energy-based economy where users receive daily distributions of virtual SOLAR currency based on real solar energy calculations. The platform includes multiple interactive components including a live solar counter, member dashboard, AI-powered features, and various demonstration tools.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Backend Architecture
- **Server Framework**: Express.js with Node.js CommonJS modules
- **Database Strategy**: Dual approach using PostgreSQL with Drizzle ORM for persistent storage and JSON file fallback for local development
- **Session Management**: Express-session with PostgreSQL store for user authentication
- **File Storage**: Local filesystem with organized directory structure for static assets and uploads

## Frontend Architecture
- **Static Site Architecture**: Server-side rendered HTML with vanilla JavaScript enhancements
- **Build System**: Vite-based build process with React support for interactive components
- **CSS Framework**: Custom CSS with Bootstrap integration for responsive design
- **Real-time Updates**: WebSocket connections for live data synchronization

## Core Components
- **Solar Clock System**: Real-time calculation engine that tracks global solar energy accumulation since April 7, 2025, with mathematical models for energy distribution
- **Member Management**: Complete user registration and profile system with solar currency tracking
- **AI Integration**: OpenAI-powered assistant services for energy consulting and interactive features
- **Marketplace System**: Digital artifact management with file upload, processing, and transaction capabilities

## Data Architecture
- **Solar Constants**: Hardcoded mathematical models for global solar energy calculations (4.176e+15 kWh daily)
- **Member Storage**: JSON-based member data with database synchronization for production
- **Analytics**: Simple in-memory analytics with file-based logging for performance tracking
- **Distribution System**: Automated daily SOLAR currency distribution based on energy calculations

## Service Integrations
- **Python Services**: Geolocation and badge generation services running as child processes
- **Badge Generation**: Custom achievement badge creation for social sharing
- **Voice Assistant**: AI-powered voice interaction capabilities
- **Health Monitoring**: Comprehensive health check and monitoring systems for deployment reliability

# External Dependencies

## Third-party Services
- **OpenAI API**: Powers the AI assistant features and energy consultation services
- **PostgreSQL Database**: Primary data storage with connection pooling via pg library
- **MaxMind GeoIP**: Geolocation services for user location detection (via license key)

## Node.js Packages
- **express**: Web application framework
- **pg**: PostgreSQL database client
- **cors**: Cross-origin resource sharing middleware
- **express-session**: Session management
- **node-schedule**: Task scheduling for automated distributions
- **multer**: File upload handling for marketplace
- **ws**: WebSocket implementation for real-time features

## Frontend Libraries
- **Bootstrap 5.3.0**: CSS framework for responsive design
- **Font Awesome 6.0.0**: Icon library for UI elements
- **React**: Component-based UI for interactive features (via Vite build)

## Development Tools
- **Vite**: Build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **TypeScript**: Type checking and development support
- **Drizzle ORM**: Database schema management and queries

## Python Dependencies
- **Flask**: Microservices for geolocation and badge generation
- **PIL/Pillow**: Image processing for badge creation
- **GeoIP2**: Advanced geolocation capabilities