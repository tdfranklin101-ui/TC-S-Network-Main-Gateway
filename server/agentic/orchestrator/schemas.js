/**
 * TC-S Network — Era 21.2
 * Orchestrator Schemas
 *
 * Defines runtime-neutral orchestration envelope formats.
 * These are NOT LLM prompt formats — they are Network intent envelopes.
 *
 * NO new LLM. All validation is deterministic.
 */

'use strict';

// ── ORCHESTRATION_TASK_V1 ─────────────────────────────────────────────────────
// A task envelope submitted by an external orchestrator expressing an intent.
const ORCHESTRATION_TASK_V1_SCHEMA = {
  $schema:     'http://json-schema.org/draft-07/schema#',
  $id:         'tcs:orchestration:task:v1',
  title:       'ORCHESTRATION_TASK_V1',
  description: 'Runtime-neutral intent envelope for external orchestrators',
  type:        'object',
  required:    ['task_id', 'principal', 'intent', 'constraints', 'requested_outcome'],
  properties:  {
    task_id:   { type: 'string', format: 'uuid' },
    principal: {
      type:     'object',
      required: ['type', 'id'],
      properties: {
        type: { type: 'string', enum: ['MEMBER', 'AGENT', 'NETWORK'] },
        id:   { type: 'string' },
      },
    },
    intent: { type: 'string', minLength: 1, maxLength: 1000 },
    constraints: {
      type: 'object',
      properties: {
        max_risk_level:       { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        max_solar_spend:      { type: ['number', 'null'], minimum: 0 },
        deadline:             { type: ['string', 'null'] },
        physical_execution:   { type: 'boolean' },
        require_idempotency:  { type: 'boolean' },
      },
    },
    requested_outcome: {
      type:     'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: [
            'ARTIFACT_CREATED',
            'ARTIFACT_LISTED',
            'ARTIFACT_PURCHASED',
            'TRANSACTION_SETTLED',
            'NETWORK_CREATED',
            'REPORT_GENERATED',
            'KNOWLEDGE_RECORDED',
          ],
        },
        verification_criteria: { type: 'object' },
      },
    },
    context:  { type: 'object' },
    metadata: { type: 'object' },
  },
};

// ── ORCHESTRATION_PLAN_V1 ─────────────────────────────────────────────────────
// A concrete execution plan: ordered capability invocations with parameter mapping.
const ORCHESTRATION_PLAN_V1_SCHEMA = {
  $schema:     'http://json-schema.org/draft-07/schema#',
  $id:         'tcs:orchestration:plan:v1',
  title:       'ORCHESTRATION_PLAN_V1',
  description: 'Ordered capability execution plan. ONE workflow_run_id, MANY request_ids.',
  type:        'object',
  required:    ['task_id', 'workflow_run_id', 'workflow_type', 'steps'],
  properties:  {
    task_id:         { type: 'string', format: 'uuid' },
    workflow_run_id: { type: 'string' },
    workflow_type:   { type: 'string' },
    principal:       {
      type: 'object',
      properties: {
        type: { type: 'string' },
        id:   { type: 'string' },
      },
    },
    constraints: { type: 'object' },
    steps: {
      type:     'array',
      minItems: 1,
      items: {
        type:     'object',
        required: ['sequence', 'capability_id'],
        properties: {
          sequence:        { type: 'integer', minimum: 1 },
          capability_id:   { type: 'string' },
          version:         { type: 'string', default: '1.0' },
          parameters:      { type: 'object' },
          parameters_from: {
            type:  'array',
            items: { type: 'string' },
            description: 'e.g. ["step:1"] — inherit output from step N',
          },
          optional: { type: 'boolean', default: false },
        },
      },
    },
    metadata: { type: 'object' },
  },
};

// ── OUTCOME TYPES ─────────────────────────────────────────────────────────────
const OUTCOME_TYPES = Object.freeze({
  ARTIFACT_CREATED:      'ARTIFACT_CREATED',
  ARTIFACT_LISTED:       'ARTIFACT_LISTED',
  ARTIFACT_PURCHASED:    'ARTIFACT_PURCHASED',
  TRANSACTION_SETTLED:   'TRANSACTION_SETTLED',
  NETWORK_CREATED:       'NETWORK_CREATED',
  REPORT_GENERATED:      'REPORT_GENERATED',
  KNOWLEDGE_RECORDED:    'KNOWLEDGE_RECORDED',
});

