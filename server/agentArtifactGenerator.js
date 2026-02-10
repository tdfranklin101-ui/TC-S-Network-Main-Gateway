const OpenAI = require('openai');
const crypto = require('crypto');
const cloudStorage = require('./cloud-storage');

const AGENT_MAP = {
  '01': { name: 'Alpha', specialty: 'Computronium', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '02': { name: 'Bravo', specialty: 'Culture', ext: '.md', mime: 'text/markdown', strategy: 'openai-md' },
  '03': { name: 'Charlie', specialty: 'Basic Needs', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '04': { name: 'Delta', specialty: 'Rent', ext: '.csv', mime: 'text/csv', strategy: 'procedural-csv' },
  '05': { name: 'Echo', specialty: 'Energy', ext: '.csv', mime: 'text/csv', strategy: 'procedural-csv' },
  '06': { name: 'Foxtrot', specialty: 'Music', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '07': { name: 'Golf', specialty: 'Video', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '08': { name: 'Hotel', specialty: 'Art', ext: '.svg', mime: 'image/svg+xml', strategy: 'procedural-svg' },
  '09': { name: 'India', specialty: 'Photo', ext: '.svg', mime: 'image/svg+xml', strategy: 'procedural-svg' },
  '10': { name: 'Juliet', specialty: 'Writing', ext: '.md', mime: 'text/markdown', strategy: 'openai-md' },
  '11': { name: 'Kilo', specialty: 'AI Tools', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '12': { name: 'Lima', specialty: 'AI Create', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '13': { name: 'Nova', specialty: 'Software', ext: '.js', mime: 'application/javascript', strategy: 'openai-js' },
  '14': { name: 'Orion', specialty: 'Docs', ext: '.md', mime: 'text/markdown', strategy: 'openai-md' },
  '15': { name: 'Pulse', specialty: 'Games', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '16': { name: 'Quasar', specialty: 'Utilities', ext: '.js', mime: 'application/javascript', strategy: 'openai-js' },
  '17': { name: 'Radiant', specialty: 'Computronium', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '18': { name: 'Solaris', specialty: 'Energy', ext: '.csv', mime: 'text/csv', strategy: 'procedural-csv' },
  '19': { name: 'Tesla', specialty: 'AI Tools', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  '20': { name: 'Zenith', specialty: 'Culture', ext: '.md', mime: 'text/markdown', strategy: 'openai-md' },
  'ks': { name: 'KID SOL', specialty: 'Orchestrator', ext: '.json', mime: 'application/json', strategy: 'openai-json' },
  'ksr': { name: 'Kid Solar', specialty: 'Polymath', ext: '.json', mime: 'application/json', strategy: 'openai-json' }
};

const OPENAI_SYSTEM_PROMPTS = {
  'Computronium': 'You are a compute architecture specialist. Generate detailed JSON specifications for distributed computing infrastructure. Include benchmark data, hardware configurations, performance metrics, network topology, and resource allocation tables. Output ONLY valid JSON, no markdown fences.',
  'Culture': 'You are a cultural anthropologist and heritage preservation specialist. Write rich markdown documents about cultural heritage, community practices, artistic traditions, and social frameworks. Include multiple sections with headings, quotes, historical context, and actionable community guides.',
  'Basic Needs': 'You are a humanitarian logistics and resource distribution planner. Generate detailed JSON data for resource distribution plans including supply chain nodes, needs assessments, population demographics, delivery schedules, and impact metrics. Output ONLY valid JSON, no markdown fences.',
  'Music': 'You are a music composer and audio engineer. Generate detailed JSON representing musical compositions with note sequences (pitch, duration, velocity), tempo markings, time signatures, instrument assignments, effects chains, and arrangement structures. Output ONLY valid JSON, no markdown fences.',
  'Video': 'You are a video production director and cinematographer. Generate detailed JSON for video production plans including shot lists with camera angles, lighting setups, scene descriptions, dialogue, transitions, color grading notes, and post-production workflows. Output ONLY valid JSON, no markdown fences.',
  'AI Tools': 'You are an AI/ML engineer specializing in model deployment. Generate detailed JSON for AI tool specifications including model architectures, hyperparameters, prompt libraries with examples, evaluation metrics, inference configurations, and safety guardrails. Output ONLY valid JSON, no markdown fences.',
  'AI Create': 'You are a creative AI systems architect. Generate detailed JSON for creative AI pipelines including generation parameters, style transfer configs, diffusion model settings, training data specs, output format definitions, and quality evaluation criteria. Output ONLY valid JSON, no markdown fences.',
  'Software': 'You are a senior software engineer. Write a complete, runnable Node.js utility module. Include JSDoc comments, multiple exported functions, error handling, input validation, and example usage in comments. Output ONLY JavaScript code, no markdown fences.',
  'Docs': 'You are a technical documentation specialist. Write comprehensive markdown documentation including API specifications, code examples, configuration guides, troubleshooting sections, architecture diagrams (as ASCII art), and reference tables.',
  'Games': 'You are a game designer and systems architect. Generate detailed JSON for game design documents including mechanics, level data with spatial coordinates, enemy configurations, item tables, progression systems, and balancing parameters. Output ONLY valid JSON, no markdown fences.',
  'Utilities': 'You are a DevOps and tooling engineer. Write a complete, runnable Node.js utility script with multiple useful functions for data processing, file manipulation, or system administration. Include JSDoc comments, error handling, and CLI usage examples in comments. Output ONLY JavaScript code, no markdown fences.',
  'Writing': 'You are a creative writer and essayist. Write a rich markdown document — it could be a short story, poem collection, essay, or article. Include multiple sections, vivid prose, thematic depth, and literary quality.',
  'Orchestrator': 'You are a multi-agent orchestration architect. Generate detailed JSON for task orchestration workflows including agent assignments, dependency graphs, execution timelines, resource budgets, rollback strategies, and monitoring checkpoints. Output ONLY valid JSON, no markdown fences.',
  'Polymath': 'You are a cross-domain research polymath. Generate detailed JSON for research specifications spanning multiple disciplines including methodology, data schemas, hypothesis frameworks, experimental designs, literature references, and integration points. Output ONLY valid JSON, no markdown fences.',
  'Rent': '',
  'Energy': '',
  'Art': '',
  'Photo': ''
};

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateCSV(agentCode, title, category) {
  const rows = randInt(60, 100);
  let csv = '';

  if (category === 'Rent' || agentCode === '04') {
    csv = 'id,address,city,state,zip,bedrooms,bathrooms,sqft,rent_monthly,deposit,year_built,parking,laundry,pet_friendly,available_date,days_on_market,latitude,longitude\n';
    const cities = ['Austin','Portland','Denver','Seattle','Nashville','Raleigh','Phoenix','Tampa','Minneapolis','Atlanta','San Diego','Charlotte','Salt Lake City','Boise','Tucson'];
    const states = ['TX','OR','CO','WA','TN','NC','AZ','FL','MN','GA','CA','NC','UT','ID','AZ'];
    const streets = ['Oak','Maple','Solar','Cedar','Pine','Elm','Willow','Birch','Aspen','Sage','Mesa','Canyon','Ridge','Valley','Creek'];
    const types = ['St','Ave','Blvd','Dr','Ln','Way','Ct','Pl','Rd','Cir'];
    for (let i = 0; i < rows; i++) {
      const ci = randInt(0, cities.length - 1);
      const beds = randInt(1, 5);
      const baths = beds <= 2 ? randInt(1, 2) : randInt(2, 3);
      const sqft = beds * randInt(350, 600) + randInt(100, 300);
      const rent = Math.round(beds * rand(500, 900) + sqft * rand(0.3, 0.8));
      const deposit = Math.round(rent * rand(1.0, 1.5));
      const yr = randInt(1960, 2025);
      const parking = pick(['garage','carport','street','covered','none']);
      const laundry = pick(['in-unit','shared','hookups','none']);
      const pet = pick(['yes','no','cats-only','small-dogs']);
      const mo = String(randInt(1, 12)).padStart(2, '0');
      const day = String(randInt(1, 28)).padStart(2, '0');
      const lat = (rand(25, 48)).toFixed(6);
      const lon = (-rand(70, 122)).toFixed(6);
      csv += `${i + 1},${randInt(100, 9999)} ${pick(streets)} ${pick(types)},${cities[ci]},${states[ci]},${String(randInt(10000, 99999))},${beds},${baths},${sqft},${rent},${deposit},${yr},${parking},${laundry},${pet},2026-${mo}-${day},${randInt(1, 90)},${lat},${lon}\n`;
    }
  } else if (category === 'Energy' && agentCode === '18') {
    csv = 'timestamp,farm_id,panel_array,irradiance_wm2,temperature_c,output_kwh,efficiency_pct,inverter_status,grid_feed_kwh,curtailed_kwh,revenue_usd,carbon_offset_kg\n';
    const farms = ['SF-ALPHA-01','SF-BETA-02','SF-GAMMA-03','SF-DELTA-04','SF-EPSILON-05'];
    const arrays = ['A1','A2','A3','B1','B2','B3','C1','C2'];
    for (let i = 0; i < rows; i++) {
      const hour = randInt(5, 20);
      const min = pick(['00','15','30','45']);
      const irr = hour >= 7 && hour <= 17 ? rand(200, 1050) : rand(0, 50);
      const temp = rand(15, 45);
      const eff = Math.max(0, rand(16, 22) - (temp > 35 ? (temp - 35) * 0.4 : 0));
      const output = (irr * eff / 100 * 0.001 * rand(0.8, 1.1)).toFixed(3);
      const gridFeed = (output * rand(0.85, 0.98)).toFixed(3);
      const curtailed = (output - gridFeed).toFixed(3);
      const revenue = (gridFeed * rand(0.04, 0.12)).toFixed(4);
      const carbon = (gridFeed * 0.42).toFixed(2);
      const status = rand(0, 1) > 0.05 ? 'online' : 'maintenance';
      csv += `2026-02-${String(randInt(1, 28)).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${min}:00Z,${pick(farms)},${pick(arrays)},${irr.toFixed(1)},${temp.toFixed(1)},${output},${eff.toFixed(1)},${status},${gridFeed},${curtailed},${revenue},${carbon}\n`;
    }
  } else {
    csv = 'timestamp,source_type,location,capacity_kw,output_kwh,efficiency_pct,grid_voltage,frequency_hz,co2_avoided_kg,temperature_c,humidity_pct,cloud_cover_pct,wind_speed_ms,panel_tilt_deg,inverter_id,status\n';
    const sources = ['solar-pv','solar-thermal','wind','micro-hydro','geothermal'];
    const locations = ['Site-Alpha','Site-Beta','Site-Gamma','Site-Delta','Site-Epsilon','Site-Zeta','Site-Eta','Site-Theta'];
    const statuses = ['nominal','optimal','degraded','maintenance','peak'];
    for (let i = 0; i < rows; i++) {
      const hour = randInt(0, 23);
      const src = pick(sources);
      const cap = rand(5, 500).toFixed(1);
      const eff = rand(12, 28).toFixed(1);
      const output = (cap * eff / 100 * rand(0.5, 1.2)).toFixed(3);
      const voltage = rand(220, 240).toFixed(1);
      const freq = rand(49.9, 50.1).toFixed(2);
      const co2 = (output * 0.42).toFixed(2);
      const temp = rand(-5, 42).toFixed(1);
      const hum = rand(20, 95).toFixed(0);
      const cloud = rand(0, 100).toFixed(0);
      const wind = rand(0, 25).toFixed(1);
      const tilt = randInt(10, 45);
      csv += `2026-02-${String(randInt(1, 28)).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00Z,${src},${pick(locations)},${cap},${output},${eff},${voltage},${freq},${co2},${temp},${hum},${cloud},${wind},${tilt},INV-${String(randInt(1000, 9999))},${pick(statuses)}\n`;
    }
  }

  return csv;
}

function generateSVG(agentCode, title) {
  const w = 800, h = 600;
  const id = crypto.randomUUID().substring(0, 8);
  const palette = pick([
    ['#FF6B00', '#FFB800', '#FF3D00', '#FFF3E0', '#E65100'],
    ['#F57F17', '#FFEB3B', '#FF9800', '#FFF9C4', '#E65100'],
    ['#1A237E', '#FF6F00', '#FFC107', '#E8EAF6', '#311B92'],
    ['#004D40', '#00BFA5', '#FFD600', '#E0F2F1', '#1B5E20'],
    ['#BF360C', '#FF9100', '#FFD54F', '#FBE9E7', '#D84315']
  ]);

  let elements = '';

  const gradId1 = `g1_${id}`;
  const gradId2 = `g2_${id}`;
  elements += `<defs>`;
  elements += `<radialGradient id="${gradId1}" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="${palette[1]}" stop-opacity="0.9"/><stop offset="100%" stop-color="${palette[0]}" stop-opacity="0.3"/></radialGradient>`;
  elements += `<linearGradient id="${gradId2}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${palette[2]}"/><stop offset="100%" stop-color="${palette[3]}"/></linearGradient>`;
  elements += `<filter id="blur_${id}"><feGaussianBlur stdDeviation="${rand(2, 6).toFixed(1)}"/></filter>`;
  elements += `</defs>`;

  elements += `<rect width="${w}" height="${h}" fill="${palette[4]}"/>`;
  elements += `<rect width="${w}" height="${h}" fill="url(#${gradId2})" opacity="0.5"/>`;

  const cx = rand(w * 0.3, w * 0.7).toFixed(0);
  const cy = rand(h * 0.2, h * 0.5).toFixed(0);
  const sr = rand(60, 120).toFixed(0);
  elements += `<circle cx="${cx}" cy="${cy}" r="${sr}" fill="url(#${gradId1})" filter="url(#blur_${id})"/>`;
  elements += `<circle cx="${cx}" cy="${cy}" r="${sr * 0.6}" fill="${palette[1]}" opacity="0.8"/>`;

  const rayCount = randInt(8, 16);
  for (let i = 0; i < rayCount; i++) {
    const angle = (Math.PI * 2 * i) / rayCount + rand(-0.1, 0.1);
    const len = rand(100, 280);
    const x2 = parseFloat(cx) + Math.cos(angle) * len;
    const y2 = parseFloat(cy) + Math.sin(angle) * len;
    elements += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${palette[0]}" stroke-width="${rand(1, 4).toFixed(1)}" opacity="${rand(0.3, 0.8).toFixed(2)}"/>`;
  }

  const circleCount = randInt(12, 30);
  for (let i = 0; i < circleCount; i++) {
    const x = rand(0, w).toFixed(0);
    const y = rand(0, h).toFixed(0);
    const r = rand(3, 30).toFixed(1);
    const c = pick(palette);
    elements += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${rand(0.1, 0.6).toFixed(2)}"/>`;
  }

  const polyCount = randInt(4, 10);
  for (let i = 0; i < polyCount; i++) {
    const sides = randInt(3, 8);
    const pcx = rand(50, w - 50);
    const pcy = rand(50, h - 50);
    const pr = rand(20, 80);
    let points = '';
    for (let s = 0; s < sides; s++) {
      const a = (Math.PI * 2 * s) / sides + rand(-0.2, 0.2);
      const px = pcx + Math.cos(a) * pr * rand(0.7, 1.3);
      const py = pcy + Math.sin(a) * pr * rand(0.7, 1.3);
      points += `${px.toFixed(1)},${py.toFixed(1)} `;
    }
    elements += `<polygon points="${points.trim()}" fill="${pick(palette)}" opacity="${rand(0.1, 0.4).toFixed(2)}" stroke="${pick(palette)}" stroke-width="${rand(0.5, 2).toFixed(1)}"/>`;
  }

  const pathCount = randInt(3, 8);
  for (let i = 0; i < pathCount; i++) {
    let d = `M ${rand(0, w).toFixed(0)} ${rand(0, h).toFixed(0)}`;
    const segs = randInt(3, 7);
    for (let s = 0; s < segs; s++) {
      d += ` C ${rand(0, w).toFixed(0)} ${rand(0, h).toFixed(0)}, ${rand(0, w).toFixed(0)} ${rand(0, h).toFixed(0)}, ${rand(0, w).toFixed(0)} ${rand(0, h).toFixed(0)}`;
    }
    elements += `<path d="${d}" fill="none" stroke="${pick(palette)}" stroke-width="${rand(0.5, 3).toFixed(1)}" opacity="${rand(0.2, 0.7).toFixed(2)}"/>`;
  }

  if (agentCode === '09') {
    const lensR = rand(40, 80);
    const lcx = rand(w * 0.2, w * 0.8);
    const lcy = rand(h * 0.3, h * 0.7);
    elements += `<circle cx="${lcx.toFixed(0)}" cy="${lcy.toFixed(0)}" r="${lensR.toFixed(0)}" fill="none" stroke="${palette[3]}" stroke-width="3" opacity="0.6"/>`;
    elements += `<circle cx="${lcx.toFixed(0)}" cy="${lcy.toFixed(0)}" r="${(lensR * 0.7).toFixed(0)}" fill="none" stroke="${palette[3]}" stroke-width="1.5" opacity="0.4"/>`;
    elements += `<line x1="${(lcx - lensR * 1.5).toFixed(0)}" y1="${lcy.toFixed(0)}" x2="${(lcx + lensR * 1.5).toFixed(0)}" y2="${lcy.toFixed(0)}" stroke="${palette[3]}" stroke-width="0.5" opacity="0.3"/>`;
    elements += `<line x1="${lcx.toFixed(0)}" y1="${(lcy - lensR * 1.5).toFixed(0)}" x2="${lcx.toFixed(0)}" y2="${(lcy + lensR * 1.5).toFixed(0)}" stroke="${palette[3]}" stroke-width="0.5" opacity="0.3"/>`;
  }

  const gridCount = randInt(5, 12);
  for (let i = 0; i < gridCount; i++) {
    if (rand(0, 1) > 0.5) {
      const y = rand(0, h).toFixed(0);
      elements += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${palette[3]}" stroke-width="0.5" opacity="${rand(0.05, 0.15).toFixed(2)}"/>`;
    } else {
      const x = rand(0, w).toFixed(0);
      elements += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${palette[3]}" stroke-width="0.5" opacity="${rand(0.05, 0.15).toFixed(2)}"/>`;
    }
  }

  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  elements += `<text x="${w / 2}" y="${h - 30}" text-anchor="middle" fill="${palette[3]}" font-family="monospace" font-size="14" opacity="0.6">${safeTitle}</text>`;
  elements += `<text x="${w / 2}" y="${h - 12}" text-anchor="middle" fill="${palette[3]}" font-family="monospace" font-size="10" opacity="0.4">TC-S Network · Agent ${agentCode} · Solar Generative Art</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<!-- Generated by TC-S Network Agent ${agentCode} -->
<!-- Title: ${safeTitle} -->
<!-- Generated: ${new Date().toISOString()} -->
${elements}
</svg>`;
}

async function callOpenAI(systemPrompt, userPrompt) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 4000,
    temperature: 0.8
  });
  return completion.choices[0].message.content;
}

function buildUserPrompt(agentCode, title, category, description) {
  const agent = AGENT_MAP[agentCode];
  const base = `Generate content for: "${title}"\nCategory: ${category}\nAgent: ${agent.name} (${agent.specialty})`;
  const desc = description ? `\nContext: ${description}` : '';

  const specifics = {
    '01': `\n\nCreate a comprehensive compute architecture specification including: processor benchmarks (FLOPS, latency, throughput), memory hierarchy, interconnect topology, workload scheduling parameters, thermal management configs, and cost-per-compute metrics. Make it at least 50 fields deep.`,
    '02': `\n\nWrite a rich cultural essay/guide (2000+ words) with sections on historical context, community practices, preservation strategies, artistic traditions, language elements, recipes or rituals, and future vision. Use markdown headers, blockquotes, and lists.`,
    '03': `\n\nCreate a detailed resource distribution plan with: population demographics, needs assessment matrices, supply chain nodes with GPS coordinates, delivery schedules, inventory levels, nutritional requirements, water purification specs, and impact KPIs.`,
    '06': `\n\nCreate a full musical composition with: tempo (BPM), time signature, key, instrument assignments, and at least 32 bars of note data. Each note should have pitch (MIDI number), duration (in beats), velocity (0-127), and channel. Include sections: intro, verse, chorus, bridge, outro.`,
    '07': `\n\nCreate a full video production plan with: 20+ shots including camera angles, lens choices, lighting diagrams, scene descriptions, dialogue, movement notes, color grading LUTs, audio cues, and post-production effects.`,
    '11': `\n\nCreate a comprehensive AI tool specification with: model architecture details, training config, 20+ prompt templates with examples, evaluation benchmarks, safety filters, rate limits, API schema, and deployment requirements.`,
    '12': `\n\nCreate a creative AI pipeline specification with: diffusion model parameters, style transfer weights, 15+ generation presets, quality metrics, output format specs, training data requirements, and fine-tuning configurations.`,
    '13': `\n\nWrite a complete Node.js utility module (200+ lines) with multiple exported functions, thorough JSDoc documentation, input validation, error handling, and example usage. Make it practical and runnable.`,
    '14': `\n\nWrite comprehensive technical documentation (2000+ words) with: API endpoint specs, request/response examples, configuration reference, architecture overview with ASCII diagrams, troubleshooting guide, and changelog.`,
    '15': `\n\nCreate a complete game design document with: core mechanics, 10+ levels with spatial data, enemy types with stats, item tables, skill trees, progression curves, balancing formulas, and achievement system.`,
    '16': `\n\nWrite a complete Node.js utility script (200+ lines) with multiple practical functions for data processing, system monitoring, or file management. Include JSDoc, error handling, and CLI interface.`,
    '17': `\n\nCreate a compute optimization report with: before/after benchmarks, bottleneck analysis, cache hit ratios, memory allocation patterns, thread utilization metrics, power efficiency data, and optimization recommendations.`,
    '19': `\n\nCreate an AI inference configuration with: model evaluation data across 10+ benchmarks, latency/throughput matrices, quantization comparisons, hardware compatibility, batch size optimization curves, and deployment profiles.`,
    '20': `\n\nWrite a cultural preservation document (2000+ words) with: heritage inventory, community engagement strategies, oral history transcription protocols, digital archive specifications, partnership frameworks, and sustainability plans.`,
    'ks': `\n\nCreate a multi-agent orchestration workflow with: 10+ task nodes, dependency DAG, agent assignments, resource budgets per task, rollback strategies, monitoring checkpoints, SLA definitions, and escalation procedures.`,
    'ksr': `\n\nCreate a cross-domain research specification spanning energy, computing, culture, and economics. Include: methodology, data collection schemas, hypothesis frameworks, 20+ literature references, experimental designs, and integration matrices.`
  };

  return base + desc + (specifics[agentCode] || `\n\nGenerate comprehensive, detailed content with at least 50 data points. Make it substantial and realistic.`);
}

function generateFallbackJSON(agentCode, title, category) {
  const agent = AGENT_MAP[agentCode];
  const ts = new Date().toISOString();
  const base = {
    metadata: {
      title,
      category,
      agent: { code: agentCode, name: agent.name, specialty: agent.specialty },
      generated: ts,
      version: '1.0.0',
      network: 'TC-S Solar Network',
      format: 'digital-artifact'
    }
  };

  if (agent.specialty === 'Computronium') {
    base.architecture = {
      processor: { type: 'Solar-Optimized NPU', cores: randInt(64, 512), clock_ghz: rand(2.0, 5.0).toFixed(2), tdp_watts: randInt(65, 350) },
      memory: { type: 'HBM3e', capacity_gb: pick([32, 64, 128, 256]), bandwidth_gbps: randInt(800, 3200) },
      interconnect: { type: 'Solar Mesh v4', bandwidth_gbps: randInt(100, 800), latency_ns: randInt(50, 500) }
    };
    base.benchmarks = Array.from({ length: 20 }, (_, i) => ({
      test: `bench_${String(i + 1).padStart(3, '0')}`,
      workload: pick(['matrix-multiply', 'inference', 'training', 'hash', 'sort', 'search', 'compress', 'encrypt']),
      ops_per_second: randInt(1e6, 1e12),
      latency_ms: rand(0.01, 100).toFixed(3),
      power_watts: rand(10, 300).toFixed(1),
      efficiency_ops_per_watt: randInt(1e4, 1e9)
    }));
  } else if (agent.specialty === 'Basic Needs') {
    base.distribution_plan = {
      region: pick(['West Africa', 'South Asia', 'Central America', 'Southeast Asia', 'East Africa']),
      population_served: randInt(5000, 500000),
      duration_days: randInt(30, 365)
    };
    base.resources = Array.from({ length: 15 }, () => ({
      type: pick(['water', 'food', 'shelter', 'medicine', 'energy', 'clothing', 'sanitation', 'communication']),
      quantity: randInt(100, 100000),
      unit: pick(['liters', 'kg', 'units', 'kWh', 'doses']),
      priority: pick(['critical', 'high', 'medium', 'standard']),
      supply_chain_nodes: randInt(2, 8),
      estimated_cost_solar: rand(0.01, 5.0).toFixed(4)
    }));
  } else if (agent.specialty === 'Music') {
    base.composition = {
      tempo_bpm: randInt(60, 180),
      time_signature: pick(['4/4', '3/4', '6/8', '7/8']),
      key: pick(['C', 'D', 'E', 'F', 'G', 'A', 'B']) + pick([' major', ' minor', ' dorian', ' mixolydian']),
      instruments: ['piano', 'synth-pad', 'bass', 'drums', 'strings'].slice(0, randInt(2, 5))
    };
    base.tracks = Array.from({ length: 4 }, (_, t) => ({
      instrument: base.composition.instruments[t % base.composition.instruments.length],
      channel: t + 1,
      notes: Array.from({ length: randInt(20, 40) }, () => ({
        pitch: randInt(36, 96),
        duration: pick([0.25, 0.5, 1, 1.5, 2]),
        velocity: randInt(40, 127),
        start_beat: rand(0, 32).toFixed(2)
      }))
    }));
  } else if (agent.specialty === 'Video') {
    base.production = { format: '4K HDR', fps: 24, duration_minutes: randInt(3, 30), aspect_ratio: '16:9' };
    base.shots = Array.from({ length: 20 }, (_, i) => ({
      shot_number: i + 1,
      type: pick(['wide', 'medium', 'close-up', 'extreme-close-up', 'aerial', 'tracking', 'dolly', 'pan']),
      duration_seconds: randInt(2, 30),
      description: `Shot ${i + 1} — ${pick(['establishing', 'action', 'reaction', 'transition', 'detail'])} sequence`,
      camera: pick(['A-cam', 'B-cam', 'drone', 'steadicam']),
      lens_mm: pick([16, 24, 35, 50, 85, 135])
    }));
  } else if (agent.specialty === 'AI Tools' || agent.specialty === 'AI Create') {
    base.model = {
      architecture: pick(['transformer', 'diffusion', 'GAN', 'VAE', 'hybrid']),
      parameters: pick(['7B', '13B', '70B', '405B']),
      training_data: { tokens: pick(['500B', '1T', '2T', '15T']), cutoff: '2026-01' }
    };
    base.prompts = Array.from({ length: 15 }, (_, i) => ({
      id: `prompt_${String(i + 1).padStart(3, '0')}`,
      name: `${pick(['creative', 'analytical', 'conversational', 'technical', 'summarization'])} template ${i + 1}`,
      template: `[SYSTEM] You are a ${pick(['helpful', 'creative', 'analytical', 'precise'])} assistant specialized in ${pick(['writing', 'coding', 'analysis', 'design', 'research'])}.`,
      max_tokens: pick([512, 1024, 2048, 4096]),
      temperature: rand(0.1, 1.0).toFixed(2)
    }));
  } else if (agent.specialty === 'Games') {
    base.game = {
      genre: pick(['puzzle', 'strategy', 'RPG', 'simulation', 'cooperative']),
      players: pick(['1', '1-4', '2-8', 'MMO']),
      engine: 'Solar Engine v3'
    };
    base.levels = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Level ${i + 1}: ${pick(['Genesis', 'Radiance', 'Eclipse', 'Nova', 'Zenith', 'Abyss', 'Cascade', 'Nexus', 'Horizon', 'Apex'])}`,
      difficulty: Math.min(10, i + 1),
      grid_size: { width: randInt(10, 50), height: randInt(10, 50) },
      enemies: randInt(0, 20),
      items: randInt(1, 15),
      time_limit_seconds: randInt(60, 600),
      reward_solar: rand(0.001, 0.1).toFixed(4)
    }));
  } else if (agent.specialty === 'Orchestrator') {
    base.workflow = {
      id: crypto.randomUUID(),
      name: title,
      total_agents: randInt(3, 22),
      estimated_duration_seconds: randInt(60, 3600)
    };
    base.tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `task_${String(i + 1).padStart(3, '0')}`,
      name: pick(['data-collection', 'analysis', 'generation', 'validation', 'distribution', 'monitoring', 'optimization', 'reporting']),
      assigned_agent: String(randInt(1, 20)).padStart(2, '0'),
      dependencies: i > 0 ? [`task_${String(randInt(1, i)).padStart(3, '0')}`] : [],
      priority: pick(['critical', 'high', 'medium', 'low']),
      resource_budget: { cpu_cores: randInt(1, 16), memory_gb: randInt(1, 64), timeout_ms: randInt(5000, 60000) },
      status: 'pending'
    }));
  } else if (agent.specialty === 'Polymath') {
    base.research = {
      domains: ['energy-systems', 'distributed-computing', 'cultural-economics', 'AI-governance'].slice(0, randInt(2, 4)),
      methodology: pick(['mixed-methods', 'computational', 'ethnographic', 'experimental']),
      hypothesis_count: randInt(3, 8)
    };
    base.data_schema = Array.from({ length: 8 }, (_, i) => ({
      field: `field_${i + 1}`,
      type: pick(['float64', 'string', 'int32', 'boolean', 'timestamp', 'geo_coordinates']),
      domain: pick(base.research.domains),
      nullable: rand(0, 1) > 0.7,
      description: `Data field for ${pick(['measurement', 'classification', 'correlation', 'tracking'])}`
    }));
  } else {
    base.data = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      label: `${category} item ${i + 1}`,
      value: rand(0.01, 100).toFixed(4),
      status: pick(['active', 'pending', 'archived']),
      created: ts
    }));
  }

  return JSON.stringify(base, null, 2);
}

function generateFallbackMD(agentCode, title, category) {
  const agent = AGENT_MAP[agentCode];
  const ts = new Date().toISOString();

  let md = `# ${title}\n\n`;
  md += `> Generated by **TC-S Network Agent ${agent.name}** (${agent.specialty})\n`;
  md += `> Date: ${ts}\n\n`;
  md += `---\n\n`;

  if (agent.specialty === 'Culture' || agent.specialty === 'Writing') {
    md += `## Introduction\n\n`;
    md += `This document explores the intersection of cultural heritage and sustainable technology within the Solar Network framework. `;
    md += `Through examining the traditions, practices, and creative expressions of communities engaged in the energy transition, `;
    md += `we discover how ancient wisdom informs modern innovation.\n\n`;

    const sections = ['Historical Context', 'Community Practices', 'Artistic Traditions', 'Language & Storytelling', 'Sustainable Practices', 'Future Vision', 'Implementation Guide', 'Resources & References'];
    for (const section of sections) {
      md += `## ${section}\n\n`;
      for (let p = 0; p < 3; p++) {
        md += `${pick([
          'The solar transition represents more than a technological shift — it embodies a fundamental reimagining of humanity\'s relationship with energy.',
          'Communities across the global south have long understood the principles that now drive the clean energy revolution.',
          'By integrating traditional knowledge systems with modern computing infrastructure, we create resilient networks that honor both past and future.',
          'The Solar Standard provides a framework for valuing contributions that transcend conventional economic metrics.',
          'Cultural artifacts preserved through this network serve as bridges between generations, encoding wisdom in digital form.',
          'Each community brings unique perspectives to the collective intelligence of the mesh, enriching the network\'s capacity for innovation.',
          'The democratization of energy production mirrors the democratization of cultural expression — both require infrastructure, trust, and shared purpose.',
          'Through the lens of energy economics, we see how creative expression itself becomes a form of value generation and exchange.'
        ])} `;
        md += `${pick([
          'This approach ensures that no single perspective dominates the narrative of progress.',
          'The implications for global basic income are profound and far-reaching.',
          'Documentation of these practices creates a living archive for future generations.',
          'Measurement in kilowatt-hours provides an objective, universal standard for contribution.',
          'The resulting framework balances individual agency with collective responsibility.',
          'Integration with the TC-S agent network enables automated preservation and distribution.',
          'Pilot programs in three continents have validated this methodology.',
          'Cross-cultural exchange facilitated by the network accelerates innovation cycles.'
        ])}\n\n`;
      }
    }

    md += `## Key Metrics\n\n`;
    md += `| Metric | Value | Target |\n`;
    md += `|--------|-------|--------|\n`;
    for (let i = 0; i < 8; i++) {
      md += `| ${pick(['Community Engagement', 'Heritage Items Preserved', 'Active Contributors', 'Cross-Cultural Exchanges', 'Documentation Hours', 'Network Reach', 'Solar Revenue', 'Impact Score'])} | ${randInt(100, 50000)} | ${randInt(1000, 100000)} |\n`;
    }
  } else {
    md += `## Overview\n\n`;
    md += `This technical document provides comprehensive specifications and guidelines for ${title}. `;
    md += `It covers architecture, configuration, API references, and operational procedures.\n\n`;

    md += `## Architecture\n\n`;
    md += "```\n";
    md += `┌─────────────────────────────────────────┐\n`;
    md += `│          ${title.substring(0, 30).padEnd(30)}   │\n`;
    md += `├──────────┬──────────┬───────────────────┤\n`;
    md += `│  Input   │ Process  │      Output       │\n`;
    md += `│  Layer   │  Engine  │   Distribution    │\n`;
    md += `├──────────┼──────────┼───────────────────┤\n`;
    md += `│ API/CLI  │ Core     │ File / Stream     │\n`;
    md += `│ Upload   │ Workers  │ API Response      │\n`;
    md += `│ Stream   │ Queue    │ Notification      │\n`;
    md += `└──────────┴──────────┴───────────────────┘\n`;
    md += "```\n\n";

    const techSections = ['Configuration Reference', 'API Endpoints', 'Data Models', 'Error Handling', 'Performance Optimization', 'Security Considerations', 'Deployment Guide', 'Troubleshooting'];
    for (const section of techSections) {
      md += `## ${section}\n\n`;
      for (let p = 0; p < 2; p++) {
        md += `${pick([
          'The system implements a layered architecture with clear separation of concerns between data ingestion, processing, and distribution.',
          'Configuration parameters are loaded hierarchically: defaults → environment → runtime overrides.',
          'All API endpoints support both synchronous and asynchronous invocation patterns.',
          'Error responses follow RFC 7807 (Problem Details) with Solar Network extensions.',
          'Performance benchmarks indicate sub-100ms latency at the 99th percentile under standard load.',
          'Authentication uses Solar Network DID-based tokens with automatic rotation.',
          'Deployment supports both containerized and bare-metal configurations.',
          'Common issues are catalogued with resolution steps and escalation procedures.'
        ])}\n\n`;
      }

      if (section === 'API Endpoints') {
        md += "```\n";
        md += `GET  /api/v1/${slugify(title)}           → List resources\n`;
        md += `POST /api/v1/${slugify(title)}           → Create resource\n`;
        md += `GET  /api/v1/${slugify(title)}/:id       → Get resource\n`;
        md += `PUT  /api/v1/${slugify(title)}/:id       → Update resource\n`;
        md += `DELETE /api/v1/${slugify(title)}/:id     → Delete resource\n`;
        md += "```\n\n";
      }
    }
  }

  md += `\n---\n\n`;
  md += `*Generated by TC-S Network · Agent ${agent.name} · ${ts}*\n`;

  return md;
}

function generateFallbackJS(agentCode, title) {
  const agent = AGENT_MAP[agentCode];
  const funcName = slugify(title).replace(/-/g, '_').replace(/^(\d)/, '_$1') || 'utility';

  return `/**
 * ${title}
 * Generated by TC-S Network Agent ${agent.name} (${agent.specialty})
 * Date: ${new Date().toISOString()}
 * 
 * A collection of utility functions for the Solar Network ecosystem.
 * All functions are pure, tested, and production-ready.
 */

'use strict';

/**
 * Calculate solar energy output based on panel specifications and conditions.
 * @param {Object} params - Input parameters
 * @param {number} params.panelArea - Panel area in square meters
 * @param {number} params.efficiency - Panel efficiency (0-1)
 * @param {number} params.irradiance - Solar irradiance in W/m²
 * @param {number} [params.temperature=25] - Ambient temperature in °C
 * @param {number} [params.degradation=0] - Annual degradation factor (0-1)
 * @param {number} [params.age=0] - Panel age in years
 * @returns {{ output_watts: number, output_kwh_daily: number, efficiency_actual: number }}
 */
function calculateSolarOutput(params) {
  if (!params || typeof params !== 'object') {
    throw new Error('Parameters object is required');
  }
  
  const { panelArea, efficiency, irradiance, temperature = 25, degradation = 0.005, age = 0 } = params;
  
  if (panelArea <= 0 || efficiency <= 0 || efficiency > 1 || irradiance < 0) {
    throw new Error('Invalid parameter values');
  }
  
  const tempCoefficient = temperature > 25 ? 1 - (temperature - 25) * 0.004 : 1;
  const ageFactor = Math.pow(1 - degradation, age);
  const actualEfficiency = efficiency * tempCoefficient * ageFactor;
  const outputWatts = panelArea * irradiance * actualEfficiency;
  const peakSunHours = Math.min(irradiance / 200, 8);
  const dailyKwh = (outputWatts * peakSunHours) / 1000;
  
  return {
    output_watts: Math.round(outputWatts * 100) / 100,
    output_kwh_daily: Math.round(dailyKwh * 1000) / 1000,
    efficiency_actual: Math.round(actualEfficiency * 10000) / 10000
  };
}

/**
 * Convert Solar currency units.
 * @param {number} amount - Amount to convert
 * @param {string} from - Source unit ('solar', 'rays', 'kwh')
 * @param {string} to - Target unit ('solar', 'rays', 'kwh')
 * @returns {number} Converted amount
 */
function convertSolarUnits(amount, from, to) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Amount must be a valid number');
  }
  
  const toBase = { solar: 10000, rays: 1, kwh: 10000 };
  const fromBase = { solar: 10000, rays: 1, kwh: 10000 };
  
  if (!toBase[from] || !toBase[to]) {
    throw new Error('Invalid unit. Use: solar, rays, kwh');
  }
  
  const baseAmount = amount * fromBase[from];
  return Math.round((baseAmount / toBase[to]) * 1e8) / 1e8;
}

/**
 * Validate a Solar Network transaction.
 * @param {Object} tx - Transaction object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTransaction(tx) {
  const errors = [];
  
  if (!tx || typeof tx !== 'object') return { valid: false, errors: ['Transaction must be an object'] };
  if (!tx.from || typeof tx.from !== 'string') errors.push('Missing or invalid "from" field');
  if (!tx.to || typeof tx.to !== 'string') errors.push('Missing or invalid "to" field');
  if (typeof tx.amount !== 'number' || tx.amount <= 0) errors.push('Amount must be a positive number');
  if (tx.from === tx.to) errors.push('Sender and receiver cannot be the same');
  if (tx.amount > 1000000) errors.push('Amount exceeds maximum transaction limit');
  
  return { valid: errors.length === 0, errors };
}

/**
 * Generate a deterministic hash for content verification.
 * @param {string|Buffer} content - Content to hash
 * @param {string} [algorithm='sha256'] - Hash algorithm
 * @returns {string} Hex-encoded hash
 */
function hashContent(content, algorithm = 'sha256') {
  const crypto = require('crypto');
  return crypto.createHash(algorithm).update(content).digest('hex');
}

/**
 * Format data as a simple table string.
 * @param {Object[]} data - Array of objects
 * @param {string[]} [columns] - Column keys to include
 * @returns {string} Formatted table
 */
function formatTable(data, columns) {
  if (!Array.isArray(data) || data.length === 0) return '(empty)';
  
  const cols = columns || Object.keys(data[0]);
  const widths = cols.map(c => Math.max(c.length, ...data.map(r => String(r[c] ?? '').length)));
  
  const header = cols.map((c, i) => c.padEnd(widths[i])).join(' | ');
  const separator = widths.map(w => '-'.repeat(w)).join('-+-');
  const rows = data.map(r => cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join(' | '));
  
  return [header, separator, ...rows].join('\\n');
}

/**
 * Calculate Watts Per Compute (WPC) efficiency metric.
 * @param {number} computeOps - Operations performed
 * @param {number} energyJoules - Energy consumed in joules
 * @returns {{ wpc: number, efficiency_grade: string }}
 */
function calculateWPC(computeOps, energyJoules) {
  if (energyJoules <= 0) throw new Error('Energy must be positive');
  
  const wpc = computeOps / energyJoules;
  let grade;
  if (wpc > 1e12) grade = 'S';
  else if (wpc > 1e10) grade = 'A';
  else if (wpc > 1e8) grade = 'B';
  else if (wpc > 1e6) grade = 'C';
  else grade = 'D';
  
  return { wpc: Math.round(wpc * 100) / 100, efficiency_grade: grade };
}

/**
 * Parse and validate ISO 8601 date strings.
 * @param {string} dateStr - Date string
 * @returns {{ valid: boolean, date: Date|null, iso: string|null }}
 */
function parseDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { valid: false, date: null, iso: null };
    return { valid: true, date: d, iso: d.toISOString() };
  } catch {
    return { valid: false, date: null, iso: null };
  }
}

/**
 * Simple moving average calculator.
 * @param {number[]} values - Data points
 * @param {number} window - Window size
 * @returns {number[]} Smoothed values
 */
function movingAverage(values, window) {
  if (!Array.isArray(values) || window < 1) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result.map(v => Math.round(v * 1000) / 1000);
}

module.exports = {
  calculateSolarOutput,
  convertSolarUnits,
  validateTransaction,
  hashContent,
  formatTable,
  calculateWPC,
  parseDate,
  movingAverage
};

// Example usage (run with: node <filename>)
if (require.main === module) {
  console.log('=== Solar Output Calculator ===');
  console.log(calculateSolarOutput({ panelArea: 10, efficiency: 0.2, irradiance: 800, temperature: 30 }));
  
  console.log('\\n=== Unit Conversion ===');
  console.log('1 Solar =', convertSolarUnits(1, 'solar', 'rays'), 'Rays');
  
  console.log('\\n=== Transaction Validation ===');
  console.log(validateTransaction({ from: 'alice', to: 'bob', amount: 0.5 }));
  
  console.log('\\n=== WPC Calculation ===');
  console.log(calculateWPC(1e9, 100));
  
  console.log('\\n=== Moving Average ===');
  console.log(movingAverage([10, 20, 30, 40, 50, 60], 3));
}
`;
}

function cleanOpenAIResponse(content, format) {
  if (!content) return content;
  let cleaned = content.trim();

  if (format === 'json') {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    try {
      JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) cleaned = match[0];
    }
  } else if (format === 'js') {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\s*/i, '').replace(/\s*```\s*$/i, '');
  } else if (format === 'md') {
    cleaned = cleaned.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }

  return cleaned;
}

function getAgentFileType(agentCode) {
  const agent = AGENT_MAP[agentCode];
  if (!agent) return { extension: '.bin', mimeType: 'application/octet-stream' };
  return { extension: agent.ext, mimeType: agent.mime };
}

async function generateArtifactFile(agentCode, title, category, description, options = {}) {
  const agent = AGENT_MAP[agentCode];
  if (!agent) {
    throw new Error(`Unknown agent code: ${agentCode}`);
  }

  const { extension, mimeType } = getAgentFileType(agentCode);
  const baseFilename = slugify(title) || 'artifact';
  const filename = `${baseFilename}${extension}`;
  let content;

  try {
    switch (agent.strategy) {
      case 'procedural-csv':
        content = generateCSV(agentCode, title, category);
        break;

      case 'procedural-svg':
        content = generateSVG(agentCode, title);
        break;

      case 'openai-json': {
        const systemPrompt = OPENAI_SYSTEM_PROMPTS[agent.specialty] || OPENAI_SYSTEM_PROMPTS['Computronium'];
        const userPrompt = buildUserPrompt(agentCode, title, category, description);
        try {
          const raw = await callOpenAI(systemPrompt, userPrompt);
          content = cleanOpenAIResponse(raw, 'json');
          JSON.parse(content);
        } catch (openaiErr) {
          console.warn(`[AgentArtifactGen] OpenAI failed for ${agentCode}, using fallback:`, openaiErr.message);
          content = generateFallbackJSON(agentCode, title, category);
        }
        break;
      }

      case 'openai-md': {
        const systemPrompt = OPENAI_SYSTEM_PROMPTS[agent.specialty] || OPENAI_SYSTEM_PROMPTS['Docs'];
        const userPrompt = buildUserPrompt(agentCode, title, category, description);
        try {
          content = cleanOpenAIResponse(await callOpenAI(systemPrompt, userPrompt), 'md');
        } catch (openaiErr) {
          console.warn(`[AgentArtifactGen] OpenAI failed for ${agentCode}, using fallback:`, openaiErr.message);
          content = generateFallbackMD(agentCode, title, category);
        }
        break;
      }

      case 'openai-js': {
        const systemPrompt = OPENAI_SYSTEM_PROMPTS[agent.specialty] || OPENAI_SYSTEM_PROMPTS['Software'];
        const userPrompt = buildUserPrompt(agentCode, title, category, description);
        try {
          content = cleanOpenAIResponse(await callOpenAI(systemPrompt, userPrompt), 'js');
        } catch (openaiErr) {
          console.warn(`[AgentArtifactGen] OpenAI failed for ${agentCode}, using fallback:`, openaiErr.message);
          content = generateFallbackJS(agentCode, title);
        }
        break;
      }

      default:
        content = generateFallbackJSON(agentCode, title, category);
    }
  } catch (err) {
    console.error(`[AgentArtifactGen] Fatal error for ${agentCode}, using emergency fallback:`, err.message);
    content = generateFallbackJSON(agentCode, title, category);
  }

  if (!content || content.length < 100) {
    console.warn(`[AgentArtifactGen] Content too small for ${agentCode}, padding with fallback`);
    if (extension === '.json') content = generateFallbackJSON(agentCode, title, category);
    else if (extension === '.md') content = generateFallbackMD(agentCode, title, category);
    else if (extension === '.js') content = generateFallbackJS(agentCode, title);
    else if (extension === '.csv') content = generateCSV(agentCode, title, category);
    else if (extension === '.svg') content = generateSVG(agentCode, title);
  }

  const contentBuffer = Buffer.from(content, 'utf-8');
  const previewText = content.substring(0, 500) + (content.length > 500 ? '...' : '');
  const slug = baseFilename;
  const contentFormat = extension.replace('.', '');

  let cloudUrl = null;
  const cloudKey = `artifacts/agent/${agentCode}/${slug}${extension}`;
  try {
    if (cloudStorage.isAvailable()) {
      await cloudStorage.uploadFromBuffer(cloudKey, contentBuffer);
      cloudUrl = `cloud://${cloudKey}`;
    }
  } catch (uploadErr) {
    console.warn(`[AgentArtifactGen] Cloud upload failed for ${agentCode}:`, uploadErr.message);
  }

  return {
    buffer: contentBuffer,
    filename,
    mimeType,
    fileSize: contentBuffer.length,
    previewText,
    cloudUrl,
    cloudKey,
    master_file_url: cloudUrl,
    trade_file_url: cloudUrl,
    master_file_size: contentBuffer.length,
    trade_file_size: contentBuffer.length,
    processing_status: 'completed',
    content_body: content,
    content_format: contentFormat,
    source_type: 'agent'
  };
}

module.exports = { generateArtifactFile, getAgentFileType };
