---
name: Marketplace cold storage
description: How artifact content is offloaded to compressed object storage via a content_body pointer, and the constraints that shaped it.
---

# Marketplace cold storage

Artifact text payloads are stored gzip-compressed in the private object-storage
bucket and referenced from the DB by a tiny `cold://<key>` sentinel kept in the
**existing** `content_body` column. Read paths detect the prefix and resolve on
demand; results warm a bounded 24h LRU working buffer.

**Why:** publish-time schema diff blocks on ANY new column/table (see
publish-diff-blocked). So content could NOT get a new column — the pointer had to
ride inside `content_body`, which meant every read path had to stay backward
compatible with plain inline text (older rows) AND `cold://` pointers.

**How to apply:**
- Modules: `server/cold-storage.js` (isColdPointer/putContent/getContent/resolveContentBody/bufferStats)
  and `server/working-buffer.js` (byte-capped LRU + TTL). Buffer cap/TTL via env
  WORKING_BUFFER_MAX_BYTES / WORKING_BUFFER_TTL_MS.
- Any NEW code path that reads `content_body` and returns/serves the actual text
  MUST resolve it: `coldStorage.isColdPointer(v) ? await resolveContentBody(v) : v`.
  Truthy-only checks (hasFile/isTextOnly) are fine unresolved — a pointer is truthy.
- Any NEW write path that persists text into `content_body` should cold-store it
  first (threshold ~256 chars) and store the pointer, with inline fallback when
  object storage is unavailable.
- When serving resolved content, treat null resolution as a hard failure (5xx),
  never a 200 with an empty body — silent data loss otherwise.
- Backfill existing inline rows via `POST /api/admin/cold-storage/backfill`
  (ADMIN_KEY-guarded, batched, idempotent; skips `cold://%`). Run until remaining=0.
- `/api/artifacts/available` is metadata-only (never selected content_body); its
  memory cost is row-count, not content. It still loads the FULL catalog per
  request and the frontend does client-side search over it — server-side
  pagination there would break search UX and is a separate, higher-risk task.

**Extension (user's vision):** for regenerable artifacts, store ONLY the
`product_prompt` (DNA) and re-infer on read instead of storing a payload. This
rides the same resolver: pointer→file and pointer→inference become interchangeable
resolution strategies behind one read path.

DNA reconstitution is configured to run through the **LifeLens workflow** — the
stored DNA (product_prompt) is fed into LifeLens, and the reconstituted result is
emitted as part of the artifact on read. So the future inference-resolution
strategy is specifically "resolve pointer → invoke LifeLens with the DNA → return
its output as the artifact content," not a generic one-off inference call.
