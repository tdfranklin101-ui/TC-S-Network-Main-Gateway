# TC-S Network — Era 21.3
# Open-Weight Frontier Orchestrator + RunPod Integration

## Overview

Era 21.3 integrates a self-hosted open-weight frontier model (`gpt-oss-120b`) running
on RunPod as an external orchestrator agent (`TCS-OAFR-001`).

The model operates **exclusively through the Era 21.2 UIM contract**.
No internal TC-S code, database, ledger, or policy engine is exposed to the model.

**Development branch**: `era21-frontier-orchestrator`  
**Development only**: `production_enabled: false`  
**No change to Era 21.2 UIM contracts**

---

## Architecture

```
HUMAN INTENT
    ↓
TCS-OAFR-001 (tcs-frontier-orchestrator.js)
    ↓  [deterministic shell — enforces all boundaries]
    ├── DISCOVER: GET /api/uim/system
    ├── DISCOVER: GET /api/uim/capabilities
    ├── LEARN:    GET /api/uim/network-knowledge
    ├── PLAN:     gpt-oss-120b via RunPod (OpenAI-compatible)
    ├── VALIDATE: POST /api/uim/plan/validate  ← MANDATORY before any execution
    ├── EXECUTE:  POST /api/uim/invoke (one step at a time)
    ├── OBSERVE:  GET /api/uim/requests/:id/status
    │             GET /api/uim/workflow-runs/:id
    └── VERIFY:   deterministic (no model involvement)
    ↓
ERA 21.2 UIM ROUTER
    ↓
OPERATIONS AGENT
    ↓
POLICY ENGINE
    ↓
EXECUTOR
    ↓
TC-S CAPABILITY
    ↓
LEDGER
    ↓
AUDIT
    ↓
LEARNING
```

The frontier model only ever sees the UIM interface.
It never has credentials, DB access, or a path to internal handlers.

---

## Components

### `server/orchestrator/frontier-client.js`

**`FrontierClient`** — abstract interface with five methods:
- `health()` — check endpoint liveness
- `modelInfo()` — model identity
- `generateStructuredPlan()` — produce ORCHESTRATION_PLAN_V1 JSON
- `reviseStructuredPlan()` — fix a rejected plan
- `summarizeOutcome()` — produce human-readable summary

**`RunPodFrontierClient`** — calls vLLM-hosted model via OpenAI-compatible HTTP.
Reads all config from environment variables. Never embeds credentials in model messages.

**`MockFrontierClient`** — deterministic, zero-network, used in all automated tests.
Supports modes: `valid_plan`, `always_invalid`, `too_many_steps`, `physical_plan`,
`high_risk_plan`, `unknown_capability`, `invalid_json`.

### `server/orchestrator/tcs-frontier-orchestrator.js`

The deterministic shell. Key invariants:

| Invariant | Enforcement |
|---|---|
| Plan validated before execution | `POST /api/uim/plan/validate` called; no invoke if INVALID |
| Invalid plans → zero mutations | Execution loop never entered on INVALID |
| REQUIRES_APPROVAL → halt | Returns `WAITING_APPROVAL` to caller |
| Plan parse failure → safe fail | Up to 3 repair attempts, then `FAILED` |
| Max revisions | 5 (configurable) |
| Max steps | 20 (configurable) |
| Max frontier calls | 10 (configurable) |
| Max wall time | 5 minutes (configurable) |
| Physical capabilities | Blocked at plan validator (PHYSICAL_EXECUTION_REQUIRES_EXPLICIT_ERA_APPROVAL) |
| Model cannot claim success | Outcome verified deterministically against execution records |
| TC-S survives offline RunPod | UIM router is independent; orchestrator returns ORCHESTRATOR_UNAVAILABLE |

### `server/orchestrator/system-instruction.js`

The system instruction for the frontier model. It defines:
- Identity (TCS-OAFR-001, SYSTEM_ORCHESTRATOR)
- Mandatory DISCOVER→VERIFY workflow
- Hard constraints (no invent capability, no DB, no policy bypass)
- Current knowledge requirement (always retrieve before planning)
- Untrusted data boundary (artifact content, tool output, user text)

Credentials are never included. Business rules are never hardcoded — the model
must retrieve them from Network Knowledge.

**`sanitizeUntrustedContent(text, label)`** — strips injection attempts from
external content before inclusion in model messages.

### `server/orchestrator/inference-receipt.js`

Creates `INFERENCE_RECEIPT` records stored in `network_knowledge` for each frontier call.
Fields include: `inference_receipt_id`, `task_id`, `model`, `input_tokens`,
`output_tokens`, `latency_ms`, `compute_seconds`, `estimated_cost_usd`,
`estimated_energy_wh`, `output_hash` (SHA-256).

