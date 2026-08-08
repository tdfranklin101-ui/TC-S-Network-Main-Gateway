/**
 * TC-S Network Foundation — ARTIFACT_COMMERCE_LOOP_V1
 * Era 21.2: Workflow Provenance & Orchestrator Readiness
 * (refactored from Era 21.1)
 *
 * Changes in 21.2:
 *   - workflow_run_id generated via crypto.randomUUID() before run() begins
 *   - ctx._workflowRunId set immediately so all steps inherit the same ID
 *   - Persistent workflow_runs + workflow_run_steps tables (not just network_knowledge)
 *   - Creation provenance recorded on success
 *   - Capability metrics recorded per step
 *   - Structured logging keyed by workflow_run_id
 *
 * Invariants (unchanged from Era 21.1):
 *   ONE workflow_run_id → MANY request_ids (one per step)
 *   Rollback rules: see _applyRollback()
 *   NO new LLM. All deterministic.
 */

'use strict';

const crypto = require('crypto');
const { recordCapabilityOutcome } = require('../orchestrator/capability-metrics');
const { recordProvenance }        = require('../orchestrator/provenance');

// ── Workflow states ────────────────────────────────────────────────────
const WF_STATES = Object.freeze({
  CREATED:          'CREATED',
  RUNNING:          'RUNNING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  FAILED:           'FAILED',
  ROLLED_BACK:      'ROLLED_BACK',
  SUCCEEDED:        'SUCCEEDED',
  CANCELLED:        'CANCELLED',
});

// ── Step definitions (ordered) ─────────────────────────────────────────
const WORKFLOW_STEPS = [
  { step_id: 'asset_create',      capability_id: 'tcs.marketplace.asset_create',  label: 'Create Asset' },
  { step_id: 'calculate_energy',  capability_id: 'tcs.solar.calculate_energy',    label: 'Calculate Energy' },
  { step_id: 'price_quote',       capability_id: 'tcs.marketplace.price_quote',   label: 'Price Quote' },
  { step_id: 'asset_enrich',      capability_id: 'tcs.marketplace.asset_enrich',  label: 'Enrich Asset' },
  { step_id: 'asset_list',        capability_id: 'tcs.marketplace.asset_list',    label: 'List Asset' },
  { step_id: 'purchase_artifact', capability_id: 'tcs.marketplace.purchase',      label: 'Purchase Artifact' },
  { step_id: 'audit_transaction', capability_id: 'tcs.solar.audit_transaction',   label: 'Audit Transaction' },
  { step_id: 'learning_update',   capability_id: 'tcs.capability_discovery',      label: 'Learning Update' },
];

