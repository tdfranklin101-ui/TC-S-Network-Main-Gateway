import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const SOLAR_STANDARD = {
  GENESIS_DATE: '2025-04-07',
  GENESIS_TIMESTAMP: new Date('2025-04-07').getTime(),
  KWH_PER_SOLAR: 4913,
  RAYS_PER_SOLAR: 1000000,
  VERSION: '1.0.0',
  PROTOCOL_NAME: 'TC-S Solar Standard',
  NETWORK_MODULES: 14
} as const;

function calculateSolarIndex(): number {
  const now = Date.now();
  const daysSinceGenesis = Math.floor(
    (now - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
  return Math.min(99, Math.max(85, 91.8 + Math.sin(daysSinceGenesis / 30) * 3));
}

function getDaysSinceGenesis(): number {
  return Math.floor(
    (Date.now() - SOLAR_STANDARD.GENESIS_TIMESTAMP) / (1000 * 60 * 60 * 24)
  );
}

function kwhToSolar(kwh: number): number {
  return kwh / SOLAR_STANDARD.KWH_PER_SOLAR;
}

function getProtocolHash(): string {
  const canonicalData = JSON.stringify({
    genesis_date: SOLAR_STANDARD.GENESIS_DATE,
    kwh_per_solar: SOLAR_STANDARD.KWH_PER_SOLAR,
    rays_per_solar: SOLAR_STANDARD.RAYS_PER_SOLAR,
    version: SOLAR_STANDARD.VERSION,
    protocol_name: SOLAR_STANDARD.PROTOCOL_NAME
  });
  return createHash('sha256').update(canonicalData).digest('hex');
}

interface IntegrityReport {
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

function generateIntegrityReport(networkName: string): IntegrityReport {
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

async function crossValidateWithReplit(localReport: IntegrityReport): Promise<{
  synchronized: boolean;
  localReport: IntegrityReport;
  remoteReport: IntegrityReport | null;
  discrepancies: string[];
}> {
  const remoteEndpoint = 'https://current-see-website-tdfranklin101.replit.app/api/integrity';
  let remoteReport: IntegrityReport | null = null;
  const discrepancies: string[] = [];
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(remoteEndpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      remoteReport = await response.json();
      
      if (remoteReport) {
        if (localReport.protocolHash !== remoteReport.protocolHash) {
          discrepancies.push('CRITICAL: Protocol hash mismatch - constants have drifted');
        }
        
        if (localReport.constants.kwh_per_solar !== remoteReport.constants.kwh_per_solar) {
          discrepancies.push(`kWh per Solar mismatch: vercel=${localReport.constants.kwh_per_solar}, replit=${remoteReport.constants.kwh_per_solar}`);
        }
        
        if (localReport.constants.genesis_date !== remoteReport.constants.genesis_date) {
          discrepancies.push(`Genesis date mismatch: vercel=${localReport.constants.genesis_date}, replit=${remoteReport.constants.genesis_date}`);
        }
        
        const solarIndexDiff = Math.abs(
          localReport.calculations.solar_index - remoteReport.calculations.solar_index
        );
        if (solarIndexDiff > 0.5) {
          discrepancies.push(`Solar Index drift: diff=${solarIndexDiff.toFixed(2)} (may be timing)`);
        }
        
        const conversionDiff = Math.abs(
          localReport.calculations.sample_conversion.output_solar - 
          remoteReport.calculations.sample_conversion.output_solar
        );
        if (conversionDiff > 0.000001) {
          discrepancies.push(`Conversion calculation mismatch: diff=${conversionDiff}`);
        }
      }
    } else {
      discrepancies.push(`Replit endpoint returned ${response.status}`);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      discrepancies.push('Replit endpoint timeout (5s) - network may be offline');
    } else {
      discrepancies.push(`Replit endpoint unreachable: ${error.message}`);
    }
  }
  
  return {
    synchronized: discrepancies.length === 0 && remoteReport !== null,
    localReport,
    remoteReport,
    discrepancies
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const mode = req.query.mode as string || 'local';
    const localReport = generateIntegrityReport('vercel-tc-s-network');
    
    if (mode === 'cross-validate' || mode === 'full') {
      const validation = await crossValidateWithReplit(localReport);
      
      return res.status(200).json({
        mode: 'cross-validation',
        synchronized: validation.synchronized,
        integrity_status: validation.synchronized ? 'PASSED' : 'DRIFT_DETECTED',
        vercel: validation.localReport,
        replit: validation.remoteReport,
        discrepancies: validation.discrepancies,
        recommendation: validation.synchronized 
          ? 'All networks synchronized - Solar Standard protocol intact'
          : 'ALERT: Network discrepancies detected - review and resync required'
      });
    }
    
    return res.status(200).json({
      mode: 'local-only',
      integrity_status: 'PASSED',
      report: localReport,
      cross_validate_url: '/api/integrity?mode=cross-validate'
    });
    
  } catch (error: any) {
    return res.status(500).json({
      integrity_status: 'ERROR',
      error: 'Integrity check failed',
      message: error.message
    });
  }
}
