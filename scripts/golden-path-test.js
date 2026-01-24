#!/usr/bin/env node
/**
 * Golden Path Smoke Test - TC-S Network Foundation
 * 
 * Tests the complete asset-to-settlement flow:
 * 1. Create Asset (photo + text)
 * 2. Enrich Asset (AI metadata)
 * 3. Price Quote
 * 4. Publish Listing
 * 5. Create Order
 * 6. Capture Payment / Token debit
 * 7. Fulfill (QR pickup or staff confirm)
 * 8. Ledger Post (append-only)
 * 9. Settlement (split + tax bucket + microfees)
 */

const http = require('http');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'test-admin-key';
const TEST_USER_ID = process.env.TEST_USER_ID || '1';
const TEST_SESSION_TOKEN = process.env.TEST_SESSION_TOKEN || 'test-session';

const results = {
  passed: 0,
  failed: 0,
  steps: []
};

function log(step, status, message, data = null) {
  const entry = { step, status, message, timestamp: new Date().toISOString(), data };
  results.steps.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`${icon} [${step}] ${message}`);
  if (data && status === 'FAIL') {
    console.log('   Error:', JSON.stringify(data, null, 2).substring(0, 200));
  }
}

async function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3002,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin': 'true',
        'X-Admin-Key': ADMIN_KEY,
        'X-Session-Token': TEST_SESSION_TOKEN,
        'X-Req-Id': crypto.randomUUID(),
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function step1_createAsset() {
  log('1. ASSET.CREATE', 'RUN', 'Creating test asset...');
  
  const asset = {
    userId: TEST_USER_ID,
    asset: {
      title: `Test Asset ${Date.now()}`,
      description: 'Golden Path smoke test asset',
      category: 'computronium',
      condition: 'new',
      imageUrl: 'https://example.com/test-image.jpg',
      attributes: {
        type: 'test',
        energyKwh: 10
      }
    }
  };

  try {
    const res = await request('POST', '/api/agentic/marketplace/asset', asset);
    if (res.status === 200 && res.data.success) {
      const assetId = res.data.result?.assetId || res.data.actionRequestId;
      log('1. ASSET.CREATE', 'PASS', `Asset created: ${assetId}`, res.data);
      results.passed++;
      return assetId;
    } else {
      log('1. ASSET.CREATE', 'FAIL', 'Failed to create asset', res.data);
      results.failed++;
      return null;
    }
  } catch (error) {
    log('1. ASSET.CREATE', 'FAIL', error.message);
    results.failed++;
    return null;
  }
}