class ArtifactCommerceLoop {
  /**
   * @param {object} executor - ActionExecutor instance
   * @param {object} learning - OperationsLearning instance (optional)
   * @param {object} pool     - pg Pool
   */
  constructor(executor, learning, pool) {
    this.executor = executor;
    this.learning = learning;
    this.pool     = pool;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Execute the ARTIFACT_COMMERCE_LOOP_V1 workflow end-to-end.
   *
   * workflow_run_id is generated here (crypto.randomUUID()) BEFORE any step
   * begins, so every step, transaction, audit record, and provenance entry
   * all share the same immutable ID.
   *
   * @param {object} input - validated workflow input
   * @returns {object} workflow run record with full step trace
   */
  async run(input) {
    // ── CRITICAL: generate ONE immutable workflow_run_id BEFORE any step ──
    const workflowRunId = crypto.randomUUID();
    const agentId       = input.initiator_agent_id || 'tcs-operations-agent-v1';
    const startedAt     = new Date().toISOString();

    this._log(workflowRunId, 'WORKFLOW_START', { agentId, workflow_type: 'ARTIFACT_COMMERCE_LOOP_V1' });

    // ── Initialize run record ──────────────────────────────────────────
    const runRecord = {
      workflow_run_id:   workflowRunId,
      workflow_type:     'ARTIFACT_COMMERCE_LOOP_V1',
      state:             WF_STATES.CREATED,
      initiator_agent_id: agentId,
      principal_id:      input.principal_id || null,
      network_id:        input.network_id   || 'default',
      intent:            input.intent       || 'Create and list a useful digital artifact',
      input,
      steps:             WORKFLOW_STEPS.map(s => ({
        ...s,
        sequence:         WORKFLOW_STEPS.indexOf(s) + 1,
        request_id:       null,
        action_request_id: null,
        status:           'PENDING',
        started_at:       null,
        finished_at:      null,
        input_reference:  null,
        result_reference: null,
        audit_reference:  null,
        error:            null,
        latency_ms:       null,
      })),
      started_at:   startedAt,
      finished_at:  null,
      step_count:   WORKFLOW_STEPS.length,
      success_count: 0,
      failure_count: 0,
      result_summary: null,
      error_summary:  null,
      flags:          [],
      metadata:       { era: '21.2' },
    };

    await this._persistWorkflowRun(runRecord);
    runRecord.state = WF_STATES.RUNNING;
    await this._persistWorkflowRun(runRecord);

    // ── Step context shared across steps ──────────────────────────────
    // ctx._workflowRunId is set IMMEDIATELY — inherited by every step
    const ctx = {
      _workflowRunId: workflowRunId,  // ← THE FIX: set before any step runs
      agentId,
      sellerId:      input.seller_member_id,
      buyerId:       input.buyer_member_id,
      artifact:      input.artifact,
      energyInput:   input.energy_input || {},
      autoList:      input.listing?.auto_list !== false,
      marketItemId:  null,
      energyResult:  null,
      priceResult:   null,
      purchaseResult: null,
      auditResult:   null,
    };

    // ── Execute steps sequentially ─────────────────────────────────────
    for (let i = 0; i < runRecord.steps.length; i++) {
      const step    = runRecord.steps[i];
      const stepStart = Date.now();
      step.status    = 'RUNNING';
      step.started_at = new Date().toISOString();

      this._log(workflowRunId, 'STEP_START', {
        step_id:       step.step_id,
        sequence:      step.sequence,
        capability_id: step.capability_id,
        request_id:    step.request_id,
      });

      try {
        const { result, requestId, auditRef } = await this._executeStep(step.capability_id, ctx, agentId, workflowRunId);

        const latency = Date.now() - stepStart;
        step.status          = 'SUCCEEDED';
        step.finished_at     = new Date().toISOString();
        step.request_id      = requestId || null;
        step.result_reference = JSON.stringify(result).slice(0, 500);
        step.audit_reference  = auditRef || null;
        step.latency_ms       = latency;
        runRecord.success_count++;

        // Propagate results into context for dependent steps
        this._updateContext(ctx, step.capability_id, result);

        this._log(workflowRunId, 'STEP_COMPLETE', {
          step_id:       step.step_id,
          capability_id: step.capability_id,
          request_id:    requestId,
          latency_ms:    latency,
          status:        'SUCCEEDED',
        });

        // Record capability metrics (non-blocking, non-crashing)
        if (this.pool) {
          recordCapabilityOutcome(this.pool, step.capability_id, { success: true, latency_ms: latency })
            .catch(() => {});
        }

        // Learning Layer ingestion after each step
        if (this.learning) {
          await this._ingestStepLearning(workflowRunId, step, result, ctx).catch(err =>
            console.warn(`⚠️ Learning ingestion error at ${step.step_id}: ${err.message}`)
          );
        }

        await this._persistStepRecord(workflowRunId, step);
        await this._persistWorkflowRun(runRecord);
      } catch (err) {
        const latency = Date.now() - stepStart;
        step.status      = 'FAILED';
        step.finished_at = new Date().toISOString();
        step.error       = err.message;
        step.latency_ms  = latency;
        runRecord.failure_count++;

        this._log(workflowRunId, 'STEP_FAILED', {
          step_id:       step.step_id,
          capability_id: step.capability_id,
          error:         err.message,
          latency_ms:    latency,
        });

        // Record capability metrics for failure
        if (this.pool) {
          recordCapabilityOutcome(this.pool, step.capability_id, {
            success: false, latency_ms: latency,
            error_class: err.message.split(':')[0],
          }).catch(() => {});
        }

        const rollbackResult = await this._applyRollback(step.capability_id, ctx, err, runRecord);
        if (rollbackResult.flagged) {
          runRecord.flags.push({ step: step.step_id, reason: rollbackResult.reason, at: new Date().toISOString() });
        }

        runRecord.state       = WF_STATES.FAILED;
        runRecord.error_summary = `Step ${step.step_id} failed: ${err.message}`;
        runRecord.finished_at = new Date().toISOString();

        await this._persistStepRecord(workflowRunId, step);
        await this._persistWorkflowRun(runRecord);

        return runRecord;
      }
    }

    // ── All steps succeeded ────────────────────────────────────────────
    runRecord.state          = WF_STATES.SUCCEEDED;
    runRecord.finished_at    = new Date().toISOString();
    runRecord.result_summary = {
      market_item_id:   ctx.marketItemId,
      transaction_id:   ctx.purchaseResult?.transaction_id || null,
      copy_id:          ctx.purchaseResult?.copy_id        || null,
      audit_verdict:    ctx.auditResult?.verdict           || null,
    };

    await this._persistWorkflowRun(runRecord);

    this._log(workflowRunId, 'WORKFLOW_COMPLETE', {
      state:          WF_STATES.SUCCEEDED,
      duration_ms:    Date.now() - new Date(startedAt).getTime(),
      market_item_id: ctx.marketItemId,
      transaction_id: ctx.purchaseResult?.transaction_id,
    });

    // Record creation provenance
    if (this.pool) {
      await recordProvenance(this.pool, {
        creation_id:            workflowRunId,
        workflow_run_id:        workflowRunId,
        network_id:             ctx.network_id || 'default',
        principal_id:           input.seller_member_id ? String(input.seller_member_id) : null,
        initiator_agent_id:     agentId,
        intent:                 runRecord.intent,
        artifact_ids:           ctx.marketItemId ? [String(ctx.marketItemId)] : [],
        capability_invocations: runRecord.steps.filter(s => s.status === 'SUCCEEDED').map(s => s.capability_id),
        transaction_ids:        ctx.purchaseResult?.transaction_id ? [ctx.purchaseResult.transaction_id] : [],
        ownership_records:      ctx.purchaseResult?.copy_id ? [{ copy_id: ctx.purchaseResult.copy_id }] : [],
        audit_records:          ctx.auditResult ? [{ verdict: ctx.auditResult.verdict }] : [],
        started_at:             startedAt,
        completed_at:           runRecord.finished_at,
        status:                 WF_STATES.SUCCEEDED,
        metadata:               { era: '21.2', workflow_type: 'ARTIFACT_COMMERCE_LOOP_V1' },
      }).catch(err => console.warn(`⚠️ Provenance record failed: ${err.message}`));
    }

    return runRecord;
  }

  // ── Private: step dispatcher ──────────────────────────────────────

  async _executeStep(capabilityId, ctx, agentId, workflowRunId) {
    // Map Era 21.2 capability IDs → action types
    const CAP_TO_ACTION = {
      'tcs.marketplace.asset_create': 'ASSET.CREATE',
      'tcs.solar.calculate_energy':   'CALCULATE_ENERGY',
      'tcs.marketplace.price_quote':  'PRICE.QUOTE',
      'tcs.marketplace.asset_enrich': 'ASSET.ENRICH',
      'tcs.marketplace.asset_list':   'ASSET.LIST',
      'tcs.marketplace.purchase':     'PURCHASE_ARTIFACT',
      'tcs.solar.audit_transaction':  'AUDIT_TRANSACTION',
      'tcs.capability_discovery':     null, // learning only
    };

    const actionType = CAP_TO_ACTION[capabilityId];

    switch (capabilityId) {
      case 'tcs.marketplace.asset_create': {
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: {
            title:            ctx.artifact.title,
            description:      ctx.artifact.description,
            category:         ctx.artifact.category || 'Digital Artifact',
            createdByUserId:  String(ctx.sellerId),
            sourceType:       'INTERNAL_STOCK',
            metadata: { workflow: 'ARTIFACT_COMMERCE_LOOP_V1', era: '21.2', workflow_run_id: workflowRunId },
          },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'tcs.solar.calculate_energy': {
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: ctx.energyInput,
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'tcs.marketplace.price_quote': {
        if (!ctx.marketItemId) throw new Error('PRICE.QUOTE requires marketItemId from asset_create');
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: { marketItemId: ctx.marketItemId },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'tcs.marketplace.asset_enrich': {
        if (!ctx.marketItemId) throw new Error('ASSET.ENRICH requires marketItemId');
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: { marketItemId: ctx.marketItemId, energyData: ctx.energyResult },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'tcs.marketplace.asset_list': {
        if (!ctx.marketItemId) throw new Error('ASSET.LIST requires marketItemId');
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: { marketItemId: ctx.marketItemId },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'tcs.marketplace.purchase': {
        if (!ctx.marketItemId) throw new Error('PURCHASE_ARTIFACT requires marketItemId from asset_list');
        if (!ctx.buyerId)      throw new Error('PURCHASE_ARTIFACT requires buyer_member_id in workflow input');
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: {
            buyer_member_id:  ctx.buyerId,
            market_item_id:   ctx.marketItemId,
            idempotency_key:  `wf_${workflowRunId}_purchase`, // ← workflowRunId always defined
          },
        });
        return { result, requestId: result.requestId, auditRef: result?.executionResult?.audit_reference };
      }

      case 'tcs.solar.audit_transaction': {
        const txId = ctx.purchaseResult?.transaction_id;
        if (!txId) {
          return {
            result: { verdict: 'PASS_WITH_WARNING', findings: [{ code: 'NO_PURCHASE_TX', severity: 'WARNING', detail: 'No purchase transaction to audit' }] },
            requestId: null,
            auditRef: null,
          };
        }
        const result = await this.executor.submitAction({
          actionType,
          agentId,
          requesterId: agentId,
          payload: { transaction_id: txId },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'tcs.capability_discovery': {
        // Learning update — marker step, handled via _ingestStepLearning
        return {
          result: { status: 'learning_ingested', workflow_run_id: workflowRunId },
          requestId: null,
          auditRef: null,
        };
      }

      default:
        throw new Error(`Unknown capability in commerce loop: ${capabilityId}`);
    }
  }

  // ── Private: propagate step results into context ──────────────────

  _updateContext(ctx, capabilityId, result) {
    const exec = result?.executionResult || result?.result || result;
    switch (capabilityId) {
      case 'tcs.marketplace.asset_create':
        ctx.marketItemId = exec?.marketItemId || exec?.id || exec?.market_item_id || null;
        break;
      case 'tcs.solar.calculate_energy':
        ctx.energyResult = exec;
        break;
      case 'tcs.marketplace.price_quote':
        ctx.priceResult = exec;
        break;
      case 'tcs.marketplace.purchase':
        ctx.purchaseResult = exec;
        break;
      case 'tcs.solar.audit_transaction':
        ctx.auditResult = exec;
        break;
    }
  }

  // ── Private: rollback rules ───────────────────────────────────────

  async _applyRollback(capabilityId, ctx, err, runRecord) {
    switch (capabilityId) {
      case 'tcs.marketplace.asset_list':
        return { flagged: false, reason: null };

      case 'tcs.marketplace.purchase':
        return { flagged: false, reason: null };

      case 'tcs.solar.audit_transaction':
        return {
          flagged: true,
          reason:  `AUDIT_FAILED: ${err.message} — financial state NOT reversed; admin review required`,
        };

      default:
        return { flagged: false, reason: null };
    }
  }

  // ── Private: learning ingestion ───────────────────────────────────

  async _ingestStepLearning(workflowRunId, step, result, ctx) {
    if (!this.learning) return;
    const exec = result?.executionResult || result?.result || result;
    await this.learning.recordOutcome({
      action_type:     step.capability_id,
      workflow_run_id: workflowRunId,
      step_id:         step.step_id,
      status:          step.status,
      result_summary:  exec,
      financial:       ctx.purchaseResult || null,
      audit:           ctx.auditResult    || null,
    });
  }

  // ── Private: structured log helper ───────────────────────────────

  _log(workflowRunId, event, data = {}) {
    console.log(JSON.stringify({
      ts:              new Date().toISOString(),
      workflow_run_id: workflowRunId,
      event,
      workflow_type:   'ARTIFACT_COMMERCE_LOOP_V1',
      agent_id:        data.agentId || 'tcs-operations-agent-v1',
      ...data,
    }));
  }

  // ── Private: persistence (workflow_runs table, fallback to network_knowledge) ──

  async _persistWorkflowRun(runRecord) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO workflow_runs
           (workflow_run_id, workflow_type, initiator_agent_id, principal_id, network_id,
            status, intent, input_payload, started_at, finished_at, current_step,
            step_count, success_count, failure_count, result_summary, error_summary, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17::jsonb)
         ON CONFLICT (workflow_run_id) DO UPDATE SET
           status        = EXCLUDED.status,
           finished_at   = EXCLUDED.finished_at,
           current_step  = EXCLUDED.current_step,
           success_count = EXCLUDED.success_count,
           failure_count = EXCLUDED.failure_count,
           result_summary = EXCLUDED.result_summary,
           error_summary  = EXCLUDED.error_summary,
           metadata       = EXCLUDED.metadata`,
        [
          runRecord.workflow_run_id,
          runRecord.workflow_type,
          runRecord.initiator_agent_id,
          runRecord.principal_id   || null,
          runRecord.network_id     || 'default',
          runRecord.state,
          runRecord.intent,
          JSON.stringify(runRecord.input),
          runRecord.started_at,
          runRecord.finished_at    || null,
          runRecord.steps.filter(s => s.status === 'RUNNING')[0]?.step_id || null,
          runRecord.step_count,
          runRecord.success_count,
          runRecord.failure_count,
          runRecord.result_summary ? JSON.stringify(runRecord.result_summary) : null,
          runRecord.error_summary  || null,
          JSON.stringify(runRecord.metadata || {}),
        ]
      );
    } catch (err) {
      // Fall back to network_knowledge if workflow_runs table doesn't exist yet
      console.warn(`⚠️ workflow_runs persist failed (${err.message}), falling back to network_knowledge`);
      try {
        await this.pool.query(
          `INSERT INTO network_knowledge
             (subject, knowledge_type, value, confidence, source_table, network_id, valid_from, created_at)
           VALUES ($1, 'WORKFLOW_RUN', $2::jsonb, 1.0, 'commerce_loop', 'default', NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [
            `workflow:${runRecord.workflow_run_id}`,
            JSON.stringify({
              workflow_run_id: runRecord.workflow_run_id,
              workflow_type:   runRecord.workflow_type,
              state:           runRecord.state,
              steps:           runRecord.steps.map(s => ({ step_id: s.step_id, status: s.status, error: s.error })),
              flags:           runRecord.flags,
              started_at:      runRecord.started_at,
              finished_at:     runRecord.finished_at,
              error_summary:   runRecord.error_summary,
            }),
          ]
        );
      } catch (fbErr) {
        console.warn(`⚠️ Fallback persist also failed: ${fbErr.message}`);
      }
    }
  }

  async _persistStepRecord(workflowRunId, step) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO workflow_run_steps
           (workflow_run_id, step_id, sequence, capability_id, request_id,
            status, started_at, finished_at, input_reference, result_reference,
            audit_reference, error, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ON CONFLICT (workflow_run_id, step_id) DO UPDATE SET
           status          = EXCLUDED.status,
           finished_at     = EXCLUDED.finished_at,
           result_reference = EXCLUDED.result_reference,
           audit_reference  = EXCLUDED.audit_reference,
           error           = EXCLUDED.error`,
        [
          workflowRunId,
          step.step_id,
          step.sequence,
          step.capability_id,
          step.request_id    || null,
          step.status,
          step.started_at    || null,
          step.finished_at   || null,
          step.input_reference || null,
          step.result_reference || null,
          step.audit_reference || null,
          step.error         || null,
          JSON.stringify({ latency_ms: step.latency_ms || null }),
        ]
      );
    } catch (err) {
      // Non-fatal: step persistence is best-effort (run record is authoritative)
      if (!err.message.includes('does not exist')) {
        console.warn(`⚠️ workflow_run_steps persist failed for ${step.step_id}: ${err.message}`);
      }
    }
  }
}

module.exports = { ArtifactCommerceLoop, WORKFLOW_STEPS, WF_STATES };
