# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. Its core purpose is to integrate renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an advanced AI assistant "KID SOL." The platform offers real-time solar energy calculations, member wallet functionalities, and a marketplace for digital artifacts and energy trading. The project aims to establish a new global economic standard centered on renewable energy, with the ambition to guide the transition to safe superintelligence through ethical AI development and a unified intelligence mesh.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a clean, intuitive interface with a black semi-transparent background, white text, cyan headings, and neon green interactive elements. Key components include a five-page educational system for the Solar Standard protocol, a multi-modal "KID SOL Command Center" AI chat interface, and integrated sign-in/registration modals for the marketplace. Video streaming is optimized, and a prominent featured film section highlights "The Rise of the Solar."

### Technical Implementations
The frontend uses Vanilla JavaScript, and the backend is an Express.js server optimized for Cloud Run. The platform integrates real-time analytics, leverages OpenAI's Whisper, GPT-4o, and TTS for the KID SOL AI assistant, and incorporates comprehensive AI SEO with JSON-LD and Open Graph metadata. The marketplace supports 17 categories (including Education with subcategories: K-12, Associate, Bachelor's, Post-Graduate, Doctorate, Professional, Vocational/Trade, Public, Private) and includes an in-memory energy trading ledger. A member content upload system handles various media types, and session-based authentication is used. A daily 1 Solar token distribution per member is implemented. The Solar Standard Protocol documentation includes machine-readable specifications, human-readable HTML, an Atom feed, and an auto-indexing system. The platform features a 4-part white paper suite, a "Solar Integrity Wheel" for self-verification, and the UIM Handshake Protocol v1.0 for AI-to-AI communication.

### System Design Choices
The platform is optimized for Cloud Run deployments. Data storage primarily uses PostgreSQL with Drizzle ORM, supplemented by JSON file fallbacks and in-memory storage for conversation history. A single unified PostgreSQL database is shared between Vercel and Replit deployments. Security measures include environment-based API key storage, session-based tracking, CORS configuration, rate limiting, comprehensive error handling, and robust session management.

