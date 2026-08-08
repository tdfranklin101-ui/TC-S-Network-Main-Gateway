/**
 * TC-S Network Foundation — ARTIFACT_COMMERCE_LOOP_V1
 * Era 21.1: Economic Autonomy (Tasks 10-14)
 *
 * Deterministic multi-capability workflow orchestrating the full
 * creation → listing → purchase → settlement lifecycle.
 *
 * NO new LLM. All steps are deterministic handler invocations.
 *
 * Workflow steps (in order):
 *   1. ASSET.CREATE
 *   2. CALCULATE_ENERGY
 *   3. PRICE.QUOTE
 *   4. ASSET.ENRICH
 *   5. ASSET.LIST
 *   6. PURCHASE_ARTIFACT
 *   7. AUDIT_TRANSACTION
 *   8. LEARNING_UPDATE (via OperationsLearning.recordOutcome)
 *
 * State machine states:
 *   CREATED → RUNNING → WAITING_APPROVAL → FAILED → ROLLED_BACK → SUCCEEDED
 *
 * Rollback rules (strict financial):
 *   - ASSET.LIST fails → no purchase
 *   - PURCHASE_ARTIFACT fails → no ownership, no partial credit
 *   - AUDIT_TRANSACTION fails → flag for admin review, do NOT auto-reverse
 */

'use strict';

const crypto = require('crypto');

// ── Workflow states ────────────────────────────────────────────────────
const WF_STATES = Object.freeze({
  CREATED: 'CREATED',
  RUNNING: 'RUNNING',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  SUCCEEDED: 'SUCCEEDED',
});

