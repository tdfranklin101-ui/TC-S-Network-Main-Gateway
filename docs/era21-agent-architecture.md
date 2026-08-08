# TC-S Network — Era 21 Agent Architecture

**Version:** 21.0  
**Date:** 2026-08-08  
**Status:** Active Development

---

## 1. Overview

Era 21 introduces a formally layered agent architecture for the TC-S Network. This document defines the roles, boundaries, and authority model for each agent class.

---

## 2. Full Agency Stack

```
HUMAN MEMBER
      ↓  (expresses intent in natural language)
future MEMBER AGENT
      ↓  (translates human intent → authenticated structured request)
authenticated intent
      ↓
future SYSTEM ORCHESTRATOR / REPLICATOR
      ↓  (decomposes intent → capability plan, delegates work)
UIM (Universal Intent Medium)
      ↓  (capability discovery + governed invocation)
OPERATIONS AGENTS
      ↓  (executes Network functions)
POLICY ENGINE
      ↓  (authorizes or rejects every action)
EXECUTOR
      ↓  (routes to registered capability handlers)
NETWORK CAPABILITIES
  ┌──────────────────────────────────────────────┐
  │ Network Commissioning  │  Marketplace         │
  │ Solar Economy          │  Artifact Creation   │
  │ Member Management      │  Energy Calculation  │
  │ LifeLens AI            │  Reporting           │
  │ 3D Fabrication         │  Settlement          │
  └──────────────────────────────────────────────┘
      ↓
LEDGER / DATABASE (authoritative state + history)
```

---

## 3. Agent Classes

### 3.1 OPERATIONS AGENTS (Era 21 — built now)

**Purpose:** Perform authorized work _for_ the TC-S Network.

**Role:** The network worker interface that future intelligence can operate.

**Characteristics:**
- Deterministic — no LLM reasoning at this layer in Era 21
- Governed — every action goes through Policy Engine + Executor
- Audited — every invocation creates an audit trail
- Identity-bound — registered in `agent_registry` with explicit permission envelope

**Examples:**
- `tcs-operations-agent-v1` — general network operations (Era 21.0)
- Future: marketplace-agent-v1, reporting-agent-v1, settlement-agent-v1

**What Operations Agents MUST do:**
```
UIM /api/uim/invoke
  → resolve capability from registry
  → validate capability is live + UIM-exposable
  → check agent permission envelope
  → submit through Agentic Executor
  → run Policy Engine (approval, risk, rate limits)
  → execute registered handler
  → write audit record
  → return normalized UIM response
```

**What Operations Agents MUST NOT do:**
- Write directly to PostgreSQL
- Bypass the Policy Engine
- Bypass approval requirements
- Mutate balances directly
- Invoke unsupported/stub actions
- Silently fall back when policy rejects
- Invent network state

---

### 3.2 MEMBER AGENTS (Future — not in Era 21)

**Purpose:** Represent individual human members within the Network.

**Role:** "Understand my human's intent and represent that intent to the Network."

**Characteristics:**
- One per human member
- Persistent identity tied to member account
- Long-horizon memory of that member's preferences, goals, and history
- Translates human language into structured capability invocations

**Era 21 status:** NOT BUILT. The infrastructure they will call (UIM → Operations Agents) is being built first.

---

### 3.3 SYSTEM ORCHESTRATOR / FUTURE REPLICATOR (Future — not in Era 21)

**Purpose:** Coordinate multiple Operations Agents to accomplish complex intent.

**Role:** Understands intent → decomposes work → discovers capabilities via UIM → delegates to Operations Agents → assembles results → verifies completion.

**Characteristics:**
- Frontier open-weight model (not yet specified)
- Sits above both UIM and Operations Agents
- Does NOT have special elevated permissions — it still operates through UIM
- Will eventually operate the Operations Layer being built in Era 21

**Era 21 status:** NOT BUILT. Era 21 builds the Operations Layer it will eventually operate.

---

## 4. UIM — Universal Intent Medium

**Role:** Provides capability discovery and invocation abstraction between orchestrators and Operations Agents.

