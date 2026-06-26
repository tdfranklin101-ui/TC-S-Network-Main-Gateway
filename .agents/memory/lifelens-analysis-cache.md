---
name: LifeLens analysis cache completeness
description: Why a partial lifelens_analysis (uim-only) silently breaks the Rob Low Decision Lens, and the rule for caching/persisting it.
---

The `artifacts.lifelens_analysis` jsonb column is the shared cache for BOTH the
Rob Low Decision Lens (human-needs mapping) and the UIM/abundance metric. A
"complete" Rob Low analysis has top-level `humanNeedsMapping` (and usually
`fitScore`/`needsSummary`). The UIM block lives under the `uim` key.

**Rule:** Treat a stored `lifelens_analysis` as a valid cache hit only when it
carries human-needs content (`humanNeedsMapping` || `fitScore` != null ||
`needsSummary`). A record holding ONLY a `uim` block must fall through and
regenerate the full analysis. The DB persist guard must overwrite such partial
rows (key on absence of those same fields), and the cache-acceptance and
persist-overwrite predicates must stay aligned.

**Why:** `persistUimPatchToArtifact` writes the `uim` key via
`jsonb_set(COALESCE(lifelens_analysis,'{}'), '{uim}', ...)`. Calling it on a row
whose `lifelens_analysis` was NULL creates a `{uim:...}` record. The
analyze-artifact route returns ANY non-null `lifelens_analysis` as a complete
cache, so the Rob Low card renders "No decision-lens detail returned." Advisory
read-only routes (e.g. the abundance-lens display proxy) must NOT call
`persistUimPatchToArtifact` — only the create/list/purchase write pipelines
should. The abundance lens re-evaluates fresh each call anyway, so persisting its
patch is both pointless and corrupting.

**How to apply:** Any new code that reads `lifelens_analysis` as a cache, or any
new place that writes a uim patch, must respect this completeness rule, or the
Rob Low Decision Lens will silently go blank for affected artifacts.
