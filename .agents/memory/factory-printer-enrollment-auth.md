---
name: Factory printer enrollment authentication
description: The current member system has no trusted administrator RBAC source for factory enrollment.
---

Factory printer enrollment authenticates with the deployment-managed `ADMIN_KEY`, not a username or a session claim. Printer heartbeats authenticate with their individually issued printer keys.

**Why:** Public signup cannot safely establish a factory administrator, and the current member schema/environment does not have a database-backed role allowlist. Username-based foundation checks were vulnerable to account takeover on an unseeded database.

**How to apply:** Do not restore session-based enrollment until an out-of-band, non-self-assignable administrator role or allowlist is provisioned and managed independently of session JSON. Keep printer keys hashed at rest and never include credential metadata in public inventory responses.