// ── OUTCOME VERIFICATION ──────────────────────────────────────────────────────
// For each outcome type, defines what authoritative records must exist for success.
const OUTCOME_VERIFICATION_RULES = {
  ARTIFACT_LISTED: {
    description: 'artifact exists + listing active + audit trace exists',
    checks: ['artifact_exists', 'listing_active', 'audit_trace_exists'],
  },
  ARTIFACT_PURCHASED: {
    description: 'ownership record exists + transaction settled',
    checks: ['ownership_exists', 'transaction_settled'],
  },
  ARTIFACT_CREATED: {
    description: 'artifact row exists in market_items',
    checks: ['artifact_exists'],
  },
  TRANSACTION_SETTLED: {
    description: 'transaction settled + ledger balanced',
    checks: ['transaction_settled', 'ledger_balanced'],
  },
  NETWORK_CREATED: {
    description: 'network_specs row exists',
    checks: ['network_exists'],
  },
  REPORT_GENERATED: {
    description: 'report artifact or knowledge record exists',
    checks: ['knowledge_recorded'],
  },
  KNOWLEDGE_RECORDED: {
    description: 'network_knowledge record exists',
    checks: ['knowledge_recorded'],
  },
};

// ── SIDE EFFECT CLASSES ───────────────────────────────────────────────────────
const SIDE_EFFECT_CLASSES = Object.freeze([
  'NONE',
  'READ_ONLY',
  'ECONOMIC',
  'IDENTITY',
  'CONTENT',
  'NETWORK_CONFIGURATION',
  'PHYSICAL',
]);

// ── EXECUTION MODES ───────────────────────────────────────────────────────────
const EXECUTION_MODES = Object.freeze(['SYNC', 'ASYNC', 'APPROVAL_GATED']);

// ── ARTIFACT_COMMERCE_LOOP_V1 as ORCHESTRATION_PLAN_V1 ───────────────────────
// Proves the plan format can describe something the Network already executes.
function buildCommerceLoopReferencePlan(overrides = {}) {
  const workflowRunId = `wf_${Date.now()}_ref`;
  return {
    task_id:         overrides.task_id  || '00000000-0000-0000-0000-000000000001',
    workflow_run_id: overrides.workflow_run_id || workflowRunId,
    workflow_type:   'ARTIFACT_COMMERCE_LOOP_V1',
    principal: overrides.principal || { type: 'AGENT', id: 'tcs-operations-agent-v1' },
    constraints: {
      max_risk_level:     'medium',
      physical_execution: false,
    },
    steps: [
      { sequence: 1, capability_id: 'tcs.marketplace.asset_create',  version: '1.0', parameters: {} },
      { sequence: 2, capability_id: 'tcs.solar.calculate_energy',     version: '1.0', parameters_from: ['step:1'] },
      { sequence: 3, capability_id: 'tcs.marketplace.price_quote',    version: '1.0', parameters_from: ['step:1'] },
      { sequence: 4, capability_id: 'tcs.marketplace.asset_enrich',   version: '1.0', parameters_from: ['step:1', 'step:2'] },
      { sequence: 5, capability_id: 'tcs.marketplace.asset_list',     version: '1.0', parameters_from: ['step:1'] },
      { sequence: 6, capability_id: 'tcs.marketplace.purchase',       version: '1.0', parameters_from: ['step:5'] },
      { sequence: 7, capability_id: 'tcs.solar.audit_transaction',    version: '1.0', parameters_from: ['step:6'] },
      { sequence: 8, capability_id: 'tcs.capability_discovery',       version: '1.0', parameters: { type: 'LEARNING_UPDATE' }, optional: true },
    ],
    metadata: {
      reference_plan: true,
      era:            '21.2',
      note:           'Proves ORCHESTRATION_PLAN_V1 can describe ARTIFACT_COMMERCE_LOOP_V1',
    },
  };
}

module.exports = {
  ORCHESTRATION_TASK_V1_SCHEMA,
  ORCHESTRATION_PLAN_V1_SCHEMA,
  OUTCOME_TYPES,
  OUTCOME_VERIFICATION_RULES,
  SIDE_EFFECT_CLASSES,
  EXECUTION_MODES,
  buildCommerceLoopReferencePlan,
};
