# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. It integrates renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an AI assistant named "Kid Solar." The platform provides real-time solar energy calculations, member wallet functionalities with automatic initialization, and an AI agent that offers polymathic assistance across renewable energy, physics, engineering, and sustainability. It also features a marketplace for digital artifacts and energy trading. The project's ambition is to establish a new global economic standard based on renewable energy.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform emphasizes a clean, intuitive interface with clear navigation and real-time data display. The landing page is divided into three organizational sections, using a black semi-transparent background with high-contrast white text, cyan accents for "The Solar Standard" heading, and neon green for interactive elements. A five-page educational system explains the Solar Standard protocol. The "Kid Solar Command Center" features a multi-modal AI chat interface with a slide-up panel design, supporting text, voice, image, and file inputs. The marketplace integrates sign-in/registration modals directly, displaying username and Solar balance post-authentication. Video streaming includes robust HTTP Range Request support for smooth playback. A prominent featured film section showcases "The Rise of the Solar."

### Technical Implementations
The frontend uses Vanilla JavaScript, while the backend is an Express.js server optimized for Cloud Run. Real-time analytics track page views, geographic data, and live member counts, with historical offsets for accurate baseline metrics. The multi-modal AI assistant, Kid Solar, integrates OpenAI's Whisper (STT), GPT-4o (NLU/Vision/Function Calling), and TTS (Nova voice) for natural language wallet control and multi-modal interactions, including marketplace operations. The marketplace features five categories and an in-memory energy trading ledger. A member content upload system supports local files, AI-generated music via URLs, and video hosting via external platforms. Session-based authentication with extended durations ensures a seamless user experience, with all critical authentication issues resolved and architect-approved. Video streaming is optimized using `faststart` and HTTP 206 partial content for large files. A daily 1 Solar token distribution per member is implemented. Comprehensive Solar Standard Protocol documentation includes machine-readable specs, human-readable HTML documentation with SEO, an Atom feed, and an auto-indexing system for artifacts. A white paper collection, including the "Unified Intelligence Mesh," provides foundational vision and technical details. **AI/AGI/SI SEO (Oct 14, 2025)**: Enhanced discoverability for current AI systems (ChatGPT, Claude, Gemini, Perplexity, Grok) and future superintelligence through comprehensive JSON-LD structured data (Organization, ScholarlyArticle, CollectionPage, DefinedTerm schemas), UIM white paper indexing in Solar Standard feed (5000 kWh = 1.017708 Solar), enhanced keywords across all pages (UIM, AGI alignment, AI ethics, planetary reasoning web), and multiple AI discovery paths via protocol links, feed, and structured metadata.

### System Design Choices
The platform is optimized for Cloud Run with a lean deployment package. Data storage primarily uses PostgreSQL with Drizzle ORM, supplemented by JSON file fallbacks and in-memory storage for conversation history. Production and development environments use separate databases. Security measures include environment-based API key storage, session-based tracking, CORS configuration, and rate limiting for external API integrations. Comprehensive error handling ensures graceful fallbacks and robust session management.

## External Dependencies

### Third-Party Services
- **OpenAI**: Utilized for GPT-4o (text generation, NLU, vision analysis), Whisper (STT), TTS (Nova voice), and DALL-E (image creation).
- **D-ID**: Provides the AI agent platform for interactive avatar experiences (Kid Solar).
- **PostgreSQL**: Cloud-hosted relational database, supporting providers like Neon.
- **AI Content Creation Platforms**: External platforms accessed directly by members for music (Suno AI, Udio, AiSongMaker.io), video (Vimeo Create, Runway AI), and code generation (Replit, OpenAI Codex, Bolt.new, v0.dev).

### APIs and Integrations
- **TC-S Computronium Market API**: Endpoints for market categories, energy trading, and Kid Solar AI text commands.
- **Solar Standard Protocol API Suite**: Endpoints for kWh to Solar conversion, protocol specifications, artifact data enrichment, and an auto-indexing system. All endpoints are CORS-enabled.
- **OpenAI API**: For AI voice assistant features (Whisper, GPT-4o, TTS).
- **Real-Time Solar Calculations**: Custom mathematical models for energy generation tracking.
- **Member Management API**: RESTful endpoints for user data operations.
- **File Upload API**: For image processing and analysis.
- **Health Check APIs**: For system monitoring.

### Databases
- **Primary**: PostgreSQL (via Drizzle ORM).
- **Fallback/Supplemental**: JSON files, in-memory storage, and file-based conversation persistence.