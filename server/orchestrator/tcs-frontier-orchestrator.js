/**
 * TC-S Network — Era 21.3
 * TCS Frontier Orchestrator Shell
 *
 * This is the DETERMINISTIC SHELL that wraps the frontier model.
 * The model supplies intelligence. This shell enforces ALL TC-S boundaries.
 *
 * Flow:
 *   DISCOVER → LEARN → PLAN → VALIDATE → EXECUTE → OBSERVE → VERIFY
 *
 * HARD INVARIANTS (enforced here, not by the model):
 *   - Every plan is validated before any capability is invoked
 *   - Invalid plans are never executed (zero mutations on INVALID)
 *   - Plans with REQUIRES_APPROVAL halt and return to caller
 *   - Model output is parsed strictly; failures trigger repair loop (max 3)
 *   - All capability invocations go through /api/uim/invoke only
 *   - Physical capabilities are blocked at the plan validator level
 *   - Limits: max 5 revisions, 20 steps, 10 frontier calls, configurable wall time
 *   - TC-S continues operating normally if this orchestrator is offline
 *
 * NO TC-S INTERNAL IMPORTS:
 *   No economic-handlers, no policy engine, no ledger, no DB queries.
 *   All operations go through UIM HTTP APIs.
 */

'use strict';

const http   = require('http');
const https  = require('https');
const crypto = require('crypto');

const { SYSTEM_INSTRUCTION, sanitizeUntrustedContent, extractKnowledgeTopics } = require('./system-instruction');
const { createInferenceReceipt, storeInferenceReceipt } = require('./inference-receipt');

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator limits (spec §TASK 21)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_LIMITS = {
  maxPlanRevisions:     5,
  maxPlanSteps:         20,
  maxPlanParseRepairs:  3,
  maxFrontierCalls:     10,
  maxWallTimeMs:        300_000,   // 5 minutes
  maxEstimatedSpendUsd: 5.0,
  pollIntervalMs:       1000,
  pollMaxAttempts:      30,
};

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR CLASS
// ─────────────────────────────────────────────────────────────────────────────

class TCSFrontierOrchestrator {
  /**
   * @param {object} options
   * @param {object}  options.frontierClient   — FrontierClient instance (RunPod or Mock)
   * @param {string}  [options.agentKey]       — OAFR_AGENT_KEY for UIM calls
   * @param {string}  [options.baseUrl]        — TC-S server base URL (default: localhost:PORT)
   * @param {object}  [options.pool]           — pg Pool (for storing receipts/provenance)
   * @param {object}  [options.limits]         — override DEFAULT_LIMITS
   */
  constructor(options = {}) {
    this.frontierClient = options.frontierClient;
    if (!this.frontierClient) throw new Error('TCSFrontierOrchestrator: frontierClient is required');

    this.agentId  = 'TCS-OAFR-001';
    this.agentKey = options.agentKey || process.env.OAFR_AGENT_KEY || 'dev-oafr-001-key-do-not-use-in-production';
    const port    = process.env.PORT || 5000;
    this.baseUrl  = options.baseUrl  || `http://127.0.0.1:${port}`;
    this.pool     = options.pool     || null;
    this.limits   = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  }

