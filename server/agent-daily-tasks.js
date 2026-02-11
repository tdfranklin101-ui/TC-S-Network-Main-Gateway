const crypto = require('crypto');

const ITEM_PARTS = {
  'Computronium':{adj:['Quantum','Neural','Photonic','Lattice','Cryo','Nano','Hyper','Exascale','Coherent','Flux'],noun:['Compute Shard','Processing Unit','Logic Crystal','Inference Chip','Hash Engine','Tensor Core','Bit Forge','Data Loom','Cycle Pack','Throughput Token'],suffix:['v4','XL','Genesis','Prime','Ultra','Turbo','Certified','Standard','Pro','Entangled']},
  'Culture':{adj:['Solar Punk','Afrofuturist','Indigenous','Global South','Diaspora','Ancestral','Neo-Folk','Visionary','Mythopoetic','Communal'],noun:['Story Archive','Heritage Map','Festival Pass','Language Kit','Oral History','Art Zine','Cultural Exchange','Folklore Bundle','Tradition Seed','Memory Capsule'],suffix:['Edition','Collective','Archive','Vol. I','Curated','Open','Living','Sacred','Shared','Roots']},
  'Basic Needs':{adj:['Essential','Daily','Community','Shared','Universal','Cooperative','Local','Fresh','Sustainable','Open-Access'],noun:['Energy Credit','Water Purification Kit','Food Co-op Share','Shelter Maintenance Pack','Health Scan Token','Transport Pass','Communication Bundle','Clothing Voucher','Nutrition Pack','Safety Kit'],suffix:['Daily','Weekly','Family','Individual','Starter','Standard','Plus','Community','Mutual Aid','Basic']},
  'Rent':{adj:['Shared','Cooperative','Micro','Community','Modular','Solar-Powered','Off-Grid','Resilient','Portable','Sustainable'],noun:['Housing Credit','Workspace Pass','Land Share','Co-Living Token','Studio Rental','Garden Plot','Workshop Bay','Storage Unit','Shelter Voucher','Facility Access'],suffix:['Monthly','Seasonal','Flex','Standard','Equity','Rotating','Trial','Founding','Anchored','Open']},
  'Energy':{adj:['Precision','Portable','Industrial','Wireless','AI-Powered','Multi-Spectrum','Ruggedized','Modular','Open-Source','Calibrated'],noun:['Solar Meter','Inverter Diag','Panel Mapper','Irradiance Sensor','ROI Calculator','Load Tester','Efficiency Gauge','Grid Probe','Watt Tracker','Harvest Monitor'],suffix:['v4','Pro','Field Kit','IoT','USB-C','Bluetooth','HD','IP67','with Case','Starter']},
  'Music':{adj:['Binaural','Ambient','Solar Wind','Dawn Chorus','Photovoltaic','Deep Field','Resonant','Harmonic','Celestial','Crystalline'],noun:['Beats Pack','Symphony','Meditation','Soundscape','Frequency Kit','Mix Tape','Rhythm Loop','Sonic Wave','Tone Garden','Pulse Set'],suffix:['432Hz','528Hz','Full Spectrum','Studio Mix','Live','Extended','Remastered','Deluxe','Pro','Spatial']},
  'Video':{adj:['Cinematic','Drone','Time-Lapse','Volumetric','Holographic','Immersive','Documentary','Generative','Solar-Lit','RAW'],noun:['Film Reel','Tutorial Series','Music Video','Short Film','B-Roll Pack','VFX Template','Motion Study','Scene Kit','Footage Archive','Visual Essay'],suffix:['4K','8K','HDR',"Director's Cut",'Extended','Uncut','Remastered','Season 1','Premiere','Open License']},
  'Art':{adj:['Fractal','Neon','Holographic','Prismatic','Quantum','Solar','Cosmic','Bioluminescent','Kinetic','Ethereal'],noun:['Dreamscape','Canvas','Portrait','Mandala','Mosaic','Tapestry','Sculpture','Lattice','Aurora','Bloom'],suffix:['v2','HD','XR Edition',"Collector's",'Limited Run','Genesis','Infinite','Luminous','Remastered','Ultra']},
  'Photo':{adj:['Aerial','Macro','Infrared','Long-Exposure','Street','Astro','Solar','Golden Hour','Deep Field','Polaroid'],noun:['Photo Set','Print Collection','Lightroom Preset','Portfolio','Stock Pack','Documentary Series','Panorama','Composite','Archive','Gallery'],suffix:['Hi-Res','RAW','Licensed','Open','Curated','Limited','Signed','Volume 1','Platinum','Exhibition']},
  'Writing':{adj:['Speculative','Technical','Lyrical','Investigative','Collaborative','Serialized','Epistolary','Mythic','Solar Punk','Manifesto'],noun:['Novel Chapter','Essay Collection','Poetry Zine','Whitepaper','Field Notes','Script Draft','Research Paper','Blog Series','Anthology','Protocol Doc'],suffix:['First Edition','Draft','Annotated','Illustrated','Abridged','Extended','Open Access','Peer-Reviewed','Serialized','Deluxe']},
  'AI Tools':{adj:['Adaptive','Predictive','Autonomous','Federated','Explainable','Real-Time','Multi-Modal','Zero-Shot','Fine-Tuned','On-Device'],noun:['Model Weights','Prompt Library','Agent Framework','Training Pipeline','Inference Engine','Eval Suite','Dataset Curator','Embedding Index','RAG Module','Safety Filter'],suffix:['Pro','v3','Open','Certified','Enterprise','Lite','SDK','API','Beta','Community']},
  'AI Create':{adj:['Generative','Neural','Diffusion','Transformer','Dreaming','Hallucinated','Procedural','Stochastic','Emergent','Synthetic'],noun:['Image Generator','Voice Clone','Music Composer','Story Writer','Video Synthesizer','Style Transfer','Avatar Builder','World Builder','Texture Forge','Concept Engine'],suffix:['HD','XL','Turbo','Creative','Unlimited','Standard','Plus','Studio','Personal','Open']},
  'Software':{adj:['Smart','Adaptive','Real-Time','Predictive','Autonomous','Distributed','Neural','Edge','Quantum','Zero-Loss'],noun:['Optimizer','Simulator','Balancer','Analyzer','Dashboard','Controller','Monitor','Scheduler','Forecaster','Compiler'],suffix:['Pro','v3','Enterprise','Lite','Cloud','CLI','API','SDK','Toolkit','Suite']},
  'Docs':{adj:['Complete','Illustrated','Interactive','Certified','Hands-On','Immersive','Self-Paced','Expert','Step-by-Step','Annotated'],noun:['Course','Masterclass','Workshop','Guide','Bootcamp','Blueprint','Playbook','Deep Dive','Lab Manual','Seminar Notes'],suffix:['2026','Cohort','Intensive','w/ Sim','& Cert','w/ Projects','Bundle','Starter','Pro Track','Unlimited']},
  'Games':{adj:['Solar','Quantum','Neon','Retro','Procedural','Cooperative','Infinite','Pixel','Voxel','Emergent'],noun:['Puzzle','Strategy Game','Sim','RPG Module','Card Deck','Board Game','Arcade','Sandbox','World Map','Quest Pack'],suffix:['Alpha','Beta','Full','Deluxe','Expansion','Season Pass','Community','Open Source','Remastered','Definitive']},
  'Utilities':{adj:['Portable','Lightweight','Cross-Platform','Secure','Encrypted','Offline','Automated','Batch','CLI','Open-Source'],noun:['File Converter','Backup Tool','Password Vault','Network Scanner','System Monitor','Batch Processor','Data Cleaner','Log Analyzer','Config Manager','Deploy Script'],suffix:['Pro','Lite','v2','Free','Standard','Plus','Enterprise','Portable','CLI','GUI']}
};

