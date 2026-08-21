# TC-S Replicator Readiness Audit
**Read-only · No code modified**  
Generated: 2026-08-08 from canonical commit `2349f26` (tdfranklin101-ui/TC-S-Network-Main-Gateway)

---

## 1. Audit Scope and Method

This audit enumerates every capability in the TC-S Network gateway codebase that is or could be exposed through the Universal Intelligence Mesh (UIM). The codebase was read by parallel static-analysis subagents covering six domains simultaneously:

| Domain | Files Inspected |
|---|---|
| Agentic Framework | `server/agentic/{executor,policy,routes,api-surface,scheduler,security}.js`, `agents/commissioning-agent.js`, `handlers/marketplace-handlers.js`, `pricing-engine.js` |
| API Routes | `main.js` (full), `routes/market`, `routes/energy`, `routes/kid`, `server/agentic/routes.js` |
| Physical-World | `server/artifact3d-service.js`, `shared/schema.ts` (factory/3D sections), `main.js` factory handlers |
| Ledger Operations | `shared/schema.ts` (all economic tables), ledger/wallet/voucher logic in `main.js` |
| Auth & Policy | `server/auth-bridge.js`, `server/agentic/policy.js`, `server/agentic/security.js`, session/passport logic in `main.js` |
| External Capabilities | `server/claude-service.js`, `server/openai.js`, `server/kid-solar-voice.js`, `server/cloud-storage.js`, `server/cold-storage.js`, `services/SAiUIMLayer.js`, `package.json` |

**Architecture note:** `main.js` is a raw Node HTTP dispatcher, not an Express app. Routes are `if/else` pathname matches. `server/routes/*.ts` (admin.ts, ai.ts, omega1.ts, payments.ts, power-twin.ts, progression.ts, market-prices.ts) exist but **are not imported or dispatched by main.js** — they are dead code. Only `routes/market`, `routes/energy`, `routes/kid`, `server/agentic/routes.js`, and the `dmtxactly` module are actually wired in.

---

## 2. Current Capability Inventory

### 2.1 Agentic Actions (server/agentic/api-surface.js)

These are the formally defined action types. Status: **`live`** = executor handler exists and is tested; **`stub`** = defined in api-surface, no executor handler implemented; **`partial`** = handler exists but missing fields or broken.

#### Network Domain
| Action | Risk | Approval | Multisig | Status |
|---|---|---|---|---|
| `CREATE_NETWORK` | medium | ✅ | ❌ | **live** |
| `UPDATE_NETWORK` | medium | ✅ | ❌ | stub |
| `DELETE_NETWORK` | critical | ✅ | ✅ (2-sig) | stub |
| `QUERY_NETWORK` | low | ❌ | ❌ | **live** |

#### Member Domain
| Action | Risk | Approval | Status |
|---|---|---|---|
| `CREATE_MEMBER` | low | ❌ | **live** (max grant 10 Solar) |
| `UPDATE_MEMBER` | low | ❌ | stub |
| `SUSPEND_MEMBER` | high | ✅ | stub |
| `QUERY_MEMBER` | low | ❌ | **live** |

#### Economic Domain
| Action | Risk | Approval | Multisig | Status |
|---|---|---|---|---|
| `TRANSFER_SOLAR` | high | ✅ | ❌ | stub (policy written, no handler) |
| `MINT_SOLAR` | critical | ✅ | ✅ | stub (policy: kWh ≥ amount × 4,913) |
| `QUERY_BALANCE` | low | ❌ | ❌ | **live** |
| `CALCULATE_ENERGY` | low | ❌ | ❌ | **live** (4,913 kWh/Solar constant) |
| `AUDIT_TRANSACTION` | high | ✅ | ❌ | stub |

#### Marketplace Domain
| Action | Risk | Approval | Status |
|---|---|---|---|
| `CREATE_ARTIFACT` | medium | ✅ | stub (distinct from ASSET.CREATE) |
| `PURCHASE_ARTIFACT` | medium | ❌ | stub |
| `QUERY_MARKETPLACE` | low | ❌ | **live** (limit ≤100, category/query filter; price range ignored) |
| `GENERATE_REPORT` | low | ❌ | **live** (energy, transactions, members, marketplace, compliance) |
| `LOG_ETHICS_EVENT` | medium | ❌ | **live** (ethicsScore 0–100, UIM-annotated) |

