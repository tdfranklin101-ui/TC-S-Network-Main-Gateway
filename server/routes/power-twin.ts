import { Router } from 'express';
import multer from 'multer';

const router = Router();

// TC-S Constants
const SOLAR_KWH = 4913.0;
const RAYS_PER_SOLAR = 10000.0;

interface PowerSample {
  time_s: number;
  power_w: number;
}

interface PowerTwinResult {
  version: string;
  chip_id: string;
  workload_id: string;
  timestamp_utc: string;
  units: {
    time: string;
    power: string;
    energy: string;
    solar: string;
    rays: string;
  };
  profile: {
    duration_s: number;
    samples: number;
    avg_power_w: number;
    peak_power_w: number;
  };
  energy: {
    total_kwh: number;
    per_second_kwh: number;
  };
  solar_cost: {
    solar: number;
    rays: number;
  };
  source: {
    trace_type: string;
    trace_file: string;
    integration_method: string;
    assumptions: string[];
  };
  metadata: Record<string, any>;
}

function parseCSV(content: string): PowerSample[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const timeIndex = header.findIndex(h => h === 'time_s');
  const powerIndex = header.findIndex(h => h === 'power_w');

  if (timeIndex === -1 || powerIndex === -1) {
    throw new Error('CSV must have columns: time_s, power_w');
  }

  const samples: PowerSample[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    const time_s = parseFloat(values[timeIndex]);
    const power_w = parseFloat(values[powerIndex]);

    if (isNaN(time_s) || isNaN(power_w)) {
      throw new Error(`Invalid data on line ${i + 1}: ${line}`);
    }

    samples.push({ time_s, power_w });
  }

  samples.sort((a, b) => a.time_s - b.time_s);

  if (samples.length < 2) {
    throw new Error('Need at least 2 samples to integrate energy');
  }

  return samples;
}

function integrateEnergyKwh(samples: PowerSample[]): number {
  let totalJoules = 0;

  for (let i = 0; i < samples.length - 1; i++) {
    const p = samples[i].power_w;
    const dt = samples[i + 1].time_s - samples[i].time_s;
    
    if (dt < 0) {
      throw new Error('Timestamps must be monotonically increasing');
    }
    
    totalJoules += p * dt;
  }

  return totalJoules / (1000.0 * 3600.0);
}

function buildPowerTwin(
  chipId: string,
  workloadId: string,
  samples: PowerSample[],
  traceFile: string,
  metadata: Record<string, any> = {}
): PowerTwinResult {
  const duration_s = samples[samples.length - 1].time_s - samples[0].time_s;
  const avg_power_w = samples.reduce((sum, s) => sum + s.power_w, 0) / samples.length;
  const peak_power_w = Math.max(...samples.map(s => s.power_w));
  const energy_kwh = integrateEnergyKwh(samples);
  const per_second_kwh = duration_s > 0 ? energy_kwh / duration_s : 0;
  const solar = energy_kwh / SOLAR_KWH;
  const rays = solar * RAYS_PER_SOLAR;

  return {
    version: 'tcs-power-twin-v1',
    chip_id: chipId,
    workload_id: workloadId,
    timestamp_utc: new Date().toISOString(),
    units: {
      time: 'seconds',
      power: 'watts',
      energy: 'kWh',
      solar: 'Solar',
      rays: 'Solar Rays'
    },
    profile: {
      duration_s,
      samples: samples.length,
      avg_power_w,
      peak_power_w
    },
    energy: {
      total_kwh: energy_kwh,
      per_second_kwh
    },
    solar_cost: {
      solar,
      rays
    },
    source: {
      trace_type: 'time_power_csv',
      trace_file: traceFile,
      integration_method: 'left_riemann',
      assumptions: [
        'Power value held constant until next timestamp',
        'Timestamps are monotonically increasing'
      ]
    },
    metadata
  };
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/analyze', upload.single('trace'), async (req, res) => {
  try {
    const chipId = req.body.chip_id || 'unknown-chip';
    const workloadId = req.body.workload_id || 'unknown-workload';
    const metadata: Record<string, any> = {};

    if (req.body.process_node_nm) metadata.process_node_nm = parseFloat(req.body.process_node_nm);
    if (req.body.voltage_v) metadata.voltage_v = parseFloat(req.body.voltage_v);
    if (req.body.clock_ghz) metadata.clock_ghz = parseFloat(req.body.clock_ghz);
    if (req.body.notes) metadata.notes = req.body.notes;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No trace file uploaded. Please upload a CSV file with columns: time_s, power_w' 
      });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const samples = parseCSV(csvContent);
    const powerTwin = buildPowerTwin(chipId, workloadId, samples, req.file.originalname, metadata);

    res.json({
      success: true,
      power_twin: powerTwin
    });
  } catch (error: any) {
    console.error('[Power Twin] Error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process power trace'
    });
  }
});

