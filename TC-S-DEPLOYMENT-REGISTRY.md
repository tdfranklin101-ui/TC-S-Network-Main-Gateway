# TC-S Network - 14-Repository Deployment Registry

**Last Updated:** November 15, 2025  
**Database:** Shared Supabase PostgreSQL (ep-polished-truth-a6ui)  
**GitHub Organization:** https://github.com/tdfranklin101-ui

---

## Repository Overview

All 14 services connect to ONE shared Supabase database while remaining independently deployable. The `@tcs-network/shared` package provides consistent types and schemas across all services.

---

## 1. TC-S-Network-Shared (Foundation Package)

**Purpose:** Foundation package with all database schemas, types, and utilities  
**Type:** NPM Package (not deployed as service)  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Shared  
**Port:** N/A (library only)  
**Deploy To:** NPM registry (internal or public)  
**Dependencies:** drizzle-orm, drizzle-zod, @neondatabase/serverless, pg, ws, zod  

**Contains:**
- Complete database schema (24+ tables)
- TypeScript types for all models
- Database connection utilities
- Zod validation schemas

**Critical:** Changes here affect ALL 14 services. Use semantic versioning.

---

## 2. TC-S-Network-Solar-Dashboard

**Purpose:** Solar Index dashboard with energy tracking  
**Type:** Full-stack web application  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Solar-Dashboard  
**Port:** 3001  
**Deploy To:** Vercel/Replit  
**Database Tables:** `solar_clock`, `solar_audit_entries`  

**Features:**
- Real-time solar energy tracking
- kWh to Solar conversion
- Solar Clock visualization
- Global energy monitoring

---

## 3. TC-S-Network-Solar-Standard

**Purpose:** Protocol documentation and specifications  
**Type:** Static documentation + API  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Solar-Standard  
**Port:** 3002  
**Deploy To:** Vercel/Netlify  
**Database Tables:** Minimal (reference only)  

**Features:**
- Solar Standard protocol specs
- kWh to Solar conversion API
- JSON-LD schemas
- Protocol documentation

---

## 4. TC-S-SAI-Dashboard

**Purpose:** Ethics and audit monitoring dashboard  
**Type:** Analytics dashboard with Chart.js  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-SAI-Dashboard  
**Port:** 3003  
**Deploy To:** Vercel/Replit  
**Database Tables:** `solar_audit_entries`, `uim_handshakes`, `update_log`  

**Features:**
- 8-category global energy monitoring
- Ethics indices (ESI, CSI, HDI, EBI)
- UIM handshake visualizations
- Chart.js dashboards

---

## 5. TC-S-UIM-Layer

**Purpose:** Intent scoring engine with Ed25519 signatures  
**Type:** API service  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-UIM-Layer  
**Port:** 3004  
**Deploy To:** Vercel/Replit  
**Database Tables:** `uim_handshakes`, `uim_nodes`  

**Features:**
- Intent scoring calculations
- Ed25519 signature validation
- AI-to-AI handshake protocol
- Ethics alignment gateway

---

## 6. TC-S-Network-Marketplace

**Purpose:** Artifact marketplace with Identify Anything AI  
**Type:** Full-stack web application  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Marketplace  
**Port:** 3005  
**Deploy To:** Vercel/Replit  
**Database Tables:** `artifacts`, `download_tokens`, `file_access_logs`, `identify_submissions`  

**Features:**
- Digital artifact trading
- Three-copy file management (master/preview/trade)
- Identify Anything AI
- Secure download tokens
- Category browsing (music, video, images, documents, code)

**Critical:** Handles file uploads to object storage

---

## 7. TC-S-Network-Wallet

**Purpose:** Solar wallet application  
**Type:** Web application + WebSocket sync  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Wallet  
**Port:** 3006  
**Deploy To:** Vercel/Replit  
**Database Tables:** `wallets`, `transactions`, `entitlements`  

**Features:**
- Solar token wallet
- Send/receive transactions
- Real-time balance sync (WebSocket)
- World ID verification support
- Daily Solar grants

---

## 8. TC-S-Network-Members

**Purpose:** Member directory and distribution management  
**Type:** Web application + Admin panel  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Members  
**Port:** 3007  
**Deploy To:** Vercel/Replit  
**Database Tables:** `members`, `distribution_logs`, `user_profiles`  

**Features:**
- Member directory
- Daily 1 Solar distribution
- Member profiles
- Distribution tracking

---

## 9. TC-S-Network-Z-Private

**Purpose:** Enterprise commissioning portal (PRIVATE REPO)  
**Type:** Enterprise web application  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Z-Private (Private)  
**Port:** 3008  
**Deploy To:** Private hosting/Vercel Enterprise  
**Database Tables:** `network_commissioning_ledgers`, `ledger_metadata`  

**Features:**
- Journey/Stadium/Event client configuration
- Enterprise commissioning
- Licensing management
- Private analytics

