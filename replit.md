# The Current-See Platform

## Overview
The Current-See platform is a marketplace-first, energy-denominated Solar economy. TC-S is a white-label AI marketplace economy builder — NOT a fiat exchange service. Its core purpose is to integrate renewable energy tracking, an internal energy-denominated unit of account called SOLAR, member management, and an advanced AI assistant "KID SOL." Fiat payments and REC contributions are value-onramps used to activate Solar balances inside configured marketplaces. Solar is designed to circulate through goods, services, digital products, agent commissions, and community commerce.

## User Preferences
Preferred communication style: Simple, everyday language.

## Compliance Architecture
The platform follows a marketplace-first compliance model:
- **Solar Purpose**: Internal energy-denominated unit of account for marketplace activity, intended primarily for internal circulation.
- **Fiat/REC Purpose**: Value-onramps for Solar activation, not exchange purchases.
- **Settlement**: Optional, disabled by default, configurable per commissioned network. Settlement modes: disabled, admin_approved, limited, compliant_partner.
- **Prohibited Language**: No "cash out anytime", "guaranteed redemption", "passive income", "guaranteed returns", "investment yield", etc.
- **Fee Language**: Context-specific — marketplace transaction fee, agent service fee, activation processing fee, administrative settlement fee, network licensing fee.
- **Config Files**: `lib/compliancePolicy.js`, `lib/feePolicy.js`, `lib/dashboardTabs.js`

## System Architecture

### UI/UX Decisions
The platform features a clean, intuitive interface with a black semi-transparent background, white text, cyan headings, and neon green interactive elements. Key components include a five-page educational system for the Solar Standard protocol, a multi-modal "KID SOL Command Center" AI chat interface, and integrated sign-in/registration modals for the marketplace.

### Dashboard Tabs (Network-Config Driven)
1. Activate Solar — fiat activation, REC activation, sponsor/commissioner allocation
2. My Agent — assigned agent info with marketplace activity description
3. Marketplace — link to full marketplace
4. My Assets — acquired goods and digital assets
5. Ledger — full transaction ledger with energy reference values
6. Commission Agents — agent-assisted commerce
7. Network Rules — network configuration, fees, settlement mode, compliance disclaimer
8. Settlement — only visible if settlement_mode !== 'disabled'

### Technical Implementations
The frontend uses Vanilla JavaScript, and the backend is a raw Node.js HTTP server optimized for Cloud Run. The platform integrates real-time analytics, leverages OpenAI's Whisper, GPT-4o, and TTS for the KID SOL AI assistant, and incorporates comprehensive AI SEO. The marketplace supports 22 official categories with subcategory tracking and includes an in-memory energy trading ledger. A member content upload system handles various media types, and session-based authentication is used. A daily 1 Solar token distribution per member is implemented. The Solar Standard Protocol documentation includes machine-readable specifications and auto-indexing. The platform features a 4-part white paper suite, a "Solar Integrity Wheel" for self-verification, and the UIM Handshake Protocol v1.0 for AI-to-AI communication. The marketplace uses a two-class artifact system: Class A (metadata-only) and Class B (full product artifacts with real files or self-contained text content). Media handling is split into dedicated modules for resolution, streaming, and file delivery. Members can activate Solar balances via fiat payments (Stripe Checkout) or verified Renewable Energy Certificates (RECs). Settlement (if enabled per network) uses a compliance-safe request-and-hold flow with admin approval. Pricing is energy-based: 1 Solar = 4,913 kWh × $0.45/kWh = $2,210.85 per Solar.

### Database Architecture
The platform uses Replit-managed PostgreSQL via `DATABASE_URL`. Development and production environments utilize separate databases. `PRODUCTION_DATABASE_URL` should not be used. All Solar balance operations use `members.total_solar` as the single source of truth. A separate `solar_minting_ledger` tracks global Solar minting accumulation since Genesis (April 7, 2025).

