---
name: UIM abundance lens replay quirk
description: Why the SAi UIM layer returns an empty abundance_lens, and how to force the full one.
---

The SAi UIM layer (`POST /lifelens/uim_metric`, wrapped by `services/SAiUIMLayer.js` `requestUimMetric`) returns the full advisory `uim_metric.abundance_lens` (band, band_meaning, insights, gate, remediation, recommended, blocked — ~17 keys) **only on a fresh evaluation**.

**Quirk:** idempotency is keyed on `transaction_id` (primary) falling back to `artifact_id`. On a **replay** of an artifact whose record was cached under an *older policy version* (before the abundance_lens feature), the layer returns a slimmed payload with `abundance_lens: {}` **empty**, while the real numbers still sit at the top level of `uim_metric` (`abundance_score`, `blocked`, `recommended`, `rating`, `approval_threshold`). The `rendered_text` then says "band: unknown".

**Fix / how to apply:** for advisory lens *display reads*, always send a unique `transaction_id` (e.g. `lens-<artifactId>-<Date.now()>`) so each request forces a fresh full evaluation. This is what `/api/lifelens/abundance-lens` does. Do NOT reuse artifact_id alone for a display read or you may get the empty-lens replay.

**Why:** advisory display must show the real band/insights/remediation; the empty-replay path silently degrades the card to "unknown". A fresh txn id is cheap and the lens is advisory (not a real order).

**Contract reminder:** the lens is ADVISORY — never auto-block on band/score. The ONLY hard-deny is `abundance_lens.blocked === true`, which wires to `window.KidSolarController.deactivate()` (the Sign Off Kid Solar shut-off) and shows `gate.reason`.
