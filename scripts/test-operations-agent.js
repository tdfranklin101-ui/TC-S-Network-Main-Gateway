#!/usr/bin/env node
/**
 * TC-S Network — Era 21.0
 * Operations Agent Development Test Harness
 *
 * DEVELOPMENT ONLY — do not expose in production navigation
 *
 * Usage:
 *   node scripts/test-operations-agent.js
 *   node scripts/test-operations-agent.js --test QUERY_MARKETPLACE
 *   node scripts/test-operations-agent.js --test TRANSFER_SOLAR   (expect REJECTED)
 *   node scripts/test-operations-agent.js --test REPLICATE_UNIVERSE (expect NOT_FOUND)
 *
 * Reads ADMIN_KEY from environment to authenticate.
 */

'use strict';

const http  = require('http');
const https = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL  = process.env.TCS_BASE_URL || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error('❌ ADMIN_KEY env var required');
  process.exit(1);
}

// Parse command-line args
const args     = process.argv.slice(2);
const testIdx  = args.indexOf('--test');
const singleTest = testIdx >= 0 ? args[testIdx + 1] : null;
const verbose  = args.includes('--verbose');

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key':  ADMIN_KEY,
      },
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Display helpers ─────────────────────────────────────────────────────────
const W = process.stdout.columns || 80;
const HR = '─'.repeat(W);

function header(title) {
  console.log('\n' + HR);
  console.log(`  ${title}`);
  console.log(HR);
}

function result(label, value, pass) {
  const icon = pass === true ? '✅' : pass === false ? '❌' : '📋';
  console.log(`  ${icon}  ${label.padEnd(30)} ${String(value).slice(0, 80)}`);
}

function printInvocationReport(label, res) {
  console.log(`\n  ── ${label} ──`);
  result('HTTP Status',    res.status);
  result('UIM Status',     res.body?.status    || '(none)', res.body?.status === 'SUCCEEDED' || res.body?.status === 'PENDING_APPROVAL');
  result('Request ID',     res.body?.request_id || '(none)');
  result('Capability ID',  res.body?.capability_id || '(none)');
  result('Risk Level',     res.body?.policy?.risk_level || '(none)');
  result('Approval Req',   res.body?.policy?.approval_required);
  result('Action Req ID',  res.body?.audit?.action_request_id || '(none)');
  result('Error',          res.body?.error || '(none)');
  if (verbose && res.body?.result) {
    console.log('  Result:', JSON.stringify(res.body.result, null, 2).split('\n').map(l => '    ' + l).join('\n'));
  }
}