const MARKET_DEMAND = ['Basic Needs','Energy','Computronium','Software','AI Tools','Music','Art','Rent','Culture','Video','Photo','Writing','AI Create','Docs','Games','Utilities'];

const ALL_CATEGORIES = Object.keys(ITEM_PARTS);

let lastRunStatus = null;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateItemName(category) {
  const parts = ITEM_PARTS[category];
  if (!parts) return `${category} Item`;
  return `${pick(parts.adj)} ${pick(parts.noun)} ${pick(parts.suffix)}`;
}

function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) || 'untitled';
  const suffix = crypto.randomUUID().substring(0, 8);
  return `${base}-${suffix}`;
}

function generatePrice(category) {
  const demandIdx = MARKET_DEMAND.indexOf(category);
  const demandMultiplier = demandIdx >= 0 ? 1 + (MARKET_DEMAND.length - demandIdx) / MARKET_DEMAND.length : 1;

  if (category === 'Basic Needs') {
    const base = 0.002 + Math.random() * 0.078;
    return parseFloat((base * demandMultiplier).toFixed(6));
  }
  const base = 0.005 + Math.random() * 0.395;
  return parseFloat((base * demandMultiplier).toFixed(6));
}

function generateDescription(category, title) {
  const descriptions = {
    'Computronium': 'High-performance compute resource for distributed processing on the Solar network.',
    'Culture': 'Cultural artifact preserving heritage and creative expression for the Solar community.',
    'Basic Needs': 'Essential resource ensuring universal access to fundamental human needs.',
    'Rent': 'Cooperative housing and workspace access for sustainable community living.',
    'Energy': 'Solar energy measurement and optimization tool for the clean energy transition.',
    'Music': 'Audio creation crafted with Solar-powered instruments and natural harmonics.',
    'Video': 'Visual media produced with sustainable energy practices and creative vision.',
    'Art': 'Digital artwork exploring the intersection of technology and human expression.',
    'Photo': 'Photography capturing moments through sustainable and ethical creative practices.',
    'Writing': 'Written works contributing to the knowledge commons of the Solar network.',
    'AI Tools': 'AI-powered tools designed for ethical, transparent, and community-driven intelligence.',
    'AI Create': 'Creative AI system enabling new forms of artistic expression and generation.',
    'Software': 'Software solution optimized for the distributed Solar computing infrastructure.',
    'Docs': 'Educational resource for learning and mastering Solar network technologies.',
    'Games': 'Interactive experience built on cooperative and sustainable game design principles.',
    'Utilities': 'Practical utility tool for everyday tasks in the Solar ecosystem.'
  };
  return `${title} — ${descriptions[category] || 'Digital artifact on the Solar network.'}`;
}

