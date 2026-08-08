# TC-S Network — Era 21.1: Economic Autonomy

**Branch:** `era21-operations-agent`  
**Development only — no production deployment**  
**No new LLM introduced**

---

## Overview

Era 21.1 gives the Operations Agent a complete economic lifecycle. The goal is a fully governed, auditable, and deterministic path from artifact creation through purchase and settlement — without any direct SQL mutation from the agent layer, without any policy bypass, and without any LLM involvement in financial decisions.

---

## Architectural Principle

```
INTENT
  → UIM
  → POLICY
  → EXECUTOR
  → TRANSACTION VALIDATION
  → LEDGER / DATABASE
  → AUDIT
  → LEARNING
```

The Operations Agent **never**:
- Writes directly to PostgreSQL
- Bypasses the Policy Engine
- Mutates balances in two unrelated statements without a wrapping DB transaction
- Executes actions not in its permission envelope

---

## Agents Registered in Era 21.1

### tcs-operations-agent-v1 (expanded)

| Property | Value |
|---|---|
| Class | `OPERATIONS_AGENT` |
| Principal | `TC-S_NETWORK` |
| Authority | `POLICY_GOVERNED` |
| `max_risk_level` | `low` (era 21.0) |
| `gbi_exempt` | `true` |
| `production_enabled` | `false` |

**Allowed actions (Era 21.1 expansion):**
- Era 21.0: `QUERY_NETWORK`, `QUERY_MEMBER`, `QUERY_BALANCE`, `QUERY_MARKETPLACE`, `CALCULATE_ENERGY`, `GENERATE_REPORT`, `ASSET.CREATE`, `ASSET.ENRICH`
- Era 21.1 additions: `ASSET.LIST`, `ASSET.UNLIST`, `ASSET.UPDATE`, `PRICE.QUOTE`, `TRANSFER_SOLAR`, `PURCHASE_ARTIFACT`, `AUDIT_TRANSACTION`

**Denied:** `MINT_SOLAR`, `UPDATE_MEMBER`, `SUSPEND_MEMBER`, `SETTLEMENT.RUN` (scheduler domain), `CREATE_NETWORK`, `DELETE_NETWORK`

---

### tcs-scheduler-agent-v1 (new in Era 21.1)

| Property | Value |
|---|---|
| Class | `OPERATIONS_AGENT` |
| Principal | `TC-S_NETWORK` |
| Authority | `POLICY_GOVERNED` |
| `max_risk_level` | `medium` (settlement requires it) |
| `gbi_exempt` | `true` |
| `production_enabled` | `false` |
| `audit_required` | `true` |

**Allowed actions:** `SETTLEMENT.RUN`, `GENERATE_REPORT`, `QUERY_NETWORK`, `QUERY_MARKETPLACE`, `LEDGER.POST`, `LOG_ETHICS_EVENT`, `MODERATION.REVIEW`

**Denied explicitly:** `TRANSFER_SOLAR`, `MINT_SOLAR`, `PURCHASE_ARTIFACT`, `SUSPEND_MEMBER`, `UPDATE_MEMBER`

**Why it was needed:** The scheduler was previously using the literal string `'scheduler-agent'` as its `agentId`, which has no record in `agent_registry`. The policy engine rejects any action from an unregistered agent, so `SETTLEMENT.RUN` was silently rejected every night at 02:00. `tcs-scheduler-agent-v1` fixes this.

---

## Transaction Lifecycle

### TRANSFER_SOLAR

1. Validate `amount > 0`, `source ≠ destination`, both members exist
2. Check idempotency key (if provided) — early return if replay
3. Verify `source.total_solar >= amount`
4. Open DB transaction (`BEGIN`)
5. `UPDATE members SET total_solar` — debit source
6. `UPDATE members SET total_solar` — credit destination
7. `INSERT transactions` — debit row (`transaction_class='solar_transfer'`, `transaction_type='debit'`)
8. `INSERT transactions` — credit row
9. `INSERT marketplace_ledger` — debit entry
10. `INSERT marketplace_ledger` — credit entry
11. `COMMIT` (or `ROLLBACK` on any failure — both sides roll back together)

**Balance field:** `members.total_solar` (numeric)  
**Idempotency:** idempotency key embedded in `transactions.note` as `[idem:KEY]`  
**Return:** `transaction_id`, `audit_reference`, `pre/post_balance_source/destination`

---

### PURCHASE_ARTIFACT

