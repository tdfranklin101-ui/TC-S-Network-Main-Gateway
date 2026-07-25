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
  NEVER run the backfill in an environment whose deployed code cannot read the
  pointers it writes — backfilling prod before a read-path fix is published
  converts readable inline rows into unreadable pointers.
- `/api/artifacts/available` is metadata-only (never selected content_body); its
  memory cost is row-count, not content. It still loads the FULL catalog per
  request and the frontend does client-side search over it — server-side
  pagination there would break search UX and is a separate, higher-risk task.

**DNA reconstitution (implemented):** the purchase workflow already had a
reconstitution step — `ArtifactGenesisService.generateFromDNA(artifactId)` in
`server/audio-genesis-service.js` — which reads the artifact's DNA from
`content_body` and materializes a real deliverable (audio/HTML/text) via GPT-4o
into cloud storage. Because DNA now lives in cold storage as a `cold://` pointer,
`generateFromDNA` resolves that pointer to the real blueprint BEFORE feeding it to
the generators (fails loud if resolution returns null). `generateTeaser` needs no
resolution — it only uses title/description/category. This is the "connection to
the DNA pools": cold storage holds the DNA, the existing genesis path regenerates
the product from it on purchase.

**Why:** without resolution the generators would receive the literal `cold://...`
pointer string as the blueprint and produce garbage. The genesis method is the
single normalization point — all generator methods are invoked only through it.

**Object-storage key shapes (critical):** uploads store object names VERBATIM —
and because `PRIVATE_OBJECT_DIR` includes a leading `/{bucket-id}/` prefix, most
objects (cold/, master/, trade/) live under bucket-prefixed names, while a few
paths that hardcode `.private/...` live under normalized names. Reads that
normalize the prefix away miss the verbatim population entirely; this failure
was masked by the 24h working buffer (reads succeed right after writes) and
only surfaced after restarts as "orphaned pointer" noise — the objects were
never missing. `downloadFile` must try the verbatim key FIRST, then
progressively normalized forms. Never "fix" this by normalizing uploads:
18k+ objects already live under prefixed names.

**Further vision:** store ONLY the DNA/prompt and regenerate on demand; the same
resolver makes pointer→file and pointer→regeneration interchangeable behind one
read path.
