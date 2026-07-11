---
name: Production OOM crash-loop on 2GB VM
description: Live site intermittently unreachable because Node OOMs (~1GB heap) on the e2-small 2GB Reserved VM; raised heap ceiling as mitigation, root cause is in-memory growth.
---

Symptom: live site "works for a bit then can't connect." Deployment logs show `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` at ~1GB, then `command finished with error [node main.js]: signal: aborted (core dumped)`, VM auto-restarts. Time-to-OOM shrinks each restart (~4.9h → ~2.3h).

**Why:** The Reserved VM is e2-small (0.5 vCPU, **2 GB RAM**). The app loads the entire active marketplace (`market_items` WHERE status='ACTIVE', ~19,100 rows and growing) into an in-memory `artifacts` listing on boot, keeps a 139 MB in-memory static FILE_CACHE, and runs agent daily-tasks in-process continuously. Node's default heap ceiling on a 2 GB box is ~1 GB. Agents create items that persist to the DB and reload on next boot, so each restart loads more and OOMs sooner — a death spiral.

**Mitigation applied:** production run command set to `node --max-old-space-size=1400 main.js` via deployConfig (safe alongside 139 MB static buffers + OS on 2 GB; ~300-400 MB margin). This raises the ceiling but does NOT cure unbounded growth.

**How to apply / durable fix:** For real stability either (a) move to a larger Reserved VM (more RAM) — user action in the Deployments pane, or (b) stop loading the whole marketplace into memory: paginate/lazy-load `market_items` for the listing instead of `SELECT ... ORDER BY id DESC` of all ACTIVE rows (main.js ~line 8168), and/or bound agent creation + clear in-memory caches. Do NOT just keep raising max-old-space-size past ~1500 on a 2 GB box — the OS OOM-killer will take over.

Separate, unrelated to the outage: agent logs show Anthropic `credit balance is too low` 400s — that's the user's Anthropic billing; agents fall back to heuristics, site stays up.