### 4.1 Endpoints (Era 21)

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/uim-handshake.json` | Platform UIM discovery document |
| `GET /api/uim/capabilities` | Live capability registry (filtered to `status=live, uim_exposable=true`) |
| `POST /api/uim/invoke` | Standardized UIM action invocation entry point |
| `GET /api/uim/requests/:id/status` | Async result polling for approval-gated actions |
| `GET /api/uim/network-knowledge` | Derived operational knowledge (Learning Layer) |

### 4.2 Invocation Contract

**Request:**
```json
{
  "agent_id": "tcs-operations-agent-v1",
  "capability_id": "tcs.network.query",
  "intent": "Get current state of solar-powered network in North America",
  "parameters": { "networkId": "..." },
  "request_context": {}
}
```

**Response:**
```json
{
  "request_id": "<uuid>",
  "agent_id": "tcs-operations-agent-v1",
  "capability_id": "tcs.network.query",
  "status": "SUCCEEDED | PENDING_APPROVAL | RUNNING | FAILED | REJECTED",
  "result": {},
  "policy": {
    "risk_level": "low",
    "approval_required": false
  },
  "audit": {
    "action_request_id": "<uuid>",
    "audit_log_id": "<uuid>"
  },
  "error": null
}
```

### 4.3 Auth Model

| Route | Auth Required |
|---|---|
| `GET /api/uim/capabilities` | Public (default), Admin for `?include_stubs=true` |
| `POST /api/uim/invoke` | `X-Agent-API-Key` + `X-Agent-Id`, OR `X-Admin-Key`, OR admin session |
| `GET /api/uim/requests/:id/status` | Same as invoke |
| `GET /api/uim/network-knowledge` | Public (derived knowledge only, no secrets) |

---

## 5. Policy Engine

**Role:** Authorizes every action. No action executes without policy evaluation.

**Authority:** Higher than all agents, including Operations Agents.

**What policy evaluates:**
1. Agent exists and is active
2. Action is in agent's `allowed_actions`
3. Action risk level ≤ agent's `max_risk_level`
4. Input validates against action schema
5. Per-agent rate limits (in-memory)
6. Business rules (duplicate network check, transfer limits, etc.)
7. Approval/multisig requirements for medium/high/critical actions

**Outcomes:**
- `APPROVE` → executor runs handler immediately
- `REQUIRES_APPROVAL` → action enters pending state, human approval needed
- `REJECT` → action never executes, rejection reason recorded in audit log

---

## 6. Executor

**Role:** Routes approved actions to the correct capability handler.

**What executor does:**
1. Receives action request (after policy approval)
2. Looks up registered handler for `action_type`
3. Runs handler within try/catch
4. Records execution result in `action_requests` table
5. Writes audit entries to `action_audit_log` at every state transition
6. Returns normalized result

**What executor does NOT do:**
- Bypass policy (policy runs before executor)
- Write to the ledger directly (handlers do this through existing services)
- Expose unauthenticated DB access

---

## 7. Ledger / Database

**Role:** Authoritative state and history. The Network's source of truth.

**Key tables:**
| Table | Purpose |
|---|---|
| `action_requests` | All action submissions, status, policy/execution results |
| `action_audit_log` | Immutable event log for every state transition |
| `agent_registry` | Registered agents with permission envelopes |
| `members` | Member records + Solar balances |
| `solar_minting_ledger` | Solar issuance history |
| `network_specs` | Commissioned network specifications |
| `artifacts` | Marketplace artifact catalog |
| `transactions` | Solar + payment transaction history |
| `network_knowledge` | Learning Layer derived knowledge (Era 21) |

**Operations Agents never write here directly.** All writes go through Executor handlers.

---

## 8. Operations Agent Permission Model (Era 21.0)

### tcs-operations-agent-v1

| Property | Value |
|---|---|
| `agent_id` | `tcs-operations-agent-v1` |
| `class` | `OPERATIONS_AGENT` |
| `principal` | `TC-S_NETWORK` |
| `authority` | `POLICY_GOVERNED` |
| `max_risk_level` | `low` |
| `production_enabled` | `false` |
| `gbi_exempt` | `true` (does not receive member Solar distribution) |

### Initial Authorized Capabilities

| Capability ID | Action Type | Risk | Notes |
|---|---|---|---|
| `tcs.network.query` | `QUERY_NETWORK` | low | ✅ Authorized |
| `tcs.member.query` | `QUERY_MEMBER` | low | ✅ Authorized |
| `tcs.solar.query_balance` | `QUERY_BALANCE` | low | ✅ Authorized |
| `tcs.marketplace.query` | `QUERY_MARKETPLACE` | low | ✅ Authorized |
| `tcs.solar.calculate_energy` | `CALCULATE_ENERGY` | low | ✅ Authorized |
| `tcs.marketplace.generate_report` | `GENERATE_REPORT` | low | ✅ Authorized |
| `tcs.marketplace.asset_create` | `ASSET.CREATE` | low | ✅ Authorized |
| `tcs.marketplace.asset_enrich` | `ASSET.ENRICH` | low | ✅ Authorized |

### Explicitly Denied Capabilities

| Action / Capability | Reason |
|---|---|
| `TRANSFER_SOLAR` | High risk + stub — not authorized in Era 21.0 |
| `MINT_SOLAR` | Critical, admin-only |
| `PURCHASE_ARTIFACT` | Stub, medium risk |
| `UPDATE_MEMBER` | Stub |
| `SUSPEND_MEMBER` | Stub |
| `SETTLEMENT.RUN` | Broken (scheduler-agent not seeded in DB) |
| `CREATE_NETWORK` | Commissioning Agent domain, requires approval |
| `DELETE_NETWORK` | Critical |
| `Factory.*` | Unauthenticated endpoints — security hardening required |
| `LOG_ETHICS_EVENT` | Medium risk — excluded from initial Era 21.0 envelope |

---

## 9. Learning Layer (Era 21.0)

### 9.1 Principle

```
The Network changes.
The ledger records the change.
The learning layer understands the change.
The Operations Agent adapts to the change.
The policy engine still decides what is allowed.
```

### 9.2 Three-Layer Model

```
SOURCE OF TRUTH         ← raw ledger / DB events (read-only by learning layer)
       ↓
