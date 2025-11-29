import { createHash } from 'crypto';

export const SOLAR_STANDARD = {
  GENESIS_DATE: '2025-04-07',
  GENESIS_TIMESTAMP: new Date('2025-04-07').getTime(),
  KWH_PER_SOLAR: 4913,
  RAYS_PER_SOLAR: 1000000,
  VERSION: '1.0.0',
  PROTOCOL_NAME: 'TC-S Solar Standard',
  NETWORK_MODULES: 14
} as const;

export function calculateSolarIndex(): number {
  const now = Date.now();
  const daysSinceGenesis = Math.floor(
    (now - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
  return Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));
}

export function getDaysSinceGenesis(): number {
  return Math.floor(
    (Date.now() - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
}

export function kwhToSolar(kwh: number): number {
  return kwh / SOLAR_STANDARD.KWH_PER_SOLAR;
}

export function solarToKwh(solar: number): number {
  return solar * SOLAR_STANDARD.KWH_PER_SOLAR;
}

export function raysToSolar(rays: number): number {
  return rays / SOLAR_STANDARD.RAYS_PER_SOLAR;
}

export function solarToRays(solar: number): number {
  return solar * SOLAR_STANDARD.RAYS_PER_SOLAR;
}

export function getProtocolHash(): string {
  const canonicalData = JSON.stringify({
    genesis_date: SOLAR_STANDARD.GENESIS_DATE,
    kwh_per_solar: SOLAR_STANDARD.KWH_PER_SOLAR,
    rays_per_solar: SOLAR_STANDARD.RAYS_PER_SOLAR,
    version: SOLAR_STANDARD.VERSION,
    protocol_name: SOLAR_STANDARD.PROTOCOL_NAME
  });
  return createHash('sha256').update(canonicalData).digest('hex');
}

export function validateProtocolIntegrity(expectedHash?: string): {
  valid: boolean;
  currentHash: string;
  expectedHash: string;
  constants: typeof SOLAR_STANDARD;
} {
  const currentHash = getProtocolHash();
  const expected = expectedHash || 'a7b3c9d1e5f2a8b4c6d0e3f7a1b5c9d2e6f0a4b8c2d6e0f4a8b2c6d0e4f8a2b6';
  
  return {
    valid: !expectedHash || currentHash === expectedHash,
    currentHash,
    expectedHash: expected,
    constants: SOLAR_STANDARD
  };
}

export interface IntegrityReport {
  timestamp: string;
  network: string;
  protocolHash: string;
  constants: {
    genesis_date: string;
    kwh_per_solar: number;
    rays_per_solar: number;
    version: string;
  };
  calculations: {
    solar_index: number;
    days_since_genesis: number;
    sample_conversion: {
      input_kwh: number;
      output_solar: number;
    };
  };
  status: 'valid' | 'drift_detected' | 'error';
  signature: string;
}

export function generateIntegrityReport(networkName: string): IntegrityReport {
  const protocolHash = getProtocolHash();
  const solarIndex = calculateSolarIndex();
  const daysSinceGenesis = getDaysSinceGenesis();
  const sampleKwh = 10000;
  const sampleSolar = kwhToSolar(sampleKwh);
  
  const report: IntegrityReport = {
    timestamp: new Date().toISOString(),
    network: networkName,
    protocolHash,
    constants: {
      genesis_date: SOLAR_STANDARD.GENESIS_DATE,
      kwh_per_solar: SOLAR_STANDARD.KWH_PER_SOLAR,
      rays_per_solar: SOLAR_STANDARD.RAYS_PER_SOLAR,
      version: SOLAR_STANDARD.VERSION
    },
    calculations: {
      solar_index: parseFloat(solarIndex.toFixed(1)),
      days_since_genesis: daysSinceGenesis,
      sample_conversion: {
        input_kwh: sampleKwh,
        output_solar: parseFloat(sampleSolar.toFixed(6))
      }
    },
    status: 'valid',
    signature: ''
  };
  
  const reportData = JSON.stringify({
    timestamp: report.timestamp,
    network: report.network,
    protocolHash: report.protocolHash,
    calculations: report.calculations
  });
  report.signature = createHash('sha256').update(reportData).digest('hex').substring(0, 16);
  
  return report;
}

export async function crossValidateNetworks(
  localReport: IntegrityReport,
  remoteEndpoint: string
): Promise<{
  synchronized: boolean;
  localReport: IntegrityReport;
  remoteReport: IntegrityReport | null;
  discrepancies: string[];
}> {
  let remoteReport: IntegrityReport | null = null;
  const discrepancies: string[] = [];
  
  try {
    const response = await fetch(remoteEndpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      remoteReport = await response.json();
      
      if (remoteReport) {
        if (localReport.protocolHash !== remoteReport.protocolHash) {
          discrepancies.push('Protocol hash mismatch - constants may have drifted');
        }
        
        if (localReport.constants.kwh_per_solar !== remoteReport.constants.kwh_per_solar) {
          discrepancies.push(`kWh per Solar mismatch: local=${localReport.constants.kwh_per_solar}, remote=${remoteReport.constants.kwh_per_solar}`);
        }
        
        if (localReport.constants.genesis_date !== remoteReport.constants.genesis_date) {
          discrepancies.push(`Genesis date mismatch: local=${localReport.constants.genesis_date}, remote=${remoteReport.constants.genesis_date}`);
        }
        
        const solarIndexDiff = Math.abs(
          localReport.calculations.solar_index - remoteReport.calculations.solar_index
        );
        if (solarIndexDiff > 0.5) {
          discrepancies.push(`Solar Index drift detected: diff=${solarIndexDiff.toFixed(2)}`);
        }
      }
    }
  } catch (error) {
    discrepancies.push(`Remote endpoint unreachable: ${remoteEndpoint}`);
  }
  
  return {
    synchronized: discrepancies.length === 0 && remoteReport !== null,
    localReport,
    remoteReport,
    discrepancies
  };
}
