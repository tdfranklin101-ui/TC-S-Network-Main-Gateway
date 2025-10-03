# The Current-See Platform

## Overview

The Current-See is a solar-backed global economic system prototype that combines renewable energy tracking, cryptocurrency-like SOLAR tokens, member management, and AI assistance. The platform features real-time solar energy calculations, member wallet functionality with automatic initialization, and an integrated D-ID AI agent called "Kid Solar" that provides polymathic assistance in renewable energy, physics, engineering, and sustainability.

## Recent Updates (October 2025)

### Production Deployment Ready (October 3, 2025)
- **Deployment Package Optimized**: Reduced from 4.9GB to ~450MB for Cloud Run compatibility
- **JavaScript Syntax Fix**: Corrected marketplace.html line 2982 - malformed data URI prevented modal functions
- **Authentication Working**: Sign In and Join Network buttons functional in development
- **.gcloudignore Optimized**: Excludes 1.4GB (node_modules 400MB, attached_assets 521MB, non-runtime dirs 850MB)
- **Procfile Created**: Cloud Run will start with `node main.js`
- **Package Size Breakdown**:
  - Source code: ~250MB (mostly public static files)
  - Production node_modules: ~200MB (installed by Cloud Build)
  - Total: ~450MB (under 500MB Cloud Run limit)
- **Deployment Scripts Ready**: deploy-production.sh, DEPLOYMENT-CHECKLIST.md, DEPLOY-TO-PRODUCTION.md
- **Environment Variables Required**: DATABASE_URL, OPENAI_API_KEY (NODE_ENV auto-set to production)

## Recent Updates (October 2025)

### Large Video Streaming Fixed for Production (October 2, 2025)
- **HTTP Range Request Support**: Full byte-range streaming for 3 large platform videos (176MB, 134MB, 231MB)
- **Video Optimization**: All MP4s re-encoded with faststart flag (moov atom at beginning) for instant playback
- **Production-Ready**: Enhanced with CORS headers and explicit Range support for Cloud Run deployment
- **Cloud Run 32MB Limit Fix**: Force HTTP 206 partial content for files >10MB (bypasses Cloud Run HTTP/1 32MB response limit)
- **HTTP 206 Partial Content**: Proper Content-Range headers enable instant seeking/scrubbing
- **Platform Videos Working**: 
  - Plant the seed (176MB) - /videos/plant-the-seed.mp4 - ✅ Web-optimized + Cloud Run ready
  - We Said So (231MB) - /videos/we-said-so-monazite.mp4 - ✅ Web-optimized + Cloud Run ready
  - Podcast Discussion (134MB) - /videos/podcast-discussion.mp4 - ✅ Web-optimized + Cloud Run ready
- **Multi-Format**: Supports .mp4, .webm, .mov (video) and .mp3 (audio) streaming
- **CORS Enabled**: Access-Control headers for cross-origin video playback
- **Smart Content Delivery**: 
  - Large files (>10MB): HTTP 206 with 10MB initial chunk, browser requests more automatically
  - Small files (<10MB): HTTP 200 full file
  - Range requests: HTTP 206 with requested byte range
- **Production Streaming Logic**: Initial request without Range header sends first 10MB chunk (HTTP 206), browser automatically fetches subsequent chunks via Range headers
- **Root Causes Fixed**: (1) Videos had moov atom at end - fixed with ffmpeg faststart; (2) Cloud Run HTTP/1 32MB limit - fixed by forcing partial content for large files

### Marketplace Authentication Flow Fixed (October 2, 2025)
- **Primary Marketplace**: `/marketplace.html` is the Digital Artifact Market with embedded sign-in/register modals
- **Authentication UX**: Sign-in and registration happen via modal overlays - users stay on marketplace page
- **Header Display**: After login/register, header shows username + Solar balance (e.g., "Jennmarie" + "178.0000 Solar")
- **Navigation Links Fixed**: All "My Solar" links now direct to `/marketplace.html` for consistent UX
- **Modal Functions Fixed**: Removed non-existent `marketplace.` object references; functions now called directly
- **API Endpoints Corrected**: Registration uses `/api/register`, login uses `/api/login` with proper response parsing
- **Purchase Endpoint Fixed**: Corrected database queries to use `members.total_solar` instead of non-existent tables
- **Deployment Ready**: Removed redundant health check servers that caused "6 ports" deployment error
- **Daily Solar Distribution**: Active in development; manual trigger available in production via API
- **Initial Solar Calculation**: Confirmed correct - 1 Solar per day since April 7, 2025 (Genesis Date)

### Wallet & Download Fixes (October 2, 2025)
- **Real-Time Balance Updates**: Session endpoint now fetches current Solar balance from database on every request (daily additions and transactions show immediately)
- **Auto-Login with Fresh Balance**: New members automatically logged in after registration with current balance loaded from database
- **Persistent Sessions**: Extended session duration from 24 hours to 30 days for seamless long-term access
- **Download Button Fixed**: Added missing downloadOwnArtifact() function to enable file downloads for artifact creators
- **Ownership Detection Fixed**: Corrected field name mismatch (creator_id vs creatorId) in ownership validation
- **Database Registration Fixed**: Corrected column names (total_solar, signup_timestamp, name) to match schema, preventing silent registration failures
- **Member #30 (Jennmarie) Successfully Registered**: 178.0000 Solar balance displaying correctly

### Landing Page QA Fixes (October 1, 2025)
- **Z Private Link Corrected**: Now properly links to external solar-network app at `https://solar-network-tdfranklin101.replit.app` with neon green (#39FF14) styling
- **Foundation Platform Restored**: Recovered correct version from git history (commit af10e01) with Kid Solar AI agent (ID: v2_agt_vhYf_e_C)
- **Permanent Redirects Added**: `/main-platform.html` → `/main-platform` for legacy bookmark support
- **Guest Browsing Messaging**: Clear UX with "Browse freely as a guest • Sign in to participate in the marketplace"

## Previous Updates (September 2025)

### Marketplace Loading & Upload Fixes
- **Resolved undefined errors**: Added file_type fields to all API responses preventing marketplace crashes
- **Fixed wallet initialization**: Sign-in and signup now properly update both currentUser and solarBalance properties
- **Enhanced error handling**: Added request timeouts (10s sessions, 15s artifacts, 2m uploads) with user-friendly messages
- **Secure file storage**: Converted from memory to disk storage with comprehensive temp file cleanup
- **Session authentication**: Fixed cookie consistency across all endpoints for reliable user state
- **Balance display**: Normalized balance formatting to 4 decimal places (e.g., "178.0000 Solar")
- **UI state management**: Ensured name and balance display correctly after authentication

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