async function step2_enrichAsset(assetId) {
  log('2. ASSET.ENRICH', 'RUN', `Enriching asset ${assetId}...`);
  
  if (!assetId) {
    log('2. ASSET.ENRICH', 'FAIL', 'No asset ID from previous step');
    results.failed++;
    return false;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/enrich', { assetId });
    if (res.status === 200 && res.data.success) {
      log('2. ASSET.ENRICH', 'PASS', 'Asset enriched successfully', res.data);
      results.passed++;
      return true;
    } else {
      log('2. ASSET.ENRICH', 'FAIL', 'Enrichment failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('2. ASSET.ENRICH', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function step3_priceQuote(assetId) {
  log('3. PRICE.QUOTE', 'RUN', `Getting price quote for ${assetId}...`);
  
  if (!assetId) {
    log('3. PRICE.QUOTE', 'FAIL', 'No asset ID');
    results.failed++;
    return null;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/price/quote', { 
      assetId, 
      networkId: 'default' 
    });
    if (res.status === 200 && res.data.success) {
      const quote = res.data.result?.quote || res.data.result;
      log('3. PRICE.QUOTE', 'PASS', `Price quote: ${quote?.displayPrice || quote?.priceSolar} Solar`, res.data);
      results.passed++;
      return quote;
    } else {
      log('3. PRICE.QUOTE', 'FAIL', 'Quote failed', res.data);
      results.failed++;
      return null;
    }
  } catch (error) {
    log('3. PRICE.QUOTE', 'FAIL', error.message);
    results.failed++;
    return null;
  }
}

async function step4_publishPrice(assetId, priceSolar) {
  log('4. PRICE.PUBLISH', 'RUN', `Publishing price ${priceSolar} Solar...`);
  
  if (!assetId) {
    log('4. PRICE.PUBLISH', 'FAIL', 'No asset ID');
    results.failed++;
    return false;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/price/publish', { 
      assetId, 
      priceSolar: priceSolar || 10.0 
    });
    if (res.status === 200 && res.data.success) {
      log('4. PRICE.PUBLISH', 'PASS', 'Price published', res.data);
      results.passed++;
      return true;
    } else {
      log('4. PRICE.PUBLISH', 'FAIL', 'Publish failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('4. PRICE.PUBLISH', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function step5_listAsset(assetId) {
  log('5. LISTING.PUBLISH', 'RUN', `Listing asset ${assetId}...`);
  
  if (!assetId) {
    log('5. LISTING.PUBLISH', 'FAIL', 'No asset ID');
    results.failed++;
    return false;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/list', { assetId });
    if (res.status === 200 && res.data.success) {
      log('5. LISTING.PUBLISH', 'PASS', 'Asset listed', res.data);
      results.passed++;
      return true;
    } else {
      log('5. LISTING.PUBLISH', 'FAIL', 'Listing failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('5. LISTING.PUBLISH', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function step6_createOrder(assetId) {
  log('6. ORDER.CREATE', 'RUN', `Creating order for ${assetId}...`);
  
  if (!assetId) {
    log('6. ORDER.CREATE', 'FAIL', 'No asset ID');
    results.failed++;
    return null;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/order', {
      items: [{ assetId, quantity: 1 }],
      paymentMethod: 'solar',
      pickupPreference: 'in_store'
    });
    if (res.status === 200 && res.data.success) {
      const orderId = res.data.result?.orderId;
      const verificationCode = res.data.result?.verificationCode;
      log('6. ORDER.CREATE', 'PASS', `Order created: ${orderId}, code: ${verificationCode}`, res.data);
      results.passed++;
      return { orderId, verificationCode };
    } else {
      log('6. ORDER.CREATE', 'FAIL', 'Order creation failed', res.data);
      results.failed++;
      return null;
    }
  } catch (error) {
    log('6. ORDER.CREATE', 'FAIL', error.message);
    results.failed++;
    return null;
  }
}

async function step7_capturePayment(orderId) {
  log('7. PAYMENT.CAPTURE', 'RUN', `Capturing payment for order ${orderId}...`);
  
  if (!orderId) {
    log('7. PAYMENT.CAPTURE', 'FAIL', 'No order ID');
    results.failed++;
    return false;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/capture-payment', {
      orderId,
      paymentIntentId: `pi_test_${Date.now()}`,
      solarAmount: 10.0
    });
    if (res.status === 200 && res.data.success) {
      log('7. PAYMENT.CAPTURE', 'PASS', 'Payment captured', res.data);
      results.passed++;
      return true;
    } else {
      log('7. PAYMENT.CAPTURE', 'FAIL', 'Payment capture failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('7. PAYMENT.CAPTURE', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function step8_fulfillOrder(orderId, verificationCode) {
  log('8. FULFILLMENT.CONFIRM', 'RUN', `Fulfilling order ${orderId}...`);
  
  if (!orderId) {
    log('8. FULFILLMENT.CONFIRM', 'FAIL', 'No order ID');
    results.failed++;
    return false;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/fulfill', {
      orderId,
      verificationMethod: 'code',
      verificationCode: verificationCode || 'TEST123',
      staffId: 'staff-test-001'
    });
    if (res.status === 200 && res.data.success) {
      log('8. FULFILLMENT.CONFIRM', 'PASS', 'Order fulfilled', res.data);
      results.passed++;
      return true;
    } else {
      log('8. FULFILLMENT.CONFIRM', 'FAIL', 'Fulfillment failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('8. FULFILLMENT.CONFIRM', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function step9_postLedger(orderId) {
  log('9. LEDGER.POST', 'RUN', `Posting ledger entry for order ${orderId}...`);
  
  if (!orderId) {
    log('9. LEDGER.POST', 'FAIL', 'No order ID');
    results.failed++;
    return false;
  }

  try {
    const res = await request('POST', '/api/agentic/marketplace/ledger', {
      eventType: 'sale',
      orderId,
      amount: 10.0,
      currency: 'solar',
      description: 'Golden Path test sale'
    });
    if (res.status === 200 && res.data.success) {
      log('9. LEDGER.POST', 'PASS', 'Ledger entry posted', res.data);
      results.passed++;
      return true;
    } else {
      log('9. LEDGER.POST', 'FAIL', 'Ledger post failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('9. LEDGER.POST', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function step10_runSettlement() {
  log('10. SETTLEMENT.RUN', 'RUN', 'Running settlement...');
  
  const now = new Date();
  const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const res = await request('POST', '/api/agentic/marketplace/settlement', {
      networkId: 'default',
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      dryRun: true
    });
    if (res.status === 200 && res.data.success) {
      const settlement = res.data.result;
      log('10. SETTLEMENT.RUN', 'PASS', `Settlement complete: ${settlement?.ordersSettled || 0} orders`, res.data);
      results.passed++;
      return true;
    } else {
      log('10. SETTLEMENT.RUN', 'FAIL', 'Settlement failed', res.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    log('10. SETTLEMENT.RUN', 'FAIL', error.message);
    results.failed++;
    return false;
  }
}

async function runGoldenPath() {
  console.log('='.repeat(60));
  console.log('GOLDEN PATH SMOKE TEST - TC-S Network Foundation');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log('');

  const assetId = await step1_createAsset();
  await step2_enrichAsset(assetId);
  const quote = await step3_priceQuote(assetId);
  await step4_publishPrice(assetId, quote?.priceSolar || 10.0);
  await step5_listAsset(assetId);
  const order = await step6_createOrder(assetId);
  await step7_capturePayment(order?.orderId);
  await step8_fulfillOrder(order?.orderId, order?.verificationCode);
  await step9_postLedger(order?.orderId);
  await step10_runSettlement();

  console.log('');
  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}/10`);
  console.log(`Failed: ${results.failed}/10`);
  console.log(`Status: ${results.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('='.repeat(60));

  const outputPath = `./golden-path-results-${Date.now()}.json`;
  require('fs').writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Full results written to: ${outputPath}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

runGoldenPath().catch(error => {
  console.error('Golden Path test failed:', error);
  process.exit(1);
});
