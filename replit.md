# The Current-See Platform

## Overview

The Current-See is a solar-backed global economic system prototype that combines renewable energy tracking, cryptocurrency-like SOLAR tokens, member management, and AI assistance. The platform features real-time solar energy calculations, member wallet functionality, and an integrated D-ID AI agent called "Kid Solar" that provides polymathic assistance in renewable energy, physics, engineering, and sustainability.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Static File Serving**: Express.js serves HTML, CSS, and JavaScript files from a `public` directory structure
- **Client-Side Framework**: Vanilla JavaScript with dynamic content rendering and real-time counter updates
- **AI Integration**: D-ID AI agent embedded via CDN script with configured agent ID and client keys
- **File Upload**: Multer-based image upload system for AI visual analysis
- **Responsive Design**: Mobile-friendly interface with CSS media queries

### Backend Architecture
- **Server Framework**: Express.js with HTTP fallback options for deployment flexibility
- **Deployment Strategy**: Multiple deployment scripts optimized for different environments (Replit, Cloud Run)
- **Health Monitoring**: Comprehensive health check endpoints for deployment monitoring
- **Session Management**: In-memory session storage for conversation tracking
- **Static Asset Management**: MIME type handling and proper caching headers

### Data Storage Solutions
- **PostgreSQL Integration**: Drizzle ORM with schema definitions for member data
- **Database Connectivity**: Flexible connection handling supporting both DATABASE_URL and CURRENTSEE_DB_URL
- **File-Based Fallbacks**: JSON files for member data when database is unavailable
- **Conversation Storage**: File system storage for AI conversation history
- **Memory System**: Session-based storage for user interactions and AI responses

### Authentication and Authorization
- **Environment-Based Security**: API keys stored in environment variables
- **Session-Based Tracking**: Anonymous session management for conversation continuity
- **CORS Configuration**: Cross-origin resource sharing for API endpoints
- **Rate Limiting**: Built into OpenAI integration to prevent abuse

### External Service Integrations
- **OpenAI API**: GPT-4 integration for AI responses and image generation (DALL-E)
- **D-ID Platform**: AI avatar integration with voice responses and visual interaction
- **PostgreSQL Database**: Cloud-hosted database for persistent member data
- **CDN Assets**: External script loading for D-ID agent functionality

## External Dependencies

### Third-Party Services
- **OpenAI**: GPT-4o model for text generation and DALL-E for image creation
- **D-ID**: AI agent platform for interactive avatar experiences with agent ID `v2_agt_vhYf_e_C`
- **PostgreSQL**: Database hosting (supports Neon and other cloud providers)

### APIs and Integrations
- **Real-Time Solar Calculations**: Mathematical models for energy generation tracking
- **Member Management API**: RESTful endpoints for member data operations
- **File Upload API**: Image processing and analysis endpoints
- **Health Check APIs**: System monitoring and deployment verification endpoints

### Databases
- **Primary Database**: PostgreSQL with Drizzle ORM for structured data
- **Fallback Storage**: JSON files and in-memory storage for reliability
- **Session Storage**: File-based conversation persistence
- **Configuration Storage**: Environment variables and JSON configuration files

### Development and Deployment Tools
- **Package Management**: npm with Express.js, Multer, and database drivers
- **Deployment Platforms**: Optimized for Replit and Google Cloud Run
- **Monitoring**: Custom health check and status reporting systems
- **Cache Management**: Aggressive cache clearing for deployment updates