# TC-S Network — Era 21.3
# RunPod Frontier Orchestrator Deployment

## What This Is

This directory configures the self-hosted open-weight frontier orchestrator that runs
`gpt-oss-120b` on RunPod and operates TC-S through the Era 21.2 UIM contract.

The orchestrator is **development-only** (`production_enabled: false`).
TC-S continues operating normally if RunPod is offline.

---

## A. CODE REPLIT CAN BUILD (already done)

These are complete and in the repository:

| File | Purpose |
|---|---|
| `server/orchestrator/frontier-client.js` | `FrontierClient` interface, `RunPodFrontierClient`, `MockFrontierClient` |
| `server/orchestrator/tcs-frontier-orchestrator.js` | Deterministic orchestration shell (DISCOVER→VERIFY loop) |
| `server/orchestrator/system-instruction.js` | System prompt + sanitizer + topic extractor |
| `server/orchestrator/inference-receipt.js` | Receipt creation + storage in network_knowledge |
| `server/orchestrator/seed-orchestrator-agent.js` | Idempotent TCS-OAFR-001 registration |
| `runpod/orchestrator/operator-profile.json` | Machine-readable operator profile |
| `runpod/orchestrator/runtime-config.example.json` | Example config (no real values) |
| `docs/era21-3-frontier-orchestrator.md` | Architectural doc |
| `docs/runpod-orchestrator-deployment.md` | This deployment guide |
| `public/frontier-orchestrator-test.html` | Dev admin UI |
| `tests/era21-3.test.js` | Full test suite (33+ tests via MockFrontierClient) |

---

## B. MANUAL RUNPOD DASHBOARD ACTIONS

All of the following require a human operator with RunPod account access.
Replit cannot automate dashboard clicks or provision GPU endpoints.

### Prerequisites

- An existing RunPod account at https://runpod.io
- Access to the serverless endpoint dashboard
- `gpt-oss-120b` model weights accessible (HuggingFace Hub or private storage)

---

### Step 1 — Open existing RunPod account

Go to https://runpod.io and log in.

---

### Step 2 — Create a new Serverless endpoint

In the RunPod dashboard:
- Navigate to **Serverless** → **Endpoints**
- Click **+ New Endpoint**

---

### Step 3 — Select vLLM-compatible template/runtime

Choose a template that includes **vLLM** pre-installed, or select:
- **Template**: "vLLM Inference" (official RunPod template if available)
- **Container Image**: `runpod/worker-vllm:stable` (or equivalent)

---

### Step 4 — Configure gpt-oss-120b

Set the following environment variables in the endpoint configuration:

```
MODEL_NAME=gpt-oss-120b
HUGGING_FACE_HUB_TOKEN=<your_hf_token_if_model_is_gated>
VLLM_ARGS=--model gpt-oss-120b --tensor-parallel-size 1 --max-model-len 32768 --gpu-memory-utilization 0.90 --served-model-name gpt-oss-120b
OPENAI_API_KEY=<any_value_vllm_accepts>
```

---

### Step 5 — Select compatible 80GB GPU

RunPod supports multiple 80GB-class GPUs. Select any of the following:

- **H100 80GB SXM** (preferred — highest throughput)
- **H100 80GB PCIe**
- **A100 80GB**

Do not restrict to only one GPU type — RunPod will automatically use whichever
is available if you allow multiple.

---

### Step 6 — Configure scale-to-zero

If the endpoint supports it (most RunPod serverless endpoints do):
- Set **Min Workers**: `0`
- This enables scale-to-zero — no cost when idle

---

### Step 7 — Start with max worker count 1

For initial development:
- Set **Max Workers**: `1`

Increase after validating REPLICATOR_TEST_001 and REPLICATOR_TEST_002.

---

### Step 8 — Deploy the endpoint

Click **Deploy**. Wait for the endpoint to provision and report `READY`.

Note the **cold start time** — first request after idle may take 2-5 minutes for a 120B model.

---

### Step 9 — Copy the endpoint ID

After deployment, find the **Endpoint ID** in the dashboard (looks like `abc123xyz`).

The base URL will be:
```
https://api.runpod.ai/v2/<ENDPOINT_ID>/openai
```

---

### Step 10 — Add secrets to Replit

In the Replit Secrets panel, add:

| Secret Name | Value |
|---|---|
| `RUNPOD_API_KEY` | Your RunPod API key (from Account → API Keys) |
| `RUNPOD_ORCHESTRATOR_ENDPOINT_ID` | The endpoint ID from Step 9 |
| `RUNPOD_ORCHESTRATOR_BASE_URL` | `https://api.runpod.ai/v2/<ENDPOINT_ID>/openai` |
| `RUNPOD_ORCHESTRATOR_MODEL` | `gpt-oss-120b` |
| `OAFR_AGENT_KEY` | A strong random string (your agent credential) |

⚠️ Never commit real values to this repository.

---

### Step 11 — Add RunPod API key to Replit Secrets

The `RUNPOD_API_KEY` is your personal RunPod API key, found at:
https://runpod.io → Account → API Keys

This key is never passed to the model prompt.
It is only used in the HTTP `Authorization: Bearer` header by `RunPodFrontierClient`.

---

### Step 12 — Run health test

From the Replit workspace, or via the dev UI at `/frontier-orchestrator-test`:

```
GET /api/orchestrator/health
X-Admin-Key: <your_admin_key>
```

Expected response:
```json
{
  "orchestrator": "TCS-OAFR-001",
  "frontier": { "status": "healthy", "model": "gpt-oss-120b", "latency_ms": <n> },
  "tcs_uim": { "era": "21.2", ... }
}
```

If `frontier.status` is `ORCHESTRATOR_UNAVAILABLE`, check the endpoint ID and API key.

---

### Step 13 — Run REPLICATOR_TEST_001

Via the dev UI at `/frontier-orchestrator-test` or POST to `/api/orchestrator/run`:

```json
{
  "intent": "Create a useful artifact, prepare it for the TC-S marketplace, determine its energy-derived economic characteristics, list it appropriately, and return a verified creation record.",
  "requested_outcome": "ARTIFACT_LISTED",
  "use_real_model": true
}
```

Record: workflow_run_id, plan, step results, inference receipts, outcome verification.

---

### Step 14 — Run REPLICATOR_TEST_002

```json
{
  "intent": "Create an artifact that helps a new TC-S member understand how Solar distribution and marketplace purchasing currently work.",
  "use_real_model": true
}
```

Verify the orchestrator retrieved current Network Knowledge before planning.

---

## Troubleshooting

| Symptom | Likely Cause |
|---|---|
| `ORCHESTRATOR_UNAVAILABLE` | Endpoint not configured, cold starting, or API key wrong |
| `Plan parse failed` | Model output is not valid ORCHESTRATION_PLAN_V1 JSON — check vLLM `response_format: json_object` support |
| `INVALID plan after N revisions` | Model is using capabilities not in the registry — check system instruction |
| TC-S returning errors | Check `GET /api/uim/system` independently — orchestrator failure must not affect TC-S |
| High latency | 120B model on first cold start can take 2-5 minutes — subsequent calls are faster |

---

## Security Notes

- **The model never sees the `OAFR_AGENT_KEY` or `RUNPOD_API_KEY`**. Both are attached by the orchestrator shell in HTTP headers, outside all model context.
- **Untrusted external content** (artifacts, tool output, user text) is sanitized before inclusion in model messages.
- **Capability definitions come only from** `GET /api/uim/capabilities`. The model cannot invent new capabilities.
- **Policy is enforced by TC-S**. The model's plan is validated before execution; TC-S rejects any plan that violates policy.
