# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. It integrates renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an AI assistant named "Kid Solar." The platform provides real-time solar energy calculations, member wallet functionalities with automatic initialization, and an AI agent that offers polymathic assistance across renewable energy, physics, engineering, and sustainability. It also features a marketplace for digital artifacts and energy trading.

**Deployment Status**: ✅ READY FOR PRODUCTION
- Cloud Run optimized package (~250-450MB after exclusions)
- All core features tested and operational
- Kid Solar multimodal AI assistant fully functional
- Marketplace wallet operations verified

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design Philosophy**: Emphasizes a clean, intuitive interface with clear navigation and real-time data display.
- **3-Division Landing Page**: Homepage displays three organizational divisions: (1) TC-S Network Foundation, Inc. with black transparent background section (rgba(0,0,0,0.65)) featuring high-contrast white text and cyan "Solar Standard" heading, (2) Z Private Networks yellow commissioning header, and (3) TC-S Network Commission oversight references.
- **Foundation Section Styling**: Black semi-transparent background with backdrop blur, high-contrast white lettering (font-weight 800-900), enhanced text shadows and glows, cyan (#00f5d4) accent for "The Solar Standard" heading, and yellow Foundation Signup CTA button.
- **Solar Standard Educational Series**: Five-page educational navigation system explaining the Solar Standard:
  - Page 2: Why the Reserve Matters (authenticity, permanence, distributive framework)
  - Page 3: Governance & Transparency (algorithmic issuance, transparency protocol, trustless governance)
  - Page 4: Marketplace & Networks (REC/PPA energy markets, computronium allocation, Z Private Networks)
  - Page 5: Participation & Get Involved (roles for individuals, generators, institutions, and network operators with CTA to marketplace)
  - All pages feature consistent Foundation design with breadcrumb navigation, Previous/Next links, and data-testid attributes for testing
- **Kid Solar Command Center**: Multi-modal AI chat interface with slide-up panel design, supporting text, voice, image, and file inputs. Features conversation history with mixed-media message cards, iOS native file pickers (camera/gallery/documents), and real-time audio playback. All input modes maintain conversation context seamlessly.
- **Marketplace**: Integrates sign-in/registration modals directly into the marketplace experience, displaying username and Solar balance after authentication.
- **Video Streaming**: Implements robust HTTP Range Request support for large video files, ensuring smooth playback and instant seeking/scrubbing across various devices.
- **Theming**: Neon green (#39FF14) styling for key interactive elements, links, and Kid Solar branding. Foundation section uses black transparent backgrounds with white/cyan high-contrast text.

### Technical Implementations
- **Frontend**: Vanilla JavaScript for dynamic content rendering and real-time updates. D-ID AI agent is embedded via a CDN script.
- **Backend**: Express.js server, designed for deployment flexibility across environments like Replit and Cloud Run. Utilizes CommonJS architecture for modules.
- **Real-time Analytics**: Production-only tracking with daily visit aggregation, geographic analytics (countries and US states), and live member count. Development views are excluded for accurate public metrics. Environment detection via NODE_ENV and Replit deployment flags.
- **AI Multi-Modal Assistant**: Kid Solar Command Center integrates OpenAI's Whisper (STT), GPT-4o (NLU/Vision/Function Calling), and TTS (Nova voice) for natural language wallet control and multi-modal interactions. Supports text chat, voice commands, image analysis via Vision API, and file processing (PDF/TXT/DOC). **NEW (Oct 2025)**: Added OpenAI function calling for marketplace operations - Kid Solar can now execute purchases, preview artifacts, check wallet balance, list marketplace items, analyze uploads, and provide upload guidance through voice or text commands. Conversation context persisted across all input modes using in-memory state management and localStorage conversationId. Base64 audio delivery for TTS responses ensures seamless playback across devices.
- **Marketplace & Energy Trading**: Features five market categories (Computronium Missions, Culture, Basic Needs, Rent Anything, Energy Trading) with artifact display and an in-memory energy trading ledger for RECs/PPAs.
- **Member Content Upload System (Oct 2025)**: Three-tab upload interface for digital artifacts:
  - **Local File Upload**: Direct file uploads with AI-powered "Identify Anything" kWh-to-Solar pricing
  - **AI Music Creator**: URL import from AiSongMaker.io, Suno AI, and Udio platforms (members create externally, paste direct MP3/WAV/FLAC URLs)
  - **Video Hosting**: URL import from Vimeo Create (AI video generator + hosting) and Runway AI (advanced AI video generation). Members create videos externally, paste player URLs (player.vimeo.com/video/...) or direct MP4/WEBM URLs. **Decision (Oct 2025)**: Using Vimeo + Runway AI as primary video platforms - provides immediate member access without API dependencies. Sora 2 API researched but not publicly available as of Oct 2025.
- **Music Streaming Platform**: Separate from marketplace - Music Now (music-now.html) dynamically streams Monazite Foundation tracks + member uploads flagged with `isFreeStreaming: true`. Member uploaded audio served from `/uploads/member-content/audio/` with Range Request support.
- **Authentication**: Session-based authentication with extended session durations (30 days), ensuring seamless user experience. Includes self-purchase prevention for marketplace listings. **FIXED (Oct 10, 2025)**: Complete Kid Solar authentication overhaul - changed `currentUser.id` to `currentUser.userId` throughout, added Number() coercion for all balance values to prevent TypeError, made login/signup work without page reload via async session refresh, and added balance display to Kid Solar welcome message. All 6 critical authentication issues resolved and architect-approved.
- **Video Streaming Optimization**: MP4s re-encoded with `faststart` flag, and large files (>10MB) are delivered via HTTP 206 partial content to bypass Cloud Run's 32MB HTTP/1 response limit.
- **Solar Distribution**: Daily 1 Solar token distribution per member since the Genesis Date (April 7, 2025).

### System Design Choices
- **Deployment Strategy**: Optimized for Cloud Run with a lean deployment package (<450MB) and configured with necessary environment variables and a Procfile.
- **Data Storage**: Primarily PostgreSQL with Drizzle ORM for structured member data, supplemented by JSON file fallbacks and in-memory storage for reliability. Multi-modal conversation history stored in-memory (Map<conversationId, messages[]>) with automatic cleanup after 1 hour of inactivity.
- **Security**: Environment-based API key storage, session-based tracking, CORS configuration, and rate limiting for external API integrations (e.g., OpenAI).
- **Error Handling**: Comprehensive error handling across the platform, including graceful fallbacks for external service issues and robust session management.

## External Dependencies

### Third-Party Services
- **OpenAI**: Utilized for GPT-4o model (text generation, natural language understanding, vision analysis), Whisper (speech-to-text), TTS (text-to-speech with Nova voice), and DALL-E (image creation).
- **D-ID**: Provides the AI agent platform for interactive avatar experiences (Kid Solar, agent ID: `v2_agt_vhYf_e_C`).
- **PostgreSQL**: Cloud-hosted relational database for persistent storage, supporting providers like Neon.
- **AI Content Creation Platforms (Member-Accessible)** - **NEW (Oct 10, 2025)**: Implemented compact dropdown discovery system with 9 platforms:
  - **Music Creators (3)**: Suno AI, Udio, AiSongMaker.io - AI music generation platforms
  - **Video Creators (2)**: Vimeo Create (AI video + hosting), Runway AI (Gen-2/Gen-3 models)
  - **Code Creators (4)**: Replit (app builder), OpenAI Codex (code gen), Bolt.new (full-stack AI), v0.dev (UI generator)
  - **UX**: 3 compact dropdown buttons in Upload tab - click to reveal platform choices with descriptions
  - Note: All external platforms accessed by members directly; no API keys required on TC-S platform side

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