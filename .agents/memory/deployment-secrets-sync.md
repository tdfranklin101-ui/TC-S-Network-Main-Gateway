---
name: Deployment secrets don't auto-sync
description: New workspace secrets do not reach the existing VM deployment; must be added in the deployment's own secrets pane, then republish.
---

New secrets added in the workspace Secrets tab do NOT automatically propagate to an existing Reserved VM deployment — even after a fresh republish, the prod process kept rejecting a newly created secret (guard compared `process.env` value and got nothing).

**Why:** The deployment keeps its own secrets copy. Fix that worked (July 2026, ADMIN_KEY): user opened the Publishing/Deployment pane, added the secret in the deployment's production secrets section, then republished — only then did `process.env` in prod pick it up.

**How to apply:** Whenever a new secret must exist in production, tell the user to add it in the deployment's secrets pane AND republish (a running VM only reads secrets at boot). Verify with a curl against the live endpoint, not by checking workspace `viewEnvVars` (which only reflects workspace state).

Related ops lesson: agent bash background jobs (`nohup`/`setsid ... &`) are frozen/killed between tool calls in this environment — long-running HTTP-driven jobs (e.g. the cold-storage backfill loop) must be driven in foreground chunks (~85s loops per bash call, tool timeout 115s).
