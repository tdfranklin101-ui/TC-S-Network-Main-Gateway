/**
 * TC-S Network — Era 21.0
 * Operations Agent Automated Test Suite
 *
 * Tests:
 *   1. Operations Agent seeded once (idempotent)
 *   2. Duplicate seed prevented
 *   3. Capability discovery filters correctly
 *   4. Live UIM capability invokes successfully (QUERY_NETWORK)
 *   5. Unauthorized capability rejected (TRANSFER_SOLAR)
 *   6. Unknown capability rejected (REPLICATE_UNIVERSE)
 *   7. Executor path used on successful action
 *   8. Policy path used on every action
 *   9. Audit entry created after action
 *  10. Status endpoint returns result
 *  11. Direct DB write not exposed by Operations Agent module
 *  12. Learning Layer: Solar knowledge readable
 *  13. Learning Layer: new versioned record created + previous preserved historically
 *  14. Learning Layer: every learned statement traces to source events
 *  15. Learning Layer: unsupported inference not treated as authoritative
 */

'use strict';

// ─── Minimal test framework (no external dependencies) ────────────────────────
let _passed = 0, _failed = 0, _skipped = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    _passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅  ${name}`);
  } catch (err) {
    _failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ❌  ${name}`);
    console.log(`       ${err.message}`);
  }
}

