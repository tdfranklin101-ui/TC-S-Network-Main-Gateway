# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. It integrates renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an AI assistant named "Kid Solar." The platform provides real-time solar energy calculations, member wallet functionalities with automatic initialization, and an AI agent that offers polymathic assistance across renewable energy, physics, engineering, and sustainability. It also features a marketplace for digital artifacts and energy trading.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design Philosophy**: Emphasizes a clean, intuitive interface with clear navigation and real-time data display.
- **AI Integration**: Features a green neon button for the Kid Solar AI, indicating various states (recording, processing, playing, error).
- **Marketplace**: Integrates sign-in/registration modals directly into the marketplace experience, displaying username and Solar balance after authentication.
- **Video Streaming**: Implements robust HTTP Range Request support for large video files, ensuring smooth playback and instant seeking/scrubbing across various devices.
- **Theming**: Neon green styling for key interactive elements and links.

### Technical Implementations
- **Frontend**: Vanilla JavaScript for dynamic content rendering and real-time updates. D-ID AI agent is embedded via a CDN script.
- **Backend**: Express.js server, designed for deployment flexibility across environments like Replit and Cloud Run. Utilizes CommonJS architecture for modules.
- **Real-time Analytics**: Dynamic fetching of total visits, geographic analytics, daily visits, and live member count.
- **AI Voice Assistant**: Integrates OpenAI's Whisper (STT), GPT-4o (NLU), and TTS (Nova voice) for natural language wallet control, supporting queries like balance, transactions, and energy listings.
- **Marketplace & Energy Trading**: Features five market categories (Computronium Missions, Culture, Basic Needs, Rent Anything, Energy Trading) with artifact display and an in-memory energy trading ledger for RECs/PPAs.
- **Authentication**: Session-based authentication with extended session durations (30 days), ensuring seamless user experience. Includes self-purchase prevention for marketplace listings.
- **Video Streaming Optimization**: MP4s re-encoded with `faststart` flag, and large files (>10MB) are delivered via HTTP 206 partial content to bypass Cloud Run's 32MB HTTP/1 response limit.
- **Solar Distribution**: Daily 1 Solar token distribution per member since the Genesis Date (April 7, 2025).

### System Design Choices
- **Deployment Strategy**: Optimized for Cloud Run with a lean deployment package (<450MB) and configured with necessary environment variables and a Procfile.
- **Data Storage**: Primarily PostgreSQL with Drizzle ORM for structured member data, supplemented by JSON file fallbacks and in-memory storage for reliability and conversation history.
- **Security**: Environment-based API key storage, session-based tracking, CORS configuration, and rate limiting for external API integrations (e.g., OpenAI).
- **Error Handling**: Comprehensive error handling across the platform, including graceful fallbacks for external service issues and robust session management.

## External Dependencies

### Third-Party Services
- **OpenAI**: Utilized for GPT-4o model (text generation, natural language understanding) and DALL-E (image creation).
- **D-ID**: Provides the AI agent platform for interactive avatar experiences (Kid Solar, agent ID: `v2_agt_vhYf_e_C`).
- **PostgreSQL**: Cloud-hosted relational database for persistent storage, supporting providers like Neon.
- **Vimeo**: Video hosting service.

### APIs and Integrations
- **TC-S Computronium Market API**: Provides endpoints for market categories (`/market/categories`, `/market/artifacts/:category`), energy trading (`/energy`, `/energy/list`, `/energy/match`), and a text command interface for Kid Solar AI (`/kid/query`).
- **OpenAI API**: For AI voice assistant features (Whisper, GPT-4o, TTS).
- **Real-Time Solar Calculations**: Custom mathematical models for energy generation tracking.
- **Member Management API**: RESTful endpoints for user data operations.
- **File Upload API**: For image processing and analysis.
- **Health Check APIs**: For system monitoring and deployment verification.

### Databases
- **Primary**: PostgreSQL (via Drizzle ORM).
- **Fallback/Supplemental**: JSON files, in-memory storage, and file-based conversation persistence.