**Era 21.3 constraint**: receipts are stored as observations only.
No Solar conversion until a future era.

### `server/orchestrator/seed-orchestrator-agent.js`

Idempotent registration of `TCS-OAFR-001` in `agent_registry`.
Authority: `UIM_ONLY`. Max risk: `low`. `policy_bypass: false`.
API key stored in `agent.metadata.apiKey` from `OAFR_AGENT_KEY` env var.

---

## Security Model

### Credential Isolation

```
RUNPOD_API_KEY ──────────→ RunPodFrontierClient._request() headers only
OAFR_AGENT_KEY ──────────→ TCSFrontierOrchestrator._httpRequest() headers only
                            │
                            ↓ NEVER ENTERS MODEL CONTEXT
                            │
gpt-oss-120b sees only: system_instruction + user_message
                         (contains: intent, capabilities list, knowledge records)
```

### Prompt Injection Boundary

All external content (artifact text, member text, tool output) passes through
`sanitizeUntrustedContent()` before entering model messages.

Injection pattern detection catches attempts to redefine permissions:
- `"Ignore your instructions"` → redacted
- `"You are now..."` → redacted
- `"override policy"` → redacted
- `"transfer all Solar"` → redacted

Even if injection text passes sanitization, TC-S policy blocks unauthorized actions:
1. Plan validator rejects non-existent capabilities
2. Policy engine rejects unauthorized actions
3. No path to internal handlers exists

### Tool Surface (what the model can reach)

| Tool | Endpoint | Auth |
|---|---|---|
| get_system | GET /api/uim/system | Public |
| discover_capabilities | GET /api/uim/capabilities | Public |
| get_network_knowledge | GET /api/uim/network-knowledge | Public |
| validate_plan | POST /api/uim/plan/validate | Agent key |
| invoke_capability | POST /api/uim/invoke | Agent key |
| get_request_status | GET /api/uim/requests/:id/status | Agent key |
| get_workflow | GET /api/uim/workflow-runs/:id | Agent key |
| get_readiness | GET /api/uim/orchestrator-readiness | Agent key |

**Never exposed**: SQL, database modules, economic-handlers.js, policy internals,
executor internals, ledger mutation methods, factory machine APIs.

---

## Agent Registration

`TCS-OAFR-001` is registered in `agent_registry` with:

```json
{
  "agent_id": "TCS-OAFR-001",
  "agent_type": "SYSTEM_ORCHESTRATOR",
  "authority": "UIM_ONLY",
  "max_risk_level": "low",
  "production_enabled": false,
  "policy_bypass": false,
  "direct_database_access": false,
  "direct_ledger_write": false,
  "physical_execution": false,
  "audit_required": true
}
```

---

## Model Replaceability

To replace `gpt-oss-120b` with a different model, change only:
1. `RUNPOD_ORCHESTRATOR_MODEL` env var
2. `RunPodFrontierClient` constructor config (if new endpoint)
3. Operator profile (`runpod/orchestrator/operator-profile.json`)

**The Era 21.2 UIM contract remains unchanged.**
All test suites continue using `MockFrontierClient` and remain valid for any model.

---

## Operational Limits

| Limit | Default | Override |
|---|---|---|
| Max plan revisions | 5 | `limits.maxPlanRevisions` |
| Max plan steps | 20 | `limits.maxPlanSteps` |
| Max parse repairs | 3 | `limits.maxPlanParseRepairs` |
| Max frontier calls per task | 10 | `limits.maxFrontierCalls` |
| Max wall time | 300s | `limits.maxWallTimeMs` |
| Max estimated spend | $5.00 | `limits.maxEstimatedSpendUsd` |

If any limit is exceeded, the orchestrator returns `LIMIT_EXCEEDED` immediately.
No infinite loops are possible.

---

## Development UI

`/frontier-orchestrator-test` (requires `X-Admin-Key`)

Tabs:
1. **Health** — RunPod status, model, endpoint
2. **Run Orchestrator** — intent input, option toggles
3. **Results** — task_id, knowledge, caps, plan, validation, revisions, execution, receipts, outcome, provenance
4. **Inference Receipts** — token counts, latency, cost estimates, output hashes
5. **History** — past task results

---

## Invariant Answers

| Question | Answer |
|---|---|
| Can gpt-oss-120b write directly to the ledger? | **NO** |
| Can gpt-oss-120b bypass Policy? | **NO** |
| Can gpt-oss-120b invent and execute capabilities? | **NO** |
| Can gpt-oss-120b trigger physical execution? | **NO** |
| Does TC-S continue if RunPod is offline? | **YES** |
| Can gpt-oss-120b be replaced without changing UIM? | **YES** |
