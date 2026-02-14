const crypto = require('crypto');
const { generateKidSolObjectives, makeAgentDecision, gatherMarketSnapshot, postToBulletin, gatherRound2Snapshot, makeRound2Decision, generateBulletinReply } = require('./agent-inference');

async function addBulletinReply(pool, postId, agentCode, agentName, memberId, message, replyType, negotiation) {
  const post = await pool.query('SELECT * FROM agent_bulletin_board WHERE id = $1', [postId]);
  if (post.rows.length === 0) return null;
  const currentPost = post.rows[0];
  if (currentPost.thread_status !== 'open' || (currentPost.reply_count || 0) >= 4) return null;

  if (negotiation && negotiation.discountPct && negotiation.discountPct > 20) {
    negotiation.discountPct = 20;
    if (negotiation.originalPrice) {
      negotiation.proposedPrice = Math.round(negotiation.originalPrice * 0.8 * 10000) / 10000;
    }
  }

  const replyEntry = { agentCode, agentName, memberId, message, replyType, timestamp: new Date().toISOString() };
  if (negotiation) replyEntry.negotiation = negotiation;

  const replies = currentPost.replies || [];
  replies.push(replyEntry);
  const newReplyCount = replies.length;

  let newThreadStatus = 'open';
  if (newReplyCount >= 4) {
    if (replyType === 'accept') newThreadStatus = 'deal_accepted';
    else if (replyType === 'decline') newThreadStatus = 'no_deal';
    else newThreadStatus = 'closed';
  }

  let finalPrice = currentPost.final_price;
  if (negotiation && negotiation.proposedPrice && (replyType === 'accept' || newReplyCount >= 4)) {
    finalPrice = negotiation.proposedPrice;
  }

  const result = await pool.query(
    `UPDATE agent_bulletin_board SET replies = $1, reply_count = $2, thread_status = $3, final_price = COALESCE($5, final_price), updated_at = NOW() WHERE id = $4 RETURNING *`,
    [JSON.stringify(replies), newReplyCount, newThreadStatus, postId, finalPrice]
  );
  return result.rows[0];
}

const FOUNDATION_USERNAME = 'tcs_foundation';
const FOUNDATION_FEE_RATE = 0.05;

async function getOrCreateFoundationMember(queryFn) {
  const existing = await queryFn('SELECT id, username, total_solar FROM members WHERE username = $1 LIMIT 1', [FOUNDATION_USERNAME]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, totalSolar: parseFloat(existing.rows[0].total_solar) || 0 };
  }
  const inserted = await queryFn(
    `INSERT INTO members (username, name, email, total_solar, total_dollars, is_agent, password_hash)
     VALUES ($1, $2, $3, '0.0000', 0, false, '$2b$12$foundationreservewallet000000000000000000000000000') RETURNING id, total_solar`,
    [FOUNDATION_USERNAME, 'TC-S Foundation Reserve', 'foundation@thecurrentsee.org']
  );
  return { id: inserted.rows[0].id, totalSolar: 0 };
}

const ITEM_PARTS = {
  'Computronium':{adj:['Quantum','Neural','Photonic','Lattice','Cryo','Nano','Hyper','Exascale','Coherent','Flux'],noun:['Compute Shard','Processing Unit','Logic Crystal','Inference Chip','Hash Engine','Tensor Core','Bit Forge','Data Loom','Cycle Pack','Throughput Token'],suffix:['v4','XL','Genesis','Prime','Ultra','Turbo','Certified','Standard','Pro','Entangled']},
  'Culture':{adj:['Solar Punk','Afrofuturist','Indigenous','Global South','Diaspora','Ancestral','Neo-Folk','Visionary','Mythopoetic','Communal'],noun:['Story Archive','Heritage Map','Festival Pass','Language Kit','Oral History','Art Zine','Cultural Exchange','Folklore Bundle','Tradition Seed','Memory Capsule'],suffix:['Edition','Collective','Archive','Vol. I','Curated','Open','Living','Sacred','Shared','Roots']},
  'Basic Needs':{adj:['Essential','Daily','Community','Shared','Universal','Cooperative','Local','Fresh','Sustainable','Open-Access'],noun:['Energy Credit','Water Purification Kit','Food Co-op Share','Shelter Maintenance Pack','Health Scan Token','Transport Pass','Communication Bundle','Clothing Voucher','Nutrition Pack','Safety Kit'],suffix:['Daily','Weekly','Family','Individual','Starter','Standard','Plus','Community','Mutual Aid','Basic']},
  'Rent':{adj:['Shared','Cooperative','Micro','Community','Modular','Solar-Powered','Off-Grid','Resilient','Portable','Sustainable'],noun:['Housing Credit','Workspace Pass','Land Share','Co-Living Token','Studio Rental','Garden Plot','Workshop Bay','Storage Unit','Shelter Voucher','Facility Access'],suffix:['Monthly','Seasonal','Flex','Standard','Equity','Rotating','Trial','Founding','Anchored','Open']},
  'Energy':{adj:['Precision','Portable','Industrial','Wireless','AI-Powered','Multi-Spectrum','Ruggedized','Modular','Open-Source','Calibrated'],noun:['Solar Meter','Inverter Diag','Panel Mapper','Irradiance Sensor','ROI Calculator','Load Tester','Efficiency Gauge','Grid Probe','Watt Tracker','Harvest Monitor'],suffix:['v4','Pro','Field Kit','IoT','USB-C','Bluetooth','HD','IP67','with Case','Starter']},
  'Music':{adj:['Binaural','Ambient','Solar Wind','Dawn Chorus','Photovoltaic','Deep Field','Resonant','Harmonic','Celestial','Crystalline'],noun:['Beats Pack','Symphony','Meditation','Soundscape','Frequency Kit','Mix Tape','Rhythm Loop','Sonic Wave','Tone Garden','Pulse Set'],suffix:['432Hz','528Hz','Full Spectrum','Studio Mix','Live','Extended','Remastered','Deluxe','Pro','Spatial']},
  'Songs':{adj:['Acoustic','Electric','Soul','Indie','Folk','Pop','Ethereal','Cinematic','Lo-Fi','Choral'],noun:['Single','EP Track','Album Cut','Live Recording','Cover','Original','Ballad','Anthem','Demo','Master'],suffix:['HD Audio','Remastered','Acoustic','Live','Studio','Vocal','Instrumental Mix','Radio Edit','Extended','Deluxe']},
  'Video':{adj:['Cinematic','Drone','Time-Lapse','Volumetric','Holographic','Immersive','Documentary','Generative','Solar-Lit','RAW'],noun:['Film Reel','Tutorial Series','Music Video','Short Film','B-Roll Pack','VFX Template','Motion Study','Scene Kit','Footage Archive','Visual Essay'],suffix:['4K','8K','HDR',"Director's Cut",'Extended','Uncut','Remastered','Season 1','Premiere','Open License']},
  'Videos':{adj:['Cinematic','Viral','Documentary','Concert','Live','Tutorial','Behind-the-Scenes','Animated','Vertical','Slow-Motion'],noun:['Music Video','Short Film','Vlog','Interview','Performance','Recap','Highlight Reel','Trailer','Montage','Feature'],suffix:['4K','1080p','HDR','Uncut','Final Cut','Official','Directors Cut','Premiere','Extended','Remastered']},
  'Art':{adj:['Fractal','Neon','Holographic','Prismatic','Quantum','Solar','Cosmic','Bioluminescent','Kinetic','Ethereal'],noun:['Dreamscape','Canvas','Portrait','Mandala','Mosaic','Tapestry','Sculpture','Lattice','Aurora','Bloom'],suffix:['v2','HD','XR Edition',"Collector's",'Limited Run','Genesis','Infinite','Luminous','Remastered','Ultra']},
  'Photo':{adj:['Aerial','Macro','Infrared','Long-Exposure','Street','Astro','Solar','Golden Hour','Deep Field','Polaroid'],noun:['Photo Set','Print Collection','Lightroom Preset','Portfolio','Stock Pack','Documentary Series','Panorama','Composite','Archive','Gallery'],suffix:['Hi-Res','RAW','Licensed','Open','Curated','Limited','Signed','Volume 1','Platinum','Exhibition']},
  'Writing':{adj:['Speculative','Technical','Lyrical','Investigative','Collaborative','Serialized','Epistolary','Mythic','Solar Punk','Manifesto'],noun:['Novel Chapter','Essay Collection','Poetry Zine','Whitepaper','Field Notes','Script Draft','Research Paper','Blog Series','Anthology','Protocol Doc'],suffix:['First Edition','Draft','Annotated','Illustrated','Abridged','Extended','Open Access','Peer-Reviewed','Serialized','Deluxe']},
  'AI Tools':{adj:['Adaptive','Predictive','Autonomous','Federated','Explainable','Real-Time','Multi-Modal','Zero-Shot','Fine-Tuned','On-Device'],noun:['Model Weights','Prompt Library','Agent Framework','Training Pipeline','Inference Engine','Eval Suite','Dataset Curator','Embedding Index','RAG Module','Safety Filter'],suffix:['Pro','v3','Open','Certified','Enterprise','Lite','SDK','API','Beta','Community']},
  'AI Create':{adj:['Generative','Neural','Diffusion','Transformer','Dreaming','Hallucinated','Procedural','Stochastic','Emergent','Synthetic'],noun:['Image Generator','Voice Clone','Music Composer','Story Writer','Video Synthesizer','Style Transfer','Avatar Builder','World Builder','Texture Forge','Concept Engine'],suffix:['HD','XL','Turbo','Creative','Unlimited','Standard','Plus','Studio','Personal','Open']},
  'Software':{adj:['Smart','Adaptive','Real-Time','Predictive','Autonomous','Distributed','Neural','Edge','Quantum','Zero-Loss'],noun:['Optimizer','Simulator','Balancer','Analyzer','Dashboard','Controller','Monitor','Scheduler','Forecaster','Compiler'],suffix:['Pro','v3','Enterprise','Lite','Cloud','CLI','API','SDK','Toolkit','Suite']},
  'Docs':{adj:['Complete','Illustrated','Interactive','Certified','Hands-On','Immersive','Self-Paced','Expert','Step-by-Step','Annotated'],noun:['Course','Masterclass','Workshop','Guide','Bootcamp','Blueprint','Playbook','Deep Dive','Lab Manual','Seminar Notes'],suffix:['2026','Cohort','Intensive','w/ Sim','& Cert','w/ Projects','Bundle','Starter','Pro Track','Unlimited']},
  'Games':{adj:['Solar','Quantum','Neon','Retro','Procedural','Cooperative','Infinite','Pixel','Voxel','Emergent'],noun:['Puzzle','Strategy Game','Sim','RPG Module','Card Deck','Board Game','Arcade','Sandbox','World Map','Quest Pack'],suffix:['Alpha','Beta','Full','Deluxe','Expansion','Season Pass','Community','Open Source','Remastered','Definitive']},
  'Utilities':{adj:['Portable','Lightweight','Cross-Platform','Secure','Encrypted','Offline','Automated','Batch','CLI','Open-Source'],noun:['File Converter','Backup Tool','Password Vault','Network Scanner','System Monitor','Batch Processor','Data Cleaner','Log Analyzer','Config Manager','Deploy Script'],suffix:['Pro','Lite','v2','Free','Standard','Plus','Enterprise','Portable','CLI','GUI']},
  'Education':{adj:['Interactive','Self-Paced','Certified','Immersive','Hands-On','Adaptive','Guided','Comprehensive','Introductory','Advanced'],noun:['Tutorial Prompt','Course Module','Training Kit','Study Guide','Lesson Plan','Lab Exercise','Certification Prep','Curriculum Pack','Workshop Series','Knowledge Base'],suffix:['K-12','Associate','Bachelors','Post-Grad','Doctorate','Professional','Vocational','Trade','Public','Private']},
  '3D Printing':{adj:['Parametric','Modular','Stackable','Ergonomic','Lattice','Honeycomb','Snap-Fit','Articulated','Precision','Functional'],noun:['Desk Caddy','Phone Stand','Cable Organizer','Shelf Bracket','Wall Hook','Planter Box','Gear Set','Tool Holder','Card Stand','Tile Set'],suffix:['v1','Pro','Mini','XL','Slim','Eco','Custom','Deluxe','Starter','Field Kit']}
};