async function createArtifactsForAgent(pool, agent, memberId) {
  const created = [];
  const errors = [];

  const categories = [];
  categories.push(agent.specialty);
  if (agent.specialty !== 'Basic Needs') {
    categories.push('Basic Needs');
  } else {
    const other = ALL_CATEGORIES.filter(c => c !== 'Basic Needs');
    categories.push(pick(other));
  }

  while (categories.length < 5) {
    const remaining = ALL_CATEGORIES.filter(c => !categories.includes(c));
    if (remaining.length === 0) break;
    categories.push(pick(remaining));
  }

  const FILE_TYPES = {
    'Music': 'audio/mpeg', 'Video': 'video/mp4', 'Art': 'image/png', 'Photo': 'image/jpeg',
    'Writing': 'text/markdown', 'Docs': 'application/pdf', 'Software': 'application/javascript',
    'AI Tools': 'application/json', 'AI Create': 'application/json', 'Games': 'application/zip',
    'Utilities': 'application/zip', 'Computronium': 'application/octet-stream',
    'Culture': 'text/markdown', 'Basic Needs': 'text/plain', 'Rent': 'text/plain', 'Energy': 'application/json'
  };

  const CONTENT_FORMATS = {
    'Music': 'audio', 'Video': 'video', 'Art': 'image', 'Photo': 'image',
    'Writing': 'md', 'Docs': 'pdf', 'Software': 'js', 'AI Tools': 'json',
    'AI Create': 'json', 'Games': 'binary', 'Utilities': 'binary',
    'Computronium': 'binary', 'Culture': 'md', 'Basic Needs': 'text', 'Rent': 'text', 'Energy': 'json'
  };

  for (const category of categories) {
    try {
      const title = generateItemName(category);
      const slug = generateSlug(title);
      const price = generatePrice(category);
      const kwhFootprint = parseFloat((0.001 + Math.random() * 0.499).toFixed(4));
      const description = generateDescription(category, title);
      const fileType = FILE_TYPES[category] || 'application/octet-stream';
      const contentFormat = CONTENT_FORMATS[category] || 'binary';
      const contentBody = `${title}\n\n${description}\n\nCategory: ${category}\nCreated by: Agent ${agent.name} (${agent.code})\nClass: B — File Delivery\nGenerated: ${new Date().toISOString()}`;

      const artifactResult = await pool.query(
        `INSERT INTO artifacts (slug, title, description, category, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, creator_id, active, processing_status, artifact_class, source_type, content_body, content_format)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'download', $8, true, 'complete', 'B', 'agent', $9, $10)
         RETURNING id`,
        [slug, title, description, category, fileType, String(kwhFootprint), String(price), String(memberId), contentBody, contentFormat]
      );

      const artifactId = artifactResult.rows[0].id;

      // Auto-add Music/Video agent content to Music Now for free streaming
      if (category === 'Music' || category === 'Video') {
        const streamSlug = slug.replace(/[^a-z0-9-]/g, '');
        await pool.query(
          `UPDATE artifacts SET streaming_url = $1 WHERE id = $2`,
          [`/music-now.html#agent-${streamSlug}`, artifactId]
        );
        console.log(`🎵 [Agent ${agent.code}] Auto-added ${category} "${title}" to Music Now streaming`);
      }

      await pool.query(
        `INSERT INTO market_items (title, description, category, price_solar, kwh_estimate, source_type, status, created_by_user_id, metadata)
         VALUES ($1, $2, $3, $4, $5, 'INTERNAL_STOCK', 'ACTIVE', $6, $7)`,
        [title, description, category, String(price), String(kwhFootprint), String(memberId),
         JSON.stringify({ agentName: agent.name, agentCode: agent.code, artifactId, generatedAt: new Date().toISOString() })]
      );

      created.push({ artifactId, title, category, price, slug });
    } catch (err) {
      console.error(`[Agent ${agent.code}] Error creating artifact in ${category}:`, err.message);
      errors.push({ phase: 'create', category, error: err.message });
    }
  }

  return { created, errors };
}

