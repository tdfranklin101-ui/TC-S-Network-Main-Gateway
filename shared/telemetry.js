/**
 * TC-S Compute Telemetry Module (CommonJS)
 * Phase 4A: Cross-App Compute Telemetry
 * @version 1.0.0
 */

const TELEMETRY_VERSION = '1.0.0';

const DASHBOARD_ENDPOINT = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT || 
  'https://tc-s-network-solar-dashboard.vercel.app/api/telemetry';

async function sendTelemetry(payload) {
  try {
    const fullPayload = {
      ...payload,
      ts: Date.now(),
      version: TELEMETRY_VERSION
    };

    const response = await fetch(DASHBOARD_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-TCS-Telemetry': TELEMETRY_VERSION
      },
      body: JSON.stringify(fullPayload)
    });

    return response.ok;
  } catch (err) {
    console.error('[TC-S Telemetry] Send failed:', err);
    return false;
  }
}

module.exports = {
  sendTelemetry,
  TELEMETRY_VERSION,
  DASHBOARD_ENDPOINT
};
