---
name: Production PORT override breaks publish
description: Never set a PORT env var override for production — Replit assigns PORT at runtime and health-checks that port.
---

Rule: Do not set `PORT` in the production environment (`.replit` `[userenv.production]` or via setEnvVars). The app must use `process.env.PORT` untouched in production.

**Why:** On July 10, 2026 the live site went down with "This Deployment could not be reached." Production logs showed the health check probing `127.0.0.1:1104` while the app listened on 3002 because `[userenv.production] PORT = "3002"` overrode the platform-assigned port. The VM crash-looped on failed health checks. Deleting the production PORT override fixed it.

**How to apply:** If the deployed app is unreachable but boots cleanly in logs, compare the health-check port in deployment logs against the port the app reports listening on. Check `viewEnvVars({environment:"production"})` for a PORT override and delete it. Dev PORT=5000 is fine and expected (workflow waits on 5000).
