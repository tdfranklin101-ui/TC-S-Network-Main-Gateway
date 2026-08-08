---
name: Era 21.1 Schema Quirks
description: DB schema gotchas discovered while implementing and testing Era 21.1 economic handlers — needed to make TRANSFER_SOLAR, PURCHASE_ARTIFACT, and the test suite work.
---

## Key schema facts (confirmed against live DB)

### transactions table
- `wallet_id` is NOT NULL — every INSERT must provide a valid UUID from `wallets.id`
- Members created as `is_placeholder=true` have `wallet_id=NULL` in `members` table
- **Fix**: `getOrCreateWallet(pool, member)` helper: looks up `wallets WHERE user_id = String(member.id)`, creates if absent, updates `members.wallet_id`

### members table
- `name` column is NOT NULL — all INSERTs must include it (easy to miss when creating test fixtures)
- `wallet_id` column exists but is null for placeholder members

### artifact_copies table
- `artifact_id` FKs to `artifacts.id` (not `market_items.id`)
- For purchases, must resolve/create an `artifacts` record from the `market_item`
- **Pattern**: use slug `market_item_<uuid>`, INSERT into artifacts with minimal required fields (slug, title, category, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, creator_id), cache the resolved `artifacts.id` in `market_items.metadata.artifact_id`
- `purchase_transaction_id` is varchar (not uuid) — can store formatted IDs
- `id` (PK) is uuid — INSERTs don't need to provide it (gen_random_uuid default)

### transactions.id (PK)
- Type: uuid — must use `crypto.randomUUID()`, NOT custom formatted strings like `purchase_${Date.now()}`

### agent_registry table
- `rate_limit_window` is integer (minutes), NOT text — do NOT pass `'1 hour'`; pass `60` instead

### factory_printers table
- `metadata jsonb` column added by startup migration — if missing, `ALTER TABLE factory_printers ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb`

### network_knowledge table
- PK column is `knowledge_id`, NOT `id`

### action_audit_log table
- Timestamp column is `timestamp`, NOT `created_at`

## Test file (CJS) requirements
- Node treats .js files with top-level `await` as ESM — `require()` then breaks
- Pattern: wrap all test code in `async function runTests()` + `async function main()` with `.catch`
- All relative `require()` paths from `tests/` must use `../server/agentic/...`
- `finally` block with `process.exit()` swallows errors thrown by runTests — always add `catch (runErr)` before `finally`

## Why: discovered through 13 failing tests across 6 distinct root causes during Era 21.1 test run.
