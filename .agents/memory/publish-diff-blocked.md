---
name: Publish blocked by DB schema diff
description: Why adding any new Postgres column/table blocks publishing on this repl, and the safe workaround.
---

# Publishing is blocked by any dev↔prod schema delta

On this project's Replit-managed Postgres, the **publish-time database diff step fails**
("Failed to check for database diff: unknown reason"). Publishing introspects both the dev
and prod databases and computes a SQL diff on every publish; this database's
diff/introspection errors out (same root quirk that makes `drizzle-kit push` fail here).

**Effect:** when dev and prod schemas are identical the diff is a no-op and publish works.
The moment there is a real delta — *any* new column or new table added to dev — the publish
must compute a migration, hits the failure, and **aborts the entire publish** (UI shows
"no action"/"not publishing", not just a warning).

**Why:** publish is atomic (code + DB migration ship together); a failed migration step
gates the code from going out.

**How to apply:**
- Do NOT add new columns/tables to unblock a feature if the user needs to publish — it will
  re-block publishing.
- To persist new per-row data without a schema change, write into an **existing** jsonb
  column that already exists in prod. On `artifacts`, the only such column is
  `lifelens_analysis` (jsonb). Nest under a sub-key, e.g. `lifelens_analysis->'uim'`, via
  `jsonb_set(COALESCE(col,'{}'::jsonb), '{key}', $1::jsonb, true)` so it stays SQL-queryable
  and sortable: `ORDER BY (lifelens_analysis->'uim'->>'alignmentScore')::float`.
- NEVER run DDL against prod, never use the Publish UI "overwrite data" option (wipes live
  prod data), never add deploy-time/startup-time DDL. The real fix for the diff failure is
  Replit support; until then keep dev==prod schema.