async function makePurchasesForAgent(pool, agent, memberId) {
  const purchased = [];
  const errors = [];

  const buyerRow = await pool.query('SELECT id, username, total_solar FROM members WHERE id = $1', [memberId]);
  if (buyerRow.rows.length === 0) {
    errors.push({ phase: 'purchase', error: 'Buyer not found in members table' });
    return { purchased, errors };
  }

  let basicNeedsPurchased = 0;
  const targetBasicNeeds = 2;
  const totalPurchases = 5;

  for (let i = 0; i < totalPurchases; i++) {
    const client = await pool.connect();
    try {
      const freshBuyer = await client.query('SELECT id, username, total_solar FROM members WHERE id = $1', [memberId]);
      if (freshBuyer.rows.length === 0) {
        errors.push({ phase: 'purchase', error: 'Buyer disappeared mid-loop' });
        continue;
      }
      const buyerBalance = parseFloat(freshBuyer.rows[0].total_solar) || 0;

      let artifact;
      if (basicNeedsPurchased < targetBasicNeeds) {
        const result = await client.query(
          `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
           FROM artifacts a
           WHERE a.category = 'Basic Needs'
             AND a.active = true
             AND a.creator_id != $1
             AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $2)
           ORDER BY RANDOM() LIMIT 1`,
          [String(memberId), memberId]
        );
        artifact = result.rows[0];
      } else {
        const result = await client.query(
          `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
           FROM artifacts a
           WHERE a.category != 'Basic Needs'
             AND a.active = true
             AND a.creator_id != $1
             AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $2)
           ORDER BY RANDOM() LIMIT 1`,
          [String(memberId), memberId]
        );
        artifact = result.rows[0];
      }

      if (!artifact) {
        const fallback = await client.query(
          `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
           FROM artifacts a
           WHERE a.active = true
             AND a.creator_id != $1
             AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $2)
           ORDER BY RANDOM() LIMIT 1`,
          [String(memberId), memberId]
        );
        artifact = fallback.rows[0];
      }

      if (!artifact) {
        errors.push({ phase: 'purchase', error: 'No eligible artifacts found for purchase' });
        continue;
      }

      const artPrice = parseFloat(artifact.solar_amount_s) || 0.01;
      if (buyerBalance < artPrice) {
        errors.push({ phase: 'purchase', error: `Insufficient balance: ${buyerBalance} < ${artPrice}` });
        continue;
      }

      const txId = crypto.randomUUID();
      const artifactId = artifact.id;
      const creatorId = artifact.creator_id;
      const creatorIdNum = parseInt(creatorId) || 0;
      const creatorIdStr = String(creatorId);

      await client.query('BEGIN');

      const newBuyerBalance = buyerBalance - artPrice;
      await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newBuyerBalance), memberId]);

      await client.query(
        `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
         VALUES ($1, 'debit', $2, 'user', $3, $4, 'purchase', $5, $6)`,
        [txId, String(memberId), String(artPrice), String(newBuyerBalance), artifactId, `Purchase: ${artifact.title}`]
      );

      const sellerRow = await client.query(
        'SELECT id, username, total_solar FROM members WHERE id = $1 OR username = $2 LIMIT 1',
        [creatorIdNum, creatorIdStr]
      );

      if (sellerRow.rows.length > 0) {
        const seller = sellerRow.rows[0];
        const sellerOldBal = parseFloat(seller.total_solar) || 0;
        const sellerNewBal = sellerOldBal + artPrice;

        await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(sellerNewBal), seller.id]);

        await client.query(
          `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
           VALUES ($1, 'credit', $2, 'creator', $3, $4, 'purchase', $5, $6)`,
          [txId, String(seller.id), String(artPrice), String(sellerNewBal), artifactId, `Sale: ${artifact.title}`]
        );
      }

      await client.query(
        `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'purchase', $4)`,
        [artifactId, memberId, txId, String(artPrice)]
      );

      await client.query('COMMIT');

      if (artifact.category === 'Basic Needs') {
        basicNeedsPurchased++;
      }

      purchased.push({ artifactId, title: artifact.title, category: artifact.category, price: artPrice, txId });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { /* ignore rollback error */ }
      console.error(`[Agent ${agent.code}] Purchase error:`, err.message);
      errors.push({ phase: 'purchase', error: err.message });
    } finally {
      client.release();
    }
  }

  return { purchased, errors };
}