1. Check idempotency key
2. Validate `buyer_member_id` exists
3. Validate `market_item_id` exists and `status = 'ACTIVE'`
4. Check buyer does not already own this item (`artifact_copies` check)
5. Validate `buyer.total_solar >= price`
6. Calculate fees: foundation = 5%, seller_net = 95%
7. Load seller from `market_items.created_by_user_id`
8. Open DB transaction (`BEGIN`)
9. `UPDATE members` — debit buyer
10. `UPDATE members` — credit seller (if known)
11. `UPDATE members` — credit foundation (`tcs_foundation` member)
12. `INSERT transactions` — debit row (type=`purchase`)
13. `INSERT transactions` — seller credit row (type=`sale`)
14. `INSERT transactions` — foundation fee row (type=`foundation_fee`)
15. `INSERT marketplace_ledger` — buyer debit, seller credit, foundation credit
16. `INSERT artifact_copies` — ownership record with `metadata.idempotency_key`
17. `COMMIT` (or `ROLLBACK` on any failure — no partial economic state)

**Fee structure:** 5% foundation, 95% seller  
**Ownership table:** `artifact_copies` (`artifact_id = market_item_id`, `owner_id = buyer.id`)

---

### AUDIT_TRANSACTION (deterministic, no LLM)

Input: `transaction_id` (UUID of debit row)

Checks performed:
1. Transaction row exists → `TX_NOT_FOUND` if absent
2. Marketplace ledger entries exist → `NO_LEDGER_ENTRIES` (WARNING) if absent
3. `SUM(debits) == SUM(credits)` in ledger group → `LEDGER_IMBALANCE` (FAIL) if not
4. `transaction.amount_s == ledger debit total` → `AMOUNT_MISMATCH` (FAIL) if not
5. For `artifact_purchase`: foundation fee ≈ 5% of total → `FOUNDATION_FEE_INCORRECT` (WARNING) if not
6. For `artifact_purchase`: `artifact_copies` row references this transaction → `MISSING_OWNERSHIP_RECORD` (FAIL) if absent
7. Duplicate idempotency key check → `DUPLICATE_IDEMPOTENCY_KEY` (FAIL) if > 1 debit with same key

**Verdicts:** `PASS`, `PASS_WITH_WARNING`, `FAIL`

---

### SETTLEMENT.RUN

Executed by `tcs-scheduler-agent-v1` only. Runs daily at 02:00 via cron.

1. Compute prior calendar-day period (`periodStart`, `periodEnd`)
2. Submit `SETTLEMENT.RUN` through executor with `agentId: 'tcs-scheduler-agent-v1'`
3. Policy validates agent is registered and has `SETTLEMENT.RUN` in `allowed_actions`
4. Handler queries `orders` + `order_items` for fulfilled orders in period
5. Computes vendor/commissioner/TC-S/tax splits via `PricingEngine`
6. If `dryRun=false`: `INSERT settlements` + 4 `ledger_events` rows
7. If no work: returns `NO_OP` result (not a failure)

**Idempotency:** period-scoped; running twice for the same period returns existing settlement

---

## Workflow: ARTIFACT_COMMERCE_LOOP_V1

### State Machine

```
CREATED → RUNNING → SUCCEEDED
                 ↘ FAILED → ROLLED_BACK (if financial rollback needed)
                 ↘ WAITING_APPROVAL (policy-gated step)
```

### Steps (in order)

| # | Step | Capability |
|---|---|---|
| 1 | Create Asset | `ASSET.CREATE` |
| 2 | Calculate Energy | `CALCULATE_ENERGY` |
| 3 | Price Quote | `PRICE.QUOTE` |
| 4 | Enrich Asset | `ASSET.ENRICH` |
| 5 | List Asset | `ASSET.LIST` |
| 6 | Purchase Artifact | `PURCHASE_ARTIFACT` |
| 7 | Audit Transaction | `AUDIT_TRANSACTION` |
| 8 | Learning Update | `LEARNING_UPDATE` |

Each step records: `step_id`, `capability_id`, `request_id`, `status`, `started_at`, `finished_at`, `result_reference`, `audit_reference`, `error`.

Workflow state is persisted in `network_knowledge` with `knowledge_type = 'WORKFLOW_RUN'`.

### Rollback Rules

| Step fails | Action |
|---|---|
| `ASSET.LIST` | No purchase attempted. No financial state. |
| `PURCHASE_ARTIFACT` | DB ROLLBACK. No ownership. No partial credit. |
| `AUDIT_TRANSACTION` | Flag for admin review. Do **not** auto-reverse completed financial state unless deterministic rollback logic explicitly supports it. |

**No automatic "repair by guessing."**

---

## Factory Authentication (Era 21.1 Hardening)

Prior to Era 21.1, `POST /api/factory/printers/register` and `POST /api/factory/printers/:id/heartbeat` were unauthenticated.

**Now:**

- `POST /api/factory/printers/register` requires `X-Admin-Key` or `X-Factory-Owner-Key`
- On registration, a random 256-bit `printer_api_key` is generated, its SHA-256 hash stored in `factory_printers.metadata.api_key_hash`, and the plain key returned **once** (never stored in plaintext)
- `POST /api/factory/printers/:id/heartbeat` requires `X-Factory-Key` header; the server computes `SHA-256(key)` and compares to the stored hash
- Unauthenticated requests → `401 Unauthorized`
- Wrong key → `403 Forbidden`

