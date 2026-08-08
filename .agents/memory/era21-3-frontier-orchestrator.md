---
name: Era 21.3 Frontier Orchestrator
description: Key design decisions and gotchas for the TCSFrontierOrchestrator + RunPod integration built in Era 21.3
---

# Era 21.3 Frontier Orchestrator

## Hard rules
- Branch: `era21-frontier-orchestrator` — NOT merged to main. Tag: `era21.3-frontier-orchestrator`.
- TCS-OAFR-001 agent uses `UIM_ONLY` authority; seeded idempotently via `seedOrchestratorAgent(pool)`.
- Model never sees credentials — all headers attached in `_httpRequest()` outside prompt context.
- Physical caps (PHYSICAL_BLOCKED_IDS) return `REQUIRES_APPROVAL` from the validator, not `INVALID`.

## Schema / validator quirks
- Plan steps MUST have `sequence` (integer ≥ 1) or the validator hits `INVALID_SEQUENCE` and `continue`s before it can run PHYSICAL/UNKNOWN_CAPABILITY checks.
- Plan MUST have `workflow_run_id` or validator hits `MISSING_WORKFLOW_RUN_ID`.
- `_normalizePlan()` injects both `workflow_run_id` and `plan_id` if absent.
- Live capability API returns `capability_id` field (not `id`) — mock must use `cap.capability_id || cap.id`.

## HTTP contract
- `/api/uim/plan/validate` returns 422 for INVALID plans (not 200). The orchestrator catches 422 and treats it as INVALID response — it must NOT throw.
- `_uimPost` throws on statusCode ≥ 400; catch 422 explicitly for plan/validate.

## MockFrontierClient modes
- `valid_plan` — uses first live+low-risk cap from availableCaps; includes sequence, workflow_run_id.
- `always_invalid` — uses `tcs.nonexistent.fake_capability` → UNKNOWN_CAPABILITY finding.
- `too_many_steps` — 21 steps of `tcs.network.query`.
- `physical_plan` — `tcs.factory.submit_print` → PHYSICAL_EXECUTION_DISABLED finding (REQUIRES_APPROVAL).
- `high_risk_plan` — `tcs.network.create` (medium-risk) with low ceiling → REQUIRES_APPROVAL or INVALID.
- `unknown_capability` — `TELEPORT_ARTIFACT` → INVALID.
- `{ unavailable: true }` — health() returns `ORCHESTRATOR_UNAVAILABLE` status.

## Inference receipts
- Stored in `network_knowledge` with `knowledge_type = 'INFERENCE_RECEIPT'`, `structured_facts = JSONB`.
- Storage is non-fatal (catch swallowed). Neon direct-connection endpoint may be disabled; server uses pooler URL.

## Push method
- Use `git -c "http.extraHeader=Authorization: Basic ${B64}"` where `B64 = base64("x-access-token:${PAT}")`.
- `git remote set-url` with PAT-in-URL is blocked by Replit askpass interceptor.

## Test suite
- 36 tests in `tests/era21-3.test.js`. All use MockFrontierClient — zero RunPod dependency for CI.
- Regression tests 34/35/36 run era21-2 (31/31), era21-1 (34/34), operations-agent (15/15).
- RunPod endpoint: NOT configured until user completes 14 manual steps in runpod/orchestrator/README.md.