  // ─── Public: Health ────────────────────────────────────────────────────────
  async health() {
    const modelHealth = await this.frontierClient.health();
    // Check TC-S UIM is also reachable (TC-S must work regardless of RunPod)
    let tcsHealth = { status: 'unknown' };
    try {
      tcsHealth = await this._uimGet('/api/uim/system', { auth: false });
    } catch (e) {
      tcsHealth = { status: 'error', error: e.message };
    }
    return {
      orchestrator: 'TCS-OAFR-001',
      frontier:  modelHealth,
      tcs_uim:   tcsHealth,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Public: Run ──────────────────────────────────────────────────────────
  /**
   * Full DISCOVER → LEARN → PLAN → VALIDATE → EXECUTE → OBSERVE → VERIFY loop.
   *
   * @param {string} intent              — human intent text (untrusted; sanitized before use)
   * @param {object} [options]
   *   @param {string} [options.task_id]
   *   @param {string} [options.principal_id]
   *   @param {string} [options.network_id]
   *   @param {string} [options.requested_outcome]  — e.g. 'ARTIFACT_LISTED'
   *   @param {object} [options.limits]
   * @returns {object} orchestration result
   */
  async run(intent, options = {}) {
    const taskId     = options.task_id || crypto.randomUUID();
    const startedAt  = new Date().toISOString();
    const wallStart  = Date.now();
    const limits     = { ...this.limits, ...(options.limits || {}) };

    let frontierCallCount  = 0;
    let estimatedSpendUsd  = 0;
    const inferenceReceipts = [];

    const result = {
      task_id:             taskId,
      intent,
      status:              'RUNNING',
      plan:                null,
      plan_revisions:      0,
      validation:          null,
      steps_executed:      [],
      outcome_verification:null,
      inference_receipts:  [],
      workflow_run_id:     null,
      provenance:          null,
      error:               null,
      started_at:          startedAt,
      finished_at:         null,
      frontier_calls:      0,
    };

    // ── Limit enforcer ──────────────────────────────────────────────────────
    const checkLimits = () => {
      if (frontierCallCount >= limits.maxFrontierCalls)
        throw _limitError('max_frontier_calls', `Exceeded max frontier calls (${limits.maxFrontierCalls})`);
      if (Date.now() - wallStart > limits.maxWallTimeMs)
        throw _limitError('wall_time', `Exceeded max wall time (${limits.maxWallTimeMs}ms)`);
      if (estimatedSpendUsd > limits.maxEstimatedSpendUsd)
        throw _limitError('estimated_spend', `Exceeded max estimated spend ($${limits.maxEstimatedSpendUsd})`);
    };

    // ── Frontier call wrapper (records inference receipt) ───────────────────
    const frontierCall = async (callType, fn) => {
      checkLimits();
      frontierCallCount++;
      const t0 = Date.now();
      const res = await fn();
      const receipt = createInferenceReceipt({
        task_id:       taskId,
        workflow_run_id: result.workflow_run_id,
        provider:      (await this.frontierClient.modelInfo().catch(() => ({}))).provider || 'unknown',
        runtime:       'vllm',
        model:         (await this.frontierClient.modelInfo().catch(() => ({}))).model    || 'unknown',
        input_tokens:  res.input_tokens  || 0,
        output_tokens: res.output_tokens || 0,
        latency_ms:    res.latency_ms    || (Date.now() - t0),
        raw_output:    res.raw_output    || '',
        call_type:     callType,
        started_at:    new Date(t0).toISOString(),
        finished_at:   new Date().toISOString(),
      });
      if (receipt.estimated_cost_usd) estimatedSpendUsd += receipt.estimated_cost_usd;
      await storeInferenceReceipt(this.pool, receipt);
      inferenceReceipts.push(receipt);
      result.inference_receipts = inferenceReceipts;
      return { ...res, receipt };
    };

    try {
      // ── 1. Check orchestrator health ──────────────────────────────────────
      const healthCheck = await this.frontierClient.health();
      if (healthCheck.status === 'ORCHESTRATOR_UNAVAILABLE') {
        result.status  = 'ORCHESTRATOR_UNAVAILABLE';
        result.error   = healthCheck.error || 'Frontier model unavailable';
        result.frontier_health = healthCheck;
        result.finished_at = new Date().toISOString();
        result.frontier_calls = frontierCallCount;
        return result;
      }

      // ── 2. DISCOVER: GET /api/uim/system ──────────────────────────────────
      const systemManifest = await this._uimGet('/api/uim/system', { auth: false });

      // ── 3. DISCOVER: GET /api/uim/capabilities ────────────────────────────
      const capsData = await this._uimGet('/api/uim/capabilities', { auth: false });
      const availableCaps = capsData.capabilities || [];

      // ── 4. LEARN: Retrieve relevant Network Knowledge ─────────────────────
      const knowledgeTopics = extractKnowledgeTopics(intent);
      const knowledgeRecords = [];
      for (const ktype of knowledgeTopics.slice(0, 3)) { // limit to 3 topic queries
        try {
          const kData = await this._uimGet(`/api/uim/network-knowledge?knowledge_type=${encodeURIComponent(ktype)}`, { auth: false });
          if (kData.records) knowledgeRecords.push(...kData.records.slice(0, 5));
        } catch { /* non-fatal */ }
      }

      // ── 5. Build ORCHESTRATION_TASK_V1 ────────────────────────────────────
      // Sanitize intent BEFORE including in model context
      const sanitizedIntent = sanitizeUntrustedContent(intent, 'human_intent');
      const task = {
        schema_version:   'ORCHESTRATION_TASK_V1',
        task_id:          taskId,
        agent_id:         this.agentId,
        era:              '21.3',
        intent:           sanitizedIntent,
        raw_intent:       intent, // kept for outcome verification
        principal_id:     options.principal_id || null,
        network_id:       options.network_id   || 'default',
        requested_outcome:options.requested_outcome || null,
        system_manifest:  systemManifest,
        created_at:       startedAt,
      };

      // ── 6-8. PLAN: Generate + parse (with repair) ─────────────────────────
      let planRaw = await frontierCall('generate_plan', () =>
        this.frontierClient.generateStructuredPlan(task, availableCaps, knowledgeRecords, SYSTEM_INSTRUCTION)
      );

      let plan = _parseWithRepair(planRaw.plan_json, limits.maxPlanParseRepairs);
      if (!plan) {
        result.status    = 'FAILED';
        result.error     = 'Plan parse failed after max repair attempts — model did not return valid JSON';
        result.finished_at = new Date().toISOString();
        result.frontier_calls = frontierCallCount;
        return result;
      }

      // Inject task_id, agent_id, and workflow_run_id (model may omit them)
      plan = _normalizePlan(plan, taskId, this.agentId);
      result.plan = plan; // set before validation so it's available even if validate throws

      // ── 9-11. VALIDATE + REVISE LOOP ──────────────────────────────────────
      let validationResult = null;
      let revisions = 0;

      while (true) { // eslint-disable-line no-constant-condition
        // plan/validate returns 200 (VALID/REQUIRES_APPROVAL) or 422 (INVALID).
        // Treat 422 as a valid response (INVALID), not a fatal error.
        validationResult = await this._uimPost('/api/uim/plan/validate', { plan }, { auth: true })
          .catch(err => err.statusCode === 422 ? (err.body || { result: 'INVALID', error: err.message }) : Promise.reject(err));
        const pvResult   = validationResult?.plan_validation?.result || validationResult?.result;

        if (pvResult === 'VALID') break;

        if (pvResult === 'REQUIRES_APPROVAL') {
          result.status     = 'WAITING_APPROVAL';
          result.plan       = plan;
          result.validation = validationResult;
          result.finished_at = new Date().toISOString();
          result.frontier_calls = frontierCallCount;
          return result;
        }

        // INVALID path
        if (revisions >= limits.maxPlanRevisions) {
          result.status     = 'FAILED';
          result.error      = `Plan remained INVALID after ${revisions} revisions`;
          result.plan       = plan;
          result.validation = validationResult;
          result.finished_at = new Date().toISOString();
          result.frontier_calls = frontierCallCount;
          return result;
        }

        const findings = validationResult?.plan_validation?.findings || validationResult?.findings || [];
        revisions++;

        const revised = await frontierCall('revise_plan', () =>
          this.frontierClient.reviseStructuredPlan(task, availableCaps, knowledgeRecords, plan, findings, SYSTEM_INSTRUCTION)
        );

        const parsedRevision = _parseWithRepair(revised.plan_json, limits.maxPlanParseRepairs);
        if (!parsedRevision) {
          result.status  = 'FAILED';
          result.error   = `Revised plan parse failed on revision ${revisions}`;
          result.plan    = plan;
          result.validation = validationResult;
          result.finished_at = new Date().toISOString();
          result.frontier_calls = frontierCallCount;
          return result;
        }
        plan = _normalizePlan(parsedRevision, taskId, this.agentId);
      }

      result.plan          = plan;
      result.plan_revisions = revisions;
      result.validation    = validationResult;

      // ── 12. Check step count ──────────────────────────────────────────────
      const steps = plan.steps || [];
      if (steps.length > limits.maxPlanSteps) {
        result.status = 'FAILED';
        result.error  = `Plan has ${steps.length} steps, exceeds limit of ${limits.maxPlanSteps}`;
        result.finished_at = new Date().toISOString();
        result.frontier_calls = frontierCallCount;
        return result;
      }

      // ── 13. EXECUTE: invoke each step via UIM (in dependency order) ───────
      const stepResults = {};
      const executedSteps = [];

      const orderedSteps = _topologicalOrder(steps);

      for (const step of orderedSteps) {
        const stepStart = new Date().toISOString();
        let invokeResult;

        try {
          invokeResult = await this._uimPost('/api/uim/invoke', {
            capability_id: step.capability_id,
            input:         step.input || {},
            request_id:    crypto.randomUUID(),
            task_id:       taskId,
            step_id:       step.step_id,
            agent_id:      this.agentId,
          }, { auth: true });

          // ── 14. Poll async requests ────────────────────────────────────────
          if (invokeResult.request_id || invokeResult.action_request_id) {
            const reqId = invokeResult.request_id || invokeResult.action_request_id;
            invokeResult = await this._pollStatus(reqId, limits);
          }

          const stepRecord = {
            step_id:       step.step_id,
            capability_id: step.capability_id,
            status:        invokeResult.status || 'UNKNOWN',
            request_id:    invokeResult.request_id || null,
            result:        invokeResult.result || invokeResult,
            started_at:    stepStart,
            finished_at:   new Date().toISOString(),
          };

          stepResults[step.step_id] = stepRecord;
          executedSteps.push(stepRecord);

          // ── 16. Step failure: allow model to revise remaining plan ─────────
          if (['FAILED', 'REJECTED', 'CANCELLED'].includes(invokeResult.status)) {
            // Record and continue (orchestrator collects all step outcomes)
            // For now: fail fast on step failure (future: partial plan revision)
            result.steps_executed = executedSteps;
            result.status  = 'FAILED';
            result.error   = `Step ${step.step_id} (${step.capability_id}) failed: ${invokeResult.error || invokeResult.status}`;
            result.workflow_run_id = invokeResult.workflow_run_id || null;
            break;
          }

          // Track workflow_run_id if returned
          if (invokeResult.workflow_run_id && !result.workflow_run_id) {
            result.workflow_run_id = invokeResult.workflow_run_id;
          }

        } catch (invokeErr) {
          const stepRecord = {
            step_id:       step.step_id,
            capability_id: step.capability_id,
            status:        'FAILED',
            error:         invokeErr.message,
            started_at:    stepStart,
            finished_at:   new Date().toISOString(),
          };
          stepResults[step.step_id] = stepRecord;
          executedSteps.push(stepRecord);
          result.steps_executed = executedSteps;
          result.status = 'FAILED';
          result.error  = `Step ${step.step_id} threw: ${invokeErr.message}`;
          break;
        }
      }

      result.steps_executed = executedSteps;

      if (result.status === 'FAILED') {
        result.finished_at    = new Date().toISOString();
        result.frontier_calls = frontierCallCount;
        return result;
      }

      // ── 15. VERIFY outcome deterministically ──────────────────────────────
      const outcomeVerification = _verifyOutcome(
        options.requested_outcome,
        executedSteps,
        result.workflow_run_id
      );
      result.outcome_verification = outcomeVerification;

      // ── 17. Retrieve workflow/provenance records ──────────────────────────
      if (result.workflow_run_id) {
        try {
          const wfData = await this._uimGet(`/api/uim/workflow-runs/${result.workflow_run_id}`, { auth: true });
          result.provenance = wfData;
        } catch { /* non-fatal */ }
      }

      // ── 18. Summarize ─────────────────────────────────────────────────────
      try {
        const summaryRaw = await frontierCall('summarize', () =>
          this.frontierClient.summarizeOutcome(task, executedSteps)
        );
        result.summary = summaryRaw;
      } catch { /* non-fatal — summary failure doesn't fail the task */ }

      result.status = outcomeVerification?.verified ? 'SUCCEEDED' : 'COMPLETED_UNVERIFIED';

    } catch (err) {
      if (err.code === 'LIMIT_EXCEEDED') {
        result.status = 'LIMIT_EXCEEDED';
        result.error  = err.reason;
      } else if (err.code === 'ORCHESTRATOR_UNAVAILABLE') {
        result.status = 'ORCHESTRATOR_UNAVAILABLE';
        result.error  = err.message;
      } else {
        result.status = 'FAILED';
        result.error  = err.message;
      }
    }

    result.finished_at    = new Date().toISOString();
    result.frontier_calls = frontierCallCount;
    return result;
  }

  // ─── UIM HTTP helpers ──────────────────────────────────────────────────────

  async _uimGet(path, { auth = true } = {}) {
    return this._httpRequest('GET', path, null, { auth });
  }

  async _uimPost(path, body, { auth = true } = {}) {
    return this._httpRequest('POST', path, body, { auth });
  }

  async _httpRequest(method, path, body, { auth = true } = {}) {
    const fullUrl = new URL(path, this.baseUrl);
    const isHttps = fullUrl.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    // Attach agent credential — NEVER passed to the model
    if (auth) {
      headers['X-Agent-Id']      = this.agentId;
      headers['X-Agent-API-Key'] = this.agentKey;
    }

    return new Promise((resolve, reject) => {
      const opts = {
        hostname: fullUrl.hostname,
        port:     fullUrl.port || (isHttps ? 443 : 80),
        path:     fullUrl.pathname + fullUrl.search,
        method,
        headers,
        timeout:  30000,
      };

      const req = lib.request(opts, res => {
        let raw = '';
        res.on('data', c => { raw += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 400) {
              const err = Object.assign(new Error(`UIM ${method} ${path} → HTTP ${res.statusCode}`), { statusCode: res.statusCode, body: parsed });
              reject(err);
            } else {
              resolve(parsed);
            }
          } catch {
            if (res.statusCode >= 400) {
              reject(new Error(`UIM ${method} ${path} → HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
            } else {
              resolve(raw);
            }
          }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error(`UIM ${method} ${path} timed out`)); });
      req.on('error',   reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  async _pollStatus(requestId, limits) {
    for (let attempt = 0; attempt < limits.pollMaxAttempts; attempt++) {
      const status = await this._uimGet(`/api/uim/requests/${requestId}/status`, { auth: true });
      if (!['PENDING', 'RUNNING', 'QUEUED', 'CREATED'].includes(status.status)) {
        return status;
      }
      await _sleep(limits.pollIntervalMs);
    }
    return { status: 'TIMEOUT', error: `Request ${requestId} did not complete within polling window` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome verification — DETERMINISTIC, no model involved
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a requested outcome based purely on execution records.
 * The model may never claim success — TC-S records determine truth.
 */
function _verifyOutcome(requestedOutcome, executedSteps, workflowRunId) {
  if (!requestedOutcome) {
    const allSucceeded = executedSteps.every(s => s.status === 'SUCCEEDED');
    return {
      requested_outcome: null,
      verified:  allSucceeded && executedSteps.length > 0,
      method:    'ALL_STEPS_SUCCEEDED',
      checks:    [{ code: 'ALL_STEPS_SUCCEEDED', pass: allSucceeded }],
      workflow_run_id: workflowRunId || null,
    };
  }

  const checks = [];

  switch (requestedOutcome) {
    case 'ARTIFACT_LISTED': {
      const assetCreate = executedSteps.find(s => s.capability_id?.includes('asset_create') || s.capability_id?.includes('ASSET.CREATE'));
      const assetList   = executedSteps.find(s => s.capability_id?.includes('asset_list')   || s.capability_id?.includes('ASSET.LIST'));
      checks.push({ code: 'ARTIFACT_STEP_EXECUTED',  pass: !!(assetCreate), detail: assetCreate?.request_id || null });
      checks.push({ code: 'LISTING_STEP_EXECUTED',   pass: !!(assetList),   detail: assetList?.request_id   || null });
      checks.push({ code: 'ALL_STEPS_SUCCEEDED',     pass: executedSteps.every(s => s.status === 'SUCCEEDED') });
      checks.push({ code: 'WORKFLOW_RUN_EXISTS',      pass: !!(workflowRunId) });
      break;
    }

    case 'ARTIFACT_PURCHASED': {
      const purchase = executedSteps.find(s => s.capability_id?.includes('purchase') || s.capability_id?.includes('PURCHASE'));
      checks.push({ code: 'PURCHASE_STEP_EXECUTED',  pass: !!(purchase) });
      checks.push({ code: 'ALL_STEPS_SUCCEEDED',     pass: executedSteps.every(s => s.status === 'SUCCEEDED') });
      break;
    }

    case 'MEMBER_CREATED': {
      const create = executedSteps.find(s => s.capability_id?.includes('member.create') || s.capability_id?.includes('CREATE_MEMBER'));
      checks.push({ code: 'MEMBER_STEP_EXECUTED',    pass: !!(create) });
      checks.push({ code: 'ALL_STEPS_SUCCEEDED',     pass: executedSteps.every(s => s.status === 'SUCCEEDED') });
      break;
    }

    default: {
      // Generic: all steps succeeded
      const allSucceeded = executedSteps.every(s => s.status === 'SUCCEEDED');
      checks.push({ code: 'ALL_STEPS_SUCCEEDED', pass: allSucceeded });
      checks.push({ code: 'OUTCOME_TYPE_UNKNOWN', pass: true, detail: `No specific checks for ${requestedOutcome}` });
    }
  }

  const verified = checks.filter(c => c.code !== 'OUTCOME_TYPE_UNKNOWN').every(c => c.pass);
  return {
    requested_outcome: requestedOutcome,
    verified,
    method:          'DETERMINISTIC_STEP_RECORD_CHECK',
    checks,
    workflow_run_id: workflowRunId || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function _parseWithRepair(jsonText, maxAttempts) {
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const text = (typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText)).trim();

    // Try direct parse
    try { return JSON.parse(text); } catch { /* fall through to repair */ }

    // Repair attempt 1: extract JSON object from prose
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* continue */ }
    }

    // Repair attempt 2: strip markdown code fences
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    try { return JSON.parse(stripped); } catch { /* continue */ }

    if (attempt >= maxAttempts) return null;
  }
  return null;
}

function _normalizePlan(plan, taskId, agentId) {
  const planId = plan.plan_id || crypto.randomUUID();
  return {
    ...plan,
    schema_version:  plan.schema_version  || 'ORCHESTRATION_PLAN_V1',
    task_id:         plan.task_id         || taskId,
    plan_id:         planId,
    workflow_run_id: plan.workflow_run_id  || planId, // validator requires this
    agent_id:        plan.agent_id        || agentId,
    era:             plan.era             || '21.3',
    // Safety net: inject sequence (1-indexed) if the model omitted it.
    // The plan validator requires sequence: integer ≥ 1 on every step.
    steps: (Array.isArray(plan.steps) ? plan.steps : []).map((s, i) => ({
      ...s,
      sequence: (typeof s.sequence === 'number' && Number.isInteger(s.sequence) && s.sequence >= 1)
                ? s.sequence : i + 1,
    })),
  };
}

function _topologicalOrder(steps) {
  // Simple topological sort by depends_on
  const stepMap  = new Map(steps.map(s => [s.step_id, s]));
  const visited  = new Set();
  const ordered  = [];

  const visit = (stepId, visiting = new Set()) => {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) return; // skip cycles (validator already caught them)
    visiting.add(stepId);
    const step = stepMap.get(stepId);
    if (!step) return;
    for (const dep of (step.depends_on || [])) visit(dep, visiting);
    visiting.delete(stepId);
    visited.add(stepId);
    ordered.push(step);
  };

  for (const step of steps) visit(step.step_id);
  return ordered;
}

function _limitError(reason, message) {
  return Object.assign(new Error(message), { code: 'LIMIT_EXCEEDED', reason });
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  TCSFrontierOrchestrator,
  _verifyOutcome,     // exported for tests
  _parseWithRepair,   // exported for tests
  _normalizePlan,     // exported for tests
};