// ─── Test definitions ────────────────────────────────────────────────────────
const TESTS = {

  // ── Test 1: Capability Discovery ──────────────────────────────────────────
  CAPABILITY_DISCOVERY: async () => {
    header('TEST 1: Capability Discovery — GET /api/uim/capabilities');
    const res = await request('GET', '/api/uim/capabilities');
    result('HTTP Status',   res.status,  res.status === 200);
    result('Has capabilities', Array.isArray(res.body?.capabilities), true);
    result('Total caps',    res.body?.total_capabilities || 0);
    result('Era',           res.body?.era);

    const caps = res.body?.capabilities || [];
    result('Only live caps', caps.every(c => c.status === 'live'), caps.length > 0);
    result('No factory (uim_enabled)', !caps.some(c => c.uim_operations_enabled === true && c.capability_id?.includes('factory')), true);

    const factoryBlocked = caps.filter(c => c.uim_operations_enabled === false);
    result('Factory blocked count', factoryBlocked.length);

    console.log('\n  Capability IDs in registry:');
    caps.slice(0, 15).forEach(c => console.log(`    • ${c.capability_id} [${c.risk_level}]`));
    if (caps.length > 15) console.log(`    ... and ${caps.length - 15} more`);

    return { pass: res.status === 200 && caps.length > 0, caps };
  },

  // ── Test 2: QUERY_NETWORK ─────────────────────────────────────────────────
  QUERY_NETWORK: async () => {
    header('TEST 2: QUERY_NETWORK — POST /api/uim/invoke');
    const res = await request('POST', '/api/uim/invoke', {
      agent_id:      'tcs-operations-agent-v1',
      capability_id: 'tcs.network.query',
      intent:        'List all active TC-S Networks for Operations Agent status check',
      parameters:    { networkId: 'all' },
      request_context: { test: true },
    });

    printInvocationReport('QUERY_NETWORK', res);
    const pass = [200, 202].includes(res.status) &&
      ['SUCCEEDED', 'PENDING_APPROVAL', 'RUNNING'].includes(res.body?.status);
    result('Overall',       pass ? 'PASS' : 'FAIL', pass);
    return { pass, requestId: res.body?.request_id };
  },

  // ── Test 3: QUERY_MARKETPLACE ─────────────────────────────────────────────
  QUERY_MARKETPLACE: async () => {
    header('TEST 3: QUERY_MARKETPLACE — POST /api/uim/invoke');
    const res = await request('POST', '/api/uim/invoke', {
      agent_id:      'tcs-operations-agent-v1',
      capability_id: 'tcs.marketplace.query',
      intent:        'Find available solar-powered artifacts in the TC-S Marketplace',
      parameters:    { limit: 5, category: 'any' },
    });

    printInvocationReport('QUERY_MARKETPLACE', res);
    const pass = [200, 202].includes(res.status) &&
      ['SUCCEEDED', 'PENDING_APPROVAL'].includes(res.body?.status);
    result('Overall', pass ? 'PASS' : 'FAIL', pass);
    return { pass, requestId: res.body?.request_id };
  },

  // ── Test 4: CALCULATE_ENERGY ──────────────────────────────────────────────
  CALCULATE_ENERGY: async () => {
    header('TEST 4: CALCULATE_ENERGY — POST /api/uim/invoke');
    const res = await request('POST', '/api/uim/invoke', {
      agent_id:      'tcs-operations-agent-v1',
      capability_id: 'tcs.solar.calculate_energy',
      intent:        'Calculate the energy equivalent for 10 Solar tokens',
      parameters:    { solarAmount: 10 },
    });

    printInvocationReport('CALCULATE_ENERGY', res);
    const pass = [200, 202].includes(res.status) &&
      ['SUCCEEDED', 'PENDING_APPROVAL'].includes(res.body?.status);
    result('Overall', pass ? 'PASS' : 'FAIL', pass);
    return { pass, requestId: res.body?.request_id };
  },

  // ── Test 5: GENERATE_REPORT ───────────────────────────────────────────────
  GENERATE_REPORT: async () => {
    header('TEST 5: GENERATE_REPORT — POST /api/uim/invoke');
    const res = await request('POST', '/api/uim/invoke', {
      agent_id:      'tcs-operations-agent-v1',
      capability_id: 'tcs.marketplace.generate_report',
      intent:        'Generate a marketplace activity summary for the Operations Agent',
      parameters:    { reportType: 'marketplace_summary', period: 'last_7_days' },
    });

    printInvocationReport('GENERATE_REPORT', res);
    const pass = [200, 202].includes(res.status) &&
      ['SUCCEEDED', 'PENDING_APPROVAL'].includes(res.body?.status);
    result('Overall', pass ? 'PASS' : 'FAIL', pass);
    return { pass, requestId: res.body?.request_id };
  },

  // ── Test 6: Policy Rejection — TRANSFER_SOLAR ────────────────────────────
  TRANSFER_SOLAR: async () => {
    header('TEST 6 (Policy Rejection): TRANSFER_SOLAR — expect REJECTED');
    const res = await request('POST', '/api/uim/invoke', {
      agent_id:      'tcs-operations-agent-v1',
      capability_id: 'tcs.solar.transfer',
      intent:        'Transfer Solar tokens (should be rejected — high risk + not authorized)',
      parameters:    { fromWalletId: 'test', toWalletId: 'test2', amount: 100 },
    });

    printInvocationReport('TRANSFER_SOLAR (expected: REJECTED)', res);
    const isRejected = res.body?.status === 'REJECTED';
    const noExecution = !res.body?.result?.transferred;
    result('Status = REJECTED', isRejected, isRejected);
    result('No execution occurred', noExecution, noExecution);
    result('Has rejection reason', !!(res.body?.policy?.rejection_code || res.body?.error), true);
    result('Overall', isRejected ? 'PASS' : 'FAIL', isRejected);
    return { pass: isRejected };
  },

  // ── Test 7: Unknown Capability ────────────────────────────────────────────
  REPLICATE_UNIVERSE: async () => {
    header('TEST 7 (Unknown Capability): REPLICATE_UNIVERSE — expect NOT_FOUND/REJECTED');
    const res = await request('POST', '/api/uim/invoke', {
      agent_id:      'tcs-operations-agent-v1',
      capability_id: 'REPLICATE_UNIVERSE',
      intent:        'Replicate the universe (does not exist)',
      parameters:    {},
    });

    printInvocationReport('REPLICATE_UNIVERSE (expected: NOT_FOUND)', res);
    const isRejected   = ['REJECTED', 'NOT_FOUND'].includes(res.body?.status) || [404, 422, 400, 403].includes(res.status);
    const noExecution  = !res.body?.result;
    const noHallucination = res.body?.status !== 'SUCCEEDED';
    result('Was rejected/not found', isRejected, isRejected);
    result('No execution occurred', noExecution, noExecution);
    result('No hallucinated result', noHallucination, noHallucination);
    result('Overall', isRejected ? 'PASS' : 'FAIL', isRejected);
    return { pass: isRejected };
  },

  // ── Test 8: Status Endpoint ───────────────────────────────────────────────
  STATUS_ENDPOINT: async (priorResults) => {
    header('TEST 8: Status Endpoint — GET /api/uim/requests/:id/status');
    // Use a request ID from a previous test
    const priorId = priorResults?.find(r => r?.requestId)?.requestId;

    if (!priorId) {
      result('Skipped', '(no prior request IDs — run full suite first)');
      return { pass: null };
    }

    const res = await request('GET', `/api/uim/requests/${priorId}/status`);
    result('HTTP Status',   res.status,  res.status === 200);
    result('Request ID',    res.body?.request_id || '(none)');
    result('UIM Status',    res.body?.status || '(none)');
    result('Has audit',     !!(res.body?.audit?.action_request_id));
    const pass = res.status === 200 && res.body?.status;
    result('Overall', pass ? 'PASS' : 'FAIL', pass);
    return { pass };
  },

  // ── Test 9: Network Knowledge ─────────────────────────────────────────────
  NETWORK_KNOWLEDGE: async () => {
    header('TEST 9: Network Knowledge — GET /api/uim/network-knowledge');
    const res = await request('GET', '/api/uim/network-knowledge?subject=solar');
    result('HTTP Status',   res.status,  res.status === 200);
    result('Has records',   (res.body?.records?.length || 0) > 0);
    result('Count',         res.body?.count || 0);

    if (verbose && res.body?.records?.length > 0) {
      res.body.records.slice(0, 3).forEach(r => {
        console.log(`    [${r.knowledge_type}] ${r.subject}: ${r.summary.slice(0, 80)}...`);
      });
    }
    const pass = res.status === 200;
    result('Overall', pass ? 'PASS' : 'FAIL', pass);
    return { pass };
  },
};

