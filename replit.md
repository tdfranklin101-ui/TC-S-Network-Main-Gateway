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

### Solar Balance Architecture (Single Source of Truth)
**CRITICAL: All Solar balance operations MUST use `members.total_solar` as the single source of truth.**

Data Flow:
1. **Registration**: Creates member record with initial Solar allocation in `members.total_solar`
2. **Session API** (`/api/session`): Queries `members.total_solar` directly from database, caches in session
3. **Purchases** (`storage.purchaseArtifact`): Reads/writes `members.total_solar` via atomic transaction
4. **Daily Distribution**: Updates `members.total_solar` during nightly distribution job
5. **Frontend Display**: All balance displays (wallet.html, marketplace.html) fetch from `/api/session`

**Important**: All `getSession()` calls MUST use `await` since it's an async function. Missing `await` causes session data to be a Promise object, resulting in `userId` and `solarBalance` being undefined.

Storage Methods (in `server/storage.ts`):
- `getMemberSolarBalance(memberId: number)`: Query balance from members table
- `updateMemberSolarBalance(memberId: number, newBalance: number)`: Update balance in members table
- `purchaseArtifact(buyerId: number, artifactId: string)`: Atomic purchase with ledger entries

Note: The `userProfiles.solarBalance` column exists for the separate progression/timer-gated content system. These are distinct features with independent balance tracking.

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
- **Marketplace Search & Procurement API**: 
  - `GET /api/market/search?q=...` - Search active marketplace items
  - `POST /api/market/requests` - Submit request for unavailable items
  - `GET /api/admin/procurement/requests` - Admin: view pending requests
  - `GET /api/admin/procurement/recommendations` - Admin: view AI recommendations
  - `POST /api/admin/procurement/review` - Admin: approve/reject requests
  - `POST /api/market/items/publish` - Admin: publish draft items

### Marketplace Search & Procurement System
The platform implements an AI-powered procurement scout system with human-in-the-loop approval:

**User Flow:**
1. User searches marketplace via `/api/market/search`
2. If no matches found, user submits item request via `/api/market/requests`
3. AI Procurement Scout automatically generates recommendations from allowed portals (Amazon, Walmart, eBay)
4. Foundation admin reviews recommendations at `/admin/procurement-review.html`
5. Admin can APPROVE (creates draft item), REJECT, or request MORE_INFO
6. Approved items become DRAFT listings; separate publish action makes them ACTIVE

**Database Tables:**
- `market_items` - Products/services in marketplace (DRAFT/ACTIVE/ARCHIVED)
- `market_requests` - User requests for unavailable items (NEW → SCOUTING → REVIEW_READY → APPROVED/REJECTED/PUBLISHED)
- `procurement_recommendations` - AI-generated vendor recommendations with fit scores
- `procurement_reviews` - Human review decisions with approval mode

**Security:** Admin routes require `X-Admin: true` header. Agent recommends only; no auto-procurement or auto-publishing.

### Databases
- **Primary**: PostgreSQL (via Drizzle ORM).
- **Fallback/Supplemental**: JSON files, in-memory storage, and file-based conversation persistence.

### WPC (Watts Per Compute) Module
The WPC module provides universal compute-energy intelligence across the 14-repository hub-and-spoke architecture. Version 1.0.0 is the current standard.

**Core Files (Main Gateway):**
- `shared/wpc.js` - CommonJS version for Node.js backends
- `shared/wpc.mjs` - ESM version for modern JavaScript
- `shared/components/WPCPanel.tsx` - Universal React component with `'use client'` for Next.js compatibility
- `client/src/components/tcs/WPCPanel.tsx` - Main Gateway-specific copy

**Deployment:**
- `scripts/deploy-wpc.sh` - Generates integration patches for all 13 satellite repos
- `wpc-patches/` - Contains per-repo integration instructions and WPCPanel.tsx copies
- Safe deployment: Creates patches and README instructions, no automatic pushes

**Key Functions:**
- `estimateFlops()` - Estimates FLOPs for LLM, vision, and diffusion models
- `estimateEnergy()` - Calculates energy in Joules from watts × seconds
- `computeWPC()` - Computes Joules per FLOP ratio
- `joulesToKWh()` - Converts Joules to kilowatt-hours
- `kWhToSolar()` - Converts kWh to Solar tokens (1 Solar = 4913 kWh)
- `efficiencyGrade()` - Returns A+ to D efficiency rating

**Satellite Repos (all use Next.js App Router):**
1. TC-S-Network-Identify-Anything
2. TC-S-Network-Market-Grid (reference: https://solar-grid-market-tdfranklin101.replit.app)
3. TC-S-Network-Satellite-ID-Anywhere
4. TC-S-Network-Seismic-ID-Anywhere
5. TC-S-Network-Solar-Dashboard
6. TC-S-Network-Wallet
7. TC-S-Network-Solar-Reserve
8. TC-S-Network-GBI-Onboarding
9. TC-S-Network-Compute-Governance
10. TC-S-Network-Ethics-Engine
11. TC-S-Network-UIM-Protocol
12. TC-S-Network-Standards
13. TC-S-Network-Z-Private

## Security Hardening (Autonomy Spine v2.1)

### Scoped Admin Keys
All privileged operations require a scoped admin key with appropriate permissions:
- `actions.execute`, `actions.approve`, `actions.reject`
- `settlement.run`, `pricing.publish`, `scheduler.manage`
- `admin.full` for full access

### RBAC System (5 Roles)
- `member`: Basic marketplace access
- `seller`: Asset creation, pricing
- `staff`: Order fulfillment
- `commissioner_admin`: Network operations
- `tcs_admin`: Full system access

### Security Features
- **Intent Logging**: All privileged operations logged with user, role, action, payload hash
- **Replay Protection**: X-Req-Id required on privileged endpoints, 5-min deduplication
- **validateWithRBAC**: Combines scoped admin keys + RBAC permission checks
- **Route Permissions**: 18 privileged routes mapped with required roles

### Key Files
- `server/agentic/security.js`: Scoped keys, RBAC, intent logging, replay protection
- `server/agentic/scheduler.js`: Daily schedulers for settlements/reports
- `server/agentic/routes.js`: Agentic API routes with security enforcement
- `docs/AUTONOMY.md`: Full security documentation