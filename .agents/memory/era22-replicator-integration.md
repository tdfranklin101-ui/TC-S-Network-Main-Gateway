---
name: Era 22.1 ArmOS Replicator integration
description: How the TC-S repl integrates the remote ArmOS Replicator app; boundaries and quirks
---

- The ArmOS Replicator (Era 22.0 lifecycle, Cloud Nine at /cloudnine) is a **separate standalone Replit app** (suspicious-pristine-struct.replit.app), not code in this repl. Its GitHub repo: https://github.com/tdfranklin101-ui/tcs-replicator-armos. Its only public API: `/api/health`, `/api/designs`, `POST /api/engineer {prompt}` (Gemini-backed, authoritative engineering), `/api/parse`.
- **Why:** the full mission lifecycle (nodes RP-0001/2/3, capsule, fabrication, provenance) is client-side in ArmOS — this repl simulates execution locally (`server/replicator/armos-adapter.js`, everything labeled `TC-S_LOCAL_SIMULATION`), with only engineering live.
- ArmOS `/api/engineer` **504s after ~12s on complex prompts** — the adapter retries 3× with backoff; never substitute synthetic engineering.
- Orchestrator: OpenAI Responses API, model `gpt-5.5`, function-tool loop in `server/replicator/frontier-orchestrator.js`. Watch the race: approval can land while the final summary round is still running — completion checks must key off the timeline, not current status.
- Mission approve/cancel require the `X-Mission-Token` header (control_token returned only at creation). POST mission is rate-limited 5/10min per IP, 3 concurrent.
- RunPod stays ON_HOLD (`server/replicator/model-router.js`); no execution may route there in Era 22.1.
