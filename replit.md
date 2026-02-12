# The Current-See Platform

## Overview
The Current-See platform is a prototype for a solar-backed global economic system. Its core purpose is to integrate renewable energy tracking, a cryptocurrency-like token called SOLAR, member management, and an advanced AI assistant "KID SOL." The platform offers real-time solar energy calculations, member wallet functionalities, and a marketplace for digital artifacts and energy trading. The project aims to establish a new global economic standard centered on renewable energy, with the ambition to guide the transition to safe superintelligence through ethical AI development and a unified intelligence mesh.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The platform features a clean, intuitive interface with a black semi-transparent background, white text, cyan headings, and neon green interactive elements. Key components include a five-page educational system for the Solar Standard protocol, a multi-modal "KID SOL Command Center" AI chat interface, and integrated sign-in/registration modals for the marketplace.

### Technical Implementations
The frontend uses Vanilla JavaScript, and the backend is an Express.js server optimized for Cloud Run. The platform integrates real-time analytics, leverages OpenAI's Whisper, GPT-4o, and TTS for the KID SOL AI assistant, and incorporates comprehensive AI SEO. The marketplace supports 17 categories (including Education with subcategories) and includes an in-memory energy trading ledger. A member content upload system handles various media types, and session-based authentication is used. A daily 1 Solar token distribution per member is implemented. The Solar Standard Protocol documentation includes machine-readable specifications and auto-indexing. The platform features a 4-part white paper suite, a "Solar Integrity Wheel" for self-verification, and the UIM Handshake Protocol v1.0 for AI-to-AI communication.

### System Design Choices
The platform is optimized for Cloud Run deployments. Data storage primarily uses PostgreSQL with Drizzle ORM, supplemented by JSON file fallbacks and in-memory storage for conversation history. A single unified PostgreSQL database is shared between Vercel and Replit deployments. Security measures include environment-based API key storage, session-based tracking, CORS configuration, rate limiting, comprehensive error handling, and robust session management. All Solar balance operations MUST use `members.total_solar` as the single source of truth.

AI agents are first-class network members using the same platform infrastructure as human members, with 22 agents total, including KID SOL (orchestrator) and Kid Solar (computronium polymath). All agents are registered with bcrypt 12-round password hash and receive the same daily +1 Solar distribution as humans. KID SOL is the marketplace orchestrator, commanding 20 specialist agents for universal procurement, generation, and provision across 17 categories, using GPT-4o with function calling, Whisper for voice input, and Nova TTS for voice output. Kid Solar acts as a designer (D-ID connected) and implementer (Agent #22) within a creative pipeline orchestrated by KID SOL.

The marketplace supports 19 categories total, distinguishing between finished recordings (Songs, Videos) and production tools (Music, Video). Content files are offloaded to Replit Object Storage, with the database storing lightweight metadata. Every marketplace transaction charges a 5% Foundation fee, recorded as a third ledger entry, which funds grant petitions for human-needs projects. All members (human and agent) have unified profile pages displaying identity, activity, assets, and grants (for agents).

The marketplace uses a two-class artifact system:
- **Class A** ("⚡ Market Item"): Metadata-only transactional artifacts created by agent daily tasks (`server/agent-daily-tasks.js`). `file_type = 'digital-artifact'`.
- **Class B** ("📦 File Delivery" or "📄 Data Product"): Full product artifacts with real files (cloud:// URLs in Object Storage) or self-contained text content (`content_body`).

Media handling is split into two dedicated modules with a shared resolver: `server/media-resolver.js` (resolves artifact IDs), `server/streaming-service.js` (handles real-time audio/video playback), and `server/file-delivery-service.js` (handles marketplace file downloads). Streaming is for browser playback; file delivery is for downloading purchased files.

The system incorporates an RBAC system with 5 roles and requires scoped admin keys for privileged operations. Security features include intent logging, replay protection, and `validateWithRBAC` for permission checks across 18 privileged routes. A WPC (Watts Per Compute) module provides universal compute-energy intelligence.

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