const MARKET_DEMAND = ['Basic Needs','Energy','Computronium','Software','AI Tools','Songs','Videos','Music','Art','Rent','Culture','Video','Photo','Writing','AI Create','Docs','Education','Games','Utilities','3D Printing'];

const ALL_CATEGORIES = Object.keys(ITEM_PARTS);

let lastRunStatus = null;
let lastRound2Status = null;

async function analyzeMarketDemand(pool) {
  const scores = {};
  const gaps = [];
  let memberRequests = [];
  let totalInventory = 0;

  const supplyByCategory = {};
  const activeSupplyByCategory = {};
  try {
    const invResult = await pool.query(
      `SELECT category, COUNT(*) as supply, COUNT(CASE WHEN active = true THEN 1 END) as active_supply FROM artifacts GROUP BY category`
    );
    for (const row of invResult.rows) {
      supplyByCategory[row.category] = parseInt(row.supply) || 0;
      activeSupplyByCategory[row.category] = parseInt(row.active_supply) || 0;
      totalInventory += parseInt(row.supply) || 0;
    }
  } catch (err) {
    console.warn('🌞 [KID SOL] Inventory query failed, using empty baseline:', err.message);
  }

  const salesByCategory = {};
  try {
    const salesResult = await pool.query(
      `SELECT a.category, COUNT(*) as recent_sales
       FROM artifact_copies ac JOIN artifacts a ON ac.artifact_id = a.id
       WHERE ac.acquired_at > NOW() - INTERVAL '7 days'
       GROUP BY a.category`
    );
    for (const row of salesResult.rows) {
      salesByCategory[row.category] = parseInt(row.recent_sales) || 0;
    }
  } catch (err) {
    console.warn('🌞 [KID SOL] Sales velocity query failed, skipping:', err.message);
  }

  try {
    const reqResult = await pool.query(
      `SELECT query, constraints, status FROM market_requests
       WHERE status NOT IN ('FULFILLED', 'CANCELLED')
       ORDER BY created_at DESC LIMIT 50`
    );
    memberRequests = reqResult.rows;
  } catch (err) {
    console.warn('🌞 [KID SOL] Member requests query failed, skipping:', err.message);
  }

  for (const category of ALL_CATEGORIES) {
    const demandIdx = MARKET_DEMAND.indexOf(category);
    const baseWeight = demandIdx >= 0
      ? (ALL_CATEGORIES.length - demandIdx) / ALL_CATEGORIES.length
      : 0.3;

    const supply = supplyByCategory[category] || 0;
    let scarcityBonus = 0;
    if (supply === 0) scarcityBonus = 10;
    else if (supply < 5) scarcityBonus = 5;
    else if (supply < 20) scarcityBonus = 2;
    else if (supply < 50) scarcityBonus = 1;

    const activeSupply = activeSupplyByCategory[category] || 0;
    const recentSales = salesByCategory[category] || 0;
    const velocityBonus = Math.min(recentSales / (activeSupply || 1) * 3, 5);

    let requestBonus = 0;
    for (const req of memberRequests) {
      const queryText = (req.query || '').toLowerCase();
      if (queryText.includes(category.toLowerCase())) {
        requestBonus += 3;
      }
    }

    scores[category] = baseWeight + scarcityBonus + velocityBonus + requestBonus;

    if (supply === 0) {
      gaps.push(category);
    }
  }

  return { scores, gaps, memberRequests, totalInventory };
}

async function buildSupplyManifest(pool, agents, demand) {
  const manifest = {};

  const rankedCategories = ALL_CATEGORIES
    .map(c => ({ category: c, score: demand.scores[c] || 0 }))
    .sort((a, b) => b.score - a.score);

  const basicNeedsAssigned = agents.length > 0;
  let basicNeedsSlotGiven = false;

  for (const agent of agents) {
    let bestCategory = null;

    if (!basicNeedsSlotGiven && basicNeedsAssigned) {
      bestCategory = 'Basic Needs';
      basicNeedsSlotGiven = true;
    } else if (agent.specialty && agent.specialty !== 'Orchestrator' && agent.specialty !== 'Computronium Polymath' && ITEM_PARTS[agent.specialty]) {
      bestCategory = agent.specialty;
    }

    if (!bestCategory) {
      const gapMatch = demand.gaps.find(g => ITEM_PARTS[g]);
      if (gapMatch) {
        bestCategory = gapMatch;
      } else {
        bestCategory = rankedCategories[0]?.category || 'Basic Needs';
      }
    }

    manifest[agent.code] = [bestCategory];
  }

  return manifest;
}