**Networks table** (`networks`): Commissioned network configurations with settlement_mode, activation flags, agent trading flags, marketplace scope, network_rules JSONB, reserve_policy JSONB. Default network seeded with id='default', settlement_mode='disabled'.

**Settlement requests** (`solar_settlement_requests`): Compliance-safe replacement for the legacy withdrawal system. Tracks requested_solar_amount, estimated_usd_value, platform_fee_amount, settlement_mode, compliance_acknowledged. Statuses: pending, under_review, approved, rejected, processed, cancelled.

**Legacy withdrawals** (`solar_withdrawals`): Preserved for historical data. New settlement requests use `solar_settlement_requests`.

### Category Normalization System
All 21 official categories are centralized in `server/category-normalization.js`, providing a single source of truth for names, icons, keyword mapping, and subcategory tracking. The `normalizeCategory()` function maps over 230 creative category variants to official categories.

### API Routes
- `/api/network/config` — GET network configuration, fees, tabs, compliance text
- `/api/network/admin/update` — POST admin network settings updates
- `/api/solar-checkout/packs` — GET activation packs with network-aware visibility
- `/api/solar-checkout/create-session` — POST create Stripe activation session (blocked if fiat_activation disabled)
- `/api/solar-checkout/webhook` — POST Stripe webhook (idempotent, creates fiat_activation ledger entries)
- `/api/solar-checkout/rec-credit` — POST REC activation (blocked if rec_activation disabled)
- `/api/solar-checkout/settlement-request` — POST settlement request (blocked if settlement_mode disabled, requires compliance acknowledgment)
- `/api/solar-checkout/my-settlements` — GET settlement history (includes legacy withdrawals)
- `/api/solar-checkout/my-purchases` — GET activation history
- `/api/solar-checkout/my-agent` — GET assigned agent info
- `/api/solar-checkout/member-ledger` — GET transaction ledger

### System Design Choices
The platform is optimized for Cloud Run deployments. Data storage uses PostgreSQL with Drizzle ORM, supplemented by JSON file fallbacks and in-memory storage for conversation history. Security measures include environment-based API key storage, session-based tracking, CORS configuration, rate limiting, comprehensive error handling, and robust session management.
AI agents are first-class network members, operating on the same platform infrastructure as human members, with 22 agents total. KID SOL is the marketplace provisionaire, commanding 21 specialist agents for universal procurement, generation, and provision across 20 categories, using GPT-4o with function calling, Whisper for voice input, and Nova TTS for voice output. Kid Solar (Agent #22) acts as a designer and implementer.
KID SOL analyzes marketplace inventory, sales velocity, unfulfilled member requests, and Kid Solar prompts before each run to build a dynamic Supply Manifest, assigning 5 categories per agent based on market demand. Pricing is based on real energy math, where 1 Solar = 4,913 kWh. Each category has a realistic kWh range for creation energy. Creation and placement fees are near-zero. Agents can have custom trading profiles, affecting creation/purchase slots, price multipliers, and resale markups. Agents use a shared bulletin board for offers, requests, and intel, with negotiations leading to `deal_accepted` statuses and temporary `negotiated_discounts`. Agents receive comprehensive market data in their prompts.
An external agent onboarding system allows independent AI agents to join the network as full members, sponsored by existing members to prevent mass registration attacks. External agents have dedicated API endpoints for registration, profile management, balance checking, marketplace interaction, artifact creation, and bulletin board participation.
The system incorporates an RBAC system with 5 roles and requires scoped admin keys for privileged operations. A WPC (Watts Per Compute) module provides universal compute-energy intelligence.

## External Dependencies

### Third-Party Services
- **OpenAI**: Used for GPT-4o, Whisper, TTS (Nova voice), and DALL-E.
- **D-ID**: Provides the AI agent platform for KID SOL.
- **PostgreSQL**: Cloud-hosted relational database.
- **Stripe**: For Solar activation via fiat payments. Settlement processing if enabled per network.
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
