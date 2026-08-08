# TC-S Network — Era 21.2 Orchestrator Readiness

**Development Only — No Production Deployment**

---

## The Architectural Boundary

```
MEMBER
   ↓
MEMBER AGENT
   ↓
AUTHENTICATED INTENT
   ↓
FUTURE FRONTIER ORCHESTRATOR
   ↓
ORCHESTRATION TASK (ORCHESTRATION_TASK_V1)
   ↓
CAPABILITY DISCOVERY  →  GET /api/uim/capabilities
   ↓
PLAN (ORCHESTRATION_PLAN_V1)
   ↓
PLAN VALIDATION  →  POST /api/uim/plan/validate  (zero mutations)
   ↓
UIM  →  POST /api/uim/invoke
   ↓
OPERATIONS AGENTS  (tcs-operations-agent-v1, tcs-scheduler-agent-v1)
   ↓
POLICY ENGINE
   ↓
EXECUTOR
   ↓
CAPABILITIES (Economic Handlers, Asset Handlers, …)
   ↓
LEDGER (PostgreSQL — authoritative Network state)
   ↓
LEARNING (network_knowledge — derived, never authoritative)
```

---

## What the Future Frontier Orchestrator CAN Do

| Action | Interface |
|--------|-----------|
| DISCOVER what capabilities exist | `GET /api/uim/capabilities` |
| DESCRIBE an intended result | `ORCHESTRATION_TASK_V1` envelope |
| CONSTRUCT a valid capability plan | `ORCHESTRATION_PLAN_V1` format |
| VALIDATE the plan before execution | `POST /api/uim/plan/validate` (zero mutations) |
| INVOKE authorized capabilities | `POST /api/uim/invoke` |
| OBSERVE progress | `GET /api/uim/requests/:id/status` |
| VERIFY the requested outcome | `GET /api/uim/workflow-runs/:id` |
| TRACE complete creation provenance | `GET /api/uim/network-knowledge?knowledge_type=CREATION_PROVENANCE` |
| LEARN from Network outcomes | `GET /api/uim/network-knowledge?knowledge_type=CAPABILITY_METRICS` |
| CHECK system readiness | `GET /api/uim/orchestrator-readiness` |

---

## What the Future Frontier Orchestrator CANNOT Do

| Forbidden | Reason |
|-----------|--------|
| Write directly to the database | Ledger is authoritative; all mutations go through Policy → Executor |
| Bypass the Policy Engine | Every invocation is policy-gated. No side-channel. |
| Grant itself new permissions | Permissions live in `agent_registry`. Orchestrator cannot modify them. |
| Invent capabilities | Only registered, live, uim_exposable capabilities can be invoked. |
| Activate physical/factory execution | `PHYSICAL_EXECUTION_REQUIRES_EXPLICIT_ERA_APPROVAL` |
| Alter Network rules through learned inference | Learning layer observations are read-only advisory data |
| Escalate its own authority | Risk ceiling enforced by plan validator and policy engine |

---

## ORCHESTRATION_TASK_V1 — Intent Envelope

```json
{
  "task_id": "<uuid>",
  "principal": {
    "type": "MEMBER | AGENT | NETWORK",
    "id": "<principal-id>"
  },
  "intent": "Create and list a useful digital artifact",
  "constraints": {
    "max_risk_level": "low",
    "max_solar_spend": 0.01,
    "deadline": null,
    "physical_execution": false
  },
  "requested_outcome": {
    "type": "ARTIFACT_LISTED"
  },
  "context": {},
  "metadata": {}
}
```

---

## ORCHESTRATION_PLAN_V1 — Execution Plan

```json
{
  "task_id": "<uuid>",
  "workflow_run_id": "<uuid>",
  "workflow_type": "ARTIFACT_COMMERCE_LOOP_V1",
  "principal": { "type": "AGENT", "id": "tcs-operations-agent-v1" },
  "constraints": { "max_risk_level": "medium", "physical_execution": false },
  "steps": [
    { "sequence": 1, "capability_id": "tcs.marketplace.asset_create",  "version": "1.0", "parameters": {} },
    { "sequence": 2, "capability_id": "tcs.solar.calculate_energy",    "version": "1.0", "parameters_from": ["step:1"] },
    { "sequence": 3, "capability_id": "tcs.marketplace.price_quote",   "version": "1.0", "parameters_from": ["step:1"] },
    { "sequence": 4, "capability_id": "tcs.marketplace.asset_enrich",  "version": "1.0", "parameters_from": ["step:1", "step:2"] },
    { "sequence": 5, "capability_id": "tcs.marketplace.asset_list",    "version": "1.0", "parameters_from": ["step:1"] },
    { "sequence": 6, "capability_id": "tcs.marketplace.purchase",      "version": "1.0", "parameters_from": ["step:5"] },
    { "sequence": 7, "capability_id": "tcs.solar.audit_transaction",   "version": "1.0", "parameters_from": ["step:6"] },
    { "sequence": 8, "capability_id": "tcs.capability_discovery",      "version": "1.0", "parameters": { "type": "LEARNING_UPDATE" }, "optional": true }
  ]
}
```

---

## Invariants (Never Violated)

```
ONE workflow_run_id  →  MANY request_ids
All value movement through:
  INTENT → UIM → POLICY → EXECUTOR → LEDGER → AUDIT → LEARNING
```

---

## Physical World Boundary

The following capabilities are `platform_available: true` but `uim_operations_enabled: false`:

- `tcs.factory.register_printer`
- `tcs.factory.submit_print`
- `tcs.factory.queue_status`
- `tcs.factory.pickup`
- `tcs.3d.generate`
- `tcs.3d.mint`

**Reason:** `PHYSICAL_EXECUTION_REQUIRES_EXPLICIT_ERA_APPROVAL`

These capabilities exist in the platform. They are NOT invocable by `tcs-operations-agent-v1` or any external orchestrator without a separate era-level policy decision. This is a hard boundary, not a technical limitation.

---

## Era 21.2 Success Definition

Era 21.2 succeeds when an external, model-neutral caller that knows nothing about TC-S internals can:

1. **DISCOVER** what the Network can do
2. **DESCRIBE** an intended result
3. **CONSTRUCT** a valid capability plan
4. **VALIDATE** that plan before execution (zero mutations)
5. **INVOKE** authorized capabilities
6. **OBSERVE** their progress
7. **VERIFY** the requested outcome
8. **TRACE** the complete creation provenance
9. **LEARN** from Network outcomes

While remaining unable to bypass policy, write directly to the ledger, invent capabilities, escalate authority, or execute physical machinery.

---

## The Principle

> Era 21.0 created the governed Operations Agent.  
> Era 21.1 gave it economic capability.  
> Era 21.2 creates the universal doorway.

The future frontier orchestrator will not **become** TC-S.  
It will **discover, plan, and operate** TC-S through this doorway.

**The Network remains sovereign.  
The ledger remains truth.  
The Policy Engine remains authority.  
The Operations Layer remains execution.  
The Learning Layer remains understanding.**
