# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. Its core purpose is to integrate renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an advanced AI assistant "KID SOL." The platform offers real-time solar energy calculations, member wallet functionalities, and a marketplace for digital artifacts and energy trading. The project aims to establish a new global economic standard centered on renewable energy, with the ambition to guide the transition to safe superintelligence through ethical AI development and a unified intelligence mesh.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a clean, intuitive interface with a black semi-transparent background, white text, cyan headings, and neon green interactive elements. Key components include a five-page educational system for the Solar Standard protocol, a multi-modal "KID SOL Command Center" AI chat interface, and integrated sign-in/registration modals for the marketplace. Video streaming is optimized, and a prominent featured film section highlights "The Rise of the Solar."

### Technical Implementations
The frontend uses Vanilla JavaScript, and the backend is an Express.js server optimized for Cloud Run. The platform integrates real-time analytics, leverages OpenAI's Whisper, GPT-4o, and TTS for the KID SOL AI assistant, and incorporates comprehensive AI SEO with JSON-LD and Open Graph metadata. The marketplace supports five categories and includes an in-memory energy trading ledger. A member content upload system handles various media types, and session-based authentication is used. Video streaming is optimized with `faststart` and HTTP 206 partial content. A daily 1 Solar token distribution per member is implemented. The Solar Standard Protocol documentation includes machine-readable specifications, human-readable HTML, an Atom feed, and an auto-indexing system. The platform features a 4-part white paper suite, a "Solar Integrity Wheel" for self-verification, and the UIM Handshake Protocol v1.0 for AI-to-AI communication.

### System Design Choices
The platform is optimized for Cloud Run deployments. Data storage primarily uses PostgreSQL with Drizzle ORM, supplemented by JSON file fallbacks and in-memory storage for conversation history. A single unified PostgreSQL database is shared between Vercel and Replit deployments. Security measures include environment-based API key storage, session-based tracking, CORS configuration, rate limiting, comprehensive error handling, and robust session management.

### Cross-Domain Authentication
Session management uses database-backed sessions stored in the PostgreSQL `session` table for cross-domain authentication between Vercel (frontend) and Replit (backend). Sessions persist across server restarts with a 30-day expiration, and cookies use `SameSite=None; Secure`. A local `sessionCache` provides fast lookups with the database as the source of truth, and expired sessions are automatically cleaned up.

### Solar Balance Architecture (Single Source of Truth)
All Solar balance operations MUST use `members.total_solar` as the single source of truth. This includes initial allocation upon registration, retrieval via the `/api/session` API, updates during purchases via atomic transactions, and daily distribution. All frontend displays fetch the balance from `/api/session`. All `getSession()` calls MUST use `await`.

### Resident Programmable Agents (22 Agents)
AI agents are first-class network members using the same platform infrastructure as human members. 22 agents total: 20 specialist agents (Alpha through Zenith) + KID SOL (orchestrator, agent_eco_ks) + Kid Solar (freelance polymath, agent_eco_ksr). All registered with bcrypt 12-round password hash, `is_agent = true`, and same daily +1 Solar distribution as humans. The ecosystem test (`/ecosystem-test.html`) registers agents via `/api/auth/signup`, resolves existing agents via `storage.getMemberByUsername()`, and executes purchases through `storage.purchaseArtifact()` — the exact same atomic transaction flow used by human purchases at `/api/marketplace/purchase`. Agent transactions create real double-entry ledger entries in `marketplace_ledger`, real artifact copies in `artifact_copies`, and real download tokens. Daily Solar distribution updates `members.total_solar` via `storage.updateMemberSolarBalance()` with ledger entries. Three ecosystem API endpoints (`/api/ecosystem/resolve-agent`, `/api/ecosystem/distribute`, `/api/ecosystem/purchase`) use `pool.query()` with direct SQL (same logic as storage.ts methods) to provide agent-accessible interfaces without session cookie requirements.

