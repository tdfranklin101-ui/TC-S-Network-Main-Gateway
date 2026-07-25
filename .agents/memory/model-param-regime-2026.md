---
name: 2026 AI model param regime
description: Breaking param rules for GPT-5.x / Claude 5 upgrades, which code paths are OpenAI vs Claude vs Perplexity bound, dead API key.
---

# 2026 model param regime

Current stable tiers (verified July 2026 against /models on our keys):
OpenAI `gpt-5.5` (flagship), `gpt-5.4-mini` (mini), `gpt-image-2`,
`gpt-4o-mini-tts`, `gpt-4o-mini-transcribe`. Anthropic `claude-opus-5`,
`claude-sonnet-5`. The `gpt-5.6-sol/terra/luna` trio works on our key but is a
LIMITED PREVIEW (June 2026) with undocumented tiering — not for prod until GA.

Param rules (the upgrade breaks on params, not names):
- All GPT-5.x reject `max_tokens` → must use `max_completion_tokens`.
- gpt-5.5/5.6 reject custom `temperature` (default only); gpt-5.4-mini still
  accepts it. `response_format: json_object` works on all.
- Claude 5 family rejects `temperature` ("deprecated") — claude-service strips
  it centrally; callers may still pass it, it's ignored.
- gpt-image-2 = same regime as gpt-image-1: b64_json only, no response_format.

Path gotchas:
- agent-inference.js + agentArtifactGenerator.js pass 'gpt-4o'/'gpt-4o-mini'
  as claude-service MODEL_MAP keys (Anthropic-bound); their max_tokens is the
  Anthropic param. Never "upgrade" those strings or rename that param.
- /api/market/web-search is Perplexity (PERPLEXITY_API_KEY), not OpenAI — its
  max_tokens/temperature are Perplexity params, leave them.
- NEW_OPENAI_API_KEY is INVALID (401 from OpenAI); OPENAI_API_KEY is the live
  key. Never add NEW_ fallbacks back.

**Why:** the July 2026 model bump would have silently 400'd every AI feature if
applied as a name-swap; live probes with the code's exact param shape caught it.
**How to apply:** before any model swap, list /v1/models on the real key, then
probe one tiny call per candidate using the code's exact params.
