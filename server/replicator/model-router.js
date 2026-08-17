/**
 * ERA 22.1 — TC-S MODEL ROUTER
 * ============================
 * FRONTIER ORCHESTRATION WITH FRONTIER DIVERSIFICATION
 *
 * The TC-S Network does not belong to one AI model.
 *   - OpenAI orchestrates (intent / planning / capability routing).
 *   - Gemini 3 engineers and sees (ArmOS specialist inference).
 *   - Open-weight models (RunPod) can perform additional network work later.
 * UIM provides the common capability language connecting them.
 * The Replicator turns that intelligence into execution.
 *
 * ARCHITECTURAL NOTE (RunPod / open-weight inference):
 * RunPod/open-weight inference is intentionally retained but placed ON HOLD
 * during Era 22.1. The TC-S model architecture remains inference-provider-
 * independent. Open-weight inference will return as an additional routing
 * option after the Marketplace → Orchestrator → Replicator execution loop is
 * verified. No RunPod code has been destroyed — the Era 21.3 orchestrator,
 * gpt-oss-120b integration, health checks, model routing logic, credential
 * hooks, inference adapters, REPLICATOR_TEST_001 work and verification logic
 * are preserved on the `era21-frontier-orchestrator` branch (tag
 * `era21.3-frontier-orchestrator`) and the RUNPOD_* environment hooks remain
 * configured in this workspace.
 */

const RUNPOD_STATUS = 'ON_HOLD';
const OPEN_WEIGHT_INFERENCE_ENABLED = false;

// Desired future architecture:
//   TC-S ORCHESTRATOR → MODEL ROUTER → { OPENAI | GEMINI | RUNPOD } → UIM →
//   CAPABILITIES → REPLICATOR
// The router makes later activation possible without rewriting the Replicator.
const PROVIDERS = {
  OPENAI: {
    provider: 'OPENAI',
    role: 'NETWORK_ORCHESTRATION',
    description: 'Intent / Planning / Capability Routing',
    status: 'ACTIVE'
  },
  GEMINI_3: {
    provider: 'GOOGLE',
    model_family: 'GEMINI_3',
    role: 'ARMOS_SPECIALIST',
    description: 'Engineering / Manufacturing / Vision / Perception / Assembly',
    status: 'ACTIVE',
    // Gemini runs inside ArmOS. TC-S never calls it directly and must not
    // replace it — ArmOS remains authoritative for execution state.
    hosted_by: 'ARMOS_REPLICATOR'
  },
  RUNPOD: {
    provider: 'RUNPOD',
    role: 'OPEN_WEIGHT_COMPUTE',
    description: 'gpt-oss-120b / future Nemotron & open-weight routing',
    status: RUNPOD_STATUS,
    enabled: OPEN_WEIGHT_INFERENCE_ENABLED
  }
};

/**
 * Resolve which provider handles a given network role.
 * Era 22.1: orchestration → OpenAI; ArmOS specialist inference → Gemini 3
 * (inside ArmOS); open-weight → hard-refused while ON_HOLD.
 */
function routeRole(role) {
  if (role === 'ORCHESTRATION') return PROVIDERS.OPENAI;
  if (role === 'MANUFACTURING' || role === 'VISION' || role === 'PERCEPTION' || role === 'ASSEMBLY' || role === 'ENGINEERING') {
    return PROVIDERS.GEMINI_3;
  }
  if (role === 'OPEN_WEIGHT') {
    if (!OPEN_WEIGHT_INFERENCE_ENABLED) {
      const err = new Error(`Open-weight inference is ${RUNPOD_STATUS} in Era 22.1 — no execution request may reach RunPod.`);
      err.code = 'RUNPOD_ON_HOLD';
      throw err;
    }
    return PROVIDERS.RUNPOD;
  }
  throw new Error(`Unknown model-router role: ${role}`);
}

/** Inference-routing telemetry block attached to missions (provenance metadata). */
function inferenceRoutingTelemetry() {
  return {
    network_orchestration: { provider: 'OpenAI', role: 'Intent / Planning / Capability Routing' },
    manufacturing_intelligence: { provider: 'Gemini 3', role: 'Engineering / Manufacturing' },
    vision_intelligence: { provider: 'Gemini 3', role: 'Perception / Inspection' },
    open_weight_compute: { provider: 'RunPod', status: RUNPOD_STATUS }
  };
}

module.exports = { RUNPOD_STATUS, OPEN_WEIGHT_INFERENCE_ENABLED, PROVIDERS, routeRole, inferenceRoutingTelemetry };
