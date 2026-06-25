'use strict';
// ====================================================================
// Automated checks for the Energetic-Ethical Alignment (EIA) feature.
//
// Run with:  node tests/eia.test.js
// Optional:  TEST_BASE_URL=http://localhost:5000 node tests/eia.test.js
//
// Part 1 (always runs): unit checks of services/SAiUIMLayer.js with a
//   mocked global.fetch — verifies the live/blocked/unavailable behavior
//   and that the layer never fabricates an alignment score.
// Part 2 (best-effort): HTTP checks of GET /api/artifacts/:id/eia against
//   a locally-running server. Skipped automatically if no server is up.
// ====================================================================

const assert = require('assert');
const SAiUIM = require('../services/SAiUIMLayer.js');

let passed = 0;
let failed = 0;

const realFetch = global.fetch;
function mockFetch(impl) { global.fetch = impl; }
function restoreFetch() { global.fetch = realFetch; }

async function test(name, fn) {
  try {
    await fn();
    console.log('  \u2713 ' + name);
    passed++;
  } catch (e) {
    console.error('  \u2717 ' + name + '\n    ' + (e && e.message));
    failed++;
  } finally {
    // Guarantee no mocked fetch leaks into the next test, even on failure.
    restoreFetch();
  }
}

(async () => {
  if (typeof realFetch !== 'function') {
    console.error('global fetch is not available in this Node runtime; cannot run checks.');
    process.exit(1);
  }

  console.log('SAi UIM alignment \u2014 unit checks');

  await test('approved metric is returned verbatim (live path)', async () => {
    mockFetch(async () => ({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({
        uim_metric: { alignment_score: 0.91, approval_threshold: 0.62, approved: true, indices_freshness: { live: true } },
        rendered_text: 'aligned',
      }),
    }));
    const r = await SAiUIM.requestUimMetric({ artifact_id: 'a1' }, 'inspect', { strict: false });
    restoreFetch();
    assert.ok(!r.error, 'should not be an error envelope');
    assert.strictEqual(r.uim_metric.approved, true);
    assert.strictEqual(r.uim_metric.alignment_score, 0.91);
  });

  await test('blocked metric (approved:false) is passed through, not overridden', async () => {
    mockFetch(async () => ({
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({
        uim_metric: { alignment_score: 0.40, approval_threshold: 0.62, approved: false },
        rendered_text: 'misaligned',
      }),
    }));
    const r = await SAiUIM.requestUimMetric({ artifact_id: 'a2' }, 'inspect', { strict: false });
    restoreFetch();
    assert.strictEqual(r.uim_metric.approved, false);
    assert.ok(r.uim_metric.alignment_score < r.uim_metric.approval_threshold);
  });

  await test('permissive mode on service error returns unavailable envelope, never a fake score', async () => {
    mockFetch(async () => ({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) }));
    const r = await SAiUIM.requestUimMetric({ artifact_id: 'a3' }, 'inspect', { strict: false });
    restoreFetch();
    assert.strictEqual(r.error, true);
    assert.strictEqual(r.uim_metric, null, 'must not invent a metric when the layer is down');
    assert.ok(/UNAVAILABLE/.test(r.rendered_text || ''));
  });

  await test('strict mode on service error throws (so checkout can block)', async () => {
    mockFetch(async () => { throw new Error('network down'); });
    let threw = false;
    try {
      await SAiUIM.requestUimMetric({ artifact_id: 'a4' }, 'purchase', { strict: true });
    } catch (e) {
      threw = true;
    }
    restoreFetch();
    assert.strictEqual(threw, true, 'strict mode must propagate the failure');
  });

  await test('mergeUimMetricIntoReport folds patch + rendered text into report', async () => {
    const merged = SAiUIM.mergeUimMetricIntoReport(
      { existing: 1 },
      { lifelens_report_patch: { uim_alignment: { score: 0.7 } }, rendered_text: 'hello' }
    );
    assert.strictEqual(merged.existing, 1);
    assert.deepStrictEqual(merged.uim_alignment, { score: 0.7 });
    assert.strictEqual(merged.uim_rendered, 'hello');
  });

  // ---- Part 2: best-effort HTTP integration against a running server ----
  const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
  let serverUp = false;
  try {
    const ping = await realFetch(BASE + '/', { method: 'GET' });
    serverUp = ping.ok;
  } catch (_) { /* server not running */ }

  if (!serverUp) {
    console.log('\nHTTP integration \u2014 SKIPPED (no server reachable at ' + BASE + ')');
  } else {
    console.log('\nHTTP integration \u2014 GET /api/artifacts/:id/eia');

    await test('invalid artifact id \u2192 400', async () => {
      const res = await realFetch(BASE + '/api/artifacts/not-a-uuid/eia');
      assert.strictEqual(res.status, 400);
    });

    await test('real artifact id \u2192 200 with EIA shape', async () => {
      const list = await realFetch(BASE + '/api/artifacts/available?limit=1');
      const data = await list.json();
      const arr = data.artifacts || data.items || (Array.isArray(data) ? data : []);
      const id = Array.isArray(arr) && arr[0] && (arr[0].id || arr[0].artifactId);
      if (!id) {
        console.log('    (no artifacts available to test; shape assertion skipped)');
        return;
      }
      const res = await realFetch(BASE + '/api/artifacts/' + id + '/eia');
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok('available' in body, 'response must always carry an "available" flag');
      if (body.available) {
        for (const key of ['approved', 'alignmentScore', 'approvalThreshold', 'rendered', 'source']) {
          assert.ok(key in body, 'missing key: ' + key);
        }
      }
    });
  }

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
