---
name: network_knowledge column layout
description: Correct column names for network_knowledge — prevents "column does not exist" errors when writing capability metrics or provenance records.
---

# network_knowledge Column Layout (Era 21.2 verified)

## Rule

The `network_knowledge` table has **no `value` column**. JSON payloads go into `structured_facts` (JSONB). There is a separate `summary` (text NOT NULL) for a human-readable label.

## Correct INSERT pattern

```sql
INSERT INTO network_knowledge
  (subject, knowledge_type, summary, structured_facts,
   confidence, source_table, network_id, valid_from, created_at, updated_at, era)
VALUES ($1, $2, $3, $4::jsonb, 1.0, $5, $6, NOW(), NOW(), NOW(), '21.2')
```

## Correct UPDATE pattern

```sql
UPDATE network_knowledge
SET structured_facts = $1::jsonb, summary = $2, updated_at = NOW()
WHERE knowledge_id = $3
```

## Correct SELECT pattern

```sql
SELECT structured_facts FROM network_knowledge WHERE subject = $1 AND knowledge_type = $2
```

## Full required columns (non-null, no default)

- `knowledge_type` text NOT NULL
- `subject` text NOT NULL
- `summary` text NOT NULL
- `structured_facts` jsonb NOT NULL (default '{}')
- `source_event_ids` jsonb NOT NULL (default '[]')
- `confidence` numeric(4,3) NOT NULL (default 1.0)
- `valid_from` timestamptz NOT NULL (default now())
- `era` text NOT NULL (default '21.0')
- `status` text NOT NULL (default 'active')
- `created_at` / `updated_at` timestamptz NOT NULL (default now())

**Why:** Original capability-metrics.js and provenance.js both used `value` (wrong), causing silent failures (caught by try/catch) and tests 5/17/18/25/26 failing on first run of Era 21.2 tests.