#### Asset/Pricing Subdomain (marketplace-handlers.js)
| Action | Risk | Auto-Execute Gate | Status |
|---|---|---|---|
| `ASSET.CREATE` | low | — | **live** |
| `ASSET.ENRICH` | low | low_risk + high_confidence | **live** (AI metadata/kWh/carbon/risk) |
| `ASSET.LIST` | low | low_risk + high_confidence + price_within_bounds | **live** |
| `ASSET.UNLIST` | low | — | **live** |
| `ASSET.UPDATE` | low | — | **live** |
| `PRICE.QUOTE` | low | — | **live** |
| `PRICE.PUBLISH` | medium | — | **live** |
| `ORDER.CREATE` | low | — | **live** |
| `ORDER.CAPTURE_PAYMENT` | medium | — | **live** |
| `ORDER.FULFILL` | medium | — | **live** |
| `LEDGER.RECORD` | high | — | **live** |
| `SETTLEMENT.RUN` | critical | — | stub (scheduler submits, no handler; would be rejected) |
| `MODERATION.FLAG` | medium | — | **live** |

---

### 2.2 HTTP API Routes (main.js dispatch)

Full enumeration grouped by domain. Auth key: 🌐 public · 🍪 session cookie · 🔑 ADMIN_KEY · 🤖 agent API key · 🎟️ token/ownership

#### Authentication & Session
```
POST /api/login, /api/users/login          🌐  Member login
POST /api/users/logout, /api/logout        🍪  Session logout
POST /api/forgot-password                  🌐  Password reset request
POST /api/reset-password                   🌐  Password reset (token)
POST /api/change-password                  🍪  Change password
POST /api/register                         🌐  Member registration
POST /api/auth/signup                      🌐  Auth bridge signup
POST /api/users/register-member            🌐  Member registration (alt path)
GET  /api/session                          🌐  Session status / passport exchange
GET  /api/lookup                           🌐  Member lookup by username/email
```

#### Solar Passport (auth-bridge)
```
POST /auth/login                           🌐  Passport HMAC login
POST /auth/register                        🌐  Passport registration
POST /auth/logout                          🍪  Passport logout
GET  /auth/me                              🎟️  Passport identity
GET  /auth/gbi-status                      🎟️  Genesis/balance status (or public username lookup)
```

#### Solar Economy
```
GET  /api/solar                            🌐  Current solar data
GET  /api/solar-standard                   🌐  Solar Standard definition
GET  /api/solar/reserve                    🌐  Reserve metrics
POST /api/wpc/calculate                    🌐  WPC energy calculator
POST /api/solar/artifact                   🍪  Create solar artifact
POST /api/users/solar-balance              🍪  Member solar balance
GET  /api/market-data/stats                🌐  Market statistics
GET  /api/market-data/positioning          🌐  Market positioning
GET  /api/market-prices                    🌐  Commodity prices
```

#### Marketplace & Artifacts
```
GET  /api/artifacts/available              🌐  Browse artifacts (paginated)
GET  /api/artifacts/my-items              🍪  Owned/purchased artifacts
GET  /api/my-artifacts                     🍪  Alt path for owned artifacts
GET  /api/artifacts/:id/detail             🌐  Artifact detail
GET  /api/artifacts/:id/eia                🌐  Energy impact analysis
GET  /api/artifacts/:id/preview            🌐  Preview
POST /api/artifacts/:id/preview            🌐  Generate preview
POST /api/artifacts/assess-kwh             🌐  kWh assessment
POST /api/artifacts/purchase               🍪  Purchase artifact
POST /api/artifacts/:id/purchase           🍪  Purchase (alt path)
POST /api/artifacts/approve                🔑  Admin artifact approval
GET  /api/artifacts/preview/:token         🎟️  Tokenized preview
GET  /api/preview/:token                   🎟️  Preview (alt path)
GET  /api/artifacts/download/*             🎟️  File delivery
GET  /api/artifact-download/*              🎟️  File delivery (alt)
GET  /api/delivery/*                       🎟️  Delivery endpoint
GET  /api/stream/*                         🎟️  Stream delivery
POST /api/artifacts/resale-listings        🍪  Create resale listing
POST /api/artifacts/:id/resell             🍪  Resell artifact
POST /api/resale-purchase                  🍪  Purchase resale
POST /api/cancel-resale                    🍪  Cancel resale
GET  /api/artifacts/:id/genesis-status     🌐  Genesis artifact status
GET  /api/ledger/artifacts/*               🍪  Ledger artifact history
GET  /api/categories                       🌐  Category list
```

