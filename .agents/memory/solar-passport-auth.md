---
name: Solar Passport auth architecture
description: How the two auth token systems (site session + passport bridge) interact, and the passport-email signal on signup.
---

# Solar Passport auth architecture

Two credential systems coexist over the SAME `members` table, by design:

1. **Site sessions** — `tc_s_session` cookie → DB-backed `session` table
   (`createSession`/`getSession` in main.js). Set by the legacy UI endpoints
   `/api/register`, `/api/users/signup-solar`, `/api/login`. All session-gated
   APIs check this.
2. **Passport bridge tokens** — `tcs_auth` cookie or Bearer token, stateless
   HMAC (SESSION_SECRET) signed in `server/auth-bridge.js` (`/auth/login`,
   `/auth/register`, `/auth/me`, `/auth/gbi-status`). Used by the external
   Solar Passport app (excellent-direction.replit.app).

**Bridging rule:** `/api/session` accepts a valid passport token when no site
session exists and EXCHANGES it for a real site session (sets `tc_s_session`).
So passport sign-ins become full site sign-ins on the first session check.
The exchange is idempotent (reuses the member's newest active session) and
new-session creation is capped per member — keep both properties if touching it
(global rate limiting is disabled, so this is the only abuse guard).

**Passport artifact = an email, not a UI.** Every non-agent, non-anonymous
signup path (site `/api/register`, `/api/users/signup-solar`, bridge
`/auth/register`) fire-and-forgets `sendSolarPassportEmail` (exported from
auth-bridge). It prefers main.js `getResendClient` (env key → Replit Resend
connector fallback) and no-ops loudly if neither is available.

**Why:** owner decision (July 2026): the prototype passport app must never be
the signup surface — the site's legacy UI owns signup/sign-in; the prototype
drifted into being the join destination once (all CTAs hijacked) and was
reverted. But passport-issued auth should still count on the site.

**How to apply:**
- New signup path? Call `sendSolarPassportEmail` (guard: skip agents/anonymous).
- New auth-gated read? Check site session; don't parse `tcs_auth` yourself —
  users hit `/api/session` first, which normalizes to a site session.
- Never point site CTAs/links at the prototype app.
- Resend email tests: use `delivered@resend.dev` as recipient.
