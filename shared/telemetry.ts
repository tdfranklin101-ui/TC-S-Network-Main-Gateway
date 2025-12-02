/**
 * TC-S Compute Telemetry Module
 * Phase 4A: Cross-App Compute Telemetry
 * @version 1.0.0
 */

const TELEMETRY_VERSION = '1.0.0';

interface TelemetryPayload {
  app: string;
  kWh: number;
  solar: number;
  rays: number;
  flops: number;
  wpc: number;
  grade: string;
  ts: number;
  version: string;
}

const DASHBOARD_ENDPOINT = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT || 
  'https://tc-s-network-solar-dashboard.vercel.app/api/telemetry';

export async function sendTelemetry(payload: Omit<TelemetryPayload, 'ts' | 'version'>): Promise<boolean> {
  try {
    const fullPayload: TelemetryPayload = {
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

export { TELEMETRY_VERSION, DASHBOARD_ENDPOINT };
export type { TelemetryPayload };