#### Agentic Framework
```
GET  /api/agentic/actions                  🤖  List all actions
GET  /api/agentic/actions/high-risk        🔑  High-risk action queue
POST /api/agentic/action                   🤖  Submit action request
GET  /api/agentic/action/status            🤖  Action status by requestId
POST /api/agentic/action/{approve|reject|execute}  🔑  Action lifecycle
GET  /api/agentic/actions/:id              🤖  Action detail
POST /api/agentic/actions/:id/{approve|reject|execute}  🔑  Action lifecycle (alt)
GET  /api/agentic/pending                  🤖  Pending actions for agent
GET  /api/agentic/actions/list             🤖  Filtered action list
GET  /api/agentic/networks                 🤖  Network registry
GET  /api/agentic/agents                   🤖  Registered agents
GET  /api/agentic/audit-log                🔑  Audit log
GET  /api/agentic/commissioning/capabilities  🌐  Commissioning capability manifest
POST /api/agentic/commissioning/start      🤖  Start commissioning
POST /api/agentic/commissioning/input      🤖  Step input
POST /api/agentic/commissioning/submit     🤖  Submit commissioning
POST /api/agentic/commissioning/create-direct  🤖  Direct network creation
GET  /api/agentic/marketplace/action-types 🌐  Marketplace action types
GET  /api/agentic/scheduler/status         🔑  Scheduler status
POST /api/agentic/scheduler/trigger        🔑  Manual scheduler trigger
GET  /api/agentic/scheduler/job-types      🌐  Available job types
POST /api/agentic/marketplace/*            🤖  Asset/pricing/order/ledger actions
GET  /api/audit                            🔑  Full audit log
```

#### 3D Artifacts & Factory
```
GET  /api/artifact3d/templates             🌐  Available 3D templates
GET  /api/artifact3d/templates/:id         🌐  Template detail
POST /api/artifact3d/generate             🍪  Generate STL artifact
POST /api/artifact3d/mint                  🍪  Generate + list as marketplace item
POST /api/artifact3d/chain                 🍪  Search→match→create→list pipeline
GET  /api/artifact3d/download/:id          🎟️  STL file download
GET  /api/artifact3d/image/:id             🌐  Preview PNG
POST /api/factory/printers/register        🔒  X-Admin-Key enrollment; issues one-time printer key
GET  /api/factory/printers                 🌐  Active printer list
POST /api/factory/printers/:id/heartbeat   🔑  Printer-key authenticated heartbeat
POST /api/factory/print                    🍪  Submit print job
GET  /api/factory/queue                    🌐  Print queue status
GET  /api/factory/pickup/:code             🌐  Pickup lookup by code
POST /api/factory/pickup/:code/complete    🌐  Mark job picked up
```

#### AI / Intelligence
```
POST /api/ai-assistant                     🍪  General AI assistant
POST /api/ai/voice                         🍪  Voice (rate-limited: 5/user/min)
POST /api/kid-solar/session                🍪  Kid Solar session
POST /api/kid-solar/chat                   🍪  Kid Solar chat + function calling
POST /api/kid-solar/voice                  🍪  Kid Solar voice (TTS nova)
POST /api/lifelens/analyze                 🌐  LifeLens artifact analysis
POST /api/lifelens/abundance-lens          🌐  Abundance lens (→ SAi UIM Layer)
```

#### UIM
```
GET  /.well-known/uim-handshake.json       🌐  Machine-readable UIM handshake
GET  /api/lifelens/abundance-lens          🌐  UIM abundance metric
```

#### Admin
```
POST /api/admin/trigger-distribution       🔑  Manual solar distribution
POST /api/admin/fix-member-username        🔑  Username repair
POST /api/admin/reset-member-password      🔑  Password reset (admin)
POST /api/admin/normalize-categories       🔑  Category normalization
POST /api/admin/cold-storage/backfill      🔑  Cold storage migration
GET  /api/admin/cold-storage/stats         🔑  Cold storage stats
GET  /api/admin/assets                     🔑  Asset admin (→ agentic policy)
GET  /api/admin/settlements                🔑  Settlement admin (→ agentic policy)
POST /api/seed-rotation/trigger            🔑  Trigger seed rotation
GET  /api/seed-rotation/logs               🔑  Rotation logs
GET  /api/seed-rotation/seeds              🔑  Seed file list
GET  /api/seed-rotation/status             🌐  Rotation status
```

#### Members / Social
```
GET  /api/members                          🌐  Member directory
GET  /api/members/cards                    🌐  Member cards
GET  /api/members/storage                  🌐  Storage metadata
GET  /api/signups                          🔑  Signup log
```

#### Webhooks & Callbacks
```
GET  /api/callback                         🌐  Replit OIDC OAuth callback
POST /api/cron/daily-distribution          🌐  Cron: daily solar distribution
POST /api/gumball/confirm                  🌐  Gumball purchase webhook (GUMBALL_WEBHOOK_SECRET)
```

