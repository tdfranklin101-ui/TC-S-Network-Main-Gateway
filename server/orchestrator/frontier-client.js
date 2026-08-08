/**
 * TC-S Network — Era 21.3
 * Frontier Client Interface + Implementations
 *
 * FrontierClient (abstract interface)
 *   ↳ RunPodFrontierClient  — calls a vLLM-compatible RunPod endpoint
 *   ↳ MockFrontierClient    — deterministic, no network, used in tests
 *
 * DESIGN CONSTRAINTS:
 *   - No TC-S internal imports (no economic-handlers, no policy, no DB)
 *   - Configuration comes from environment variables only
 *   - Credentials are never passed to the model
 *   - The client generates plan JSON; the orchestrator shell enforces all boundaries
 */

'use strict';

const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

// ─────────────────────────────────────────────────────────────────────────────
// Abstract interface
// ─────────────────────────────────────────────────────────────────────────────

class FrontierClient {
  /**
   * Check if the remote model endpoint is healthy.
   * @returns {{ status: string, model: string, latency_ms: number, error?: string }}
   */
  async health()  { throw new Error('FrontierClient.health() not implemented'); }

  /**
   * Return model identity information.
   * @returns {{ model: string, version?: string, provider: string, runtime?: string }}
   */
  async modelInfo() { throw new Error('FrontierClient.modelInfo() not implemented'); }

  /**
   * Ask the model to generate a structured ORCHESTRATION_PLAN_V1 JSON.
   *
   * @param {object} task               — ORCHESTRATION_TASK_V1 envelope
   * @param {object[]} availableCaps    — capabilities from GET /api/uim/capabilities
   * @param {object[]} networkKnowledge — records from GET /api/uim/network-knowledge
   * @param {string}  systemInstruction — system prompt text
   * @returns {{ plan_json: string, raw_output: string, input_tokens: number, output_tokens: number, latency_ms: number }}
   */
  async generateStructuredPlan(_task, _caps, _knowledge, _sysInstruction) {
    throw new Error('FrontierClient.generateStructuredPlan() not implemented');
  }

  /**
   * Ask the model to revise a plan that failed validation.
   *
   * @param {object}   task
   * @param {object[]} availableCaps
   * @param {object[]} networkKnowledge
   * @param {object}   previousPlan      — the ORCHESTRATION_PLAN_V1 that was rejected
   * @param {object[]} validatorFindings — validator findings array
   * @param {string}   systemInstruction
   * @returns {{ plan_json: string, raw_output: string, input_tokens: number, output_tokens: number, latency_ms: number }}
   */
  async reviseStructuredPlan(_task, _caps, _knowledge, _prevPlan, _findings, _sysInstruction) {
    throw new Error('FrontierClient.reviseStructuredPlan() not implemented');
  }

