---
name: GitHub sync state
description: State of the GitHub remote after the Aug 2026 sync session — canonical URL, credential method, push result, safety tags.
---

# GitHub Sync — Post-Push State (Aug 8 2026)

**Canonical remote URL:** `https://github.com/tdfranklin101-ui/TC-S-Network-Main-Gateway.git`
- No credential embedded in URL (cleaned during this session)
- Auth: `GITHUB_PERSONAL_ACCESS_TOKEN` Replit Secret passed at push time via credential helper

**Push result:** Clean fast-forward, 1334 commits, `40cb8f9 → e66436c`

**GitHub main SHA:** `e66436ca40e7972abc4d093726d1cb4561961301` (= local HEAD)

**Safety tags (both pushed to GitHub):**
- `production-known-good` → `a2ae35c` (Solar Passport auth, Jul 25 2026)
- `pre-replicator-baseline` → `50f53f6` (UIM card + Black Notebook, Aug 3 2026)

**Known issue:** `backups/seed-rotation/` (~300 HTML files) and `data/daily-brief*.json` were already tracked in git and are now on GitHub. `.gitignore` now excludes them from future commits, but `git rm --cached -r` + a follow-up push is needed to fully untrack them.

**Why:**
- Old hardcoded PAT `ghp_HrLD…` was expired and embedded in `.git/config` — removed.
- Stripe test keys were in `.replit [userenv.shared]` — removed, rotated in Stripe dashboard, new values stored as Replit Secrets.