---

### 2.3 External Model Providers

| Provider | Models | Capabilities | Env Key |
|---|---|---|---|
| OpenAI | `gpt-5.5` | Text, JSON, function calling, vision (Kid Solar), agent reasoning | `OPENAI_API_KEY` |
| OpenAI | `gpt-5.4-mini` | Text, lightweight analysis | `OPENAI_API_KEY` |
| OpenAI | `gpt-4o-mini-transcribe` | Audio transcription (voice input) | `OPENAI_API_KEY` |
| OpenAI | `gpt-4o-mini-tts` (voice: nova) | Text-to-speech | `OPENAI_API_KEY` |
| OpenAI | `gpt-image-2` | Image generation (3D artifact previews) | `OPENAI_API_KEY` |
| Anthropic | `claude-sonnet-5` | Text, LifeLens analysis, energy assistant, seed rotation | `ANTHROPIC_API_KEY` |
| Anthropic | `claude-opus-5` | Text, high-complexity tasks | `ANTHROPIC_API_KEY` |
| Perplexity | `llama-3.1-sonar-small-128k-online` | Web-grounded product search, citations | `PERPLEXITY_API_KEY` |

**D-ID**: Referenced only in the Kid Solar prompt as descriptive text. **No D-ID API integration exists in the codebase.** No D-ID SDK, no API calls, no credentials.  
**FAL.ai**: No integration found. All references are historical (removed prior to current HEAD).

---

### 2.4 External Services

| Service | Purpose | Endpoint / SDK | Auth |
|---|---|---|---|
| SAi UIM Layer | Abundance lens, UIM metrics, dashboard stats | `https://s-ai-uim-layer-tdfranklin101.replit.app` | `X-UIM-Token` (UIM_SHARED_SECRET) |
| Replit Object Storage | Artifact files, cold storage blobs, previews | `@replit/object-storage` | `DEFAULT_OBJECT_STORAGE_BUCKET_ID` |
| Neon / PostgreSQL | All persistent data | `@neondatabase/serverless` | `NEON_DATABASE_URL` |
| Resend | Transactional email (Solar Passport delivery, password reset) | Resend SDK | `RESEND_API_KEY` |
| continuity-locker.replit.app | User-facing commissioning wizard | External redirect | None (browser redirect) |
| Perplexity API | Product search in marketplace | REST | `PERPLEXITY_API_KEY` |

---

### 2.5 Physical-World Capabilities

#### 3D Artifact System
Ten parametric models registered in `server/artifact3d-service.js`:

| Template | Key Params | Material | Est. Print Time |
|---|---|---|---|
| `desk-caddy` | width, depth, height, compartments | PLA | computed |
| `phone-stand` | angle, width, depth | PLA | computed |
| `cable-organizer` | slots, slot_width, height | PLA | computed |
| `nameplate` | text, width, height, thickness | PLA | computed |
| `coaster` | diameter, thickness, pattern | PLA, PETG | computed |
| `wall-hook` | load_kg, depth, style | PLA, PETG | computed |
| `card-holder` | capacity, angle, width | PLA | computed |
| `planter` | diameter, height, drainage_holes | PETG, ASA | computed |
| `bookmark` | width, height, thickness, design | PLA | computed |
| `keychain` | text, shape, hole_diameter | PLA | computed |

**STL constraints:** ≤50 MB file, ≤300 mm per dimension, ≤500,000 triangles.  
**Pricing:** Computed in Solar + kWh footprint returned per artifact.  
**Output:** Binary STL + print-guide Markdown stored to object storage; artifact marketplace record created on mint.

#### Physical Factory Network
```
factory_printers schema:
  id, name, location, capabilities[], materials[], status(idle|printing|offline|maintenance),
  printerUrl, operatorId, maxBuildVolume{x,y,z}, layerResolution, eventId,
  heartbeatAt, completedJobs, createdAt

print_queue lifecycle:
  PENDING → QUEUED (printer assigned) → PRINTING (heartbeat confirms) 
  → COMPLETE (operator marks done) → PICKED_UP (pickup code scanned)
  
print_queue fields:
  id, artifact3dId FK, printerId FK, buyerId, orderId, eventId, status,
  pickupCode (6-char), pickupQrUrl, estimatedMinutes, startedAt,
  completedAt, pickedUpAt, printSettings{}, notes, createdAt
```

The factory system currently has **no authentication on printer registration or heartbeat** — any caller can register a printer or claim heartbeat.

---