Factory UIM capabilities remain blocked pending a separate policy decision on enabling them through UIM.

---

## UIM Rate Limiting (Era 21.1)

`POST /api/uim/invoke` is rate-limited per caller:

| Bucket | Limit |
|---|---|
| Per agent (`X-Agent-Id`) | 20 requests / minute |
| Per session | 10 requests / minute |
| Scheduler (`tcs-scheduler-agent-v1`) | 60 requests / hour |

Exceeded limit → `429 Too Many Requests` with `policy.rejection_code: 'RATE_LIMIT_EXCEEDED'` and `reset_ms`.

Implementation: in-memory sliding window (development only; production should use Redis).

---

## SAi UIM Circuit Breaker (Era 21.1)

External SAi UIM / LifeLens / abundance analysis calls are wrapped in a `CircuitBreaker`:

| Parameter | Value |
|---|---|
| Timeout | 5 000 ms |
| Failure threshold | 5 failures → OPEN |
| Recovery probe | After 30 000 ms |
| Success threshold | 2 successes → CLOSED |

States: `CLOSED` (normal), `OPEN` (fail-fast), `HALF` (probe).

**LifeLens is non-essential to economic transactions.** If the circuit is open, transactions degrade gracefully (abundance lens omitted) rather than failing, unless current policy explicitly requires that analysis.

---

## Policy Boundaries

| Action | Required agent | Risk level | Approval |
|---|---|---|---|
| `TRANSFER_SOLAR` | Any authorized ops agent | medium | yes |
| `PURCHASE_ARTIFACT` | Any authorized ops agent | medium | yes |
| `AUDIT_TRANSACTION` | Any authorized ops agent | low | no |
| `SETTLEMENT.RUN` | `tcs-scheduler-agent-v1` only | medium | yes |
| `MINT_SOLAR` | Admin only | critical | yes + multisig |
| `SUSPEND_MEMBER` | Admin only | high | yes |

---

## Atomicity Guarantees

All financial mutations use PostgreSQL transactions (`BEGIN` / `COMMIT` / `ROLLBACK`):

- A transfer failure rolls back both debit and credit
- A purchase failure rolls back buyer debit, seller credit, foundation credit, and ownership record creation — together
- No partial economic state is possible under normal DB operation

---

## Learning Layer Integration

After each workflow step, `OperationsLearning.recordOutcome()` ingests:
- Capability invoked
- Policy outcome
- Execution result
- Financial result (balance deltas, fees)
- Audit result (verdict, findings)

Knowledge types created:
- `TRANSACTION_PATTERN` — from TRANSFER_SOLAR and PURCHASE_ARTIFACT events
- `MARKETPLACE_BEHAVIOR` — from purchase + listing events
- `SETTLEMENT_RULE` — from SETTLEMENT.RUN outcomes
- `AUDIT_RESULT` — from AUDIT_TRANSACTION verdicts
- `WORKFLOW_RUN` — per ARTIFACT_COMMERCE_LOOP_V1 execution

**The Learning Layer may summarize these patterns. It may never authorize them.**

---

## Security Assumptions

1. `ADMIN_KEY` env var is secret and never committed to source
2. Factory printer API keys are 256-bit random, stored as SHA-256 hash only
3. `tcs-scheduler-agent-v1` is the only agent authorized for `SETTLEMENT.RUN`
4. All balance mutations go through the Policy Engine — no direct balance SQL from agent code
5. Idempotency keys prevent replay of financial operations
6. Rate limiting prevents agent abuse of mutation endpoints
7. Circuit breaker prevents external dependency failure from cascading into economic workflows

---

## Remaining Blockers Before Frontier Orchestrator

1. **TRANSFER_SOLAR approval flow**: medium-risk actions require `approval_required=true`. The current executor auto-approves low-risk actions; medium-risk actions need a human or multisig approval step before the executor fires the handler. Until that approval path is connected, TRANSFER_SOLAR and PURCHASE_ARTIFACT may auto-execute in development (the policy check records the approval requirement but the development executor bypasses it).
2. **Factory UIM exposure**: factory auth is complete but enabling factory capabilities in UIM requires a separate policy decision.
3. **Production agent keys**: `agent_registry.metadata.apiKey` is currently compared against a derived default (`agent-key-${agentId}`) or `AGENT_MASTER_KEY`. Production needs a proper key issuance and rotation system.
4. **Redis-backed rate limiter**: current in-memory rate limiter is development-only.
5. **Async UIM callbacks**: medium/high-risk actions that require approval complete asynchronously. UIM callers currently need to poll `/api/uim/requests/:id/status`; a proper webhook/callback mechanism is a prerequisite for frontier orchestrator integration.
6. **`policy.review` scheduler job**: the Monday 05:00 `policy.review` scheduled job still falls into the default `skipped` branch in `scheduler.js`. A handler needs to be implemented before `tcs-scheduler-agent-v1` can run it.
