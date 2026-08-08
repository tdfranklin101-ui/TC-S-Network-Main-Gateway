---
name: Era 21 Operations Agent
description: tcs-operations-agent-v1 registration, UIM endpoints, Learning Layer — all on era21-operations-agent branch
---

# Era 21.0 Operations Agent

**Branch:** `era21-operations-agent` (starting SHA: `0fddb76`, ending SHA: `09359b0`)  
**Status:** Complete, not merged to main, not deployed to production.

## Agent Registry Record
- `id`: `tcs-operations-agent-v1`
- `agent_type`: `operations`
- `max_risk_level`: `low`
- `allowed_actions`: QUERY_NETWORK, QUERY_MEMBER, QUERY_BALANCE, QUERY_MARKETPLACE, CALCULATE_ENERGY, GENERATE_REPORT, ASSET.CREATE, ASSET.ENRICH
- `gbi_exempt`: true (does NOT receive member Solar distribution)
- `production_enabled`: false
- Seed is idempotent: checks `id = 'tcs-operations-agent-v1' OR agent_name = 'TC-S Operations Agent'`

## New Files
- `server/agentic/agents/operations-agent.js` — OperationsAgent class; invoke(), getStatus(), discoverCapabilities()
- `server/agentic/uim-router.js` — initializeUimRouter(pool, executor), handleUimRoutes()
- `server/agentic/operations-learning.js` — OperationsLearning class; network_knowledge + learning_checkpoints tables
- `docs/era21-agent-architecture.md` — full agent architecture doc
- `scripts/test-operations-agent.js` — manual test harness (DEVELOPMENT ONLY)
- `tests/operations-agent.test.js` — 15 automated tests (all pass)

## New Routes (wired in main.js)
- `GET  /api/uim/capabilities` — public; ?include_stubs=true requires admin
- `POST /api/uim/invoke` — auth required (X-Admin-Key, X-Agent-API-Key+X-Agent-Id, or admin session)
- `GET  /api/uim/requests/:id/status` — auth required
- `GET  /api/uim/network-knowledge` — public read

## New DB Tables (created programmatically in OperationsLearning.initialize())
- `network_knowledge` — versioned derived knowledge; never overwrites, always supersedes
- `learning_checkpoints` — last_processed timestamp per source for incremental ingestion

## UIM Router Init Pattern
The UIM router is lazy-initialized on first /api/uim/* request in main.js:
```js
const { executor } = await initializeAgenticFramework(pool);
await initializeUimRouter(pool, executor);
```
initializeAgenticFramework and initializeUimRouter are both idempotent.

## Test Fix: DB Connection in Tests
Test scripts must use DATABASE_URL (not NEON_DATABASE_URL). NEON_DATABASE_URL hits a disabled HTTP endpoint. Pool config: `{ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }`.

**Why:** Neon has two access modes — wire protocol (DATABASE_URL) and HTTP API (NEON_DATABASE_URL). The HTTP endpoint may be disabled; wire protocol always works when the app can connect.

## Confirmed Working (live smoke test)
- GET /api/uim/capabilities → 26 capabilities, era: 21.0
- POST /api/uim/invoke tcs.marketplace.query → SUCCEEDED with request_id
- POST /api/uim/invoke tcs.solar.transfer → REJECTED (CAPABILITY_NOT_LIVE — not in registry as live)
- POST /api/uim/invoke REPLICATE_UNIVERSE → REJECTED (unknown capability, no fallback)
- GET /api/uim/network-knowledge?subject=solar → 1 record (solar_standard, ENERGY_STANDARD)