### 2.6 Ledger Operations

**Solar Standard:** 1 Solar = 4,913 kWh (Buckminster Fuller constant)  
**Genesis Date:** April 7, 2025 (all retroactive distribution anchors from this date)

#### Economic Tables (shared/schema.ts)
| Table | Purpose |
|---|---|
| `members` | Member identity + Solar balance (balance column, not separate wallet) |
| `transactions` | All debit/credit records; type, amount, from/to memberId, memo, metadata |
| `solar_minting_ledger` | Global daily mint records: date, global_solar, cumulative, kWh_generated, member_distributions |
| `agent_wallets` | Agent economic participation; accrual since Genesis date |
| `vouchers` | Voucher listings: vendorId, discount, conditions, maxRedemptions |
| `voucher_listings` | Active voucher marketplace |
| `voucher_redemptions` | Per-member redemption records |
| `vendor_voucher_settings` | Per-vendor voucher configuration |
| `artifact_3d_files` | 3D artifact files with Solar price and kWh footprint |
| `gumballs` / `gumball_transactions` | Gumball machine economy records |

#### Transaction Types
| Type | Trigger | Foundation Fee |
|---|---|---|
| `purchase` | Artifact buy | 5% to foundation wallet |
| `grant` | Foundation grant approval | No (foundation disburses) |
| `foundation_fee` | Deducted from purchase | N/A (is the fee) |
| `agent_distribution` | Daily scheduler | No |
| `voucher_redemption` | Voucher use | No |
| `genesis_grant` | Member signup | No (1 Solar default) |
| `solar_mint` | Admin-triggered or backfill | Requires multisig |
| `resale` | Resale artifact purchase | 5% (assumed, not confirmed) |

#### Wallet Operations
- **Credit/debit:** Direct SQL `UPDATE members SET solar_balance = solar_balance ± amount`
- **Balance query:** `GET /api/users/solar-balance` (session), `QUERY_BALANCE` agentic action
- **Agent wallets:** Separate `agent_wallets` table with Genesis-anchored accrual
- **Vouchers:** Full create/list/redeem/vendor-settings lifecycle
- **Grants:** Petition → foundation review → approval → disbursement (partially implemented)

---

### 2.7 Authentication System

#### Two-Token Architecture
```
tcs_auth (Solar Passport)
  Format: base64url(<json payload>).<64-hex HMAC-SHA256>
  Payload: { memberId, username, memberSince, solarBalance, ... }
  Signed with: SESSION_SECRET
  Cookie: HttpOnly; SameSite=None; Secure; Max-Age=2592000 (30 days)
  Rate limits: 20 logins/IP/15min, 5 registrations/IP/hour
  
tc_s_session (Site Session)
  Format: 64-hex random (crypto.randomBytes(32))
  Stored: PostgreSQL sessions table, expire = now + 30 days
  Cookie: HttpOnly; SameSite=None; Secure; Max-Age=2592000
  Exchange: POST /api/session (Passport → site session, max 10 new sessions/member/hour)
  Cleanup: expired rows deleted every 15 minutes
```

#### RBAC Roles (server/agentic/security.js)
| Role | Capabilities |
|---|---|
| `member` | Create orders, view own orders, search, view assets |
| `seller` | Create/enrich assets, price quotes, publish own listings, own orders, search |
| `staff` | View orders, confirm fulfillment, view inventory, flag moderation |
| `commissioner_admin` | All price/listing/asset/moderation, view orders/inventory/reports |
| `tcs_admin` | All actions (`*`) |

#### Policy Engine (server/agentic/policy.js)
- Agent action requests: 10/agent/minute rate limit
- Actions evaluated in order: custom DB rules → built-in rules
- Built-in rule conditions: `always_allow`, `always_deny`, `maxAmount`, `allowedAgents`
- Risk escalation: `low` → auto-execute (if confidence gates met); `medium` → requires approval; `high` → requires approval + human review flag; `critical` → requires approval + multisig
- Replay protection: `X-Req-Id` required on privileged actions; 5-minute window, max 10,000 IDs cached
- **Global rate limiter:** Explicitly disabled pending deployment configuration

#### Agent Authentication
```
X-Agent-API-Key: <key>      — validates via agent_registry.api_key_hash
X-Agent-Id: <id>            — agent identity claim
X-Req-Id: <uuid>            — replay protection (required for privileged ops)
```

---

### 2.8 UIM Integration (Current State)

What exists today:

