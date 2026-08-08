# RunPod Orchestrator Deployment Guide
# TC-S Network — Era 21.3

See `runpod/orchestrator/README.md` for the complete step-by-step manual checklist.

This document provides supplementary technical notes for operators.

---

## Quick Reference

| Secret | Source | Purpose |
|---|---|---|
| `RUNPOD_API_KEY` | RunPod Dashboard → API Keys | Authenticates RunPodFrontierClient to RunPod |
| `RUNPOD_ORCHESTRATOR_ENDPOINT_ID` | RunPod Dashboard → Serverless → Endpoint ID | Identifies the vLLM endpoint |
| `RUNPOD_ORCHESTRATOR_BASE_URL` | Constructed from endpoint ID | Base URL for OpenAI-compatible API |
| `RUNPOD_ORCHESTRATOR_MODEL` | Set to `gpt-oss-120b` | Model name passed to /chat/completions |
| `OAFR_AGENT_KEY` | Generate a strong random string | TCS-OAFR-001 agent credential for UIM |
| `ADMIN_KEY` | Already in Replit Secrets | For dev UI access |

## Base URL Pattern

```
https://api.runpod.ai/v2/<ENDPOINT_ID>/openai
```

Chat completions endpoint:
```
https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/chat/completions
```

---

## vLLM Launch Arguments (recommended)

```bash
--model gpt-oss-120b
--tensor-parallel-size 1
--max-model-len 32768
--gpu-memory-utilization 0.90
--served-model-name gpt-oss-120b
--response-role tool
```

If the model requires authentication from HuggingFace:
```bash
--hf-token YOUR_HF_TOKEN
```

---

## GPU Selection

| GPU | VRAM | Notes |
|---|---|---|
| H100 80GB SXM | 80GB | Preferred — highest throughput |
| H100 80GB PCIe | 80GB | Acceptable |
| A100 80GB | 80GB | Acceptable, lower throughput |

Do not use 40GB-class GPUs for 120B parameter models without quantization.

---

## Testing Sequence

After configuring secrets, test in order:

```
1. GET /api/orchestrator/health          → frontier.status should be "healthy"
2. GET /api/uim/system                   → verifies TC-S is independent of RunPod
3. POST /api/orchestrator/run (REPLICATOR_TEST_001)
4. POST /api/orchestrator/run (REPLICATOR_TEST_002)
```

---

## Environment Variables (development fallbacks)

When RunPod secrets are not set, the system behaves as follows:

| Variable | Missing behavior |
|---|---|
| `RUNPOD_API_KEY` | RunPodFrontierClient returns ORCHESTRATOR_UNAVAILABLE |
| `RUNPOD_ORCHESTRATOR_ENDPOINT_ID` | Same |
| `RUNPOD_ORCHESTRATOR_BASE_URL` | Tries to construct from endpoint_id; fails if also missing |
| `RUNPOD_ORCHESTRATOR_MODEL` | Defaults to `gpt-oss-120b` |
| `OAFR_AGENT_KEY` | Uses `dev-oafr-001-key-do-not-use-in-production` |

TC-S continues operating normally in all cases — RunPod unavailability is isolated.

---

## Inference Receipt Storage

Each frontier call creates an `INFERENCE_RECEIPT` record in `network_knowledge`:
- `subject`: `inference_receipt:<uuid>`
- `knowledge_type`: `INFERENCE_RECEIPT`
- `structured_facts`: full receipt JSON (tokens, latency, cost, output_hash)

Query inference history:
```
GET /api/uim/network-knowledge?knowledge_type=INFERENCE_RECEIPT
```

---

## Cost Estimation Notes

Cost estimates in `INFERENCE_RECEIPT` records are **ESTIMATED** (`energy_measurement_type: "ESTIMATED"`).
They use H100 TDP ≈ 700W and RunPod pricing ≈ $2.89/hr as of 2026.
Actual costs depend on RunPod pricing, GPU allocation, and batch efficiency.

No Solar conversion occurs in Era 21.3. Future eras may formalize energy accounting.