router.post('/calculate', async (req, res) => {
  try {
    const { samples, chip_id, workload_id, metadata } = req.body;

    if (!samples || !Array.isArray(samples) || samples.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Must provide at least 2 power samples as array of {time_s, power_w}'
      });
    }

    const validSamples: PowerSample[] = samples.map((s: any) => ({
      time_s: parseFloat(s.time_s),
      power_w: parseFloat(s.power_w)
    }));

    const powerTwin = buildPowerTwin(
      chip_id || 'unknown-chip',
      workload_id || 'unknown-workload',
      validSamples,
      'api-input',
      metadata || {}
    );

    res.json({
      success: true,
      power_twin: powerTwin
    });
  } catch (error: any) {
    console.error('[Power Twin] Error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to calculate power twin'
    });
  }
});

router.get('/constants', (req, res) => {
  res.json({
    solar_kwh: SOLAR_KWH,
    rays_per_solar: RAYS_PER_SOLAR,
    description: '1 Solar = 4,913 kWh of renewable energy. 1 Solar = 10,000 Solar Rays.',
    version: 'tcs-power-twin-v1'
  });
});

// External Simulator Integration
const OSS_SIMULATOR_URL = 'https://open-source-eda-tdfranklin101.replit.app';

router.get('/simulator/status', async (req, res) => {
  const simulatorInfo = {
    name: 'Open Silicon Stack',
    url: OSS_SIMULATOR_URL,
    features: [
      'VexRiscv RISC-V Core Simulation',
      'OpenRAM Memory Generator',
      'Skywater 130nm PDK',
      'OpenLane RTL-to-GDSII Flow'
    ],
    power_trace_format: 'CSV with time_s, power_w columns',
    integration: 'embedded_iframe'
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(OSS_SIMULATOR_URL, {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      res.json({
        success: true,
        simulator: {
          ...simulatorInfo,
          status: 'online'
        }
      });
    } else {
      res.status(503).json({
        success: false,
        error: `Simulator returned status ${response.status}`,
        simulator: {
          ...simulatorInfo,
          status: 'degraded'
        }
      });
    }
  } catch (error: any) {
    const errorMessage = error.name === 'AbortError' ? 'Connection timeout' : 'Connection failed';
    res.status(503).json({
      success: false,
      error: errorMessage,
      simulator: {
        ...simulatorInfo,
        status: 'offline'
      }
    });
  }
});

router.get('/simulator/info', (req, res) => {
  res.json({
    simulator: {
      name: 'Open Silicon Stack',
      description: 'Open-source EDA digital twin chip simulator showcasing VexRiscv, OpenRAM, Skywater PDK, and OpenLane',
      url: OSS_SIMULATOR_URL,
      supported_architectures: [
        { name: 'VexRiscv', type: 'RISC-V Core', description: 'Configurable 32-bit RISC-V processor core' },
        { name: 'OpenRAM', type: 'Memory', description: 'Open-source static RAM compiler' },
        { name: 'Skywater 130nm', type: 'PDK', description: 'Open-source process design kit' },
        { name: 'OpenLane', type: 'Flow', description: 'Automated RTL-to-GDSII synthesis flow' }
      ],
      workflow: [
        'Select chip architecture or configure custom design',
        'Choose workload benchmark',
        'Run power simulation',
        'Export power trace as CSV',
        'Upload to Power Twin for Solar cost calculation'
      ],
      csv_format: {
        required_columns: ['time_s', 'power_w'],
        time_unit: 'seconds',
        power_unit: 'watts',
        example: 'time_s,power_w\\n0.0,0.5\\n0.001,0.6\\n0.002,0.55'
      }
    },
    power_twin: {
      version: 'tcs-power-twin-v1',
      solar_conversion: '1 Solar = 4,913 kWh',
      rays_conversion: '1 Solar = 10,000 Rays',
      integration_method: 'left_riemann'
    }
  });
});

export default router;