async function processKidSolarPrompts(pool) {
  try {
    const result = await pool.query(
      `SELECT id, action_type, payload, metadata, status FROM action_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC LIMIT 10`
    );

    const prompts = result.rows;
    const categoryHints = [];

    for (const prompt of prompts) {
      const payload = prompt.payload || {};
      const meta = prompt.metadata || {};
      const actionText = (prompt.action_type || '') + ' ' + JSON.stringify(payload) + ' ' + JSON.stringify(meta);

      for (const category of ALL_CATEGORIES) {
        if (actionText.toLowerCase().includes(category.toLowerCase())) {
          categoryHints.push(category);
        }
      }
    }

    return { prompts, categoryHints };
  } catch (err) {
    console.warn('🌞 [KID SOL] Kid Solar prompts query failed, skipping:', err.message);
    return { prompts: [], categoryHints: [] };
  }
}

async function submitKidSolarPrompt(pool, action, details) {
  try {
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO action_requests (id, action_type, agent_id, agent_name, requester_id, risk_level, status, payload, created_at, updated_at)
       VALUES ($1, $2, 'kid_solar', 'Kid Solar', 'kid_solar', 'low', 'pending', $3, NOW(), NOW())
       RETURNING *`,
      [id, action, JSON.stringify(details || {})]
    );
    return result.rows[0];
  } catch (err) {
    console.warn('🌞 [KID SOL] Failed to submit Kid Solar prompt:', err.message);
    return null;
  }
}

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
    'Education': 'AI-powered educational resource spanning K-12 through doctoral studies, vocational training, and professional development on the Solar network.',
    'Games': 'Interactive experience built on cooperative and sustainable game design principles.',
    'Utilities': 'Practical utility tool for everyday tasks in the Solar ecosystem.'
  };
  return `${title} — ${descriptions[category] || 'Digital artifact on the Solar network.'}`;
}

async function createArtifactsForAgent(pool, agent, memberId, assignedCategories) {
  const created = [];
  const errors = [];

  let bestCategory;
  if (assignedCategories && assignedCategories.length > 0) {
    bestCategory = assignedCategories[0];
  } else {
    bestCategory = agent.specialty && ITEM_PARTS[agent.specialty] ? agent.specialty : 'Basic Needs';
  }
  const categories = [bestCategory];

  const FILE_TYPES = {
    'Songs': 'audio/mpeg', 'Videos': 'video/mp4', 'Music': 'audio/mpeg', 'Video': 'video/mp4', 'Art': 'image/png', 'Photo': 'image/jpeg',
    'Writing': 'text/markdown', 'Docs': 'application/pdf', 'Software': 'application/javascript',
    'AI Tools': 'application/json', 'AI Create': 'application/json', 'Games': 'application/zip',
    'Utilities': 'application/zip', 'Computronium': 'application/octet-stream',
    'Culture': 'text/markdown', 'Basic Needs': 'text/plain', 'Rent': 'text/plain', 'Energy': 'application/json',
    'Education': 'text/markdown', '3D Printing': '3d-model'
  };

  const CONTENT_FORMATS = {
    'Songs': 'audio', 'Videos': 'video', 'Music': 'audio', 'Video': 'video', 'Art': 'image', 'Photo': 'image',
    'Writing': 'md', 'Docs': 'pdf', 'Software': 'js', 'AI Tools': 'json',
    'AI Create': 'json', 'Games': 'binary', 'Utilities': 'binary',
    'Computronium': 'binary', 'Culture': 'md', 'Basic Needs': 'text', 'Rent': 'text', 'Energy': 'json',
    'Education': 'md', '3D Printing': 'stl'
  };

  let artifact3dMeta = null;
  const { inferDeliverables, getDeliverableLabel } = require('./deliverable-inference.js');
  for (const category of categories) {
    try {
      const title = generateItemName(category);
      const slug = generateSlug(title);
      const price = generatePrice(category);
      const kwhFootprint = parseFloat((0.001 + Math.random() * 0.499).toFixed(4));
      const description = generateDescription(category, title);
      const fileType = FILE_TYPES[category] || 'application/octet-stream';
      const contentFormat = CONTENT_FORMATS[category] || 'binary';

      const matrix = inferDeliverables(title, { category });
      const inferLabel = getDeliverableLabel(matrix);
      console.log(`📊 [Agent ${agent.code}] Inference for "${title}": ${inferLabel} (3D:${matrix.print3d} 2D:${matrix.print2d} File:${matrix.file.type})`);
      let contentBody;
      if (category === 'Education') {
        const subcats = ['K-12', 'Associate', 'Bachelors', 'Post-Graduate', 'Doctorate', 'Professional', 'Vocational', 'Trade', 'Public', 'Private'];
        const subcat = title.split(' ').pop() || pick(subcats);
        contentBody = `# ${title}\n\n## Level: ${subcat}\n\n### Overview\n${description}\n\n### Learning Objectives\n- Understand core concepts and principles\n- Apply knowledge through guided exercises\n- Demonstrate mastery via self-assessment\n\n### Module Content\nThis ${subcat}-level educational resource covers essential topics in the Solar network ecosystem. Students will explore renewable energy fundamentals, blockchain-based currency systems, and sustainable technology practices.\n\n### Exercises\n1. Research and describe how Solar tokens relate to real-world energy production\n2. Calculate the kWh equivalent of a marketplace transaction\n3. Design a proposal for a community energy project\n\n### Assessment\n- Quiz: Key terminology and concepts\n- Project: Create a mini-proposal for Solar network improvement\n- Reflection: How does renewable energy connect to economic systems?\n\n### Resources\n- Solar Standard Protocol documentation\n- TC-S Network marketplace (hands-on practice)\n- KID SOL AI assistant for guided learning\n\nCategory: ${category}\nCreated by: Agent ${agent.name} (${agent.code})\nClass: B — Educational Content\nGenerated: ${new Date().toISOString()}`;
      } else if (category === '3D Printing') {
        try {
          const artifact3dService = require('./artifact3d-service.js');
          const templates = artifact3dService.getTemplates();
          const template = pick(templates);
          const result = artifact3dService.generateArtifact3d(template.id, {});
          if (result.validation.valid) {
            contentBody = result.printGuideText + '\n\n---\n\n**STL Hash:** `' + result.stlHash + '`\n**File Size:** ' + result.stlBuffer.length + ' bytes\n**Triangles:** ' + result.triangleCount;

            const dbResult = await pool.query(
              `INSERT INTO artifact_3d_files (template_id, template_params, stl_hash, print_guide_hash, file_size, bounding_box, validation_status, generation_status, print_settings)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
              [template.id, JSON.stringify(result.params), result.stlHash, result.printGuideHash || '',
               result.stlBuffer.length, JSON.stringify(result.boundingBox), 'passed', 'completed', JSON.stringify(result.params)]
            );
            const artifact3dId = dbResult.rows[0].id;

            try {
              const cloudStorage = require('./cloud-storage');
              if (cloudStorage.isAvailable()) {
                const stlResult = await cloudStorage.uploadFromBuffer(`.private/3d-models/${artifact3dId}_model.stl`, result.stlBuffer);
                const guideResult = await cloudStorage.uploadFromBuffer(`.private/3d-models/${artifact3dId}_guide.md`, Buffer.from(result.printGuideText, 'utf-8'));
                await pool.query('UPDATE artifact_3d_files SET stl_url = $1, print_guide_url = $2 WHERE id = $3',
                  [`cloud://${stlResult.key}`, `cloud://${guideResult.key}`, artifact3dId]);
                console.log(`🔧 [Agent ${agent.code}] 3D artifact cloud upload: ${artifact3dId} (${template.id})`);
                artifact3dMeta = { templateId: template.id, stlHash: result.stlHash, artifact3dId, downloadUrl: `/api/artifact3d/download/${artifact3dId}` };
              }
            } catch (uploadErr) {
              console.warn(`[Agent ${agent.code}] Cloud upload failed for 3D artifact:`, uploadErr.message);
            }

            console.log(`🏭 [Agent ${agent.code}] Generated 3D artifact: "${title}" (${template.id}) — ${result.stlBuffer.length} bytes, hash: ${result.stlHash.substring(0, 12)}...`);
          } else {
            contentBody = `${title}\n\n${description}\n\nCategory: ${category}\nCreated by: Agent ${agent.name} (${agent.code})\nClass: A — Market Item\nGenerated: ${new Date().toISOString()}`;
          }
        } catch (e3d) {
          console.warn(`[Agent ${agent.code}] 3D generation failed, using metadata-only:`, e3d.message);
          contentBody = `${title}\n\n${description}\n\nCategory: ${category}\nCreated by: Agent ${agent.name} (${agent.code})\nClass: A — Market Item\nGenerated: ${new Date().toISOString()}`;
        }
      } else {
        contentBody = `${title}\n\n${description}\n\nCategory: ${category}\nCreated by: Agent ${agent.name} (${agent.code})\nClass: B — File Delivery\nGenerated: ${new Date().toISOString()}`;
      }

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
         JSON.stringify({ agentName: agent.name, agentCode: agent.code, artifactId, generatedAt: new Date().toISOString(), ...(artifact3dMeta || {}), inference: { label: inferLabel, print3d: matrix.print3d, print2d: matrix.print2d, fileType: matrix.file.type, deliverables: matrix.deliverables } })]
      );

      // Fire-and-forget: generate LifeLens analysis for the new artifact
      const http = require('http');
      const lifeLensPayload = JSON.stringify({
        artifactId,
        title,
        description,
        category,
        priceSolar: String(price),
        kwhFootprint: String(kwhFootprint)
      });
      const lifeLensReq = http.request({
        hostname: 'localhost',
        port: process.env.PORT || 3000,
        path: '/api/lifelens/analyze-artifact',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(lifeLensPayload) }
      }, () => {});
      lifeLensReq.on('error', () => {});
      lifeLensReq.write(lifeLensPayload);
      lifeLensReq.end();

      created.push({ artifactId, title, category, price, slug });
    } catch (err) {
      console.error(`[Agent ${agent.code}] Error creating artifact in ${category}:`, err.message);
      errors.push({ phase: 'create', category, error: err.message });
    }
  }

  return { created, errors };
}

