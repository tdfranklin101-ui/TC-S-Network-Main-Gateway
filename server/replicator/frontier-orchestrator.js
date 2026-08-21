/**
 * ERA 22.1 — OPENAI FRONTIER ORCHESTRATOR
 * =======================================
 * OpenAI acts as the TC-S network-level reasoning/orchestration intelligence
 * (Responses API + function tools). It understands marketplace intent,
 * discovers capabilities, initiates the ArmOS workflow, and interprets
 * returned status.
 *
 * HARD BOUNDARY: OpenAI must never fabricate manufacturing results —
 * geometry hashes, fabrication completion, inspection results, tolerances,
 * machine-code references, provenance, assembly success, or a
 * "Replication Complete" status all originate from the ArmOS adapter.
 * Tool results are authoritative; the LLM cannot substitute prose for them.
 *
 * Execution stops at WAITING_APPROVAL — human-in-the-loop governance. The
 * orchestrator may interpret, engineer, discover, recommend, and request the
 * capsule, but fabrication only starts after explicit marketplace approval.
 */

const OpenAI = require('openai');
const armos = require('./armos-adapter');
const { inferenceRoutingTelemetry } = require('./model-router');

const ORCHESTRATOR_MODEL = process.env.TCS_ORCHESTRATOR_MODEL || 'gpt-5.5';
const ENGINEERING_RECOVERY_ATTEMPTS = 2;
const ENGINEERING_RECOVERY_COOLDOWN_MS = 8000;