DERIVED KNOWLEDGE       ← network_knowledge table (summaries, rules, trends)
       ↓
AGENT MEMORY            ← getNetworkKnowledge() retrieves relevant context
                           for a specific task
```

### 9.3 Knowledge Types

| Type | Description |
|---|---|
| `SOLAR_DISTRIBUTION_RULE` | How Solar is issued and distributed |
| `TRANSACTION_PATTERN` | Normal transaction lifecycle and fee structure |
| `MARKETPLACE_BEHAVIOR` | Listing, pricing, purchase patterns |
| `POLICY_RULE` | Current policy decisions and risk levels |
| `NETWORK_CHANGE` | Detected changes in network rules or behavior |
| `CAPABILITY_CHANGE` | New/deprecated capabilities |
| `MEMBER_RULE` | Member creation and growth patterns |
| `AGENT_RULE` | Agent registration and behavior patterns |
| `SETTLEMENT_RULE` | Settlement timing and flow |
| `ENERGY_STANDARD` | Solar Standard constants and versions |
| `PROTOCOL_CHANGE` | UIM protocol version changes |
| `ANOMALY` | Flagged unexpected behavior |
| `OUTCOME_RECORD` | Operations Agent action outcomes |

### 9.4 Change Detection

When rules or behavior change, a new versioned knowledge record is created:
- Old record: `status = 'superseded'`, `valid_to` set
- New record: `status = 'active'`, references old via `supersedes`
- History is always preserved

### 9.5 Anomaly Detection

Flagged anomalies (Era 21.0 — detect only, no auto-correction):
- Incorrect Solar debit/credit pattern
- Fee mismatch
- Missing reserve allocation
- Duplicate transaction
- Action succeeds but no audit record
- Capability output changes unexpectedly

---

## 10. Security Model

### 10.1 What Is Protected

- All UIM mutation endpoints require authentication
- Operations Agent cannot escalate beyond its permission envelope
- Policy Engine is not bypassable by any agent identity
- Audit log is append-only

### 10.2 Known Gaps (Era 21.0 — not resolved in this sprint)

| Gap | Location | Priority |
|---|---|---|
| Factory printer registration is unauthenticated | `POST /api/factory/printers/register` | P3 |
| Global rate limiter disabled | `main.js` | P3 |
| `SETTLEMENT.RUN` scheduler-agent not seeded | `scheduler.js` + `agent_registry` | P2 |
| `server/routes/*.ts` are dead code | `server/routes/` | P4 |

---

## 11. Era 21 Build Sequence

```
✅ DONE (Era 21.0)
├── era21-operations-agent git branch
├── tcs-operations-agent-v1 registered in agent_registry
├── Operations Agent permission envelope defined
├── GET /api/uim/capabilities
├── POST /api/uim/invoke (thin adapter)
├── GET /api/uim/requests/:id/status
├── GET /api/uim/network-knowledge
├── Operations Agent service (server/agentic/agents/operations-agent.js)
├── Learning Layer (server/agentic/operations-learning.js)
│   ├── network_knowledge table
│   ├── learning_checkpoints table
│   ├── Incremental event ingestion (5 sources)
│   ├── Change detection (versioned records)
│   ├── Anomaly detection
│   └── Knowledge retrieval API
├── Development test harness (scripts/test-operations-agent.js)
├── Automated test suite (tests/operations-agent.test.js)
└── Architecture documentation (this file)

⏳ NEXT (Era 21.x)
├── TRANSFER_SOLAR executor handler
├── PURCHASE_ARTIFACT executor handler
├── UPDATE_MEMBER executor handler
├── Factory printer authentication
├── scheduler-agent DB seed
├── GET /api/uim/capabilities → reference /.well-known/uim-handshake.json
├── Member Agent design
└── System Orchestrator / Replicator
```

---

## 12. Design Decisions

### Why Operations Agents are NOT LLMs (yet)

Era 21.0 builds the **operational substrate** the Replicator will eventually operate. The substrate must be deterministic, auditable, and governed before intelligence is layered on top. An LLM operating over a policy-governed network is far safer than an LLM with direct DB access.

### Why the UIM Invoke endpoint is a thin adapter

The agentic executor already handles policy, approval, audit, and retry. Reimplementing any of this in the UIM layer would create two competing implementations. The adapter translates UIM vocabulary → existing action vocabulary, then gets out of the way.

### Why the Learning Layer does not write to source-of-truth tables

Learning authority ≠ Network authority. A model observing patterns cannot be allowed to alter the ledger that those patterns were observed in. The separation of derived knowledge from source truth is a hard architectural boundary.