// ─── Main runner ─────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(W));
  console.log('  TC-S OPERATIONS AGENT — DEVELOPMENT TEST HARNESS');
  console.log('  Era 21.0 / DEVELOPMENT ONLY');
  console.log('  Base URL:', BASE_URL);
  console.log('═'.repeat(W));

  const priorResults = [];
  const summary = [];

  const testsToRun = singleTest
    ? { [singleTest]: TESTS[singleTest] || (() => { console.log(`❌ Unknown test: ${singleTest}`); return { pass: false }; }) }
    : TESTS;

  for (const [name, testFn] of Object.entries(testsToRun)) {
    try {
      const outcome = await testFn(priorResults);
      priorResults.push(outcome);
      summary.push({ name, ...outcome });
    } catch (err) {
      console.error(`\n  ❌ TEST ${name} threw error:`, err.message);
      priorResults.push({ pass: false });
      summary.push({ name, pass: false, error: err.message });
    }
  }

  // Summary
  header('TEST SUMMARY');
  let passed = 0, failed = 0, skipped = 0;
  for (const s of summary) {
    if (s.pass === true)  { passed++; result(s.name, 'PASS', true); }
    else if (s.pass === false) { failed++; result(s.name, s.error ? `FAIL (${s.error})` : 'FAIL', false); }
    else { skipped++; result(s.name, 'SKIP'); }
  }
  console.log(`\n  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);
  console.log(HR + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test harness error:', err);
  process.exit(1);
});