**Critical:** This repo should remain PRIVATE

---

## 10. TC-S-Commissioning-Engine

**Purpose:** Commission creation and licensing calculation  
**Type:** API service  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Commissioning-Engine  
**Port:** 3009  
**Deploy To:** Vercel/Replit  
**Database Tables:** `network_commissioning_ledgers`, `ledger_metadata`, `wallets`  

**Features:**
- Commission calculations
- Licensing logic
- Wallet provisioning
- Enterprise billing

---

## 11. TC-S-Network-Kid-Solar

**Purpose:** AI voice assistant with GPT-4o integration  
**Type:** Full-stack AI application  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Kid-Solar  
**Port:** 3010  
**Deploy To:** Vercel/Replit  
**Database Tables:** `kid_solar_sessions`, `kid_solar_memories`, `kid_solar_conversations`  

**Features:**
- GPT-4o text + vision + voice
- OpenAI Whisper (speech-to-text)
- TTS (text-to-speech) with Nova voice
- Image analysis
- File upload support
- Session management

**Critical:** Requires OPENAI_API_KEY

---

## 12. TC-S-Network-Music-System

**Purpose:** Music streaming platform with play tracking  
**Type:** Music streaming web app  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Music-System  
**Port:** 3011  
**Deploy To:** Vercel/Replit  
**Database Tables:** `songs`, `play_events`, `content_library`  

**Features:**
- Music catalog
- Play event tracking
- Music Now streaming
- Play count analytics

---

## 13. TC-S-Network-Satellite-ID-Anywhere

**Purpose:** Satellite tracking with TLE data ingestion  
**Type:** Satellite tracking web app  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Satellite-ID-Anywhere  
**Port:** 3012  
**Deploy To:** Vercel/Netlify  
**Database Tables:** Minimal (logs only)  

**Features:**
- Real-time satellite tracking
- TLE data ingestion
- 3D globe visualization
- Satellite identification

---

## 14. TC-S-Network-Ledger

**Purpose:** Reference ledger and archive management  
**Type:** Data service + archive viewer  
**GitHub:** https://github.com/tdfranklin101-ui/TC-S-Network-Ledger  
**Port:** 3013  
**Deploy To:** Vercel/Replit  
**Database Tables:** `ledger_archives`, `ledger_metadata`, `backup_logs`  

**Features:**
- Transaction ledger
- Archive management
- Backup tracking
- Audit trails

---

## Shared Dependencies

### Environment Variables (ALL repos need):
```
DATABASE_URL=postgresql://...your-supabase-url...
```

### Additional per service:
- **Kid Solar:** OPENAI_API_KEY
- **Marketplace:** Object storage credentials
- **Wallet:** Payment gateway keys (Stripe - optional)

---

## Deployment Strategy

### Phase 1: Foundation
1. Publish `TC-S-Network-Shared` to NPM (or GitHub packages)
2. All other repos install it as dependency

### Phase 2: Core Services
Deploy in this order:
1. Solar Dashboard (public visibility)
2. Marketplace (revenue)
3. Wallet (user engagement)
4. Members (community)

### Phase 3: AI & Features
5. Kid Solar
6. Music System
7. SAI Dashboard

### Phase 4: Enterprise & Advanced
8. Commissioning Engine
9. Z-Private Portal
10. Remaining services

---

## Troubleshooting Guide

### Schema Changes
1. Update `TC-S-Network-Shared/src/schema.ts`
2. Bump version (semantic versioning)
3. Publish to NPM
4. Update dependency in all 14 repos
5. Redeploy affected services

### Service Down
1. Check service health endpoint: `https://[service-url]/health`
2. Review logs in deployment platform
3. Verify DATABASE_URL is set
4. Check if TC-S-Network-Shared version is compatible

### Database Issues
1. All services share ONE database
2. Check Supabase dashboard for connection limits
3. Verify migrations applied via Drizzle
4. Review query performance

---

## Monitoring & Operations

### Required for Production:
- [ ] Centralized logging (e.g., Logtail, Datadog)
- [ ] Health check monitoring
- [ ] Automated alerts for service failures
- [ ] CI/CD pipelines per repository
- [ ] Dependency update automation

---

## Update Procedures

### For TC-S-Network-Shared (Foundation):
```bash
cd TC-S-Network-Shared
# Make schema changes
npm version patch  # or minor/major
npm publish
# Update all dependent services
```

### For Individual Services:
```bash
cd [service-name]
# Make code changes
npm update @tcs-network/shared  # if shared updated
git add .
git commit -m "Feature: description"
git push
# Auto-deploys via Vercel/Replit
```

---

## Contact & Ownership

**Platform Owner:** TC-S Network Foundation  
**GitHub:** tdfranklin101-ui  
**Database:** Supabase (ep-polished-truth-a6ui)  
**Primary Domain:** thecurrentsee.org

---

**END OF DEPLOYMENT REGISTRY**