// ── Step definitions (ordered) ─────────────────────────────────────────
const WORKFLOW_STEPS = [
  { step_id: 'asset_create',       capability_id: 'ASSET.CREATE',         label: 'Create Asset' },
  { step_id: 'calculate_energy',   capability_id: 'CALCULATE_ENERGY',     label: 'Calculate Energy' },
  { step_id: 'price_quote',        capability_id: 'PRICE.QUOTE',          label: 'Price Quote' },
  { step_id: 'asset_enrich',       capability_id: 'ASSET.ENRICH',         label: 'Enrich Asset' },
  { step_id: 'asset_list',         capability_id: 'ASSET.LIST',           label: 'List Asset' },
  { step_id: 'purchase_artifact',  capability_id: 'PURCHASE_ARTIFACT',    label: 'Purchase Artifact' },
  { step_id: 'audit_transaction',  capability_id: 'AUDIT_TRANSACTION',    label: 'Audit Transaction' },
  { step_id: 'learning_update',    capability_id: 'LEARNING_UPDATE',      label: 'Learning Update' },
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
    this.pool = pool;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Execute the ARTIFACT_COMMERCE_LOOP_V1 workflow end-to-end.
   *
   * @param {object} input - validated workflow input (see Task 11)
   * @returns {object} workflow run record with full step trace
   */
  async run(input) {
    const workflowRunId = `wf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const agentId = input.initiator_agent_id || 'tcs-operations-agent-v1';
    const startedAt = new Date().toISOString();

    // ── Initialize run record ────────────────────────────────────────
    const runRecord = {
      workflow_run_id: workflowRunId,
      workflow_id: 'ARTIFACT_COMMERCE_LOOP_V1',
      state: WF_STATES.CREATED,
      initiator_agent_id: agentId,
      input,
      steps: WORKFLOW_STEPS.map(s => ({
        ...s,
        request_id: null,
        status: 'PENDING',
        started_at: null,
        finished_at: null,
        result_reference: null,
        audit_reference: null,
        error: null,
      })),
      started_at: startedAt,
      finished_at: null,
      error: null,
      flags: [],
    };

    await this._persistRun(runRecord);
    runRecord.state = WF_STATES.RUNNING;
    await this._persistRun(runRecord);

    // ── Step context shared across steps ─────────────────────────────
    const ctx = {
      agentId,
      sellerId: input.seller_member_id,
      buyerId: input.buyer_member_id,
      artifact: input.artifact,
      energyInput: input.energy_input || {},
      autoList: input.listing?.auto_list !== false,
      marketItemId: null,
      energyResult: null,
      priceResult: null,
      purchaseResult: null,
      auditResult: null,
    };

    // ── Execute steps sequentially ────────────────────────────────────
    for (let i = 0; i < runRecord.steps.length; i++) {
      const step = runRecord.steps[i];
      step.status = 'RUNNING';
      step.started_at = new Date().toISOString();

      try {
        const { result, requestId, auditRef } = await this._executeStep(step.capability_id, ctx, agentId);

        step.status = 'SUCCEEDED';
        step.finished_at = new Date().toISOString();
        step.request_id = requestId || null;
        step.result_reference = JSON.stringify(result).slice(0, 500); // truncate for storage
        step.audit_reference = auditRef || null;

        // Propagate results into context for dependent steps
        this._updateContext(ctx, step.capability_id, result);

        // Learning Layer ingestion after each step
        if (this.learning) {
          await this._ingestStepLearning(workflowRunId, step, result, ctx).catch(err =>
            console.warn(`⚠️ Learning ingestion error at ${step.step_id}: ${err.message}`)
          );
        }

        await this._persistRun(runRecord);
      } catch (err) {
        step.status = 'FAILED';
        step.finished_at = new Date().toISOString();
        step.error = err.message;

        // Rollback rules
        const rollbackResult = await this._applyRollback(step.capability_id, ctx, err, runRecord);

        if (rollbackResult.flagged) {
          runRecord.flags.push({ step: step.step_id, reason: rollbackResult.reason, at: new Date().toISOString() });
          runRecord.state = WF_STATES.FAILED; // flag, don't auto-reverse financial state
        } else {
          runRecord.state = WF_STATES.FAILED;
        }

        runRecord.error = `Step ${step.step_id} failed: ${err.message}`;
        runRecord.finished_at = new Date().toISOString();
        await this._persistRun(runRecord);

        return runRecord;
      }
    }

    // ── All steps succeeded ───────────────────────────────────────────
    runRecord.state = WF_STATES.SUCCEEDED;
    runRecord.finished_at = new Date().toISOString();
    await this._persistRun(runRecord);
    return runRecord;
  }

  // ── Private: step dispatcher ──────────────────────────────────────

  async _executeStep(capabilityId, ctx, agentId) {
    switch (capabilityId) {
      case 'ASSET.CREATE': {
        const result = await this.executor.submitAction({
          actionType: 'ASSET.CREATE',
          agentId,
          requesterId: agentId,
          payload: {
            title: ctx.artifact.title,
            description: ctx.artifact.description,
            category: ctx.artifact.category || 'Digital Artifact',
            createdByUserId: String(ctx.sellerId),
            sourceType: 'INTERNAL_STOCK',
            metadata: { workflow: 'ARTIFACT_COMMERCE_LOOP_V1', era: '21.1' },
          },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'CALCULATE_ENERGY': {
        const result = await this.executor.submitAction({
          actionType: 'CALCULATE_ENERGY',
          agentId,
          requesterId: agentId,
          payload: ctx.energyInput,
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'PRICE.QUOTE': {
        if (!ctx.marketItemId) throw new Error('PRICE.QUOTE requires marketItemId from ASSET.CREATE');
        const result = await this.executor.submitAction({
          actionType: 'PRICE.QUOTE',
          agentId,
          requesterId: agentId,
          payload: { marketItemId: ctx.marketItemId },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'ASSET.ENRICH': {
        if (!ctx.marketItemId) throw new Error('ASSET.ENRICH requires marketItemId');
        const result = await this.executor.submitAction({
          actionType: 'ASSET.ENRICH',
          agentId,
          requesterId: agentId,
          payload: { marketItemId: ctx.marketItemId, energyData: ctx.energyResult },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'ASSET.LIST': {
        if (!ctx.marketItemId) throw new Error('ASSET.LIST requires marketItemId');
        const result = await this.executor.submitAction({
          actionType: 'ASSET.LIST',
          agentId,
          requesterId: agentId,
          payload: { marketItemId: ctx.marketItemId },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'PURCHASE_ARTIFACT': {
        if (!ctx.marketItemId) throw new Error('PURCHASE_ARTIFACT requires marketItemId from ASSET.LIST');
        if (!ctx.buyerId) throw new Error('PURCHASE_ARTIFACT requires buyer_member_id in workflow input');
        const result = await this.executor.submitAction({
          actionType: 'PURCHASE_ARTIFACT',
          agentId,
          requesterId: agentId,
          payload: {
            buyer_member_id: ctx.buyerId,
            market_item_id: ctx.marketItemId,
            idempotency_key: `wf_${ctx._workflowRunId || 'x'}_purchase`,
          },
        });
        return { result, requestId: result.requestId, auditRef: result?.executionResult?.audit_reference };
      }

      case 'AUDIT_TRANSACTION': {
        const txId = ctx.purchaseResult?.transaction_id;
        if (!txId) {
          // No purchase to audit — treat as PASS_WITH_WARNING
          return {
            result: { verdict: 'PASS_WITH_WARNING', findings: [{ code: 'NO_PURCHASE_TX', severity: 'WARNING', detail: 'No purchase transaction to audit' }] },
            requestId: null,
            auditRef: null,
          };
        }
        const result = await this.executor.submitAction({
          actionType: 'AUDIT_TRANSACTION',
          agentId,
          requesterId: agentId,
          payload: { transaction_id: txId },
        });
        return { result, requestId: result.requestId, auditRef: null };
      }

      case 'LEARNING_UPDATE': {
        // Learning is handled via _ingestStepLearning — this step is a no-op marker
        return { result: { status: 'learning_ingested', workflow_run_id: ctx._workflowRunId }, requestId: null, auditRef: null };
      }

      default:
        throw new Error(`Unknown capability in commerce loop: ${capabilityId}`);
    }
  }

  // ── Private: propagate step results into context ──────────────────

  _updateContext(ctx, capabilityId, result) {
    // Extract the actual execution result from the executor envelope
    const exec = result?.executionResult || result?.result || result;
    switch (capabilityId) {
      case 'ASSET.CREATE':
        ctx.marketItemId = exec?.marketItemId || exec?.id || exec?.market_item_id || null;
        break;
      case 'CALCULATE_ENERGY':
        ctx.energyResult = exec;
        break;
      case 'PRICE.QUOTE':
        ctx.priceResult = exec;
        break;
      case 'PURCHASE_ARTIFACT':
        ctx.purchaseResult = exec;
        break;
      case 'AUDIT_TRANSACTION':
        ctx.auditResult = exec;
        break;
    }
  }

  // ── Private: rollback rules ───────────────────────────────────────

  async _applyRollback(capabilityId, ctx, err, runRecord) {
    switch (capabilityId) {
      case 'ASSET.LIST':
        // Listing failed → no purchase. No financial state to roll back.
        return { flagged: false, reason: null };

      case 'PURCHASE_ARTIFACT':
        // Purchase failed → executor guarantees atomicity (ROLLBACK in handler).
        // No ownership, no partial credit. Just mark failed.
        return { flagged: false, reason: null };

      case 'AUDIT_TRANSACTION':
        // Audit failed → DO NOT auto-reverse completed financial state.
        // Flag for admin review.
        return {
          flagged: true,
          reason: `AUDIT_FAILED: ${err.message} — financial state NOT reversed; admin review required`,
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
      action_type: step.capability_id,
      workflow_run_id: workflowRunId,
      step_id: step.step_id,
      status: step.status,
      result_summary: exec,
      financial: ctx.purchaseResult || null,
      audit: ctx.auditResult || null,
    });
  }

  // ── Private: persistence (network_knowledge table) ─────────────────

  async _persistRun(runRecord) {
    // Store workflow state in network_knowledge as a WORKFLOW_RUN type
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO network_knowledge (subject, knowledge_type, value, confidence, source_table, network_id, valid_from, created_at)
         VALUES ($1, 'WORKFLOW_RUN', $2::jsonb, 1.0, 'commerce_loop', 'default', NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [
          `workflow:${runRecord.workflow_run_id}`,
          JSON.stringify({
            workflow_run_id: runRecord.workflow_run_id,
            workflow_id: runRecord.workflow_id,
            state: runRecord.state,
            steps: runRecord.steps.map(s => ({ step_id: s.step_id, status: s.status, error: s.error })),
            flags: runRecord.flags,
            started_at: runRecord.started_at,
            finished_at: runRecord.finished_at,
            error: runRecord.error,
          }),
        ]
      );
    } catch (err) {
      // Persistence failure must not crash the workflow itself
      console.warn(`⚠️ WorkflowPersist: ${err.message}`);
    }
  }
}

module.exports = { ArtifactCommerceLoop, WORKFLOW_STEPS, WF_STATES };