### KID SOL (Agent #21 — Marketplace Orchestrator)
KID SOL (she/her) is Agent #21, the user's personal agent and marketplace orchestrator (`agent_eco_ks`). She commands the 20 specialist agents via MCP (Model Context Protocol) for universal procurement, generation, and provision across 16 categories. Uses GPT-4o with function calling, Whisper for voice input, Nova TTS for voice output. All purchases use atomic double-entry ledger (BEGIN/COMMIT/ROLLBACK with marketplace_ledger, artifact_copies, transactions table). MCP functions: `agent_recommend` (delegate to specialists), `agent_batch_order` (multi-category purchases), `agent_network_status` (network awareness). Personal agent page: `/agent.html`.

### Kid Solar (Agent #22 — Freelance Polymath, D-ID Connected)
Kid Solar is Agent #22, a separate freelance agent (`agent_eco_ksr`) with MCP capabilities, connected through the D-ID video agent API. Operates as an independent polymath with curated knowledge base and full MCP orchestration access. The Kid Solar face appears across the site via `kid-solar-controller.js` which handles D-ID script injection, session activation/deactivation, and persistent session state. Kid Solar and KID SOL are two different agents — KID SOL is the marketplace orchestrator, Kid Solar is the freelance polymath.

### Specialist Agent Registry
| Code | Name | Specialty | Code | Name | Specialty |
|------|------|-----------|------|------|-----------|
| 01 | Alpha | Computronium | 11 | Kilo | AI Tools |
| 02 | Bravo | Culture | 12 | Lima | AI Create |
| 03 | Charlie | Basic Needs | 13 | Nova | Software |
| 04 | Delta | Rent | 14 | Orion | Docs |
| 05 | Echo | Energy | 15 | Pulse | Games |
| 06 | Foxtrot | Music | 16 | Quasar | Utilities |
| 07 | Golf | Video | 17 | Radiant | Computronium |
| 08 | Hotel | Art | 18 | Solaris | Energy |
| 09 | India | Photo | 19 | Tesla | AI Tools |
| 10 | Juliet | Writing | 20 | Zenith | Culture |
| ks | KID SOL | Orchestrator | ksr | Kid Solar | Freelance Polymath |

### Content Storage Architecture (Implemented)
Content files are offloaded to Replit Object Storage to keep deployments lean. The database stores lightweight metadata (title, price, seller, category, cloud URL pointer) while actual content files live in cloud storage. Key components:
- **ObjectStorageService** (`server/cloud-storage.js`): Unified wrapper for `@replit/object-storage` with `uploadMasterFile()`, `uploadTradeFile()`, `uploadPreviewFile()`, `downloadFile()`, `migrateLocalFile()` methods.
- **ArtifactFileManager** (`server/artifact-file-manager.js`): Three-copy workflow (master/preview/trade) uploads to cloud first, falls back to local filesystem. Returns `storageProvider: 'cloud'|'local'` and `cloudKey` in results.
- **Secure Download Route** (`/api/files/secure/:type/:artifactId`): Tries cloud storage via `getCloudFile()` first, falls back to local file serving for legacy artifacts.
- **Storage Layout**: Master and trade files go to `{PRIVATE_OBJECT_DIR}/master/` and `{PRIVATE_OBJECT_DIR}/trade/` (private). Previews go to `public/previews/` (public access).
- **Migration**: `scripts/migrate-to-cloud-storage.js` uploads existing local files and optionally updates DB URLs with `--update-db` flag.
- **AI Creation Pipeline** (`ai-creation-engine.js`): Uses `@replit/object-storage` directly for ecosystem artifact generation with same cloud-first/local-fallback pattern.

### Foundation Fee & Grant Reserve System
Every marketplace transaction charges a 5% Foundation fee. Constants: `FOUNDATION_USERNAME = 'tcs_foundation'`, `FOUNDATION_FEE_RATE = 0.05`. On each purchase, buyer pays full price, seller receives 95%, Foundation wallet receives 5%. The Foundation fee is recorded as a third ledger entry (entry_type: 'credit', account_type: 'foundation', reference_type: 'foundation_fee'). The `getOrCreateFoundationMember()` helper ensures the Foundation member exists before any transaction. Grant Petitions (`grant_petitions` table) allow agents to petition the Foundation for funding to advance human-needs projects (shelter, energy, food, medicine, education, infrastructure, environment, technology). API: POST `/api/grants/petition`, GET `/api/grants/petitions`, POST `/api/grants/review` (approve with atomic ledger transfer or deny), GET `/api/grants/foundation-balance`. Grant approval uses SELECT FOR UPDATE to prevent race conditions.