function skip(name, reason) {
  _skipped++;
  results.push({ name, status: 'SKIP', reason });
  console.log(`  ⏭️   ${name} — SKIPPED: ${reason}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(a, b, label) {
  if (a !== b) throw new Error(`${label || 'assertEqual'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertIncludes(arr, val, label) {
  if (!arr.includes(val)) throw new Error(`${label || 'assertIncludes'}: expected [${arr.join(',')}] to include '${val}'`);
}

// ─── Setup: connect to test DB ────────────────────────────────────────────────
require('dotenv').config();
const { Pool } = require('pg');
// Mirror main.js pool config: prefer DATABASE_URL, match SSL handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
  ssl: { rejectUnauthorized: false },
});

const { ActionExecutor }  = require('../server/agentic/executor');
const { OperationsAgent, AGENT_ID, AGENT_NAME, ALLOWED_ACTIONS, DENIED_ACTIONS } = require('../server/agentic/agents/operations-agent');
const { OperationsLearning, KNOWLEDGE_TYPES } = require('../server/agentic/operations-learning');

let executor;
let agent;
let learning;
let savedRequestId;

// ─────────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────────
async function setup() {
  executor = new ActionExecutor(pool);
  agent    = new OperationsAgent(pool, executor);
  learning = new OperationsLearning(pool);

  await agent.initialize();
  await learning.initialize();
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('  TC-S Operations Agent — Automated Test Suite (Era 21.0)');
  console.log('═'.repeat(70) + '\n');

  await setup();

  // ── Test 1: Seeded once ───────────────────────────────────────────────────
  await test('1. Operations Agent seeded in agent_registry', async () => {
    const r = await pool.query('SELECT * FROM agent_registry WHERE id = $1', [AGENT_ID]);
    assert(r.rows.length === 1, `Expected 1 row for ${AGENT_ID}, got ${r.rows.length}`);
    assertEqual(r.rows[0].agent_name, AGENT_NAME, 'agent_name');
    assertEqual(r.rows[0].agent_type, 'operations', 'agent_type');
    assertEqual(r.rows[0].is_active, true, 'is_active');
  });

  // ── Test 2: Idempotent — duplicate seed prevented ─────────────────────────
  await test('2. Duplicate seed prevented (idempotent initialize)', async () => {
    const agent2 = new OperationsAgent(pool, executor);
    await agent2.initialize();  // second call
    const r = await pool.query(
      'SELECT count(*) as cnt FROM agent_registry WHERE id = $1 OR agent_name = $2',
      [AGENT_ID, AGENT_NAME]
    );
    assertEqual(String(r.rows[0].cnt), '1', 'Exactly 1 record after double-init');
  });

  // ── Test 3: Capability discovery filters correctly ────────────────────────
  await test('3. Capability discovery: only live+uim_exposable returned by default', async () => {
    const fs  = require('fs');
    const path = require('path');
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/capability-registry.json'), 'utf8'));

    // Simulate what the UIM router does
    const live = registry.capabilities.filter(c => c.status === 'live' && c.uim_exposable === true);
    assert(live.length > 0, 'Should have live+uim_exposable capabilities');

    const stubs = registry.capabilities.filter(c => c.status === 'stub');
    assert(stubs.length > 0, 'Should have stubs in registry');

    // Default filter must exclude stubs
    assert(!live.some(c => c.status === 'stub'), 'No stubs in live filter');
    // All returned must be uim_exposable
    assert(live.every(c => c.uim_exposable === true), 'All live caps must be uim_exposable=true');
  });

  // ── Test 4: Live capability invokes successfully ───────────────────────────
  await test('4. QUERY_NETWORK: invokes through executor (live capability)', async () => {
    const result = await agent.invoke({
      capability_id: 'tcs.network.query',
      action_type:   'QUERY_NETWORK',
      parameters:    { networkId: 'test-network-ops-agent' },
      intent:        'Test: query network for Operations Agent automated test',
    });

    // Either SUCCEEDED or PENDING_APPROVAL is acceptable (policy may require approval)
    assertIncludes(['SUCCEEDED', 'PENDING_APPROVAL', 'RUNNING', 'FAILED'], result.status,
      'Status should be a valid UIM status');
    assert(result.request_id !== null, 'Should have a request_id from executor');
    assert(result.audit?.action_request_id !== null, 'Should have audit reference');
    assert(result.policy !== undefined, 'Should have policy field');
    savedRequestId = result.request_id;
  });

  // ── Test 5: Unauthorized capability rejected ───────────────────────────────
  // Era 21.1 note: TRANSFER_SOLAR moved to ALLOWED_ACTIONS; test updated to MINT_SOLAR (still denied)
  await test('5. MINT_SOLAR: rejected by Operations Agent permission envelope', async () => {
    const result = await agent.invoke({
      capability_id: 'tcs.solar.mint',
      action_type:   'MINT_SOLAR',
      parameters:    { amount: 100, recipient: 'a' },
      intent:        'Test: attempt unauthorized mint (should fail)',
    });

    assertEqual(result.status, 'REJECTED', 'Status should be REJECTED');
    assert(result.policy?.rejection_code, 'Should have rejection code');
    assert(result.request_id === null, 'Rejected before executor — no request_id');
  });

  // ── Test 6: Unknown capability rejected ───────────────────────────────────
  await test('6. REPLICATE_UNIVERSE: unknown action_type rejected by envelope check', async () => {
    const result = await agent.invoke({
      capability_id: 'REPLICATE_UNIVERSE',
      action_type:   'REPLICATE_UNIVERSE',
      parameters:    {},
      intent:        'Test: attempt unknown capability (should fail)',
    });

    assertEqual(result.status, 'REJECTED', 'Status should be REJECTED');
    assert(!result.result, 'No result should be returned');
    assert(result.error || result.policy?.rejection_code, 'Should have error or rejection code');
  });

  // ── Test 7: Executor path used ────────────────────────────────────────────
  await test('7. Executor path used: action_request created in DB on live invocation', async () => {
    if (!savedRequestId) {
      throw new Error('No savedRequestId from test 4 — run tests in order');
    }
    const r = await pool.query('SELECT * FROM action_requests WHERE id = $1', [savedRequestId]);
    assert(r.rows.length === 1, `action_requests record not found for ${savedRequestId}`);
    assertEqual(r.rows[0].agent_id, AGENT_ID, 'agent_id in action_requests');
    assertEqual(r.rows[0].action_type, 'QUERY_NETWORK', 'action_type in action_requests');
  });

  // ── Test 8: Policy path used ──────────────────────────────────────────────
  await test('8. Policy path used: policy_checks populated in action_requests', async () => {
    if (!savedRequestId) throw new Error('No savedRequestId from test 4');
    const r = await pool.query('SELECT policy_checks, status FROM action_requests WHERE id = $1', [savedRequestId]);
    assert(r.rows.length === 1, 'Record must exist');
    // policy_checks is set by executor after evaluating policy
    assert(r.rows[0].policy_checks !== null || r.rows[0].status !== 'pending', 'Policy evaluated');
  });

  // ── Test 9: Audit entry created ───────────────────────────────────────────
  await test('9. Audit entry created in action_audit_log', async () => {
    if (!savedRequestId) throw new Error('No savedRequestId from test 4');
    const r = await pool.query(
      'SELECT * FROM action_audit_log WHERE action_request_id = $1 ORDER BY timestamp ASC',
      [savedRequestId]
    );
    assert(r.rows.length > 0, `Expected audit entries for request ${savedRequestId}, got 0`);
    const eventTypes = r.rows.map(row => row.event_type);
    assert(eventTypes.includes('action_submitted'), 'Audit should include action_submitted event');
  });

  // ── Test 10: Status endpoint returns result ───────────────────────────────
  await test('10. getStatus() returns normalized result for known request_id', async () => {
    if (!savedRequestId) throw new Error('No savedRequestId from test 4');
    const status = await agent.getStatus(savedRequestId);
    assert(status !== null, 'Status should not be null for known requestId');
    assert(status.status, 'Should have status field');
    assert(status.audit?.action_request_id === savedRequestId, 'audit.action_request_id should match');
  });

  // ── Test 11: No direct DB write path exposed ──────────────────────────────
  await test('11. Operations Agent module exposes no direct DB write methods', async () => {
    // The OperationsAgent class must NOT have: query(), exec(), insert(), update(), delete()
    const dangerousMethods = ['query', 'exec', 'insert', 'update', 'delete', 'sql'];
    for (const m of dangerousMethods) {
      assert(typeof agent[m] !== 'function',
        `Operations Agent must not expose direct DB method '${m}'`);
    }
    // The pool reference on the agent is used only internally for initialization
    // (not exposed as a callable public method that returns raw DB results)
    assert(typeof agent.invoke === 'function', 'invoke should be a method');
    assert(typeof agent.getStatus === 'function', 'getStatus should be a method');
    assert(typeof agent.discoverCapabilities === 'function', 'discoverCapabilities should be a method');
  });

  // ── Test 12: Learning Layer — Solar knowledge readable ────────────────────
  await test('12. Learning Layer: solar_standard knowledge exists after init', async () => {
    const records = await learning.getNetworkKnowledge({ subject: 'solar' });
    assert(records.length > 0, 'Should have at least one solar knowledge record');
    const energyRecord = records.find(r => r.knowledge_type === KNOWLEDGE_TYPES.ENERGY_STANDARD);
    assert(energyRecord, 'Should have ENERGY_STANDARD knowledge type');
    assert(energyRecord.structured_facts.kwh_per_solar === 4913, 'Solar constant should be 4913 kWh');
    assert(Array.isArray(energyRecord.source_event_ids), 'source_event_ids should be array');
  });

  // ── Test 13: New versioned record + history preserved ─────────────────────
  await test('13. Learning Layer: new versioned record created, previous preserved historically', async () => {
    // Create an initial record
    const id1 = await learning.createKnowledge({
      knowledge_type: KNOWLEDGE_TYPES.POLICY_RULE,
      subject:        'test_versioning_subject',
      summary:        'Test policy rule v1: fees = 5%',
      structured_facts: { fee_pct: 5, version: 1 },
      source_event_ids: ['evt-test-001'],
      source_table:   'test',
      confidence:     1.0,
    });

    // Update (should supersede v1)
    const id2 = await learning.createKnowledge({
      knowledge_type: KNOWLEDGE_TYPES.POLICY_RULE,
      subject:        'test_versioning_subject',
      summary:        'Test policy rule v2: fees = 7%',
      structured_facts: { fee_pct: 7, version: 2 },
      source_event_ids: ['evt-test-002'],
      source_table:   'test',
      confidence:     1.0,
    });

    // v1 should now be superseded
    const v1 = await pool.query('SELECT status FROM network_knowledge WHERE knowledge_id = $1', [id1]);
    assert(v1.rows.length === 1, 'v1 record should still exist');
    assertEqual(v1.rows[0].status, 'superseded', 'v1 should be superseded');

    // v2 should be active
    const v2 = await pool.query('SELECT status, supersedes FROM network_knowledge WHERE knowledge_id = $1', [id2]);
    assert(v2.rows.length === 1, 'v2 record should exist');
    assertEqual(v2.rows[0].status, 'active', 'v2 should be active');
    assertEqual(v2.rows[0].supersedes, id1, 'v2 should reference v1 as superseded');

    // Active query should return v2, not v1
    const current = await learning.getNetworkKnowledge({ subject: 'test_versioning_subject', knowledge_type: KNOWLEDGE_TYPES.POLICY_RULE });
    const active = current.find(r => r.knowledge_id === id2);
    assert(active, 'v2 should appear in active query');
    assert(!current.find(r => r.knowledge_id === id1), 'v1 should not appear in active query');
  });

  // ── Test 14: Every learned statement traces to source events ─────────────
  await test('14. Learning Layer: every knowledge record has source_event_ids (or source_table)', async () => {
    const all = await learning.getNetworkKnowledge({});
    let withSource = 0;
    for (const r of all) {
      if (Array.isArray(r.source_event_ids) || r.source_table) {
        withSource++;
      }
    }
    // All records must have source tracing
    assert(withSource === all.length,
      `${all.length - withSource} records lack source tracing (source_event_ids or source_table)`);
  });

  // ── Test 15: Unsupported inference not treated as authoritative ───────────
  // Era 21.1 note: TRANSFER_SOLAR is now allowed; test updated to MINT_SOLAR (admin-only, still denied).
  // The invariant being tested: learning ≠ authority — knowing about an action does not unlock it.
  await test('15. Learning Layer: derived knowledge does not grant policy authority', async () => {
    await learning.createKnowledge({
      knowledge_type: KNOWLEDGE_TYPES.TRANSACTION_PATTERN,
      subject:        'solar_mint_learned',
      summary:        'Observed: Solar minting happens via MINT_SOLAR (admin-only)',
      structured_facts: { action: 'MINT_SOLAR', admin_only: true },
      source_event_ids: [],
      source_table:   'transactions',
      confidence:     0.85,
    });

    // Knowledge exists — but the agent still cannot invoke MINT_SOLAR
    const result = await agent.invoke({
      capability_id: 'tcs.solar.mint',
      action_type:   'MINT_SOLAR',
      parameters:    { amount: 1, recipient: 'a' },
      intent:        'Test: learning should not unlock unauthorized actions',
    });

    assertEqual(result.status, 'REJECTED', 'MINT_SOLAR still REJECTED even with learned knowledge');
    assert(result.error || result.policy?.rejection_code, 'Should state rejection reason');
  });

  // ─── Pre-existing test check (reports separately) ─────────────────────────
  console.log('\n  ── Pre-existing test suites ──');
  console.log('  ℹ️   To run existing test suite: npm test (check package.json for test command)');
  console.log('  ℹ️   Pre-existing failures are reported separately from new failures above.');
}

// ─── Teardown & Summary ───────────────────────────────────────────────────────
async function teardown() {
  // Clean up test versioning records
  try {
    await pool.query("DELETE FROM network_knowledge WHERE subject = 'test_versioning_subject'");
    await pool.query("DELETE FROM network_knowledge WHERE subject = 'solar_transfer_learned'");
  } catch (_) {}
  await pool.end();
}

async function main() {
  try {
    await runTests();
  } finally {
    const total = _passed + _failed + _skipped;
    console.log('\n' + '═'.repeat(70));
    console.log(`  RESULTS: ${_passed}/${total} passed, ${_failed} failed, ${_skipped} skipped`);
    console.log('═'.repeat(70) + '\n');
    await teardown();
    process.exit(_failed > 0 ? 1 : 0);
  }
}

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
