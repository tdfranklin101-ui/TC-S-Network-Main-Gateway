/**
 * TC-S Network — Era 21.3
 * Inference Receipt
 *
 * Creates and stores a provenance receipt for each frontier model call.
 * Receipts are stored in network_knowledge (knowledge_type = 'INFERENCE_RECEIPT').
 *
 * These are observations only — they do NOT convert to Solar in Era 21.3.
 * Future eras may use these for energy accounting.
 */

'use strict';

const crypto = require('crypto');

const KNOWLEDGE_TYPE   = 'INFERENCE_RECEIPT';
const KNOWLEDGE_SOURCE = 'frontier_orchestrator';

// ── Energy estimate constants ─────────────────────────────────────────────────
// Very rough estimates for a 120B parameter model on H100 80GB
// These are ESTIMATED — actual values require RunPod telemetry
const ESTIMATED_WATTS_PER_GPU        = 700;   // H100 TDP ≈ 700W
const ESTIMATED_TOKENS_PER_SECOND    = 15;    // ~15 tokens/s for 120B on H100

/**
 * Create an inference receipt object.
 *
 * @param {object} options
 *   @param {string}  options.task_id
 *   @param {string}  [options.workflow_run_id]
 *   @param {string}  options.provider          — 'runpod' | 'mock'
 *   @param {string}  [options.runtime]         — 'vllm' | 'mock-runtime'
 *   @param {string}  options.model
 *   @param {string}  [options.model_version]
 *   @param {string}  [options.endpoint_id]
 *   @param {number}  [options.input_tokens]
 *   @param {number}  [options.output_tokens]
 *   @param {number}  [options.latency_ms]
 *   @param {string}  [options.raw_output]      — used to compute output_hash
 *   @param {string}  [options.started_at]
 *   @param {string}  [options.finished_at]
 *   @param {string}  [options.call_type]       — 'generate_plan' | 'revise_plan' | 'summarize'
 * @returns {object} inference receipt
 */
function createInferenceReceipt(options) {
  const {
    task_id, workflow_run_id, provider, runtime, model,
    model_version, endpoint_id, input_tokens, output_tokens,
    latency_ms, raw_output, started_at, finished_at, call_type,
  } = options;

  const now = new Date().toISOString();
  const inTok  = input_tokens  || 0;
  const outTok = output_tokens || 0;
  const totTok = inTok + outTok;
  const latMs  = latency_ms    || 0;

  // Compute seconds from latency (estimate)
  const compute_seconds = latMs / 1000;

  // Estimated energy: compute_seconds × (watts / 3600) → Wh
  const estimated_energy_wh = compute_seconds > 0
    ? parseFloat(((ESTIMATED_WATTS_PER_GPU * compute_seconds) / 3600).toFixed(6))
    : null;

  // Estimated cost (RunPod H100 ≈ $2.89/hr as of 2026)
  const estimated_cost_usd = compute_seconds > 0
    ? parseFloat(((2.89 / 3600) * compute_seconds).toFixed(8))
    : null;

  // Output hash (SHA-256 of raw output — for provenance, not privacy)
  const output_hash = raw_output
    ? crypto.createHash('sha256').update(raw_output).digest('hex')
    : null;

  return {
    inference_receipt_id:   crypto.randomUUID(),
    task_id:                task_id || null,
    workflow_run_id:        workflow_run_id || null,
    call_type:              call_type || 'unknown',
    provider:               provider || 'unknown',
    runtime:                runtime  || 'unknown',
    model:                  model    || 'unknown',
    model_version:          model_version || null,
    endpoint_id:            endpoint_id   || null,
    input_tokens:           inTok,
    output_tokens:          outTok,
    total_tokens:           totTok,
    latency_ms:             latMs,
    compute_seconds:        compute_seconds,
    estimated_cost_usd:     estimated_cost_usd,
    estimated_energy_wh:    estimated_energy_wh,
    energy_measurement_type: estimated_energy_wh != null ? 'ESTIMATED' : 'UNKNOWN',
    started_at:             started_at || now,
    finished_at:            finished_at || now,
    output_hash,
    status:                 'ESTIMATED',
    // NOTE: do NOT convert to Solar in Era 21.3
    solar_conversion_era:   null,
  };
}

/**
 * Store an inference receipt in network_knowledge.
 * Failures are silently logged — never crash the orchestration path.
 *
 * @param {object} pool   — pg Pool
 * @param {object} receipt — from createInferenceReceipt()
 * @returns {object} the receipt (unchanged)
 */
async function storeInferenceReceipt(pool, receipt) {
  if (!pool) return receipt;
  try {
    const summary = `Inference [${receipt.call_type}] model=${receipt.model} task=${receipt.task_id} tokens=${receipt.total_tokens} latency=${receipt.latency_ms}ms`;
    await pool.query(
      `INSERT INTO network_knowledge
       (subject, knowledge_type, summary, structured_facts, confidence, source_table, network_id, valid_from, created_at, updated_at, era)
       VALUES ($1, $2, $3, $4::jsonb, 1.0, $5, 'default', NOW(), NOW(), NOW(), '21.3')`,
      [
        `inference_receipt:${receipt.inference_receipt_id}`,
        KNOWLEDGE_TYPE,
        summary,
        JSON.stringify(receipt),
        KNOWLEDGE_SOURCE,
      ]
    );
  } catch (err) {
    console.warn('[InferenceReceipt] Storage failed (non-fatal):', err.message);
  }
  return receipt;
}

module.exports = { createInferenceReceipt, storeInferenceReceipt, KNOWLEDGE_TYPE };