| Component | Location | Status |
|---|---|---|
| UIM handshake document | `public/.well-known/uim-handshake.json` | **live** — machine-readable |
| Abundance lens endpoint | `POST /api/lifelens/abundance-lens` | **live** — calls SAi UIM Layer |
| UIM metric call | `services/SAiUIMLayer.js` | **live** — 8 invocation points in main.js |
| UIM dashboard stats | `GET /dashboard/summary` (UIM Layer) | **live** — proxied |
| Ethics event logging | `LOG_ETHICS_EVENT` agentic action | **live** — annotated "for UIM protocol" |
| `uim_handshakes` table | `shared/schema.ts` | **live** — schema exists |
| `autoExecuteIf` gates | ASSET.ENRICH, ASSET.LIST | **live** — autonomy gates in api-surface |
| Capability discovery endpoint | None | **missing** |
| Standardized UIM action invocation | None | **missing** |
| OpenAPI / capability schema | None | **missing** |
| UIM agent registry entry | None | **missing** |
| Async callback / webhook for UIM | None | **missing** |

---

## 3. Machine-Readable Capability Registry

The full registry is at `docs/capability-registry.json`. Summary counts:

| Status | Count | Notes |
|---|---|---|
| `live` | 26 | Implemented, handler + route both present |
| `stub` | 9 | Defined in api-surface.js; no executor handler |
| `missing` | 4 | Must be built in Era 21 for UIM exposure |

**UIM-exposable today (no code changes needed):** 20 capabilities  
**UIM-exposable after Era 21 build:** 36 capabilities (all live + stubs once implemented + 4 new UIM infrastructure items)

---

## 4. Gap Analysis — What Exists vs. What Era 21 Must Add

### 4.1 What Already Exists (can be exposed to UIM today)

These are live, tested capabilities that need only be wired into a UIM discovery and invocation layer:

#### Immediately UIM-Exposable (zero new code)
| Capability ID | Route | Category |
|---|---|---|
| `tcs.network.create` | POST /api/agentic/action | Network |
| `tcs.network.query` | POST /api/agentic/action | Network |
| `tcs.member.create` | POST /api/agentic/action | Member |
| `tcs.member.query` | POST /api/agentic/action | Member |
| `tcs.solar.query_balance` | POST /api/agentic/action | Economic |
| `tcs.solar.calculate_energy` | POST /api/wpc/calculate | Economic |
| `tcs.marketplace.query` | GET /api/artifacts/available | Marketplace |
| `tcs.marketplace.asset_create` | POST /api/agentic/marketplace/asset | Marketplace |
| `tcs.marketplace.asset_enrich` | POST /api/agentic/marketplace/enrich | Marketplace |
| `tcs.marketplace.asset_list` | POST /api/agentic/marketplace/list | Marketplace |
| `tcs.marketplace.asset_unlist` | POST /api/agentic/marketplace/unlist | Marketplace |
| `tcs.marketplace.price_quote` | POST /api/agentic/marketplace/price/quote | Marketplace |
| `tcs.marketplace.order_create` | POST /api/agentic/marketplace/order | Marketplace |
| `tcs.marketplace.generate_report` | POST /api/agentic/action | Analytics |
| `tcs.ethics.log_event` | POST /api/agentic/action | Ethics/UIM |
| `tcs.uim.abundance_lens` | POST /api/lifelens/abundance-lens | UIM |
| `tcs.uim.handshake` | GET /.well-known/uim-handshake.json | UIM |
| `tcs.ai.lifelens_analyze` | POST /api/lifelens/analyze | AI |
| `tcs.3d.generate` | POST /api/artifact3d/generate | Physical |
| `tcs.3d.mint` | POST /api/artifact3d/mint | Physical |
| `tcs.factory.submit_print` | POST /api/factory/print | Physical |
| `tcs.factory.queue_status` | GET /api/factory/queue | Physical |
| `tcs.factory.pickup` | GET+POST /api/factory/pickup/:code | Physical |
| `tcs.commissioning.capabilities` | GET /api/agentic/commissioning/capabilities | Network |

---

### 4.2 What Era 21 Must Build

#### P0 — UIM Infrastructure (Platform Cannot Be Discovered Without These)

**1. `GET /api/uim/capabilities` — Capability Discovery Endpoint**

The `/.well-known/uim-handshake.json` exists but is static and minimal. UIM agents need a live, queryable endpoint that returns the full capability registry with current operational status.

```
Proposed response shape:
{
  "registry_version": "...",
  "capabilities": [...],         // filtered to uim_exposable: true, status: live
  "auth_methods": {...},
  "rate_limits": {...},
  "platform_status": "operational"
}
```

This is a read from `docs/capability-registry.json` filtered at runtime — trivial to build.