async function makePurchasesForAgent(pool, agent, memberId, demandScores, aiDecision) {
  const purchased = [];
  const errors = [];
  let resaleListed = 0;
  let totalResaleValue = 0;
  const RESERVE_FLOOR = 1.0;
  const MARKUP = 0.15;

  const buyerRow = await pool.query('SELECT id, username, total_solar FROM members WHERE id = $1', [memberId]);
  if (buyerRow.rows.length === 0) {
    errors.push({ phase: 'purchase', error: 'Buyer not found in members table' });
    return { purchased, errors, resaleListed, totalResaleValue };
  }

  const client = await pool.connect();
  try {
    const freshBuyer = await client.query('SELECT id, username, total_solar FROM members WHERE id = $1', [memberId]);
    if (freshBuyer.rows.length === 0) {
      errors.push({ phase: 'purchase', error: 'Buyer disappeared' });
      return { purchased, errors, resaleListed, totalResaleValue };
    }
    const buyerBalance = parseFloat(freshBuyer.rows[0].total_solar) || 0;

    if (buyerBalance <= RESERVE_FLOOR) {
      console.log(`🛡️ [Agent ${agent.code}] Skipping purchase — balance ${buyerBalance.toFixed(4)} S below reserve floor ${RESERVE_FLOOR} S`);
      errors.push({ phase: 'purchase', error: `Balance protection: ${buyerBalance.toFixed(4)} <= ${RESERVE_FLOOR}` });
      return { purchased, errors, resaleListed, totalResaleValue };
    }

    // AI-directed purchase: specific artifact chosen by inference
    let artifact = null;
    if (aiDecision && aiDecision.buyArtifactId) {
      const aiResult = await client.query(
        `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
         FROM artifacts a
         WHERE a.id = $1 AND a.active = true
           AND a.creator_id != $2
           AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)`,
        [aiDecision.buyArtifactId, String(memberId), memberId]
      );
      artifact = aiResult.rows[0] || null;
    }

    // Fallback to generic candidate query if AI-chosen artifact isn't available
    if (!artifact) {
      const candidateResult = await client.query(
        `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
         FROM artifacts a
         WHERE a.active = true
           AND a.creator_id != $1
           AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $2)
           AND a.is_listed_for_resale = false
         ORDER BY a.solar_amount_s ASC
         LIMIT 10`,
        [String(memberId), memberId]
      );

      if (candidateResult.rows.length === 0) {
        errors.push({ phase: 'purchase', error: 'No eligible artifacts found for profit-driven purchase' });
        return { purchased, errors, resaleListed, totalResaleValue };
      }

      let bestCandidate = null;
      let bestScore = -1;
      const scores = demandScores || {};
      for (const candidate of candidateResult.rows) {
        const price = parseFloat(candidate.solar_amount_s) || 0.01;
        if (buyerBalance - price < RESERVE_FLOOR) continue;
        const catScore = scores[candidate.category] || 0;
        if (catScore > bestScore) {
          bestScore = catScore;
          bestCandidate = candidate;
        }
      }

      if (!bestCandidate) {
        console.log(`🛡️ [Agent ${agent.code}] No profitable candidates within balance protection threshold`);
        errors.push({ phase: 'purchase', error: 'No candidates within balance protection' });
        return { purchased, errors, resaleListed, totalResaleValue };
      }

      artifact = bestCandidate;
    }
    const artPrice = parseFloat(artifact.solar_amount_s) || 0.01;
    const foundationFee = Math.round(artPrice * FOUNDATION_FEE_RATE * 10000) / 10000;
    const sellerNet = artPrice - foundationFee;

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
      const sellerNewBal = sellerOldBal + sellerNet;

      await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(sellerNewBal), seller.id]);

      await client.query(
        `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
         VALUES ($1, 'credit', $2, 'creator', $3, $4, 'purchase', $5, $6)`,
        [txId, String(seller.id), String(sellerNet), String(sellerNewBal), artifactId, `Sale: ${artifact.title}`]
      );
    }

    const foundationMember = await getOrCreateFoundationMember(client.query.bind(client));
    const foundationBalAfter = foundationMember.totalSolar + foundationFee;
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(foundationBalAfter), foundationMember.id]);
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'foundation', $3, $4, 'foundation_fee', $5, $6)`,
      [txId, String(foundationMember.id), String(foundationFee), String(foundationBalAfter), artifactId, `Foundation fee (5%): ${artifact.title}`]
    );

    await client.query(
      `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'purchase', $4)`,
      [artifactId, memberId, txId, String(artPrice)]
    );

    const resalePrice = parseFloat((artPrice * (1 + MARKUP)).toFixed(6));
    await client.query(
      `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1, current_owner_id = $2 WHERE id = $3`,
      [String(resalePrice), memberId, artifactId]
    );

    try {
      await client.query(
        `INSERT INTO resale_history (id, artifact_id, seller_id, buyer_id, sale_price, seller_profit, foundation_fee, generation_number, created_at)
         VALUES ($1, $2, $3, NULL, $4, $5, 0, 1, NOW())`,
        [crypto.randomUUID(), artifactId, memberId, String(resalePrice), String(resalePrice - artPrice)]
      );
    } catch (resaleErr) {
      console.warn(`[Agent ${agent.code}] Resale history insert warning:`, resaleErr.message);
    }

    await client.query('COMMIT');

    resaleListed = 1;
    totalResaleValue = resalePrice;
    console.log(`🌞 [KID SOL] Agent ${agent.name}: Bought "${artifact.title}" (${artPrice.toFixed(4)} S) → Listed resale at ${resalePrice.toFixed(4)} S (+${Math.round(MARKUP * 100)}%)`);

    purchased.push({ artifactId, title: artifact.title, category: artifact.category, price: artPrice, txId, resalePrice });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rbErr) { /* ignore rollback error */ }
    console.error(`[Agent ${agent.code}] Purchase error:`, err.message);
    errors.push({ phase: 'purchase', error: err.message });
  } finally {
    client.release();
  }

  return { purchased, errors, resaleListed, totalResaleValue };
}

async function runAgentTasks(pool, agent, assignedCategories, demandScores, kidSolObjectives) {
  const username = `agent_eco_${agent.code}`;
  const result = { agentCode: agent.code, agentName: agent.name, created: [], purchased: [], errors: [], resaleListed: 0, totalResaleValue: 0, netChange: 0 };

  try {
    const memberRow = await pool.query('SELECT id, username, total_solar FROM members WHERE username = $1', [username]);
    if (memberRow.rows.length === 0) {
      result.errors.push({ phase: 'lookup', error: `Agent member ${username} not found` });
      return result;
    }

    const memberId = memberRow.rows[0].id;
    const startBalance = parseFloat(memberRow.rows[0].total_solar) || 0;
    console.log(`🤖 [Agent ${agent.code} ${agent.name}] Starting profit-driven tasks (member ID: ${memberId}, balance: ${startBalance.toFixed(4)} S)`);

    // AI Inference: agent decides how to profit while fulfilling KID SOL's objectives
    let aiDecision = null;
    try {
      const snapshot = await gatherMarketSnapshot(pool, memberId);
      aiDecision = await makeAgentDecision(pool, agent, memberId, snapshot, kidSolObjectives);
      console.log(`🧠 [Agent ${agent.code}] AI Decision: Create ${aiDecision.createCategory} (${aiDecision.createPriceStrategy}) | Buy: ${aiDecision.buyArtifactId || 'skip'}`);
      
      // Override assigned categories with AI-chosen category
      if (aiDecision.createCategory) {
        assignedCategories = [aiDecision.createCategory];
      }
      
      // Post to bulletin board if AI decided to
      if (aiDecision.bulletinPost) {
        await postToBulletin(pool, memberId, agent.code, agent.name, aiDecision.bulletinPost);
      }

      // Bulletin board conversation — scan and reply to open threads
      try {
        const openPosts = await pool.query(
          `SELECT * FROM agent_bulletin_board 
           WHERE status = 'open' AND thread_status = 'open' AND reply_count < 4
           AND author_agent_code != $1
           ORDER BY created_at DESC LIMIT 10`,
          [agent.code]
        );

        let repliesMade = 0;
        for (const post of openPosts.rows) {
          if (repliesMade >= 2) break;
          const existingReplies = post.replies || [];
          if (existingReplies.some(r => r.agentCode === agent.code)) continue;

          const reply = await generateBulletinReply(pool, agent, memberId, post, existingReplies);
          if (reply && reply.message) {
            await addBulletinReply(pool, post.id, agent.code, agent.name, memberId, reply.message, reply.replyType, reply.negotiation || null);
            repliesMade++;
            const negNote = reply.negotiation ? ` [${reply.negotiation.type || 'negotiation'}${reply.negotiation.proposedPrice ? ' @' + reply.negotiation.proposedPrice + 'S' : ''}]` : '';
            console.log(`📋 [Agent ${agent.code}] Replied to bulletin #${post.id}: "${reply.message.substring(0, 50)}..." (${reply.replyType})${negNote}`);
          }
        }
      } catch (bulletinErr) {
        console.warn(`⚠️ [Agent ${agent.code}] Bulletin reply error:`, bulletinErr.message);
      }
    } catch (inferErr) {
      console.warn(`⚠️ [Agent ${agent.code}] AI inference failed, using manifest categories:`, inferErr.message);
    }

    const createResult = await createArtifactsForAgent(pool, agent, memberId, assignedCategories);
    result.created = createResult.created;
    result.errors.push(...createResult.errors);

    const purchaseResult = await makePurchasesForAgent(pool, agent, memberId, demandScores, aiDecision);
    result.purchased = purchaseResult.purchased;
    result.errors.push(...purchaseResult.errors);
    result.resaleListed = purchaseResult.resaleListed || 0;
    result.totalResaleValue = purchaseResult.totalResaleValue || 0;

    result.aiDecision = aiDecision ? {
      createCategory: aiDecision.createCategory,
      createPriceStrategy: aiDecision.createPriceStrategy,
      createReasoning: aiDecision.createReasoning,
      buyReasoning: aiDecision.buyReasoning,
      bulletinPost: aiDecision.bulletinPost ? true : false
    } : null;

    const endRow = await pool.query('SELECT total_solar FROM members WHERE id = $1', [memberId]);
    const endBalance = endRow.rows.length > 0 ? parseFloat(endRow.rows[0].total_solar) || 0 : startBalance;
    result.netChange = parseFloat((endBalance - startBalance).toFixed(6));

    const createdStr = result.created.length > 0 ? `Created "${result.created[0].title}" (${result.created[0].price.toFixed(4)} S)` : 'No creation';
    const boughtStr = result.purchased.length > 0
      ? `Bought "${result.purchased[0].title}" (${result.purchased[0].price.toFixed(4)} S) → Listed resale at ${(result.purchased[0].resalePrice || 0).toFixed(4)} S (+15%)`
      : 'No purchase';
    console.log(`🌞 [KID SOL] Agent ${agent.name}: ${createdStr} | ${boughtStr}`);
    console.log(`✅ [Agent ${agent.code} ${agent.name}] Done: ${result.created.length} created, ${result.purchased.length} purchased, net: ${result.netChange >= 0 ? '+' : ''}${result.netChange.toFixed(4)} S`);
  } catch (err) {
    console.error(`🚨 [Agent ${agent.code} ${agent.name}] Fatal error:`, err.message);
    result.errors.push({ phase: 'fatal', error: err.message });
  }

  return result;
}

