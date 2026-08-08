/**
 * TC-S Network — Era 21.2
 * Deterministic Plan Validator
 *
 * validateOrchestrationPlan(plan, registry, options) → { result, findings }
 *
 * result:   'VALID' | 'INVALID' | 'REQUIRES_APPROVAL'
 * findings: array of { code, severity, detail }
 *
 * NO LLM. All validation is deterministic.
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const VALID             = 'VALID';
const INVALID           = 'INVALID';
const REQUIRES_APPROVAL = 'REQUIRES_APPROVAL';

const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

// Capabilities permanently blocked from UIM operations agent use (physical)
const PHYSICAL_BLOCKED_IDS = new Set([
  'tcs.factory.submit_print',
  'tcs.factory.queue_status',
  'tcs.factory.pickup',
  'tcs.factory.register_printer',
  'tcs.3d.generate',
  'tcs.3d.mint',
]);

const MAX_STEPS = 20;
const MAX_SOLAR_SPEND_DEFAULT = 10; // Solar — default ceiling

// ── Main validator ─────────────────────────────────────────────────────────────
/**
 * @param {object} plan       - ORCHESTRATION_PLAN_V1
 * @param {object[]} caps     - capability registry entries
 * @param {object} options
 *   @param {string}   options.callerAgentId    - invoking agent id
 *   @param {string[]} options.callerAllowedActions - agent's policy-approved action types
 *   @param {string}   options.riskCeiling      - 'low' | 'medium' | 'high' | 'critical'
 *   @param {number}   options.maxSolarSpend    - max Solar this agent may spend per plan
 * @returns {{ result: string, findings: object[], estimated_effects: object }}
 */