  /**
   * Ask the model to summarize the outcome of a completed orchestration.
   *
   * @param {object}   task
   * @param {object[]} executionResults  — array of step results
   * @returns {{ summary: string, outcome_assessment: string, latency_ms: number }}
   */
  async summarizeOutcome(_task, _results) {
    throw new Error('FrontierClient.summarizeOutcome() not implemented');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RunPod implementation (OpenAI-compatible /chat/completions)
// ─────────────────────────────────────────────────────────────────────────────

class RunPodFrontierClient extends FrontierClient {
  /**
   * @param {object} [config]
   * @param {string} [config.apiKey]      — RUNPOD_API_KEY  (never passed to model)
   * @param {string} [config.endpointId]  — RUNPOD_ORCHESTRATOR_ENDPOINT_ID
   * @param {string} [config.baseUrl]     — RUNPOD_ORCHESTRATOR_BASE_URL
   * @param {string} [config.model]       — RUNPOD_ORCHESTRATOR_MODEL
   * @param {number} [config.timeoutMs]   — request timeout in ms (default 60000)
   */
  constructor(config = {}) {
    super();
    this.apiKey     = config.apiKey     || process.env.RUNPOD_API_KEY                    || null;
    this.endpointId = config.endpointId || process.env.RUNPOD_ORCHESTRATOR_ENDPOINT_ID   || null;
    this.baseUrl    = config.baseUrl    || process.env.RUNPOD_ORCHESTRATOR_BASE_URL       || null;
    this.model      = config.model      || process.env.RUNPOD_ORCHESTRATOR_MODEL          || 'gpt-oss-120b';
    this.timeoutMs  = config.timeoutMs  || 60000;

    // Build the completions URL
    if (this.baseUrl) {
      this._completionsUrl = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
      this._modelsUrl      = `${this.baseUrl.replace(/\/$/, '')}/models`;
    } else if (this.endpointId) {
      this._completionsUrl = `https://api.runpod.ai/v2/${this.endpointId}/openai/chat/completions`;
      this._modelsUrl      = `https://api.runpod.ai/v2/${this.endpointId}/openai/models`;
    } else {
      this._completionsUrl = null;
      this._modelsUrl      = null;
    }
  }

  get isConfigured() {
    return !!(this._completionsUrl && this.apiKey);
  }

  async health() {
    if (!this.isConfigured) {
      return { status: 'ORCHESTRATOR_UNAVAILABLE', model: this.model, latency_ms: 0, error: 'RunPod endpoint not configured (missing RUNPOD_API_KEY or endpoint URL)' };
    }
    const start = Date.now();
    try {
      // Try the /models endpoint as a lightweight health check
      const url = this._modelsUrl || this._completionsUrl;
      await this._request('GET', url, null, 10000);
      return { status: 'healthy', model: this.model, endpoint_id: this.endpointId, latency_ms: Date.now() - start };
    } catch (err) {
      return { status: 'ORCHESTRATOR_UNAVAILABLE', model: this.model, latency_ms: Date.now() - start, error: err.message };
    }
  }

  async modelInfo() {
    if (!this.isConfigured) {
      return { model: this.model, provider: 'runpod', runtime: 'vllm', status: 'not_configured' };
    }
    try {
      const data = await this._request('GET', this._modelsUrl, null, 10000);
      return {
        model:    this.model,
        provider: 'runpod',
        runtime:  'vllm',
        endpoint_id: this.endpointId,
        raw:      data,
      };
    } catch (err) {
      return { model: this.model, provider: 'runpod', runtime: 'vllm', error: err.message };
    }
  }

  async generateStructuredPlan(task, availableCaps, networkKnowledge, systemInstruction) {
    if (!this.isConfigured) {
      throw Object.assign(new Error('RunPod endpoint not configured'), { code: 'ORCHESTRATOR_UNAVAILABLE' });
    }
    const userMessage = _buildPlanningUserMessage(task, availableCaps, networkKnowledge);
    return this._chatComplete(systemInstruction, userMessage);
  }

  async reviseStructuredPlan(task, availableCaps, networkKnowledge, previousPlan, validatorFindings, systemInstruction) {
    if (!this.isConfigured) {
      throw Object.assign(new Error('RunPod endpoint not configured'), { code: 'ORCHESTRATOR_UNAVAILABLE' });
    }
    const userMessage = _buildRevisionUserMessage(task, availableCaps, networkKnowledge, previousPlan, validatorFindings);
    return this._chatComplete(systemInstruction, userMessage);
  }

  async summarizeOutcome(task, executionResults) {
    if (!this.isConfigured) {
      return { summary: 'RunPod unavailable — no summary generated', outcome_assessment: 'UNKNOWN', latency_ms: 0 };
    }
    const systemMsg = 'You summarize task outcomes in one paragraph. Be factual and concise. Output JSON: { "summary": "...", "outcome_assessment": "SUCCEEDED|PARTIAL|FAILED" }';
    const userMsg   = `Task: ${task.intent}\n\nExecution results:\n${JSON.stringify(executionResults, null, 2)}`;
    const result    = await this._chatComplete(systemMsg, userMsg);
    try {
      const parsed = JSON.parse(result.plan_json);
      return { ...parsed, latency_ms: result.latency_ms };
    } catch {
      return { summary: result.raw_output, outcome_assessment: 'UNKNOWN', latency_ms: result.latency_ms };
    }
  }

  // ── Internal HTTP ────────────────────────────────────────────────────────────

  async _chatComplete(systemInstruction, userMessage) {
    const start   = Date.now();
    const payload = {
      model:           this.model,
      messages:        [{ role: 'system', content: systemInstruction }, { role: 'user', content: userMessage }],
      response_format: { type: 'json_object' },
      temperature:     0.1,
      max_tokens:      4096,
    };

    const data      = await this._request('POST', this._completionsUrl, payload, this.timeoutMs);
    const latency_ms = Date.now() - start;

    const choice       = data?.choices?.[0];
    const raw_output   = choice?.message?.content || '';
    const usage        = data?.usage || {};

    return {
      plan_json:     raw_output,
      raw_output,
      input_tokens:  usage.prompt_tokens     || 0,
      output_tokens: usage.completion_tokens || 0,
      latency_ms,
    };
  }

  async _request(method, url, body, timeoutMs) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;

      const bodyStr = body ? JSON.stringify(body) : null;
      const headers = {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      };
      if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

      const opts = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method,
        headers,
        timeout: timeoutMs,
      };

      const req = lib.request(opts, res => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(Object.assign(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 200)}`), { statusCode: res.statusCode }));
            return;
          }
          try   { resolve(JSON.parse(raw)); }
          catch { resolve(raw); }
        });
      });
      req.on('timeout', () => { req.destroy(); reject(new Error(`Request timed out after ${timeoutMs}ms`)); });
      req.on('error',   reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock implementation — deterministic, no network, safe for tests
// ─────────────────────────────────────────────────────────────────────────────

class MockFrontierClient extends FrontierClient {
  /**
   * @param {object} [options]
   * @param {string}  [options.mode]          — 'valid_plan' | 'always_invalid' | 'too_many_steps' | 'invalid_json' | 'physical_plan' | 'high_risk_plan'
   * @param {string}  [options.modelName]     — model name to report
   * @param {boolean} [options.unavailable]   — simulate RunPod being offline
   * @param {number}  [options.latencyMs]     — simulated latency (default 0)
   * @param {object}  [options.fixedPlan]     — if set, always return this plan JSON
   */
  constructor(options = {}) {
    super();
    this.mode       = options.mode      || 'valid_plan';
    this.modelName  = options.modelName || 'mock-frontier-v1';
    this.unavailable = options.unavailable || false;
    this.latencyMs  = options.latencyMs || 0;
    this.fixedPlan  = options.fixedPlan || null;
    this._callCount = 0;
  }

  async health() {
    if (this.unavailable) {
      return { status: 'ORCHESTRATOR_UNAVAILABLE', model: this.modelName, latency_ms: this.latencyMs, error: 'Simulated RunPod unavailable' };
    }
    return { status: 'healthy', model: this.modelName, latency_ms: this.latencyMs, endpoint_id: 'mock-endpoint' };
  }

  async modelInfo() {
    return { model: this.modelName, version: '1.0', provider: 'mock', runtime: 'mock-runtime' };
  }

  async generateStructuredPlan(task, availableCaps, _networkKnowledge, _sysInstruction) {
    if (this.unavailable) throw Object.assign(new Error('Simulated RunPod unavailable'), { code: 'ORCHESTRATOR_UNAVAILABLE' });
    this._callCount++;

    if (this.fixedPlan) {
      return { plan_json: JSON.stringify(this.fixedPlan), raw_output: JSON.stringify(this.fixedPlan), input_tokens: 100, output_tokens: 200, latency_ms: this.latencyMs };
    }

    const plan = this._buildPlan(task, availableCaps, this.mode);
    const json = (this.mode === 'invalid_json') ? 'NOT VALID JSON {{ ' : JSON.stringify(plan);
    return { plan_json: json, raw_output: json, input_tokens: 100, output_tokens: 200, latency_ms: this.latencyMs };
  }

  async reviseStructuredPlan(task, availableCaps, _knowledge, _prevPlan, _findings, _sysInstruction) {
    if (this.unavailable) throw Object.assign(new Error('Simulated RunPod unavailable'), { code: 'ORCHESTRATOR_UNAVAILABLE' });
    this._callCount++;

    // If always_invalid mode, always return a bad plan to test revision limit
    if (this.mode === 'always_invalid') {
      const badPlan = this._buildPlan(task, availableCaps, 'always_invalid');
      const json    = JSON.stringify(badPlan);
      return { plan_json: json, raw_output: json, input_tokens: 80, output_tokens: 180, latency_ms: this.latencyMs };
    }

    // Otherwise fix the plan
    const plan = this._buildPlan(task, availableCaps, 'valid_plan');
    const json = JSON.stringify(plan);
    return { plan_json: json, raw_output: json, input_tokens: 80, output_tokens: 180, latency_ms: this.latencyMs };
  }

  async summarizeOutcome(task, _results) {
    if (this.unavailable) return { summary: 'RunPod unavailable', outcome_assessment: 'UNKNOWN', latency_ms: this.latencyMs };
    this._callCount++;
    return {
      summary:            `Mock orchestrator completed intent: "${task.intent || 'unknown'}"`,
      outcome_assessment: 'SUCCEEDED',
      latency_ms:         this.latencyMs,
    };
  }

  // ── Plan builder ─────────────────────────────────────────────────────────────

  _buildPlan(task, availableCaps, mode) {
    const taskId  = task?.task_id || crypto.randomUUID();
    const planId  = crypto.randomUUID();

    switch (mode) {
      case 'always_invalid':
        // Uses a non-existent capability to force INVALID from the plan validator
        return {
          schema_version: 'ORCHESTRATION_PLAN_V1', task_id: taskId, plan_id: planId,
          workflow_run_id: planId, agent_id: 'TCS-OAFR-001', era: '21.3', intent: task?.intent || '',
          constraints: { max_risk_level: 'low' },
          steps: [{ step_id: 'step_1', sequence: 1, capability_id: 'tcs.nonexistent.fake_capability', depends_on: [], input: {} }],
        };

      case 'too_many_steps': {
        const steps = Array.from({ length: 21 }, (_, i) => ({
          step_id:       `step_${i + 1}`,
          sequence:      i + 1,
          capability_id: 'tcs.network.query',
          depends_on:    i === 0 ? [] : [`step_${i}`],
          input:         { query: `step ${i + 1}` },
        }));
        return {
          schema_version: 'ORCHESTRATION_PLAN_V1', task_id: taskId, plan_id: planId,
          workflow_run_id: planId, agent_id: 'TCS-OAFR-001', era: '21.3', intent: task?.intent || '',
          constraints: { max_risk_level: 'low' },
          steps,
        };
      }

      case 'physical_plan':
        // Uses a factory capability that is blocked by the physical execution guard
        return {
          schema_version: 'ORCHESTRATION_PLAN_V1', task_id: taskId, plan_id: planId,
          workflow_run_id: planId, agent_id: 'TCS-OAFR-001', era: '21.3', intent: task?.intent || '',
          constraints: { max_risk_level: 'low' },
          steps: [{ step_id: 'step_1', sequence: 1, capability_id: 'tcs.factory.submit_print', depends_on: [], input: { artifact3dId: 'test', buyerId: 'test' } }],
        };

      case 'high_risk_plan':
        // Uses a medium-risk capability with a low ceiling → triggers REQUIRES_APPROVAL or INVALID
        return {
          schema_version: 'ORCHESTRATION_PLAN_V1', task_id: taskId, plan_id: planId,
          workflow_run_id: planId, agent_id: 'TCS-OAFR-001', era: '21.3', intent: task?.intent || '',
          constraints: { max_risk_level: 'low' },
          steps: [{ step_id: 'step_1', sequence: 1, capability_id: 'tcs.network.create', depends_on: [], input: { network_id: 'test', name: 'test' } }],
        };

      case 'unknown_capability':
        // Uses a capability name that does not exist in the registry
        return {
          schema_version: 'ORCHESTRATION_PLAN_V1', task_id: taskId, plan_id: planId,
          workflow_run_id: planId, agent_id: 'TCS-OAFR-001', era: '21.3', intent: task?.intent || '',
          constraints: { max_risk_level: 'low' },
          steps: [{ step_id: 'step_1', sequence: 1, capability_id: 'TELEPORT_ARTIFACT', depends_on: [], input: {} }],
        };

      case 'valid_plan':
      default: {
        // Pick first low-risk, live, uim_exposable, non-physical cap with no approval_required.
        // Live API returns caps with `capability_id` field; fallback stubs may use `id`.
        const goodCap = (Array.isArray(availableCaps) ? availableCaps : []).find(c =>
          c.status === 'live' && c.uim_exposable && !c.approval_required &&
          (c.risk_level === 'low' || !c.risk_level) && c.uim_operations_enabled !== false
        ) || null;

        const capId = goodCap
          ? (goodCap.capability_id || goodCap.id || 'tcs.network.query')
          : 'tcs.network.query';

        const requiredInputs = (goodCap?.input_schema?.required) || [];
        const input = {};
        for (const field of requiredInputs) {
          input[field] = field === 'query' ? 'list network state' : `mock_${field}`;
        }
        if (!input.query) input.query = 'list network state';

        return {
          schema_version:  'ORCHESTRATION_PLAN_V1',
          task_id:         taskId,
          plan_id:         planId,
          workflow_run_id: planId, // plan_id doubles as workflow_run_id in mock
          agent_id:        'TCS-OAFR-001',
          era:             '21.3',
          intent:          task?.intent || 'mock intent',
          constraints:     { max_risk_level: 'low' },
          steps: [{
            step_id:       'step_1',
            sequence:      1,
            capability_id: capId,
            depends_on:    [],
            input,
          }],
        };
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared user-message builders (keep TC-S logic OUT of FrontierClient)
// ─────────────────────────────────────────────────────────────────────────────

function _buildPlanningUserMessage(task, availableCaps, networkKnowledge) {
  const capSummary = (availableCaps || [])
    .filter(c => c.uim_exposable && c.status === 'live' && c.uim_operations_enabled !== false)
    .map(c => `  • ${c.id} [${c.risk_level || 'low'}] — ${c.description || ''}`)
    .join('\n');

  const knowledgeSummary = (networkKnowledge || [])
    .slice(0, 10)
    .map(k => `  [${k.knowledge_type}] ${k.subject}: ${k.summary}`)
    .join('\n');

  return [
    `# Task`,
    `Intent: ${task.intent}`,
    `Task ID: ${task.task_id}`,
    ``,
    `# Available Capabilities (DO NOT use any capability not listed here)`,
    capSummary || '  (none)',
    ``,
    `# Current Network Knowledge`,
    knowledgeSummary || '  (none)',
    ``,
    `# Instruction`,
    `Output ONLY a valid ORCHESTRATION_PLAN_V1 JSON object. No commentary.`,
    `Required top-level fields: schema_version, task_id, plan_id, agent_id, era, intent, constraints, steps`,
    `Each step requires: step_id, capability_id (must match a listed capability exactly), depends_on (array), input (object)`,
    `Set constraints.max_risk_level to "low".`,
    `Set agent_id to "TCS-OAFR-001".`,
    `Set era to "21.3".`,
  ].join('\n');
}

function _buildRevisionUserMessage(task, availableCaps, networkKnowledge, previousPlan, validatorFindings) {
  const findingsText = (validatorFindings || [])
    .map(f => `  • [${f.code}] ${f.message || f.detail || JSON.stringify(f)}`)
    .join('\n');

  return [
    `# Plan Revision Required`,
    ``,
    `The previous plan was INVALID. Validator findings:`,
    findingsText || '  (no specific findings)',
    ``,
    `# Previous Plan`,
    JSON.stringify(previousPlan, null, 2),
    ``,
    `# Available Capabilities`,
    (availableCaps || [])
      .filter(c => c.uim_exposable && c.status === 'live' && c.uim_operations_enabled !== false)
      .map(c => `  • ${c.id} [${c.risk_level || 'low'}]`)
      .join('\n') || '  (none)',
    ``,
    `# Instruction`,
    `Fix ALL validation findings. Output ONLY valid ORCHESTRATION_PLAN_V1 JSON. No commentary.`,
    `Use only capabilities listed above. Use step_id, capability_id, depends_on, input for each step.`,
    `Set agent_id to "TCS-OAFR-001", era to "21.3", constraints.max_risk_level to "low".`,
  ].join('\n');
}

module.exports = {
  FrontierClient,
  RunPodFrontierClient,
  MockFrontierClient,
};