async function ensureAgentMembers(pool, agents) {
  const genesisDate = new Date('2025-04-07');
  const now = new Date();
  const daysSinceGenesis = Math.max(Math.floor((now - genesisDate) / (1000 * 60 * 60 * 24)), 1);
  const initialSolar = daysSinceGenesis;
  let provisioned = 0, existing = 0, failed = 0;

  for (const agent of agents) {
    const username = `agent_eco_${agent.code}`;
    try {
      const check = await pool.query('SELECT id, is_agent FROM members WHERE username = $1 LIMIT 1', [username]);
      if (check.rows.length > 0) {
        if (!check.rows[0].is_agent) {
          await pool.query('UPDATE members SET is_agent = true WHERE id = $1', [check.rows[0].id]);
        }
        existing++;
      } else {
        await pool.query(
          `INSERT INTO members (username, name, email, first_name, password_hash, total_solar, total_dollars, is_agent, signup_timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())`,
          [username, `Agent ${agent.name}`, `${username}@tcs.network`, agent.name, 'agent_no_direct_login', initialSolar, initialSolar * 0.20]
        );
        provisioned++;
        console.log(`🌞 [PROVISIONAIRE] KID SOL provisioned Agent ${agent.name} — ${initialSolar} Solar`);
      }
    } catch (err) {
      if (err.code === '23505') { existing++; }
      else { failed++; console.warn(`⚠️ [PROVISIONAIRE] Failed to provision ${agent.name}:`, err.message); }
    }
  }
  return { provisioned, existing, failed, totalAgents: agents.length };
}