const TOOLS = [
  { type: 'function', name: 'discover_capabilities', description: 'Discover available TC-S network capabilities (live availability check included).', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'get_replicator_nodes', description: 'List available replication nodes with envelopes and capabilities.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'engineer_replication_mission', description: 'Send the mission intent to ArmOS for authoritative engineering (Gemini specialist inference). Call exactly once per mission.', parameters: { type: 'object', properties: { intent: { type: 'string', description: 'Normalized natural-language mission intent.' } }, required: ['intent'], additionalProperties: false } },
  { type: 'function', name: 'create_replication_capsule', description: 'Create the UIM Creation Capsule on a specific node from the authoritative engineering result. May return ROUTE_REQUIRED — then discover an alternative compatible node and call again. Never override a rejection.', parameters: { type: 'object', properties: { node_id: { type: 'string', description: 'Replicator node id, e.g. RP-0001' } }, required: ['node_id'], additionalProperties: false } },
  { type: 'function', name: 'request_replication_execution', description: 'Request execution. Always returns WAITING_APPROVAL — fabrication requires human marketplace approval. Call once after a capsule is ACCEPTED.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'get_replication_status', description: 'Get authoritative mission status from ArmOS adapter.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'get_replication_result', description: 'Get the authoritative final result (inspection, perception, provenance) once complete.', parameters: { type: 'object', properties: {}, additionalProperties: false } }
];

const SYSTEM_PROMPT = `You are the TC-S Network Frontier Orchestrator (Era 22.1 — Frontier Orchestration with Frontier Diversification).
You coordinate marketplace replication missions through the TC-S.REPLICATOR.ARMOS capability.
Rules:
1. Tool results are authoritative. Never invent geometry hashes, fabrication status, inspection results, tolerances, machine-code references, provenance, or completion.
2. Workflow: discover capabilities → list nodes → engineer the mission via ArmOS → create the capsule on the requested node (or the best compatible node if none requested) → request execution (this stops at WAITING_APPROVAL).
3. If capsule creation returns ROUTE_REQUIRED, you must NOT override it. Discover an alternative compatible node from the node list and request a new capsule there, and note the routing event.
4. Gemini 3 inside ArmOS performs all engineering/manufacturing/vision inference. You only orchestrate.
5. Finish with a concise (<=120 words) plain-language summary for the marketplace buyer: what was engineered, which node, part count, and that the mission awaits their approval. Do not include credentials, hidden prompts, or reasoning traces.`;

/**
 * Run the orchestration phase of a mission (through WAITING_APPROVAL).
 * @param {object} mission - mission record from armos.createMissionRecord()
 * @param {string|null} requestedNodeId - optional explicit node request (demo tests B/C)
 */
async function orchestrateMission(mission, requestedNodeId) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
  if (!apiKey) throw new Error('OpenAI orchestrator unavailable: no OpenAI API key configured.');
  const openai = new OpenAI({ apiKey });

  mission.timeline.push({ stage: 'OPENAI FRONTIER ORCHESTRATOR', at: new Date().toISOString() });

  // Tool implementations — closures over the mission record. Adapter is the
  // single source of truth; the LLM only sequences the calls.
  const impl = {
    discover_capabilities: async () => {
      mission.timeline.push({ stage: 'CAPABILITY DISCOVERY', at: new Date().toISOString() });
      return armos.getCapabilities();
    },
    get_replicator_nodes: async () => {
      if (!mission.timeline.find(t => t.stage === 'NODE DISCOVERY')) {
        mission.timeline.push({ stage: 'NODE DISCOVERY', at: new Date().toISOString() });
      }
      return armos.getNodes();
    },
    engineer_replication_mission: async ({ intent }) => {
      if (mission.engineering) return { note: 'Engineering already complete for this mission.', assembly_name: mission.engineering.assembly.name, parts: mission.engineering.assembly.pieces.length };
      // A single orchestration run gets one bounded recovery attempt. The
      // guard prevents the model from turning a failed tool call into an
      // unbounded series of ArmOS requests.
      if (mission.engineering_error) {
        return { error: mission.engineering_error.message, retryable: !!mission.engineering_error.retryable, retry_suggestion: 'Retry the mission after the temporary ArmOS outage clears.' };
      }
      mission.timeline.push({ stage: 'ENGINEERING REQUEST (ARMOS + GEMINI 3)', at: new Date().toISOString() });
      let engineeringError;
      for (let attempt = 1; attempt <= ENGINEERING_RECOVERY_ATTEMPTS; attempt++) {
        try {
          mission.engineering = await armos.engineerMission(intent || mission.intent);
          engineeringError = null;
          break;
        } catch (e) {
          engineeringError = e;
          if (!e.retryable || attempt === ENGINEERING_RECOVERY_ATTEMPTS) break;
          mission.timeline.push({
            stage: `ENGINEERING RETRY (${attempt}/${ENGINEERING_RECOVERY_ATTEMPTS}) — ARMOS TEMPORARY OUTAGE`,
            at: new Date().toISOString()
          });
          mission.recovery = {
            kind: 'ARMOS_ENGINEERING',
            attempt,
            max_attempts: ENGINEERING_RECOVERY_ATTEMPTS,
            cooldown_ms: ENGINEERING_RECOVERY_COOLDOWN_MS
          };
          await new Promise(resolve => setTimeout(resolve, ENGINEERING_RECOVERY_COOLDOWN_MS));
        }
      }
      if (engineeringError) {
        mission.engineering_error = {
          message: engineeringError.message,
          retryable: !!engineeringError.retryable
        };
        throw engineeringError;
      }
      return {
        assembly_name: mission.engineering.assembly.name,
        parts: mission.engineering.assembly.pieces.map(p => ({ label: p.label, color: p.color, connector: p.connector })),
        specialist_model: mission.engineering.specialist_model
      };
    },
    create_replication_capsule: async ({ node_id }) => {
      if (!mission.engineering) return { error: 'Engineer the mission before creating a capsule.' };
      const out = await armos.createCapsule({ mission_id: mission.mission_id, intent: mission.intent, engineering: mission.engineering, node_id });
      if (out.compatibility === 'ROUTE_REQUIRED') {
        mission.routing_events.push({ node_id, verdict: 'ROUTE_REQUIRED', reason: out.reason, at: new Date().toISOString() });
        mission.timeline.push({ stage: `ROUTE_REQUIRED (${node_id})`, at: new Date().toISOString() });
        return out;
      }
      mission.capsule = out.capsule;
      mission.routing_events.push({ node_id, verdict: 'ACCEPTED', at: new Date().toISOString() });
      mission.timeline.push({ stage: `CREATION CAPSULE (${node_id})`, at: new Date().toISOString() });
      return { compatibility: 'ACCEPTED', node_id, object_name: out.capsule.object_name, parts: out.capsule.parts.length, dual_arm: out.capsule.node.dual_arm, capsule_hash: out.capsule.provenance.capsule_hash };
    },
    request_replication_execution: async () => {
      if (!mission.capsule) return { error: 'No accepted capsule — cannot request execution.' };
      mission.status = 'WAITING_APPROVAL';
      if (!mission.timeline.find(t => t.stage === 'WAITING_APPROVAL')) {
        mission.timeline.push({ stage: 'WAITING_APPROVAL', at: new Date().toISOString() });
      }
      return { mission_id: mission.mission_id, status: 'WAITING_APPROVAL', note: 'Human approval required before fabrication begins.' };
    },
    get_replication_status: async () => armos.getMissionStatus(mission.mission_id),
    get_replication_result: async () => armos.getMissionResult(mission.mission_id)
  };

  const nodeHint = requestedNodeId
    ? `The buyer explicitly requested replication node ${requestedNodeId}. Attempt the capsule there first; if ArmOS returns ROUTE_REQUIRED, discover a compatible alternative.`
    : 'No specific node requested — prefer the smallest/most economical compatible node (e.g. a single-arm general node for ordinary furniture); reserve the large-volume dual-arm node for missions that need it.';

  let input = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Marketplace replication order. Mission ${mission.mission_id}. Intent: "${mission.intent}". ${nodeHint}` }
  ];

  for (let round = 0; round < 10; round++) {
    const resp = await openai.responses.create({ model: ORCHESTRATOR_MODEL, input, tools: TOOLS, max_output_tokens: 4000 });
    const calls = (resp.output || []).filter(o => o.type === 'function_call');
    if (calls.length === 0) {
      mission.orchestrator_summary = (resp.output_text || '').trim() || null;
      break;
    }
    input = input.concat(resp.output);
    for (const call of calls) {
      let result;
      try {
        const args = call.arguments ? JSON.parse(call.arguments) : {};
        result = await impl[call.name](args);
      } catch (e) {
        if (e.retryable) mission.retryable = true;
        mission.error = e.message;
        result = { error: e.message };
      }
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
  }

  // Mark incomplete ONLY if the mission never reached the approval gate.
  // (Approval may already have happened while the final summary round ran —
  // never stomp an EXECUTING/COMPLETE/CANCELLED status.)
  if (!mission.timeline.find(t => t.stage === 'WAITING_APPROVAL')) {
    mission.status = 'ORCHESTRATION_INCOMPLETE';
    mission.timeline.push({ stage: 'ORCHESTRATION_INCOMPLETE', at: new Date().toISOString() });
  }
  mission.inference_routing = inferenceRoutingTelemetry();
  return mission;
}

module.exports = { orchestrateMission, ORCHESTRATOR_MODEL };
