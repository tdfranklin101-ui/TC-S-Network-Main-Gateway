# Era 22.1 — Frontier Orchestration with Frontier Diversification

**TC-S Replicator / ArmOS integration for the TC-S Network.**

```text
TC-S MARKETPLACE → OPENAI FRONTIER ORCHESTRATOR → ARMOS REPLICATOR →
GEMINI 3 MANUFACTURING/VISION → CREATION CAPSULE → FABRICATION/ASSEMBLY →
VERIFICATION → PROVENANCE RESULT → MARKETPLACE
```

The TC-S Network does not belong to one AI model. **OpenAI orchestrates.
Gemini can engineer and see. Later, open-weight models can perform additional
network work.** UIM provides the common capability language connecting them;
the Replicator turns that intelligence into execution.

## Architecture

```text
TC-S NETWORK
      │
      ▼
OPENAI FRONTIER ORCHESTRATOR        (server/replicator/frontier-orchestrator.js)
      │  UIM / capability request
      ▼
ARMOS REPLICATOR API                (server/replicator/armos-adapter.js →
      │                              https://suspicious-pristine-struct.replit.app/)
      ├── Engineering
      ├── Manufacturing reasoning
      ├── Vision / perception
      └── Assembly reasoning
               ▼
            GEMINI 3                (inside ArmOS — never replaced by TC-S)
               ▼
PHYSICAL / SIMULATED EXECUTION LAYER
```

## Components in this repository

| Piece | Location |
|---|---|
| Model router (RunPod ON_HOLD) | `server/replicator/model-router.js` |
| ArmOS adapter (capability descriptor, nodes, capsule, lifecycle) | `server/replicator/armos-adapter.js` |
| OpenAI frontier orchestrator (Responses API + function tools) | `server/replicator/frontier-orchestrator.js` |
| REST API | `main.js` → `/api/replicator/*` |
| Marketplace demonstration item "REPLICATE THIS" | `public/replicate.html` + featured card on `public/marketplace.html` |
| Index feature link (incl. Cloud Nine case) | `public/index.html` § ArmOS Replicator |

## Responsibility boundaries

- **OpenAI** — intent understanding, capability discovery, node routing,
  mission initiation, status interpretation, marketplace presentation,
  approval coordination. It must **never** fabricate manufacturing results:
  geometry hashes, inspection results, tolerances, machine-code references,
  provenance, or completion all originate from ArmOS/the adapter.
- **Gemini 3 / ArmOS** — manufacturing inference, engineering interpretation,
  perception, part identification, assembly assistance, inspection. ArmOS
  remains authoritative for execution state.
- **Creation Capsule** — a model-independent UIM/Replicator protocol artifact:
  `MODEL → UIM → CREATION CAPSULE → EXECUTION`. Never an "OpenAI capsule" or
  "Gemini capsule". Geometry hashes are sha256 of the actual returned geometry.

## Era 22.0 behavior preserved

- Node routing: **RP-0001** compatible table → `ACCEPTED`; **RP-0002**
  incompatible → `ROUTE_REQUIRED` (orchestrator discovers an alternative node,
  never overrides); **RP-0003** large-volume dual-arm → `ACCEPTED` with
  dual-arm recorded in capsule/provenance.
- Full lifecycle: fabrication → recorded scramble → perception → assembly →
  inspection → provenance, with timeline and capsule `DOWNLOAD JSON`.
- Human approval gate: execution halts at `WAITING_APPROVAL` until
  `APPROVE REPLICATION`; this boundary survives future physical deployment.
- **Cloud Nine** remains the system-scale demonstration:
  <https://suspicious-pristine-struct.replit.app/cloudnine>

## RunPod / open-weight inference — ON HOLD

> RunPod/open-weight inference is intentionally retained but placed ON HOLD
> during Era 22.1. The TC-S model architecture remains inference-provider-
> independent. Open-weight inference will return as an additional routing
> option after the Marketplace → Orchestrator → Replicator execution loop is
> verified.

`RUNPOD_STATUS = "ON_HOLD"`, `OPEN_WEIGHT_INFERENCE_ENABLED = false`
(`server/replicator/model-router.js`). No demo/production request routes to
RunPod. The Era 21.3 orchestrator, gpt-oss-120b integration, health checks,
routing logic, REPLICATOR_TEST_001 work and verification logic are preserved
on the `era21-frontier-orchestrator` branch (tag `era21.3-frontier-orchestrator`);
RUNPOD_* environment hooks remain configured.

## Future model router

```text
TC-S ORCHESTRATOR → MODEL ROUTER → { OPENAI (active) | GEMINI (ArmOS) |
RUNPOD (on hold) } → UIM → CAPABILITIES → REPLICATOR
```

Later activation is possible without rewriting the Replicator (`routeRole()`).

## Security

No API keys, tokens, hidden prompts, reasoning traces, or credentials appear
in browser source, client JavaScript, browser-returned logs, the Creation
Capsule, provenance, or the repository. `.gitignore` excludes `.env` and
credential files.

## Note on the ArmOS repository

The ArmOS Replicator itself runs as a standalone Replit app
(`https://suspicious-pristine-struct.replit.app/`). GitHub preparation,
`era-22.0` baseline tagging and `era-22.1-frontier-orchestration` development
tagging for the ArmOS codebase must be performed inside that app's own
workspace — it is not part of this repository.