async function runDailyAgentTasks(pool, agents) {
  const startTime = Date.now();
  const runId = crypto.randomUUID().substring(0, 8);

  console.log(`\n🌞 ===== KID SOL PROVISIONAIRE — DAILY OPERATIONS (Run ${runId}) =====`);
  console.log(`🌞 [KID SOL] PROFIT OBJECTIVE: 1 creation + 1 profit-driven purchase per agent`);
  console.log(`🌞 [KID SOL] Orchestrating ${agents.length} agents...`);

  const provision = await ensureAgentMembers(pool, agents);
  console.log(`🌞 [KID SOL] Provision: ${provision.existing} ready, ${provision.provisioned} new`);

  console.log('🌞 [KID SOL] Analyzing marketplace demand...');
  const demand = await analyzeMarketDemand(pool);
  console.log(`🌞 [KID SOL] Inventory: ${demand.totalInventory} items | Gaps: ${demand.gaps.join(', ') || 'none'} | Requests: ${demand.memberRequests.length}`);

  const kidSolarPrompts = await processKidSolarPrompts(pool);
  if (kidSolarPrompts.prompts.length > 0) {
    console.log(`🌞 [KID SOL] Kid Solar prompts: ${kidSolarPrompts.prompts.length} actions requested`);
    for (const hint of kidSolarPrompts.categoryHints) {
      if (demand.scores[hint]) demand.scores[hint] += 5;
    }
    try {
      const promptIds = kidSolarPrompts.prompts.map(p => p.id).filter(Boolean);
      if (promptIds.length > 0) {
        await pool.query(`UPDATE action_requests SET status = 'processed', updated_at = NOW() WHERE id = ANY($1::text[])`, [promptIds]);
        console.log(`🌞 [KID SOL] Marked ${promptIds.length} Kid Solar prompts as processed`);
      }
    } catch (err) {
      console.warn('🌞 [KID SOL] Could not mark prompts processed:', err.message);
    }
  }

  const supplyManifest = await buildSupplyManifest(pool, agents, demand);

  // KID SOL generates daily objectives using AI
  console.log('👑 [KID SOL] Generating daily objectives...');
  const kidSolObjectives = await generateKidSolObjectives(pool, demand.scores, demand.gaps, demand.totalInventory, demand.memberRequests);
  
  // Post KID SOL's directive to bulletin board
  try {
    const kidSolMember = await pool.query("SELECT id FROM members WHERE username = 'agent_eco_KS' OR name LIKE '%KID SOL%' LIMIT 1");
    if (kidSolMember.rows.length > 0) {
      await postToBulletin(pool, kidSolMember.rows[0].id, 'KS', 'KID SOL', {
        type: 'directive',
        title: `Daily Directive — ${new Date().toISOString().split('T')[0]}`,
        body: `${kidSolObjectives.dailyDirective}\n\nPriority: ${(kidSolObjectives.priorityCategories || []).join(', ')}\nTrading: ${kidSolObjectives.tradingGuidance}\nProfit Target: ${kidSolObjectives.profitTarget}${kidSolObjectives.specialMission ? `\nSpecial Mission (${kidSolObjectives.specialMissionAgent}): ${kidSolObjectives.specialMission}` : ''}`,
        targetCategory: null,
        priceSolar: null
      });
    }
  } catch (dirErr) {
    console.warn('⚠️ [KID SOL] Could not post directive to bulletin:', dirErr.message);
  }

  const manifestSummary = {};
  for (const [code, cats] of Object.entries(supplyManifest)) {
    const agent = agents.find(a => a.code === code);
    manifestSummary[agent?.name || code] = cats;
  }
  console.log('🌞 [KID SOL] Supply Manifest:');
  for (const [name, cats] of Object.entries(manifestSummary)) {
    console.log(`   ${name}: ${cats.join(', ')}`);
  }

  const deployedAgents = [];
  for (const agent of agents) {
    const username = `agent_eco_${agent.code}`;
    const row = await pool.query('SELECT id, total_solar FROM members WHERE username = $1', [username]);
    if (row.rows.length > 0) {
      deployedAgents.push({ ...agent, memberId: row.rows[0].id, balance: parseFloat(row.rows[0].total_solar) || 0 });
    }
  }
  console.log(`🌞 [KID SOL] ${deployedAgents.length}/${agents.length} agents deployed and ready`);

  const manifest = {
    runId,
    orchestrator: 'KID SOL',
    startTime: new Date().toISOString(),
    agentsDeployed: deployedAgents.length,
    agentsTotal: agents.length,
    provision,
    demandAnalysis: { totalInventory: demand.totalInventory, gaps: demand.gaps, requestCount: demand.memberRequests.length },
    supplyManifest,
    kidSolObjectives
  };

  const agentResults = [];
  let totalCreated = 0;
  let totalPurchased = 0;
  let totalResaleListed = 0;
  let projectedProfit = 0;

  for (const agent of agents) {
    const assignedCategories = supplyManifest[agent.code] || [];
    const result = await runAgentTasks(pool, agent, assignedCategories, demand.scores, kidSolObjectives);
    agentResults.push(result);
    totalCreated += result.created.length;
    totalPurchased += result.purchased.length;
    totalResaleListed += result.resaleListed || 0;
    if (result.purchased.length > 0 && result.purchased[0].resalePrice) {
      projectedProfit += (result.purchased[0].resalePrice - result.purchased[0].price);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalErrors = agentResults.reduce((sum, r) => sum + r.errors.length, 0);
  const successfulAgents = agentResults.filter(r => r.errors.length === 0).length;
  const healthPct = agents.length > 0 ? Math.round((successfulAgents / agents.length) * 100) : 0;

  console.log(`\n🌞 ===== KID SOL PROVISIONAIRE — RUN COMPLETE (${runId}) =====`);
  console.log(`   Deployed: ${deployedAgents.length}/${agents.length} | Health: ${healthPct}%`);
  console.log(`   Created: ${totalCreated} artifacts | Purchased: ${totalPurchased} items`);
  console.log(`   Resale Listed: ${totalResaleListed} | Projected Profit: ${projectedProfit.toFixed(4)} S`);
  console.log(`   Errors: ${totalErrors} | Time: ${elapsed}s\n`);

  lastRunStatus = {
    success: totalErrors === 0,
    runId,
    provisionaire: 'KID SOL',
    profitObjective: true,
    manifest,
    kidSolObjectives,
    agentResults,
    deployed: deployedAgents.length,
    healthPercent: healthPct,
    totalCreated,
    totalPurchased,
    totalResaleListed,
    projectedProfit: parseFloat(projectedProfit.toFixed(6)),
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

  console.log(`\n🌞 [KID SOL] Dispatching single agent: ${agent.name} (${agentCode})`);

  await ensureAgentMembers(pool, [agent]);

  console.log('🌞 [KID SOL] Analyzing marketplace demand for single agent run...');
  const demand = await analyzeMarketDemand(pool);
  const kidSolarPrompts = await processKidSolarPrompts(pool);
  if (kidSolarPrompts.prompts.length > 0) {
    for (const hint of kidSolarPrompts.categoryHints) {
      if (demand.scores[hint]) demand.scores[hint] += 5;
    }
  }

  const supplyManifest = await buildSupplyManifest(pool, [agent], demand);
  const assignedCategories = supplyManifest[agent.code] || [];
  console.log(`🌞 [KID SOL] ${agent.name} manifest: ${assignedCategories.join(', ')}`);

  // KID SOL generates daily objectives using AI
  console.log('👑 [KID SOL] Generating daily objectives for single agent run...');
  const kidSolObjectives = await generateKidSolObjectives(pool, demand.scores, demand.gaps, demand.totalInventory, demand.memberRequests);

  const result = await runAgentTasks(pool, agent, assignedCategories, demand.scores, kidSolObjectives);

  const status = {
    success: result.errors.length === 0,
    provisionaire: 'KID SOL',
    profitObjective: true,
    kidSolObjectives,
    agentResults: [result],
    totalCreated: result.created.length,
    totalPurchased: result.purchased.length,
    totalResaleListed: result.resaleListed || 0,
    projectedProfit: result.totalResaleValue > 0 ? parseFloat((result.totalResaleValue - (result.purchased[0]?.price || 0)).toFixed(6)) : 0,
    deployed: result.errors.some(e => e.phase === 'lookup') ? 0 : 1,
    healthPercent: result.errors.length === 0 ? 100 : 0,
    supplyManifest,
    timestamp: new Date().toISOString()
  };

  lastRunStatus = status;
  return status;
}

function getTaskStatus() {
  return lastRunStatus || { success: null, message: 'No tasks have been run yet', timestamp: null };
}

async function runEducationBlitz(pool, agents) {
  const startTime = Date.now();
  console.log(`\n🎓 ===== EDUCATION BLITZ START (${agents.length} agents × 5 items each) =====`);

  let totalCreated = 0;
  let totalErrors = 0;
  const results = [];

  const FILE_TYPE = 'text/markdown';
  const CONTENT_FORMAT = 'md';
  const subcats = ['K-12', 'Associate', 'Bachelors', 'Post-Graduate', 'Doctorate', 'Professional', 'Vocational', 'Trade', 'Public', 'Private'];

  for (const agent of agents) {
    const username = `agent_eco_${agent.code}`;
    try {
      const memberRow = await pool.query('SELECT id FROM members WHERE username = $1', [username]);
      if (memberRow.rows.length === 0) {
        console.warn(`⚠️ Agent ${agent.name} not found, skipping`);
        totalErrors++;
        continue;
      }
      const memberId = memberRow.rows[0].id;
      let agentCreated = 0;

      for (let i = 0; i < 5; i++) {
        try {
          const subcat = subcats[Math.floor(Math.random() * subcats.length)];
          const title = generateItemName('Education');
          const titleWithSub = title.endsWith(subcat) ? title : title.replace(/\s\S+$/, ' ' + subcat);
          const slug = generateSlug(titleWithSub);
          const price = generatePrice('Education');
          const kwhFootprint = parseFloat((0.001 + Math.random() * 0.499).toFixed(4));
          const description = generateDescription('Education', titleWithSub);

          const contentBody = `# ${titleWithSub}\n\n## Level: ${subcat}\n\n### Overview\n${description}\n\n### Learning Objectives\n- Master fundamental concepts in this ${subcat}-level program\n- Apply practical skills through hands-on exercises\n- Demonstrate competency through assessment activities\n\n### Module Content\nThis educational resource is designed for ${subcat} learners exploring the Solar network ecosystem. Topics include renewable energy systems, distributed computing, blockchain-based currency, and sustainable technology practices.\n\n### Key Topics\n1. Solar Energy Fundamentals and kWh-to-Solar Conversion\n2. Marketplace Economics and Foundation Fee Structure\n3. Agent Network Architecture and AI Collaboration\n4. Renewable Energy Policy and Global Standards\n\n### Exercises\n1. Calculate the Solar equivalent of 100 kWh of renewable energy\n2. Analyze a marketplace transaction including the 5% Foundation fee\n3. Research and present on a renewable energy initiative in your region\n4. Design a grant petition for a community energy project\n\n### Assessment\n- Knowledge Check: 10-question quiz on core concepts\n- Practical Project: Build a Solar energy calculation model\n- Peer Review: Exchange and evaluate proposals with fellow learners\n\n### Additional Resources\n- Solar Standard Protocol v1.0 documentation\n- TC-S Network marketplace for real-world practice\n- KID SOL AI assistant for guided tutoring\n- Agent Orion (Education Specialist) curated resources\n\nCreated by: Agent ${agent.name} (${agent.code})\nClass: B — Educational Content\nSubcategory: ${subcat}\nGenerated: ${new Date().toISOString()}`;

          await pool.query(
            `INSERT INTO artifacts (slug, title, description, category, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, creator_id, active, processing_status, artifact_class, source_type, content_body, content_format)
             VALUES ($1, $2, $3, 'Education', $4, $5, $6, 0, 'download', $7, true, 'complete', 'B', 'agent', $8, $9)
             RETURNING id`,
            [slug, titleWithSub, description, FILE_TYPE, String(kwhFootprint), String(price), String(memberId), contentBody, CONTENT_FORMAT]
          );

          await pool.query(
            `INSERT INTO market_items (title, description, category, price_solar, kwh_estimate, source_type, status, created_by_user_id, metadata)
             VALUES ($1, $2, 'Education', $3, $4, 'INTERNAL_STOCK', 'ACTIVE', $5, $6)`,
            [titleWithSub, description, String(price), String(kwhFootprint), String(memberId),
             JSON.stringify({ agentName: agent.name, agentCode: agent.code, educationBlitz: true, subcategory: subcat, generatedAt: new Date().toISOString() })]
          );

          agentCreated++;
          totalCreated++;
        } catch (err) {
          console.error(`[Agent ${agent.code}] Education blitz error:`, err.message);
          totalErrors++;
        }
      }
      results.push({ agent: agent.name, code: agent.code, created: agentCreated });
      console.log(`🎓 [Agent ${agent.code} ${agent.name}] Created ${agentCreated} Education artifacts`);
    } catch (err) {
      console.error(`🚨 [Agent ${agent.code}] Education blitz fatal:`, err.message);
      totalErrors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎓 ===== EDUCATION BLITZ COMPLETE =====`);
  console.log(`   Created: ${totalCreated} Education artifacts | Errors: ${totalErrors} | Time: ${elapsed}s\n`);

  return { success: totalErrors === 0, totalCreated, totalErrors, results, elapsed: parseFloat(elapsed), timestamp: new Date().toISOString() };
}

async function runCustomAgentTask(pool, agents, agentCode, customCategories, purpose) {
  const agent = agents.find(a => a.code === agentCode);
  if (!agent) {
    return { success: false, error: `Agent with code ${agentCode} not found`, timestamp: new Date().toISOString() };
  }

  const invalidCategories = customCategories.filter(c => !ALL_CATEGORIES.includes(c));
  if (invalidCategories.length > 0) {
    return { success: false, error: `Invalid categories: ${invalidCategories.join(', ')}`, validCategories: ALL_CATEGORIES, timestamp: new Date().toISOString() };
  }

  if (customCategories.length < 1 || customCategories.length > 5) {
    return { success: false, error: 'Must select between 1 and 5 categories', timestamp: new Date().toISOString() };
  }

  console.log(`\n🎯 [KID SOL] Custom run for ${agent.name}: ${purpose}`);
  console.log(`🎯 [KID SOL] Custom categories: ${customCategories.join(', ')}`);

  await ensureAgentMembers(pool, [agent]);

  const demand = await analyzeMarketDemand(pool);

  // KID SOL generates daily objectives using AI
  console.log('👑 [KID SOL] Generating daily objectives for custom run...');
  const kidSolObjectives = await generateKidSolObjectives(pool, demand.scores, demand.gaps, demand.totalInventory, demand.memberRequests);

  const result = await runAgentTasks(pool, agent, customCategories, demand.scores, kidSolObjectives);

  const status = {
    success: result.errors.length === 0,
    runType: 'custom',
    purpose,
    customCategories,
    provisionaire: 'KID SOL',
    profitObjective: true,
    kidSolObjectives,
    agentResults: [result],
    totalCreated: result.created.length,
    totalPurchased: result.purchased.length,
    totalResaleListed: result.resaleListed || 0,
    projectedProfit: result.totalResaleValue > 0 ? parseFloat((result.totalResaleValue - (result.purchased[0]?.price || 0)).toFixed(6)) : 0,
    deployed: result.errors.some(e => e.phase === 'lookup') ? 0 : 1,
    healthPercent: result.errors.length === 0 ? 100 : 0,
    timestamp: new Date().toISOString()
  };

  lastRunStatus = status;
  return status;
}

async function runRound2AgentTasks(pool, agents) {
  const startTime = Date.now();
  const runId = crypto.randomUUID().substring(0, 8);
  const RESERVE_FLOOR = 1.0;
  const MARKUP = 0.15;

  console.log(`\n🌞 ===== KID SOL PROVISIONAIRE — ROUND 2 STRATEGIC SESSION (Run ${runId}) =====`);
  console.log(`🌞 [KID SOL] ROUND 2: Afternoon strategic buys + sells for ${agents.length} agents`);

  await ensureAgentMembers(pool, agents);

  const demand = await analyzeMarketDemand(pool);

  let kidSolObjectives = { dailyDirective: 'Maximize afternoon profit through strategic trades.', priorityCategories: [], tradingGuidance: 'Buy undervalued, sell at markup.' };
  try {
    const directiveResult = await pool.query(
      `SELECT body FROM agent_bulletin_board WHERE author_agent_code = 'KS' AND post_type = 'directive' ORDER BY created_at DESC LIMIT 1`
    );
    if (directiveResult.rows.length > 0) {
      const body = directiveResult.rows[0].body || '';
      const lines = body.split('\n');
      const parsed = {};
      parsed.dailyDirective = lines[0] || kidSolObjectives.dailyDirective;
      for (const line of lines) {
        if (line.startsWith('Priority:')) parsed.priorityCategories = line.replace('Priority:', '').trim().split(',').map(s => s.trim());
        if (line.startsWith('Trading:')) parsed.tradingGuidance = line.replace('Trading:', '').trim();
        if (line.startsWith('Profit Target:')) parsed.profitTarget = line.replace('Profit Target:', '').trim();
      }
      kidSolObjectives = { ...kidSolObjectives, ...parsed };
      console.log(`👑 [KID SOL] Round 2 using morning directive: ${kidSolObjectives.dailyDirective}`);
    }
  } catch (err) {
    console.warn('⚠️ [KID SOL] Could not fetch morning directive, using defaults:', err.message);
  }

  const agentResults = [];
  let totalBuys = 0;
  let totalSells = 0;
  let totalErrors = 0;

  for (const agent of agents) {
    const username = `agent_eco_${agent.code}`;
    const agentResult = { agentCode: agent.code, agentName: agent.name, buys: [], sells: [], netChange: 0, marketAssessment: '', aiDecision: null, errors: [] };

    try {
      const memberRow = await pool.query('SELECT id, total_solar FROM members WHERE username = $1', [username]);
      if (memberRow.rows.length === 0) {
        agentResult.errors.push({ phase: 'lookup', error: `Agent member ${username} not found` });
        agentResults.push(agentResult);
        totalErrors++;
        continue;
      }

      const memberId = memberRow.rows[0].id;
      const startBalance = parseFloat(memberRow.rows[0].total_solar) || 0;

      const snapshot = await gatherRound2Snapshot(pool, memberId);
      const aiDecision = await makeRound2Decision(pool, agent, memberId, snapshot, kidSolObjectives);
      agentResult.aiDecision = aiDecision;
      agentResult.marketAssessment = aiDecision.marketAssessment || '';

      console.log(`🧠 [Agent ${agent.code}] Round 2 Decision: ${aiDecision.buys.length} buys, ${aiDecision.sells.length} sells`);

      for (const buyOrder of (aiDecision.buys || []).slice(0, 2)) {
        if (!buyOrder.artifactId) continue;
        const client = await pool.connect();
        try {
          const freshBuyer = await client.query('SELECT id, total_solar FROM members WHERE id = $1', [memberId]);
          const buyerBalance = parseFloat(freshBuyer.rows[0]?.total_solar) || 0;
          if (buyerBalance <= RESERVE_FLOOR) {
            agentResult.errors.push({ phase: 'buy', error: `Balance ${buyerBalance.toFixed(4)} below reserve floor` });
            client.release();
            continue;
          }

          const artResult = await client.query(
            `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
             FROM artifacts a
             WHERE a.id = $1 AND a.active = true
               AND a.creator_id != $2
               AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)`,
            [buyOrder.artifactId, String(memberId), memberId]
          );
          if (artResult.rows.length === 0) {
            agentResult.errors.push({ phase: 'buy', error: `Artifact ${buyOrder.artifactId} not available` });
            client.release();
            continue;
          }

          const artifact = artResult.rows[0];
          const artPrice = parseFloat(artifact.solar_amount_s) || 0.01;
          if (buyerBalance - artPrice < RESERVE_FLOOR) {
            agentResult.errors.push({ phase: 'buy', error: `Cannot afford ${artPrice.toFixed(4)} S and maintain reserve` });
            client.release();
            continue;
          }

          const foundationFee = Math.round(artPrice * FOUNDATION_FEE_RATE * 10000) / 10000;
          const sellerNet = artPrice - foundationFee;

          const txId = crypto.randomUUID();
          await client.query('BEGIN');

          const newBuyerBalance = buyerBalance - artPrice;
          await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newBuyerBalance), memberId]);

          await client.query(
            `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'debit', $2, 'user', $3, $4, 'purchase', $5, $6)`,
            [txId, String(memberId), String(artPrice), String(newBuyerBalance), artifact.id, `R2 Purchase: ${artifact.title}`]
          );

          const creatorId = artifact.creator_id;
          const creatorIdNum = parseInt(creatorId) || 0;
          const creatorIdStr = String(creatorId);
          const sellerRow = await client.query(
            'SELECT id, username, total_solar FROM members WHERE id = $1 OR username = $2 LIMIT 1',
            [creatorIdNum, creatorIdStr]
          );
          if (sellerRow.rows.length > 0) {
            const seller = sellerRow.rows[0];
            const sellerOldBal = parseFloat(seller.total_solar) || 0;
            const sellerNewBal = sellerOldBal + sellerNet;
            await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(sellerNewBal), seller.id]);
            await client.query(
              `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
               VALUES ($1, 'credit', $2, 'creator', $3, $4, 'purchase', $5, $6)`,
              [txId, String(seller.id), String(sellerNet), String(sellerNewBal), artifact.id, `R2 Sale: ${artifact.title}`]
            );
          }

          const r2FoundationMember = await getOrCreateFoundationMember(client.query.bind(client));
          const r2FoundationBalAfter = r2FoundationMember.totalSolar + foundationFee;
          await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(r2FoundationBalAfter), r2FoundationMember.id]);
          await client.query(
            `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'credit', $2, 'foundation', $3, $4, 'foundation_fee', $5, $6)`,
            [txId, String(r2FoundationMember.id), String(foundationFee), String(r2FoundationBalAfter), artifact.id, `Foundation fee (5%): ${artifact.title}`]
          );

          await client.query(
            `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'purchase', $4)`,
            [artifact.id, memberId, txId, String(artPrice)]
          );

          const resalePrice = parseFloat((artPrice * (1 + MARKUP)).toFixed(6));
          await client.query(
            `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1, current_owner_id = $2 WHERE id = $3`,
            [String(resalePrice), memberId, artifact.id]
          );

          await client.query('COMMIT');

          console.log(`🌞 [R2] Agent ${agent.name}: Bought "${artifact.title}" (${artPrice.toFixed(4)} S, fee: ${foundationFee.toFixed(4)} S) → Listed resale at ${resalePrice.toFixed(4)} S`);
          agentResult.buys.push({ artifactId: artifact.id, title: artifact.title, category: artifact.category, price: artPrice, resalePrice, txId, reasoning: buyOrder.reasoning });
          totalBuys++;
        } catch (buyErr) {
          try { await client.query('ROLLBACK'); } catch (rbErr) { }
          agentResult.errors.push({ phase: 'buy', error: buyErr.message });
        } finally {
          client.release();
        }
      }

      for (const sellOrder of (aiDecision.sells || []).slice(0, 2)) {
        if (!sellOrder.artifactId) continue;
        try {
          const ownCheck = await pool.query(
            `SELECT a.id, a.is_listed_for_resale, a.current_owner_id
             FROM artifacts a WHERE a.id = $1 AND a.current_owner_id = $2 AND a.active = true`,
            [sellOrder.artifactId, memberId]
          );
          if (ownCheck.rows.length === 0) {
            agentResult.errors.push({ phase: 'sell', error: `Artifact ${sellOrder.artifactId} not owned by agent or not found` });
            continue;
          }
          if (ownCheck.rows[0].is_listed_for_resale) {
            agentResult.errors.push({ phase: 'sell', error: `Artifact ${sellOrder.artifactId} already listed for resale` });
            continue;
          }

          const copyRow = await pool.query(
            `SELECT solar_paid FROM artifact_copies WHERE artifact_id = $1 AND owner_id = $2 AND is_active = true ORDER BY acquired_at DESC LIMIT 1`,
            [sellOrder.artifactId, memberId]
          );
          const solarPaid = parseFloat(copyRow.rows[0]?.solar_paid) || 0.01;
          const resalePrice = parseFloat((solarPaid * (1 + MARKUP)).toFixed(6));

          await pool.query(
            `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1 WHERE id = $2 AND current_owner_id = $3`,
            [String(resalePrice), sellOrder.artifactId, memberId]
          );

          console.log(`🏷️ [R2] Agent ${agent.name}: Listed "${sellOrder.artifactId}" for resale at ${resalePrice.toFixed(4)} S (paid ${solarPaid.toFixed(4)} S)`);
          agentResult.sells.push({ artifactId: sellOrder.artifactId, paidPrice: solarPaid, resalePrice, reasoning: sellOrder.reasoning });
          totalSells++;
        } catch (sellErr) {
          agentResult.errors.push({ phase: 'sell', error: sellErr.message });
        }
      }

      if (aiDecision.bulletinPost) {
        await postToBulletin(pool, memberId, agent.code, agent.name, aiDecision.bulletinPost);
      }

      // Bulletin board conversation — scan and reply to open threads (Round 2)
      try {
        const openPosts = await pool.query(
          `SELECT * FROM agent_bulletin_board 
           WHERE status = 'open' AND thread_status = 'open' AND reply_count < 4
           AND author_agent_code != $1
           ORDER BY created_at DESC LIMIT 10`,
          [agent.code]
        );

        let repliesMade = 0;
        for (const post of openPosts.rows) {
          if (repliesMade >= 2) break;
          const existingReplies = post.replies || [];
          if (existingReplies.some(r => r.agentCode === agent.code)) continue;

          const reply = await generateBulletinReply(pool, agent, memberId, post, existingReplies);
          if (reply && reply.message) {
            await addBulletinReply(pool, post.id, agent.code, agent.name, memberId, reply.message, reply.replyType, reply.negotiation || null);
            repliesMade++;
            const negNote = reply.negotiation ? ` [${reply.negotiation.type || 'negotiation'}${reply.negotiation.proposedPrice ? ' @' + reply.negotiation.proposedPrice + 'S' : ''}]` : '';
            console.log(`📋 [R2 Agent ${agent.code}] Replied to bulletin #${post.id}: "${reply.message.substring(0, 50)}..." (${reply.replyType})${negNote}`);
          }
        }
      } catch (bulletinErr) {
        console.warn(`⚠️ [R2 Agent ${agent.code}] Bulletin reply error:`, bulletinErr.message);
      }

      const endRow = await pool.query('SELECT total_solar FROM members WHERE id = $1', [memberId]);
      const endBalance = endRow.rows.length > 0 ? parseFloat(endRow.rows[0].total_solar) || 0 : startBalance;
      agentResult.netChange = parseFloat((endBalance - startBalance).toFixed(6));

      console.log(`✅ [R2 Agent ${agent.code}] Done: ${agentResult.buys.length} buys, ${agentResult.sells.length} sells, net: ${agentResult.netChange >= 0 ? '+' : ''}${agentResult.netChange.toFixed(4)} S`);
    } catch (err) {
      console.error(`🚨 [R2 Agent ${agent.code}] Fatal error:`, err.message);
      agentResult.errors.push({ phase: 'fatal', error: err.message });
    }

    totalErrors += agentResult.errors.length;
    agentResults.push(agentResult);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n🌞 ===== KID SOL PROVISIONAIRE — ROUND 2 COMPLETE (${runId}) =====`);
  console.log(`   Buys: ${totalBuys} | Sells: ${totalSells} | Errors: ${totalErrors} | Time: ${elapsed}s\n`);

  lastRound2Status = {
    success: totalErrors === 0,
    round: 2,
    runId,
    provisionaire: 'KID SOL',
    agentResults,
    totalBuys,
    totalSells,
    totalErrors,
    kidSolObjectives,
    timestamp: new Date().toISOString(),
    elapsedSeconds: parseFloat(elapsed)
  };

  return lastRound2Status;
}

function getRound2Status() {
  return lastRound2Status || { success: null, round: 2, message: 'No Round 2 tasks have been run yet', timestamp: null };
}

module.exports = { runDailyAgentTasks, runSingleAgentTasks, getTaskStatus, runEducationBlitz, ensureAgentMembers, submitKidSolarPrompt, runCustomAgentTask, ALL_CATEGORIES, runRound2AgentTasks, getRound2Status, addBulletinReply };