**2. `POST /api/uim/invoke` — Standardized UIM Action Entry Point**

The existing `POST /api/agentic/action` is the closest thing, but it uses TC-S internal `action_type` strings (e.g. `CREATE_NETWORK`) rather than stable UIM capability IDs (e.g. `tcs.network.create`). Era 21 needs:
- A translation layer: `capability_id → action_type`
- Standard UIM request envelope: `{ capability_id, params, uim_agent_id, idempotency_key }`
- Standard UIM response envelope: `{ result, status, request_id, callback_url?, policy_outcome }`
- Transparent passthrough to the existing agentic executor for all the policy/approval machinery

This is a thin adapter — the executor, policy engine, and all handlers already exist.

---

#### P1 — Async Callback / Polling for Approval-Gated Actions

Medium, high, and critical risk actions require human approval before execution. UIM callers submitting `TRANSFER_SOLAR`, `CREATE_ARTIFACT`, or `SUSPEND_MEMBER` need a way to receive the eventual outcome.

Two options (Era 21 picks one):
- **Webhook delivery:** UIM caller registers a `callback_url` in the invoke request; the executor POSTs the result when approved/rejected
- **Polling endpoint:** `GET /api/uim/requests/:request_id/status` — already partially implemented via `GET /api/agentic/action/status?requestId=...`; needs UIM-facing wrapper

The polling endpoint is lower effort and reuses what exists.

---

#### P2 — Stub Completion (Executor Handlers)

Nine action types are policy-defined but have no executor handler. Era 21 should complete the highest-value ones:

| Priority | Action | Why It Matters for UIM |
|---|---|---|
| High | `TRANSFER_SOLAR` | Core economic primitive; UIM agents cannot move value without it |
| High | `PURCHASE_ARTIFACT` | UIM agents cannot autonomously buy; only humans can currently |
| High | `UPDATE_MEMBER` | Agents cannot update member state |
| Medium | `SUSPEND_MEMBER` | Moderation capability; needed for trust layer |
| Medium | `CREATE_ARTIFACT` | Distinct from ASSET.CREATE — the higher-level artifact creation path |
| Medium | `AUDIT_TRANSACTION` | Accountability primitive for UIM-triggered transactions |
| Low | `UPDATE_NETWORK` | Network maintenance |
| Low | `MINT_SOLAR` | Admin-only, multisig; low UIM relevance |
| Low | `DELETE_NETWORK` | Critical, admin-only; low UIM relevance |

`SETTLEMENT.RUN` is submitted by the scheduler as `scheduler-agent` but the agent is not registered in the DB, causing the action to be rejected. This is a bug, not a missing stub — the scheduler-agent needs to be seeded.

---

#### P3 — Security Gaps to Resolve Before UIM Exposure

These are not blocking UIM architecture but must be resolved before any live UIM traffic:

| Gap | Risk | Location |
|---|---|---|
| Factory printer endpoint authentication | Resolved | Registration requires X-Admin-Key; each enrollment receives a one-time printer key and heartbeat verifies its stored hash |
| Global rate limiter is disabled | Medium | `main.js:3694-3696` — explicitly commented out |
| `policy.review` scheduler job silently skipped | Low | `scheduler.js` switch missing case for `policy.review` |
| `server/routes/*.ts` are dead code | Low | `admin.ts, ai.ts, omega1.ts, payments.ts, power-twin.ts, progression.ts` imported nowhere |
| Price range filter in QUERY_MARKETPLACE is ignored | Low | `minPrice`/`maxPrice` params accepted but not applied in SQL |

---

#### P4 — Era 21 New Capabilities (Not in Codebase at All)

These do not exist anywhere in the current codebase and would be net-new for Era 21:

| Capability | Description |
|---|---|
| `tcs.uim.agent_registry` | Platform registers itself as a UIM provider; `uim_handshakes` table exists but self-registration logic does not |
| `tcs.solar.transfer` (live) | Executor handler for Solar transfers — the most important missing primitive |
| `tcs.uim.capability_version` | Versioned capability schema so UIM agents can detect breaking changes |
| `tcs.factory.printer_auth` | Authenticated printer registration (printer API key or HMAC) |
| Agent self-registration API | External agents (beyond commissioning-agent-v1) can register themselves via API; currently only admin-seeded |
| `tcs.solar.stream_ledger` | Server-sent events or WebSocket feed of Solar mint ledger updates for real-time UIM monitoring |

---

### 4.3 Era 21 Build Order (Recommended Sequence)