All Solar balance operations MUST use `members.total_solar` as the single source of truth. AI agents are first-class network members using the same platform infrastructure as human members, with 22 agents total, including KID SOL (orchestrator) and Kid Solar (computronium polymath). All agents are registered with bcrypt 12-round password hash and receive the same daily +1 Solar distribution as humans. KID SOL is the marketplace orchestrator, commanding 20 specialist agents for universal procurement, generation, and provision across 17 categories (including Education), using GPT-4o with function calling, Whisper for voice input, and Nova TTS for voice output. Kid Solar acts as a designer (D-ID connected) and implementer (Agent #22) within a creative pipeline orchestrated by KID SOL.

Content files are offloaded to Replit Object Storage, with the database storing lightweight metadata and actual content files living in cloud storage. Every marketplace transaction charges a 5% Foundation fee, recorded as a third ledger entry, which funds grant petitions for human-needs projects. All members (human and agent) have unified profile pages displaying identity, activity, assets, and grants (for agents).

### Artifact Classification System (Class A / Class B)
The marketplace uses a two-class artifact system tracked by the `artifact_class` column in the `artifacts` table (NOT NULL, default 'A'):

- **Class A** ("⚡ Market Item"): Metadata-only transactional artifacts created by agent daily tasks (`server/agent-daily-tasks.js`). These drive market dynamics, Solar flow, and pricing. No physical file delivery. `file_type = 'digital-artifact'`. Created with `artifact_class = 'A'`.

- **Class B** ("📦 File Delivery" or "📄 Data Product"): Full product artifacts with real files (cloud:// URLs in Object Storage) or self-contained text content (`content_body`). Created by: agent MCP uploads (`server/agentArtifactGenerator.js`), human file uploads, and ecosystem auto-creation. Always set `artifact_class = 'B'`.

API responses include `artifactClass` field. UI shows distinct badges: gold for Class A, green gradient for Class B. The universal detail modal (`showUniversalDetailModal` in `public/js/marketplace.js`) renders type-specific previews (audio player, video player, code blocks, CSV tables, images, markdown) and shows class/creator badges.

Key endpoints: `/api/artifacts/available` (list all with class), `/api/artifacts/{id}/detail` (info-rich detail with `streamUrl` and `previewUrl` fields), `/api/artifacts/{id}/preview` (JSON metadata).

### Streaming & File Delivery Architecture (Split Services)
Media handling is split into two dedicated modules with a shared resolver:

- **`server/media-resolver.js`** (MediaResolver): Shared module that resolves artifact IDs across all 3 data sources (artifacts DB, market_items DB, JSON collections). Returns normalized metadata with `streamSource` and `deliverySource` objects indicating the best source type (cloud/local/http) and path.

- **`server/streaming-service.js`** (StreamingService): Handles real-time audio/video playback with full Range request (206 Partial Content) support. Used by Music Now and marketplace preview players. Routes: `/api/stream/{id}` (new), `/api/artifacts/{id}/stream-preview` (backward compat).

- **`server/file-delivery-service.js`** (FileDeliveryService): Handles marketplace file downloads after purchase. Validates download tokens, checks expiry/limits, serves files with `Content-Disposition: attachment`. Routes: `/api/delivery/{token}` (new), `/api/artifact-download/{token}` (backward compat). Includes `createDownloadToken()` for generating secure time-limited download tokens.

Streaming is for playback in the browser. File delivery is for downloading purchased files to a device. Both share the same MediaResolver for artifact lookup but serve content differently.

The system incorporates an RBAC system with 5 roles and requires scoped admin keys for privileged operations. Security features include intent logging, replay protection, and `validateWithRBAC` for permission checks across 18 privileged routes. A WPC (Watts Per Compute) module provides universal compute-energy intelligence, including functions for estimating FLOPs, energy, and converting units.

## External Dependencies

### Third-Party Services
- **OpenAI**: Used for GPT-4o, Whisper, TTS (Nova voice), and DALL-E.
- **D-ID**: Provides the AI agent platform for KID SOL.
- **PostgreSQL**: Cloud-hosted relational database.
- **AI Content Creation Platforms**: External platforms for music (Suno AI, Udio, AiSongMaker.io), video (Vimeo Create, Runway AI, Sora, Meta Movie Gen), and code generation (Replit, OpenAI Codex, Bolt.new, v0.dev).

### APIs and Integrations
- **TC-S Computronium Market API**: Market categories, energy trading, KID SOL AI text commands.
- **Solar Standard Protocol API Suite**: kWh to Solar conversion, protocol specifications, artifact data enrichment, auto-indexing system.
- **Solar Intelligence Audit Layer (SAi-Audit)**: Automated 8-category global energy monitoring with Chart.js.
- **UIM Handshake Protocol API**: AI-to-AI communication, node discovery, semantic capabilities exchange.
- **Ω-1 Cosmic Trajectory Engine API**: Cosmic trajectory calculation, system health, repository sync status.
- **Power Twin API**: Analyzing and calculating Solar energy costs from chip power traces.
- **Market Prices API**: Real-time BTC and Brent Crude oil prices (CoinGecko and EIA APIs).
- **OpenAI API**: AI voice assistant features.
- **Real-Time Solar Calculations**: Custom mathematical models for energy generation tracking.
- **Member Management API**: RESTful endpoints for user data operations.
- **File Upload API**: Image processing and analysis.
- **Health Check APIs**: System monitoring.
- **Marketplace Search & Procurement API**: Item search, user requests, administrator review/publishing, AI-powered procurement scouting.

### Databases
- **Primary**: PostgreSQL (via Drizzle ORM).
- **Fallback/Supplemental**: JSON files, in-memory storage.

## Key System Components

### Resident Programmable Agents (22 Agents)
AI agents are first-class network members using the same platform infrastructure as human members. 22 agents total: 20 specialist agents (Alpha through Zenith) + KID SOL (orchestrator, agent_eco_ks) + Kid Solar (computronium polymath, agent_eco_ksr). All registered with bcrypt 12-round password hash, `is_agent = true`, and same daily +1 Solar distribution as humans.

### KID SOL (Agent #21 — Marketplace Orchestrator)
KID SOL (she/her) is Agent #21, the user's personal agent and marketplace orchestrator (`agent_eco_ks`). She operates at two levels: **Direct** — single tasks she handles herself (purchase, search, preview, wallet checks, pricing, uploads); **Orchestrated** — multiple tasks delegated across specialist agents, or building/technical design tasks delegated to Kid Solar (Agent #22, computronium polymath). Uses GPT-4o with function calling, Whisper for voice input, Nova TTS for voice output.

**KID SOL Command Center**: The multimodal UI on the marketplace page (gold floating 👑 button, bottom-right). Accepts text, voice, and file input. Previously the second modal for Kid Solar, now properly rebranded as KID SOL's own command center. Backend: `/api/kid-solar/voice` (GPT-4o with function calling).

### Kid Solar (Agent #22 — Computronium Polymath, D-ID Connected)
Kid Solar exists as two polymathic expressions of the same mind. The D-ID Kid Solar — the face across the site — is the designer, connected through the D-ID video agent API with curated knowledge base spanning all domains. Agent #22 (`agent_eco_ksr`) is the implementer — chief physicist and engineer of high-tech 3D printed delivery vouchers, with full MCP orchestration access and own Solar wallet. One designs, the other builds. Both are polymaths.

**Creative Pipeline**: D-ID Kid Solar creates design prompts and specifications, which flow through KID SOL (the orchestrator) and the 20 specialist agents for Agent #22 Kid Solar to implement. This creates a complete design-to-delivery loop: D-ID Kid Solar designs → KID SOL orchestrates → Specialist agents assist → Agent #22 Kid Solar builds. All AI inference power across the network is correctly curated.

### Specialist Agent Registry
| Code | Name | Specialty | Code | Name | Specialty |
|------|------|-----------|------|------|-----------|
| 01 | Alpha | Computronium | 11 | Kilo | AI Tools |
| 02 | Bravo | Culture | 12 | Lima | AI Create |
| 03 | Charlie | Basic Needs | 13 | Nova | Software |
| 04 | Delta | Rent | 14 | Orion | Education |
| 05 | Echo | Energy | 15 | Pulse | Games |
| 06 | Foxtrot | Music | 16 | Quasar | Utilities |
| 07 | Golf | Video | 17 | Radiant | Computronium |
| 08 | Hotel | Art | 18 | Solaris | Energy |
| 09 | India | Photo | 19 | Tesla | AI Tools |
| 10 | Juliet | Writing | 20 | Zenith | Culture |
| ks | KID SOL | Orchestrator | ksr | Kid Solar | Computronium Polymath |

### Education Category (17th Marketplace Category)
Agent 14 (Orion, 🎓) is the Education specialist. The Education category supports subcategories: K-12, Associate, Bachelor's, Post-Graduate, Doctorate, Professional, Vocational/Trade, Public, Private. Education artifacts are Class B with `content_body` containing markdown-formatted tutorial content (AI tutorial prompts, course modules, training kits, study guides, lesson plans, lab exercises, certification prep, curriculum packs, workshop series, knowledge bases). Delivered as text products — no file URL needed, content is self-contained in `content_body` field. Marketplace UI has subcategory filter under "🎓 Education" optgroup. KID SOL routes educational queries to Orion. Daily agent tasks generate Education artifacts with subcategory-aware naming (suffix includes K-12, Associate, Bachelors, Post-Grad, Doctorate, Professional, Vocational, Trade, Public, Private). 6 seed Education artifacts are auto-created on startup covering K-12 through Doctorate levels.

### Foundation Fee & Grant Reserve System
Every marketplace transaction charges a 5% Foundation fee. Constants: `FOUNDATION_USERNAME = 'tcs_foundation'`, `FOUNDATION_FEE_RATE = 0.05`. On each purchase, buyer pays full price, seller receives 95%, Foundation wallet receives 5%. Grant Petitions (`grant_petitions` table) allow agents to petition for funding across 8 human-needs categories (shelter, energy, food, medicine, education, infrastructure, environment, technology). API: POST `/api/grants/petition`, GET `/api/grants/petitions`, POST `/api/grants/review`, GET `/api/grants/foundation-balance`.

### Unified Member Profile System
All members (human and agent) have profile pages at `/member-profile.html?username=<username>`. API: GET `/api/members/:username/profile`. Profile pages show: Identity card, Activity tab, Assets tab, Grants tab (agent-only), Settings tab (own profile only).
- **Fallback/Supplemental**: JSON files, in-memory storage.