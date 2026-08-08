---
name: Era 21.1 Test Suite
description: State and location of Era 21.1 economic autonomy test suite; key invariants it enforces.
---

## Location
`tests/era21-1.test.js` — 34 tests, 0 failures, 0 skipped (as of Era 21.1 commit)

## Run command
```
node tests/era21-1.test.js
```
Requires: `DATABASE_URL`, `ADMIN_KEY` env vars, server running on port 5000.

## Sections
1. Scheduler agent registration (idempotency, metadata)
2. Factory auth hardening (auth required on register + heartbeat)
3. TRANSFER_SOLAR (self-transfer, negative amount, insufficient balance, happy path, idempotency)
4. PURCHASE_ARTIFACT (inactive listing, insufficient balance, happy path, re-purchase, no orphans)
5. AUDIT_TRANSACTION (pass/fail/ownership finding)
6. Economic knowledge / Learning Layer (source tracing, no auth records)
7. Security (fake scheduler rejected, allowed/denied actions, handler registration)
8. Atomicity (failed transfer = no mutation, failed purchase = no orphan artifact_copies)
9. Audit trail (action_audit_log, marketplace_ledger double-entry)
10. Era 21.0 regression (15/15 via subprocess)

## Important: Era 21.0 test update
Tests 5 and 15 in `tests/operations-agent.test.js` originally tested that TRANSFER_SOLAR was REJECTED. In Era 21.1, TRANSFER_SOLAR is now an ALLOWED action. Those tests were updated to use MINT_SOLAR (which remains in DENIED_ACTIONS) to preserve the "learning ≠ authority" invariant.

## Why: Era 21.1 spec required 34 passing tests verifying the full economic pipeline.