async function runAgentTasks(pool, agent) {
  const username = `agent_eco_${agent.code}`;
  const result = { agentCode: agent.code, agentName: agent.name, created: [], purchased: [], errors: [] };

  try {
    const memberRow = await pool.query('SELECT id, username, total_solar FROM members WHERE username = $1', [username]);
    if (memberRow.rows.length === 0) {
      result.errors.push({ phase: 'lookup', error: `Agent member ${username} not found` });
      return result;
    }

    const memberId = memberRow.rows[0].id;
    console.log(`🤖 [Agent ${agent.code} ${agent.name}] Starting daily tasks (member ID: ${memberId}, balance: ${memberRow.rows[0].total_solar})`);

    const createResult = await createArtifactsForAgent(pool, agent, memberId);
    result.created = createResult.created;
    result.errors.push(...createResult.errors);

    const purchaseResult = await makePurchasesForAgent(pool, agent, memberId);
    result.purchased = purchaseResult.purchased;
    result.errors.push(...purchaseResult.errors);

    console.log(`✅ [Agent ${agent.code} ${agent.name}] Done: ${result.created.length} created, ${result.purchased.length} purchased, ${result.errors.length} errors`);
  } catch (err) {
    console.error(`🚨 [Agent ${agent.code} ${agent.name}] Fatal error:`, err.message);
    result.errors.push({ phase: 'fatal', error: err.message });
  }

  return result;
}

async function runDailyAgentTasks(pool, agents) {
  const startTime = Date.now();
  console.log(`\n🌅 ===== DAILY AGENT TASKS START (${agents.length} agents) =====`);

  const agentResults = [];
  let totalCreated = 0;
  let totalPurchased = 0;

  for (const agent of agents) {
    const result = await runAgentTasks(pool, agent);
    agentResults.push(result);
    totalCreated += result.created.length;
    totalPurchased += result.purchased.length;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalErrors = agentResults.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\n🌅 ===== DAILY AGENT TASKS COMPLETE =====`);
  console.log(`   Created: ${totalCreated} artifacts | Purchased: ${totalPurchased} items | Errors: ${totalErrors} | Time: ${elapsed}s\n`);

  lastRunStatus = {
    success: totalErrors === 0,
    agentResults,
    totalCreated,
    totalPurchased,
    totalErrors,
    timestamp: new Date().toISOString(),
    elapsedSeconds: parseFloat(elapsed)
  };

  return lastRunStatus;
}

async function runSingleAgentTasks(pool, agents, agentCode) {
  const agent = agents.find(a => a.code === agentCode);
  if (!agent) {
    return { success: false, error: `Agent with code ${agentCode} not found`, timestamp: new Date().toISOString() };
  }

  console.log(`\n🤖 ===== SINGLE AGENT TASK: ${agent.name} (${agentCode}) =====`);
  const result = await runAgentTasks(pool, agent);

  const status = {
    success: result.errors.length === 0,
    agentResults: [result],
    totalCreated: result.created.length,
    totalPurchased: result.purchased.length,
    timestamp: new Date().toISOString()
  };

  lastRunStatus = status;
  return status;
}

function getTaskStatus() {
  return lastRunStatus || { success: null, message: 'No tasks have been run yet', timestamp: null };
}

module.exports = { runDailyAgentTasks, runSingleAgentTasks, getTaskStatus };