### Unified Member Profile System
All members (human and agent) have profile pages at `/member-profile.html?username=<username>`. API: GET `/api/members/:username/profile` returns member info, recent transactions, created artifacts, purchased artifacts, grant petitions (agents), and isOwnProfile flag. Profile pages show: Identity card (with agent icon/specialty or human badge), Activity tab (transaction history), Assets tab (created + purchased), Grants tab (agent-only, with petition submission form), Settings tab (own profile only). Foundation profile shows reserve balance, fee income, and grants disbursed.

### Security Hardening (Autonomy Spine v2.1)
The system incorporates an RBAC system with 5 roles (`member`, `seller`, `staff`, `commissioner_admin`, `tcs_admin`) and requires scoped admin keys for privileged operations. Security features include intent logging for all privileged actions, replay protection using `X-Req-Id` for 5-minute deduplication, and `validateWithRBAC` for combining key and role-based permission checks across 18 privileged routes. An Agent Dashboard (`/agent-dashboard.html`) provides a unified administrative interface for managing marketplace operations with tabs for Actions, Schedulers, Intent Logs, Marketplace Admin, and Settings. All API endpoints for the dashboard enforce strict RBAC and replay protection.

### WPC (Watts Per Compute) Module
The WPC module provides universal compute-energy intelligence across the 14-repository hub-and-spoke architecture (Version 1.0.0). It includes shared JavaScript modules (`wpc.js`, `wpc.mjs`) and a React component (`WPCPanel.tsx`). Key functions include `estimateFlops()`, `estimateEnergy()`, `computeWPC()`, `joulesToKWh()`, `kWhToSolar()`, and `efficiencyGrade()`. Deployment involves generating integration patches for 13 satellite repositories.

## External Dependencies

### Third-Party Services
- **OpenAI**: Used for GPT-4o, Whisper, TTS (Nova voice), and DALL-E.
- **D-ID**: Provides the AI agent platform for KID SOL.
- **PostgreSQL**: Cloud-hosted relational database.
- **AI Content Creation Platforms**: External platforms for music (Suno AI, Udio, AiSongMaker.io), video (Vimeo Create, Runway AI, Sora, Meta Movie Gen), and code generation (Replit, OpenAI Codex, Bolt.new, v0.dev).

### APIs and Integrations
- **TC-S Computronium Market API**: Provides endpoints for market categories, energy trading, and KID SOL AI text commands.
- **Solar Standard Protocol API Suite**: Offers endpoints for kWh to Solar conversion, protocol specifications, artifact data enrichment, and an auto-indexing system.
- **Solar Intelligence Audit Layer (SAi-Audit)**: Automated 8-category global energy monitoring system with Chart.js visualizations.
- **UIM Handshake Protocol API**: Core endpoints for AI-to-AI communication, including node discovery and semantic capabilities exchange.
- **Ω-1 Cosmic Trajectory Engine API**: Endpoints for cosmic trajectory calculation, system health, and repository sync status.
- **Power Twin API**: Endpoints for analyzing and calculating Solar energy costs from chip power traces, integrated with an external Open Silicon Stack simulator.
- **Market Prices API**: Provides real-time BTC and Brent Crude oil prices using CoinGecko and EIA APIs, with fallback values and normalized indices.
- **OpenAI API**: Used for AI voice assistant features.
- **Real-Time Solar Calculations**: Custom mathematical models for energy generation tracking.
- **Member Management API**: RESTful endpoints for user data operations.
- **File Upload API**: For image processing and analysis.
- **Health Check APIs**: For system monitoring.
- **Marketplace Search & Procurement API**: Endpoints for searching items, submitting user requests, and administrator review/publishing of items with AI-powered procurement scouting.

### Databases
- **Primary**: PostgreSQL (via Drizzle ORM).
- **Fallback/Supplemental**: JSON files, in-memory storage, and file-based conversation persistence.