function validateOrchestrationPlan(plan, caps, options = {}) {
  const findings = [];
  const {
    callerAgentId    = null,
    callerAllowedActions = null,
    riskCeiling      = 'medium',
    maxSolarSpend    = MAX_SOLAR_SPEND_DEFAULT,
  } = options;

  let topResult = VALID;

  // ── 1. Structural validity ─────────────────────────────────────────────────
  if (!plan || typeof plan !== 'object') {
    findings.push({ code: 'PLAN_MISSING',   severity: 'ERROR', detail: 'Plan is null or not an object' });
    return { result: INVALID, findings, estimated_effects: {} };
  }
  if (!plan.workflow_run_id) {
    findings.push({ code: 'MISSING_WORKFLOW_RUN_ID', severity: 'ERROR', detail: 'plan.workflow_run_id is required' });
    topResult = INVALID;
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    findings.push({ code: 'NO_STEPS', severity: 'ERROR', detail: 'plan.steps must be a non-empty array' });
    return { result: INVALID, findings, estimated_effects: {} };
  }

  // ── 2. Step count limit ────────────────────────────────────────────────────
  if (plan.steps.length > MAX_STEPS) {
    findings.push({ code: 'TOO_MANY_STEPS', severity: 'ERROR',
      detail: `Plan has ${plan.steps.length} steps; maximum is ${MAX_STEPS}` });
    topResult = INVALID;
  }

  // ── 3. Per-step validation ─────────────────────────────────────────────────
  const capMap = {};
  for (const c of (caps || [])) capMap[c.id] = c;

  const seenSeqs  = new Set();
  const stepDeps  = {};   // { seq: [dep_seqs] }
  let   maxRisk   = 'low';
  let   estimatedSolarSpend = 0;
  let   requiresApproval = false;
  const expectedExecutionPath = [];
  const blocked = [];
  const missing = [];

  for (const step of plan.steps) {
    const seq  = step.sequence;
    const capId = step.capability_id;

    // Sequence must be unique integer
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
      findings.push({ code: 'INVALID_SEQUENCE', severity: 'ERROR', detail: `Step has invalid sequence: ${JSON.stringify(seq)}` });
      topResult = INVALID;
      continue;
    }
    if (seenSeqs.has(seq)) {
      findings.push({ code: 'DUPLICATE_SEQUENCE', severity: 'ERROR', detail: `Duplicate sequence number: ${seq}` });
      topResult = INVALID;
    }
    seenSeqs.add(seq);

    // capability_id required
    if (!capId) {
      findings.push({ code: 'MISSING_CAPABILITY_ID', severity: 'ERROR', detail: `Step ${seq} has no capability_id` });
      topResult = INVALID;
      continue;
    }

    // Capability must exist in registry
    const cap = capMap[capId];
    if (!cap) {
      findings.push({ code: 'UNKNOWN_CAPABILITY', severity: 'ERROR',
        detail: `Step ${seq}: capability '${capId}' does not exist in the TC-S registry. No hallucinated execution.` });
      topResult = INVALID;
      continue;
    }

    // Capability must be live
    if (cap.status !== 'live') {
      findings.push({ code: 'CAPABILITY_NOT_LIVE', severity: 'ERROR',
        detail: `Step ${seq}: capability '${capId}' has status '${cap.status}' — not live` });
      topResult = INVALID;
    }

    // Capability must be uim_exposable
    if (!cap.uim_exposable) {
      findings.push({ code: 'NOT_UIM_EXPOSABLE', severity: 'ERROR',
        detail: `Step ${seq}: capability '${capId}' is not UIM-exposable` });
      topResult = INVALID;
    }

    // Physical capabilities blocked
    if (PHYSICAL_BLOCKED_IDS.has(capId)) {
      findings.push({ code: 'PHYSICAL_EXECUTION_DISABLED', severity: 'BLOCKED',
        detail: `Step ${seq}: capability '${capId}' is a physical/factory capability. PHYSICAL_EXECUTION_REQUIRES_EXPLICIT_ERA_APPROVAL.` });
      blocked.push(capId);
      if (topResult === VALID) topResult = REQUIRES_APPROVAL; else topResult = INVALID;
    }

    // Version check (if version specified)
    const requestedVersion = step.version || '1.0';
    const capVersion = cap.version || '1.0';
    if (!_versionCompatible(requestedVersion, capVersion)) {
      findings.push({ code: 'VERSION_MISMATCH', severity: 'ERROR',
        detail: `Step ${seq}: requested version '${requestedVersion}' but capability '${capId}' is at version '${capVersion}'` });
      topResult = INVALID;
    }

    // Risk tracking
    const capRisk = cap.risk_level || 'low';
    if ((RISK_ORDER[capRisk] || 0) > (RISK_ORDER[maxRisk] || 0)) maxRisk = capRisk;

    // Approval tracking
    if (cap.approval_required) requiresApproval = true;

    // Caller authorization (if provided)
    if (callerAllowedActions && cap.action_type) {
      if (!callerAllowedActions.includes(cap.action_type)) {
        findings.push({ code: 'ACTION_NOT_AUTHORIZED', severity: 'WARNING',
          detail: `Step ${seq}: caller agent '${callerAgentId}' is not authorized for action type '${cap.action_type}'` });
        if (topResult === VALID) topResult = REQUIRES_APPROVAL;
      }
    }

    // Economic spend estimate
    if (cap.economic_cost_solar) estimatedSolarSpend += cap.economic_cost_solar;

    // Dependency tracking
    const deps = (step.parameters_from || [])
      .map(s => s.startsWith('step:') ? parseInt(s.slice(5), 10) : null)
      .filter(Boolean);
    stepDeps[seq] = deps;

    expectedExecutionPath.push({
      sequence:      seq,
      capability_id: capId,
      version:       requestedVersion,
      risk:          capRisk,
      approval:      cap.approval_required || false,
      side_effects:  cap.side_effect_class || 'READ_ONLY',
      optional:      step.optional || false,
    });
  }

  // ── 4. Circular dependency check ───────────────────────────────────────────
  if (_hasCircularDependency(stepDeps)) {
    findings.push({ code: 'CIRCULAR_DEPENDENCY', severity: 'ERROR', detail: 'Plan contains circular step dependencies' });
    topResult = INVALID;
  }

  // ── 5. Forward-only dependency check ──────────────────────────────────────
  for (const [seqStr, deps] of Object.entries(stepDeps)) {
    const seq = parseInt(seqStr, 10);
    for (const dep of deps) {
      if (dep >= seq) {
        findings.push({ code: 'FORWARD_DEPENDENCY', severity: 'ERROR',
          detail: `Step ${seq} depends on step ${dep} which is not earlier in the sequence` });
        topResult = INVALID;
      }
    }
  }

  // ── 6. Risk ceiling ────────────────────────────────────────────────────────
  if ((RISK_ORDER[maxRisk] || 0) > (RISK_ORDER[riskCeiling] || 0)) {
    findings.push({ code: 'RISK_CEILING_EXCEEDED', severity: 'ERROR',
      detail: `Plan max risk '${maxRisk}' exceeds caller ceiling '${riskCeiling}'` });
    if (topResult !== INVALID) topResult = REQUIRES_APPROVAL;
  }

  // ── 7. Economic spend constraint ───────────────────────────────────────────
  if (estimatedSolarSpend > maxSolarSpend) {
    findings.push({ code: 'SOLAR_SPEND_EXCEEDS_LIMIT', severity: 'WARNING',
      detail: `Estimated Solar spend (${estimatedSolarSpend}) exceeds max allowed (${maxSolarSpend})` });
    if (topResult === VALID) topResult = REQUIRES_APPROVAL;
  }

  // ── 8. Approval required by any step ──────────────────────────────────────
  if (requiresApproval && topResult === VALID) topResult = REQUIRES_APPROVAL;

  // ── 9. Missing inputs check ────────────────────────────────────────────────
  for (const step of plan.steps) {
    const cap = capMap[step.capability_id];
    if (!cap) continue;
    const required = cap.params_required || [];
    const provided = Object.keys(step.parameters || {});
    const hasDeps  = (step.parameters_from || []).length > 0;
    for (const req of required) {
      if (!provided.includes(req) && !hasDeps) {
        missing.push({ step: step.sequence, param: req });
        findings.push({ code: 'MISSING_REQUIRED_INPUT', severity: 'WARNING',
          detail: `Step ${step.sequence}: required param '${req}' not in parameters and no parameters_from declared` });
      }
    }
  }

  // ── 10. Physical capability constraint (plan-level) ────────────────────────
  const physicalConstraint = plan.constraints?.physical_execution === false;
  if (physicalConstraint && blocked.length > 0) {
    findings.push({ code: 'PHYSICAL_EXECUTION_CONSTRAINT_VIOLATED', severity: 'ERROR',
      detail: `Plan constraint physical_execution=false but ${blocked.length} physical capability(ies) present: ${blocked.join(', ')}` });
    topResult = INVALID;
  }

  return {
    result: topResult,
    findings,
    estimated_effects: {
      max_risk_level:         maxRisk,
      estimated_solar_spend:  estimatedSolarSpend,
      requires_approval:      requiresApproval,
      step_count:             plan.steps?.length || 0,
      blocked_capabilities:   blocked,
      missing_inputs:         missing,
      expected_execution_path: expectedExecutionPath,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Version compatibility: exact match or minor-version match.
 * '1.0' is compatible with '1.0' or '1.1' but not '2.0'.
 */
function _versionCompatible(requested, available) {
  if (requested === available) return true;
  const [rMaj] = requested.split('.').map(Number);
  const [aMaj] = available.split('.').map(Number);
  return rMaj === aMaj;
}

/**
 * Detect circular dependencies using DFS.
 * stepDeps: { seq: [dep_seqs] }
 */
function _hasCircularDependency(stepDeps) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  const seqs  = Object.keys(stepDeps).map(Number);
  for (const s of seqs) color[s] = WHITE;

  function dfs(node) {
    color[node] = GRAY;
    for (const dep of (stepDeps[node] || [])) {
      if (color[dep] === GRAY) return true;
      if (color[dep] === WHITE && dfs(dep)) return true;
    }
    color[node] = BLACK;
    return false;
  }

  for (const s of seqs) {
    if (color[s] === WHITE && dfs(s)) return true;
  }
  return false;
}

module.exports = {
  validateOrchestrationPlan,
  VALID,
  INVALID,
  REQUIRES_APPROVAL,
  PHYSICAL_BLOCKED_IDS,
};
