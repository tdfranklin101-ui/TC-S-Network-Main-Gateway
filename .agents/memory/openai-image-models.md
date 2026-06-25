---
name: OpenAI image generation in this repl
description: Which image models the OpenAI key can actually use, and the param quirk, for runtime images.generate calls
---

# OpenAI image generation

The OpenAI key in this repl (project-scoped) does **NOT** have access to the DALL·E models. Calling `images.generate({ model: 'dall-e-3' })` fails with `400 The model 'dall-e-3' does not exist.`

Available image models on this account are the `gpt-image` family only:
`gpt-image-1`, `gpt-image-1-mini`, `gpt-image-1.5`, `chatgpt-image-latest`, `gpt-image-2`, `gpt-image-2-2026-04-21`.

**Rules for `openai.images.generate` here:**
- Use `model: 'gpt-image-1'` (or another gpt-image-* id).
- Do NOT pass `response_format` — gpt-image models reject it with `400 Unknown parameter: 'response_format'`. They always return base64 in `resp.data[0].b64_json` (no `url`).
- `quality: 'low'` keeps a preview fast/cheap; sizes `1024x1024`, `1536x1024`, `1024x1536`.

**Why:** spent several restarts chasing two misleading 400s (`Unknown parameter: response_format`, then `model dall-e-3 does not exist`) before listing models via `o.models.list()`. To avoid the buffer-source ambiguity, code that consumes the result should handle both `b64_json` and `url`.

**How to apply:** any server-side runtime image generation (e.g. Layer 3 `/api/market/produce` preview images) must use gpt-image-1 and read `b64_json`. The agent's build-time `generateImage` skill is separate and unrelated to runtime server calls.
