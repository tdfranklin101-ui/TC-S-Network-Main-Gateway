---
name: Static file in-memory cache requires restart
description: Why edits to public/*.html (and other static assets) don't show in the preview until the workflow restarts.
---

The server caches static files (HTML/CSS/JS under `public/`) in memory at startup. Editing a file on disk does NOT change what the preview serves until the process reloads.

**Why:** main.js builds an in-memory static file cache on boot ("Cached N static files in memory") and serves pages (e.g. via `serveHtmlFile`/cached file handler) from that cache, so a stale copy keeps being served after edits. A `ERR_CACHE_WRITE_FAILURE` / unchanged screenshot after an edit is the tell.

**How to apply:** After editing any `public/*.html` (or other cached static asset), restart the `Start application` workflow before screenshotting or verifying in the preview. Confirm the disk file with grep first, then restart, then screenshot.