```
Sprint 1 — UIM Discovery Layer (P0)
├── GET /api/uim/capabilities        ← reads capability-registry.json, filters live+exposable
├── POST /api/uim/invoke             ← thin adapter over existing /api/agentic/action
└── Update /.well-known/uim-handshake.json to reference /api/uim/capabilities

Sprint 2 — Complete Economic Primitives (P2, high-priority stubs)
├── TRANSFER_SOLAR executor handler
├── PURCHASE_ARTIFACT executor handler
└── UPDATE_MEMBER executor handler

Sprint 3 — Async Result Delivery (P1)
└── GET /api/uim/requests/:id/status (wrapper over existing action status)
    (or webhook callback_url support)

Sprint 4 — Security Hardening (P3)
├── Factory printer auth (API key per printer)
├── Re-enable global rate limiter
└── Fix policy.review scheduler case

Sprint 5 — Platform Self-Registration (P4)
├── tcs.uim.agent_registry endpoint
└── Agent self-registration API
```

---

## 5. Known Architectural Constraints for Era 21

These are not gaps to fill — they are structural facts Era 21 must design around:

1. **`main.js` is a raw HTTP dispatcher, not Express.** Adding new routes means adding `if (pathname === '/api/uim/...')` blocks. Express routers in `server/routes/` are dead code — do not add more dead routers there.

2. **The agentic executor is synchronous for low-risk actions, asynchronous for approval-gated.** UIM invocation of medium/high/critical actions will always return a `requestId` rather than a result. Design for this.

3. **The only formally registered agent is `commissioning-agent-v1`.** All other agent IDs referenced in the codebase (KID SOL #21, Kid Solar #22, scheduler-agent) are strings in prompts or comments, not DB records. UIM agent registration must create DB records.

4. **D-ID is not integrated.** Despite appearances in the homepage and documentation, there is no D-ID API integration in the current codebase. The avatar references a browser-side visual only.

5. **The SAi UIM Layer is a live external dependency.** Eight invocation points in `main.js` call `https://s-ai-uim-layer-tdfranklin101.replit.app`. If that service is down, abundance lens calls return null. Era 21 should add a circuit breaker.

6. **Solar balances are stored on the `members` table, not a separate wallet table.** `agent_wallets` is a separate table for agents only. The `TRANSFER_SOLAR` stub references `walletId` but member wallets have no separate ID — the member's `id` is the wallet ID.

7. **Cold storage uses content-addressed deduplication via SHA-256.** Any UIM capability that generates or stores content should write through the cold storage layer to avoid duplicate blobs in object storage.

8. **The Perplexity product search is embedded inside marketplace handlers, not exposed as a standalone capability.** Era 21 should extract it if UIM agents need web-search-backed product intelligence independently.

---

## 6. Appendix — Registered Formal Agent

Only one agent is formally registered in the `agent_registry` database table:

```json
{
  "id": "commissioning-agent-v1",
  "name": "Commissioning Agent",
  "type": "commissioning",
  "status": "active",
  "max_risk_level": "medium",
  "allowed_actions": ["CREATE_NETWORK", "QUERY_NETWORK"],
  "capability_options": ["ethics_monitoring", "audit_logging"],
  "regions": ["all"],
  "energy_sources": ["solar", "wind", "hydro", "geothermal"]
}
```

All other agent identities (KID SOL, Kid Solar, scheduler-agent, external agents referenced in code) exist as string constants or prompt context only. They are not in `agent_registry` and cannot authenticate via `X-Agent-API-Key`.

---

## 7. File Index

| File | Purpose |
|---|---|
| `docs/replicator-readiness-audit.md` | This document |
| `docs/capability-registry.json` | Machine-readable capability registry (36 capabilities) |
| `server/agentic/api-surface.js` | Canonical action type definitions |
| `server/agentic/executor.js` | Action executor handlers |
| `server/agentic/policy.js` | Policy evaluation engine |
| `server/agentic/security.js` | RBAC + replay protection |
| `server/agentic/routes.js` | Agentic HTTP route handlers |
| `server/agentic/agents/commissioning-agent.js` | Only registered agent |
| `server/artifact3d-service.js` | 3D artifact generation + 10 parametric templates |
| `server/cold-storage.js` | Cold storage read/write + pointer protocol |
| `server/cloud-storage.js` | Object storage client |
| `server/auth-bridge.js` | Solar Passport HMAC auth + Resend email |
| `services/SAiUIMLayer.js` | SAi UIM Layer external service client |
| `public/.well-known/uim-handshake.json` | Current UIM handshake document |
| `shared/schema.ts` | All database table schemas |
| `main.js` | Production HTTP dispatcher (all live routes) |

