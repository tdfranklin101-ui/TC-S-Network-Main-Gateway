# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. Its core purpose is to integrate renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an advanced AI assistant "Kid Solar." The platform offers real-time solar energy calculations, member wallet functionalities, and a marketplace for digital artifacts and energy trading. The project aims to establish a new global economic standard centered on renewable energy, with the ambition to guide the transition to safe superintelligence through ethical AI development and a unified intelligence mesh.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a clean, intuitive interface with clear navigation. The design utilizes a black semi-transparent background with high-contrast white text, cyan for headings, and neon green for interactive elements. Key components include a five-page educational system for the Solar Standard protocol, a multi-modal "Kid Solar Command Center" AI chat interface, and integrated sign-in/registration modals for the marketplace. Video streaming is optimized for smooth playback, and a prominent featured film section highlights "The Rise of the Solar."

### Technical Implementations
The frontend uses Vanilla JavaScript, while the backend is an Express.js server optimized for Cloud Run. The platform integrates real-time analytics for page views and member counts. The multi-modal AI assistant, Kid Solar, leverages OpenAI's Whisper, GPT-4o, and TTS for natural language interactions, including marketplace operations and wallet control. Comprehensive AI SEO integration ensures discoverability across various AI systems and search engines, incorporating JSON-LD structured data and Open Graph metadata. The marketplace supports five categories and includes an in-memory energy trading ledger. A member content upload system handles local files, AI-generated music, and external video hosting. Session-based authentication is used for a seamless user experience. Video streaming is optimized with `faststart` and HTTP 206 partial content. A daily 1 Solar token distribution per member is implemented. The Solar Standard Protocol documentation includes machine-readable specifications, human-readable HTML, an Atom feed, and an auto-indexing system. The platform features a comprehensive 4-part white paper suite on the GENIUS Act, Unified Intelligence Mesh (UIM), ethical AI optimization, and safe superintelligence. A "Solar Integrity Wheel" provides a self-verification system with daily audits and SHA-256 hash verification of core protocol files. The UIM Handshake Protocol v1.0 enables AI-to-AI communication with cryptographic signatures, energy tracking, ethics scoring, and an audit log.

### System Design Choices
The platform is optimized for Cloud Run deployments. Data storage primarily uses PostgreSQL with Drizzle ORM, supplemented by JSON file fallbacks and in-memory storage for conversation history. **A single unified PostgreSQL database** is shared between Vercel and Replit deployments, ensuring consistent user data across both platforms. Security measures include environment-based API key storage, session-based tracking, CORS configuration, and rate limiting. Comprehensive error handling and robust session management are integral to the system's design.

### Cross-Domain Authentication
Session management uses **database-backed sessions** stored in the PostgreSQL `session` table (sid, sess, expire columns) for cross-domain authentication between Vercel (frontend) and Replit (backend). Key features:
- Sessions persist across server restarts
- 30-day session expiration
- Cookies use `SameSite=None; Secure` for cross-domain access
- Local cache (`sessionCache`) provides fast lookups with database as source of truth
- Automatic cleanup of expired sessions every 15 minutes

## External Dependencies

### Third-Party Services
- **OpenAI**: Used for GPT-4o (text, NLU, vision), Whisper (STT), TTS (Nova voice), and DALL-E (image generation).
- **D-ID**: Provides the AI agent platform for interactive avatar experiences (Kid Solar).
- **PostgreSQL**: Cloud-hosted relational database.
- **AI Content Creation Platforms**: External platforms for music (Suno AI, Udio, AiSongMaker.io), video (Vimeo Create, Runway AI, Sora, Meta Movie Gen), and code generation (Replit, OpenAI Codex, Bolt.new, v0.dev).

### APIs and Integrations
- **TC-S Computronium Market API**: Provides endpoints for market categories, energy trading, and Kid Solar AI text commands.
- **Solar Standard Protocol API Suite**: Offers endpoints for kWh to Solar conversion, protocol specifications, artifact data enrichment, and an auto-indexing system, all CORS-enabled.
- **Solar Intelligence Audit Layer (SAi-Audit)**: An automated 8-category global energy monitoring system with 48/48 global coverage and regulatory-grade audit trails, displaying Chart.js visualizations. It uses a three-tier data freshness system (live API, quarterly API, annual dataset) with robust fallbacks.
- **UIM Handshake Protocol API**: Core endpoints for AI-to-AI communication, including node discovery, semantic capabilities exchange, and task proposal/acceptance.
- **Ω-1 Cosmic Trajectory Engine API**: Endpoints at `/api/omega1/query` (cosmic trajectory calculation), `/api/omega1/status` (system health), `/api/omega1/indices/init` (indices initialization), and `/api/omega1/repos/status` (14-repository sync status). Calculates minimum-entropy trajectory for civilization longevity.
- **Power Twin API**: Endpoints at `/api/power-twin/analyze` (CSV file upload), `/api/power-twin/calculate` (JSON input), `/api/power-twin/constants`, `/api/power-twin/simulator/status` (external simulator health check), and `/api/power-twin/simulator/info` (simulator capabilities). Converts chip power traces into Solar energy costs using left Riemann integration. JSON output format: tcs-power-twin-v1. Also available as CLI tool at `scripts/power_twin.py`. Integrated with external Open Silicon Stack simulator at `open-source-eda-tdfranklin101.replit.app` for VexRiscv, OpenRAM, Skywater PDK, and OpenLane simulations.
- **Market Prices API**: Endpoint at `/api/market-prices` provides real-time BTC and Brent Crude oil prices. Uses CoinGecko API for Bitcoin prices (free, no key required) and EIA API for Brent Crude (uses EIA_API_KEY secret). Returns prices with fallback values (BTC: $97,500, Brent: $73.50/bbl) to ensure no N/A values. Includes normalized indices for dashboard charting (Fiat USD baseline=100, BTC index, Solar index, Brent index).
- **OpenAI API**: Used for AI voice assistant features (Whisper, GPT-4o, TTS).
- **Real-Time Solar Calculations**: Custom mathematical models for energy generation tracking.
- **Member Management API**: RESTful endpoints for user data operations.
- **File Upload API**: For image processing and analysis.
- **Health Check APIs**: For system monitoring.

### Databases
- **Primary**: PostgreSQL (via Drizzle ORM).
- **Fallback/Supplemental**: JSON files, in-memory storage, and file-based conversation persistence.