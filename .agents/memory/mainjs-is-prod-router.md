---
name: main.js is the only production router
description: Which server actually handles requests in production; Express routes.ts is dev-only dead code
---

The workflow and production deployment run `node main.js`, a raw `http.createServer` router with a long pathname-dispatch chain. The TypeScript Express stack (`server/index.ts` → `server/routes.ts`) is NOT executed in production — routes mounted there return the custom 404 page live.

**Why:** An auth bridge was first mounted in `server/routes.ts` and returned 404s; the same endpoints only worked after being wired directly into main.js's request handler.

**How to apply:** Any new HTTP endpoint must be added inside main.js's dispatch chain (or as a CJS module called from it, e.g. `server/auth-bridge.js` handling `/auth/*`). Never add production routes to server/routes.ts. Avoid maintaining parallel Express+main.js implementations of the same endpoints — they silently drift.

Related: the Solar Passport auth bridge lives in `server/auth-bridge.js` — stateless HMAC tokens signed with SESSION_SECRET (no schema changes), exact-match CORS allowlist, per-IP in-memory rate limits on /auth/login and /auth/register.
