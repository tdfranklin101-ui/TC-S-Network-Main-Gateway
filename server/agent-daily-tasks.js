const crypto = require('crypto');
const { generateKidSolObjectives, makeAgentDecision, gatherMarketSnapshot, postToBulletin, gatherRound2Snapshot, makeRound2Decision, generateBulletinReply, inferObjectiveNeeds, consultKidSolar } = require('./agent-inference');
const { normalizeCategory, getOfficialCategories, getCategoryIcon, getCategoryWithSubcategories } = require('./category-normalization');

async function addBulletinReply(pool, postId, agentCode, agentName, memberId, message, replyType, negotiation) {
  const post = await pool.query('SELECT * FROM agent_bulletin_board WHERE id = $1', [postId]);
  if (post.rows.length === 0) return null;
  const currentPost = post.rows[0];
  const isDirective = currentPost.post_type === 'directive';
  if (!isDirective && ((currentPost.reply_count || 0) >= 4)) return null;
  if (currentPost.thread_status !== 'open') return null;

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
  if (replyType === 'accept') {
    newThreadStatus = 'deal_accepted';
  } else if (replyType === 'decline') {
    newThreadStatus = 'no_deal';
  } else if (!isDirective && newReplyCount >= 4) {
    newThreadStatus = 'closed';
  }

  let finalPrice = currentPost.final_price;
  const priceThreshold = isDirective ? Infinity : 4;
  if (negotiation && negotiation.proposedPrice && (replyType === 'accept' || newReplyCount >= priceThreshold)) {
    finalPrice = negotiation.proposedPrice;
  }

  const result = await pool.query(
    `UPDATE agent_bulletin_board SET replies = $1, reply_count = $2, thread_status = $3, final_price = COALESCE($5, final_price), updated_at = NOW() WHERE id = $4 RETURNING *`,
    [JSON.stringify(replies), newReplyCount, newThreadStatus, postId, finalPrice]
  );

  if (newThreadStatus === 'deal_accepted' && finalPrice) {
    try {
      const originalPrice = parseFloat(currentPost.original_price || currentPost.price_solar) || 0;
      if (originalPrice > 0 && finalPrice !== originalPrice) {
        const isWanted = currentPost.post_type === 'wanted';
        const buyerMemberId = isWanted ? currentPost.author_member_id : memberId;
        const buyerCode = isWanted ? currentPost.author_agent_code : agentCode;
        const sellerMemberId = isWanted ? memberId : currentPost.author_member_id;
        const sellerCode = isWanted ? agentCode : currentPost.author_agent_code;

        let discountPct = Math.round((originalPrice - finalPrice) / originalPrice * 100 * 10000) / 10000;
        if (discountPct > 20) discountPct = 20;
        if (discountPct > 0) {
          const discountId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO negotiated_discounts (id, bulletin_thread_id, buyer_member_id, buyer_agent_code, seller_member_id, seller_agent_code, artifact_id, category, original_price, negotiated_price, discount_pct, status, expires_at, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW() + INTERVAL '48 hours', $12)`,
            [discountId, postId, buyerMemberId, buyerCode, sellerMemberId, sellerCode,
             null, currentPost.target_category || null,
             String(originalPrice), String(finalPrice), String(discountPct),
             JSON.stringify({ threadId: postId, postType: currentPost.post_type, agentName: agentName })]
          );
          const target = currentPost.related_artifact_id ? `artifact ${currentPost.related_artifact_id}` : `category ${currentPost.target_category || 'general'}`;
          console.log(`🤝 [Discount] Standing discount created: ${discountPct}% off for buyer agent ${buyerCode} on ${target}`);
        }
      }
    } catch (discountErr) {
      console.warn(`⚠️ [Discount] Failed to create negotiated discount for thread ${postId}:`, discountErr.message);
    }
  }

  return result.rows[0];
}

async function findNegotiatedDiscount(pool, buyerMemberId, artifactId, category) {
  try {
    const result = await pool.query(
      `SELECT * FROM negotiated_discounts
       WHERE buyer_member_id = $1
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (artifact_id IS NULL AND category = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [buyerMemberId, category]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.warn(`⚠️ [Discount] Lookup failed for buyer ${buyerMemberId}:`, err.message);
    return null;
  }
}

const PLATFORM_USERNAME = 'tcs_foundation';
const PLATFORM_FEE_RATE = 0.05;
const CREATION_FEE = 0.000005;
const PLACEMENT_FEE = 0.000002;
const SOLAR_KWH_RATE = 1 / 4913;

const AGENT_BASE_PROFILES = {
  '01': { role: 'Senior Trader', creationSlots: 7, purchaseSlots: 3, priceMultiplier: 1.25, resaleMarkup: 0.25 }
};
let dynamicProfiles = {};

const RECOVERY_DONATION_PER_DONOR = 20;
const RECOVERY_TOP_DONOR_COUNT = 4;
const RECOVERY_DONOR_MIN_BALANCE = RECOVERY_DONATION_PER_DONOR + 5;
let currentRecoveringMemberIds = [];

function getCurrentRecoveringMemberIds() {
  return currentRecoveringMemberIds.slice();
}

function getAgentProfile(agentCode) {
  if (dynamicProfiles[agentCode]) return dynamicProfiles[agentCode];
  return AGENT_BASE_PROFILES[agentCode] || { role: 'Standard', creationSlots: 5, purchaseSlots: 5, priceMultiplier: 1.0, resaleMarkup: 0.15 };
}

const ARTIFACT_UTILITY_TYPES = {
  'Computronium': { type: 'rentable-software', label: 'Rentable Software', desc: 'Executable compute module — licensable for distributed processing' },
  'AI Tools': { type: 'ai-inference-prompt', label: 'AI Inference Prompt', desc: 'Ready-to-deploy AI prompt chain for inference tasks' },
  'AI Create': { type: 'ai-inference-prompt', label: 'AI Inference Prompt', desc: 'Generative AI prompt template for creative production' },
  'Software': { type: 'rentable-software', label: 'Rentable Software', desc: 'Licensed software module — deployable on Solar compute network' },
  'Utilities': { type: 'rentable-software', label: 'Rentable Software', desc: 'Utility tool — licensable for Solar network operations' },
  '3D Printing': { type: '3d-printer-code', label: '3D Printer Code', desc: 'Print-ready STL/G-code for physical fabrication' },
  'Writing': { type: 'book-movie-prompt', label: 'Book/Movie Prompt', desc: 'Literary blueprint — publishable manuscript or screenplay prompt' },
  'Videos': { type: 'book-movie-prompt', label: 'Book/Movie Prompt', desc: 'Film production prompt — scene direction and visual narrative' },
  'Video': { type: 'book-movie-prompt', label: 'Book/Movie Prompt', desc: 'Video production equipment spec — studio-grade gear configuration' },
  'Songs': { type: 'book-movie-prompt', label: 'Book/Movie Prompt', desc: 'Audio production prompt — composition and arrangement blueprint' },
  'Music': { type: 'rentable-software', label: 'Rentable Software', desc: 'Music production toolkit — licensable instrument and effect chains' },
  'Art': { type: 'ai-inference-prompt', label: 'AI Inference Prompt', desc: 'Visual art generation prompt — style, composition, and rendering parameters' },
  'Photo': { type: 'ai-inference-prompt', label: 'AI Inference Prompt', desc: 'Photography prompt — lighting, composition, and post-processing spec' },
  'Games': { type: 'rentable-software', label: 'Rentable Software', desc: 'Interactive game module — playable or licensable game engine asset' },
  'Education': { type: 'ai-inference-prompt', label: 'AI Inference Prompt', desc: 'Educational AI prompt — adaptive learning module for guided instruction' },
  'Docs': { type: 'ai-inference-prompt', label: 'AI Inference Prompt', desc: 'Documentation prompt — structured knowledge base template' },
  'Basic Needs': { type: 'digital-asset', label: 'Digital Asset', desc: 'Essential resource for community sustenance and access' },
  'Rent': { type: 'rentable-software', label: 'Rentable Software', desc: 'Cooperative space access license — time-bounded usage right' },
  'Energy': { type: 'rentable-software', label: 'Rentable Software', desc: 'Energy metering and optimization module — licensable grid tool' },
  'Culture': { type: 'book-movie-prompt', label: 'Book/Movie Prompt', desc: 'Cultural narrative prompt — heritage documentation and storytelling' },
  'Health & Wellness': { type: 'digital-asset', label: 'Digital Asset', desc: 'Wellness resource — health optimization guide or tool' },
  'Community': { type: 'digital-asset', label: 'Digital Asset', desc: 'Community coordination asset — governance and collaboration tool' }
};

function getArtifactUtility(category) {
  return ARTIFACT_UTILITY_TYPES[category] || { type: 'digital-asset', label: 'Digital Asset', desc: 'General digital artifact on the Solar network' };
}

async function kidSolRebalanceProfiles(pool, agents) {
  console.log('👑 [KID SOL] Portfolio analysis & agent rebalancing...');
  try {
    const balanceRows = await pool.query(
      `SELECT m.username, m.total_solar,
        (SELECT COUNT(*) FROM artifacts a WHERE a.creator_id = CAST(m.id AS TEXT) AND a.active = true) as artifact_count,
        (SELECT COALESCE(SUM(CAST(a.solar_amount_s AS NUMERIC)), 0) FROM artifacts a WHERE a.creator_id = CAST(m.id AS TEXT) AND a.active = true) as portfolio_value
       FROM members m WHERE m.username LIKE 'agent_eco_%'`
    );

    const agentData = {};
    let totalBalance = 0;
    let totalPortfolio = 0;
    let agentCount = 0;

    for (const row of balanceRows.rows) {
      const code = row.username.replace('agent_eco_', '');
      const balance = parseFloat(row.total_solar) || 0;
      const portfolioValue = parseFloat(row.portfolio_value) || 0;
      const artifactCount = parseInt(row.artifact_count) || 0;
      agentData[code] = { balance, portfolioValue, artifactCount, netWorth: balance + portfolioValue };
      totalBalance += balance;
      totalPortfolio += portfolioValue;
      agentCount++;
    }

    if (agentCount === 0) return;

    const avgBalance = totalBalance / agentCount;
    const avgPortfolio = totalPortfolio / agentCount;
    const avgNetWorth = (totalBalance + totalPortfolio) / agentCount;

    console.log(`👑 [KID SOL] Network: ${agentCount} agents | Avg Balance: ${avgBalance.toFixed(2)} S | Avg Portfolio: ${avgPortfolio.toFixed(2)} S (${Math.round(totalPortfolio / agentCount)} items avg)`);

    const newProfiles = {};
    for (const agent of agents) {
      const data = agentData[agent.code];
      if (!data) continue;

      const base = AGENT_BASE_PROFILES[agent.code] || {};
      const balanceRatio = avgBalance > 0 ? data.balance / avgBalance : 1;
      const portfolioRatio = avgPortfolio > 0 ? data.portfolioValue / avgPortfolio : 1;

      let role = base.role || 'Standard';
      let creationSlots = base.creationSlots || 5;
      let purchaseSlots = base.purchaseSlots || 5;
      let priceMultiplier = base.priceMultiplier || 1.0;
      let resaleMarkup = base.resaleMarkup || 0.15;

      if (balanceRatio < 0.85) {
        role = base.role ? `${base.role} (Boost)` : 'Recovery Mode';
        creationSlots = Math.min((base.creationSlots || 5) + 2, 9);
        purchaseSlots = Math.max((base.purchaseSlots || 5) - 2, 2);
        priceMultiplier = Math.max(priceMultiplier, 1.15);
        resaleMarkup = Math.max(resaleMarkup, 0.20);
      } else if (balanceRatio > 1.15) {
        role = base.role ? `${base.role} (Invest)` : 'Investor Mode';
        creationSlots = Math.max((base.creationSlots || 5) - 1, 3);
        purchaseSlots = Math.min((base.purchaseSlots || 5) + 1, 7);
      }

      if (portfolioRatio < 0.5 && balanceRatio >= 0.85) {
        creationSlots = Math.min(creationSlots + 1, 9);
        role = role.includes('(') ? role : `${role} (Build Stock)`;
      }

      newProfiles[agent.code] = { role, creationSlots, purchaseSlots, priceMultiplier, resaleMarkup };

      const changed = (creationSlots !== (base.creationSlots || 5)) || (purchaseSlots !== (base.purchaseSlots || 5));
      if (changed) {
        console.log(`   📊 ${agent.name} (${agent.code}): ${data.balance.toFixed(2)} S + ${data.portfolioValue.toFixed(2)} S portfolio (${data.artifactCount} items) → ${role} [create:${creationSlots} buy:${purchaseSlots} markup:${Math.round(resaleMarkup*100)}%]`);
      }
    }

    dynamicProfiles = newProfiles;
    console.log(`👑 [KID SOL] Rebalancing complete — ${Object.keys(newProfiles).length} agents profiled`);
  } catch (err) {
    console.warn('⚠️ [KID SOL] Rebalancing failed, using base profiles:', err.message);
    dynamicProfiles = {};
  }
}

async function processRecoveryDonations(pool, agents) {
  console.log('🤝 [KID SOL] Recovery check — top agents donate to recovering peers...');
  currentRecoveringMemberIds = [];
  try {
    const balRes = await pool.query(
      `SELECT m.id, m.username, m.total_solar
       FROM members m
       WHERE m.username LIKE 'agent_eco_%'
         AND m.username != 'agent_eco_KS'
         AND m.username != 'agent_eco_KSR'`
    );
    if (balRes.rows.length === 0) return { recovering: 0, donations: 0, transferred: 0 };

    const rows = balRes.rows.map(r => ({
      id: r.id,
      code: r.username.replace('agent_eco_', ''),
      balance: parseFloat(r.total_solar) || 0
    }));
    const avgBalance = rows.reduce((s, r) => s + r.balance, 0) / rows.length;

    const recovering = rows.filter(r => avgBalance > 0 && r.balance / avgBalance < 0.85);
    if (recovering.length === 0) {
      console.log('🤝 [KID SOL] No agents in recovery — no donations needed.');
      return { recovering: 0, donations: 0, transferred: 0 };
    }

    const recoveringIds = new Set(recovering.map(r => r.id));
    currentRecoveringMemberIds = recovering.map(r => String(r.id));

    const donors = rows
      .filter(r => !recoveringIds.has(r.id) && r.balance >= RECOVERY_DONOR_MIN_BALANCE)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, RECOVERY_TOP_DONOR_COUNT);

    if (donors.length === 0) {
      console.log(`🤝 [KID SOL] ${recovering.length} agents recovering, but no eligible donors with >= ${RECOVERY_DONOR_MIN_BALANCE} S balance.`);
      return { recovering: recovering.length, donations: 0, transferred: 0 };
    }

    console.log(`🤝 [KID SOL] Recovery: ${recovering.length} agents need help | ${donors.length} top donors selected`);
    console.log(`   Donors: ${donors.map(d => `${d.code} (${d.balance.toFixed(2)} S)`).join(', ')}`);
    console.log(`   Recipients: ${recovering.map(r => `${r.code} (${r.balance.toFixed(2)} S)`).join(', ')}`);

    let donationCount = 0;
    let totalTransferred = 0;

    for (const recipient of recovering) {
      for (const donor of donors) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const donorRow = await client.query('SELECT total_solar FROM members WHERE id = $1 FOR UPDATE', [donor.id]);
          const donorBal = parseFloat(donorRow.rows[0]?.total_solar) || 0;
          if (donorBal < RECOVERY_DONOR_MIN_BALANCE) {
            await client.query('ROLLBACK');
            continue;
          }
          const recipRow = await client.query('SELECT total_solar FROM members WHERE id = $1 FOR UPDATE', [recipient.id]);
          const recipBal = parseFloat(recipRow.rows[0]?.total_solar) || 0;

          const amount = RECOVERY_DONATION_PER_DONOR;
          const newDonorBal = donorBal - amount;
          const newRecipBal = recipBal + amount;
          const txId = crypto.randomUUID();

          await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newDonorBal), donor.id]);
          await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newRecipBal), recipient.id]);

          await client.query(
            `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'debit', $2, 'agent', $3, $4, 'recovery_donation', $5, $6)`,
            [txId, String(donor.id), String(amount), String(newDonorBal), String(recipient.id),
             `Recovery donation: top agent ${donor.code} → recovering agent ${recipient.code}`]
          );
          await client.query(
            `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'credit', $2, 'agent', $3, $4, 'recovery_donation', $5, $6)`,
            [txId, String(recipient.id), String(amount), String(newRecipBal), String(donor.id),
             `Recovery donation: from top agent ${donor.code}`]
          );

          await client.query('COMMIT');
          donor.balance = newDonorBal;
          recipient.balance = newRecipBal;
          donationCount++;
          totalTransferred += amount;
          console.log(`   💚 ${donor.code} → ${recipient.code}: ${amount} S (new balances: donor ${newDonorBal.toFixed(2)} S, recipient ${newRecipBal.toFixed(2)} S)`);
        } catch (err) {
          try { await client.query('ROLLBACK'); } catch (e) {}
          console.warn(`   ⚠️ Donation failed (${donor.code} → ${recipient.code}):`, err.message);
        } finally {
          client.release();
        }
      }
    }

    console.log(`🤝 [KID SOL] Recovery complete: ${donationCount} donations, ${totalTransferred.toFixed(2)} S transferred`);
    console.log(`🛒 [KID SOL] Purchase priority directive: artifacts from recovering agents will be purchased first this round`);
    return { recovering: recovering.length, donations: donationCount, transferred: totalTransferred };
  } catch (err) {
    console.warn('⚠️ [KID SOL] Recovery donations failed:', err.message);
    return { recovering: 0, donations: 0, transferred: 0, error: err.message };
  }
}

async function getAgentPortfolios(pool) {
  try {
    const result = await pool.query(
      `SELECT m.username,
        m.total_solar as balance,
        COUNT(a.id) as artifact_count,
        COALESCE(SUM(CAST(a.solar_amount_s AS NUMERIC)), 0) as portfolio_value,
        COALESCE(SUM(CASE WHEN a.is_listed_for_resale THEN CAST(COALESCE(a.resale_price, a.solar_amount_s) AS NUMERIC) ELSE 0 END), 0) as listed_value,
        COALESCE(SUM(CAST(a.solar_amount_s AS NUMERIC)), 0) as total_value
       FROM members m
       LEFT JOIN artifacts a ON a.creator_id = CAST(m.id AS TEXT) AND a.active = true
       WHERE m.username LIKE 'agent_eco_%'
       GROUP BY m.username, m.total_solar
       ORDER BY m.username`
    );

    const agentData = {};
    let totalBalance = 0;
    let totalPortfolio = 0;
    let agentCount = 0;
    for (const row of result.rows) {
      const code = row.username.replace('agent_eco_', '');
      const balance = parseFloat(row.balance) || 0;
      const portfolioValue = parseFloat(row.portfolio_value) || 0;
      agentData[code] = { balance, portfolioValue, artifactCount: parseInt(row.artifact_count) || 0, listedValue: parseFloat(row.listed_value) || 0, totalValue: parseFloat(row.total_value) || 0 };
      totalBalance += balance;
      totalPortfolio += portfolioValue;
      agentCount++;
    }

    const avgBalance = agentCount > 0 ? totalBalance / agentCount : 0;
    const avgPortfolio = agentCount > 0 ? totalPortfolio / agentCount : 0;

    const portfolios = {};
    for (const code of Object.keys(agentData)) {
      const d = agentData[code];
      const base = AGENT_BASE_PROFILES[code] || {};
      const balanceRatio = avgBalance > 0 ? d.balance / avgBalance : 1;
      const portfolioRatio = avgPortfolio > 0 ? d.portfolioValue / avgPortfolio : 1;

      let role = base.role || 'Standard';
      let creationSlots = base.creationSlots || 5;
      let purchaseSlots = base.purchaseSlots || 5;
      let priceMultiplier = base.priceMultiplier || 1.0;
      let resaleMarkup = base.resaleMarkup || 0.15;

      if (balanceRatio < 0.85) {
        role = base.role ? `${base.role} (Boost)` : 'Recovery Mode';
        creationSlots = Math.min((base.creationSlots || 5) + 2, 9);
        purchaseSlots = Math.max((base.purchaseSlots || 5) - 2, 2);
        priceMultiplier = Math.max(priceMultiplier, 1.15);
        resaleMarkup = Math.max(resaleMarkup, 0.20);
      } else if (balanceRatio > 1.15) {
        role = base.role ? `${base.role} (Invest)` : 'Investor Mode';
        creationSlots = Math.max((base.creationSlots || 5) - 1, 3);
        purchaseSlots = Math.min((base.purchaseSlots || 5) + 1, 7);
      }
      if (portfolioRatio < 0.5 && balanceRatio >= 0.85) {
        creationSlots = Math.min(creationSlots + 1, 9);
        role = role.includes('(') ? role : `${role} (Build Stock)`;
      }

      portfolios[code] = {
        balance: d.balance,
        artifactCount: d.artifactCount,
        portfolioValue: d.portfolioValue,
        listedValue: d.listedValue,
        totalValue: d.totalValue,
        netWorth: d.balance + d.portfolioValue,
        profile: { role, creationSlots, purchaseSlots, priceMultiplier, resaleMarkup }
      };
    }
    return portfolios;
  } catch (err) {
    console.warn('⚠️ Portfolio query failed:', err.message);
    return {};
  }
}

async function getOrCreateFoundationMember(queryFn) {
  const existing = await queryFn('SELECT id, username, total_solar FROM members WHERE username = $1 LIMIT 1', [PLATFORM_USERNAME]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, totalSolar: parseFloat(existing.rows[0].total_solar) || 0 };
  }
  const inserted = await queryFn(
    `INSERT INTO members (username, name, email, total_solar, total_dollars, is_agent, password_hash)
     VALUES ($1, $2, $3, '0.0000', 0, false, '$2b$12$foundationreservewallet000000000000000000000000000') RETURNING id, total_solar`,
    [PLATFORM_USERNAME, 'TC-S Platform Reserve', 'foundation@thecurrentsee.org']
  );
  return { id: inserted.rows[0].id, totalSolar: 0 };
}

const ITEM_PARTS = {
  'Computronium':{adj:['Quantum','Neural','Photonic','Lattice','Cryo','Nano','Hyper','Exascale','Coherent','Flux'],noun:['Compute Shard','Processing Unit','Logic Crystal','Inference Chip','Hash Engine','Tensor Core','Bit Forge','Data Loom','Cycle Pack','Throughput Token'],suffix:['v4','XL','Genesis','Prime','Ultra','Turbo','Certified','Standard','Pro','Entangled']},
  'Culture':{adj:['Solar Punk','Afrofuturist','Indigenous','Global South','Diaspora','Ancestral','Neo-Folk','Visionary','Mythopoetic','Communal'],noun:['Story Archive','Heritage Map','Festival Pass','Language Kit','Oral History','Art Zine','Cultural Exchange','Folklore Bundle','Tradition Seed','Memory Capsule'],suffix:['Edition','Collective','Archive','Vol. I','Curated','Open','Living','Sacred','Shared','Roots']},
  'Basic Needs':{adj:['Essential','Daily','Community','Shared','Universal','Cooperative','Local','Fresh','Sustainable','Open-Access'],noun:['Energy Credit','Water Purification Kit','Food Co-op Share','Shelter Maintenance Pack','Health Scan Token','Transport Pass','Communication Bundle','Clothing Voucher','Nutrition Pack','Safety Kit'],suffix:['Daily','Weekly','Family','Individual','Starter','Standard','Plus','Community','Mutual Aid','Basic']},
  'Rent':{adj:['Shared','Cooperative','Micro','Community','Modular','Solar-Powered','Off-Grid','Resilient','Portable','Sustainable'],noun:['Housing Credit','Workspace Pass','Land Share','Co-Living Token','Studio Rental','Garden Plot','Workshop Bay','Storage Unit','Shelter Voucher','Facility Access'],suffix:['Monthly','Seasonal','Flex','Standard','Equity','Rotating','Trial','Founding','Anchored','Open']},
  'Energy':{adj:['Precision','Portable','Industrial','Wireless','AI-Powered','Multi-Spectrum','Ruggedized','Modular','Open-Source','Calibrated'],noun:['Solar Meter','Inverter Diag','Panel Mapper','Irradiance Sensor','ROI Calculator','Load Tester','Efficiency Gauge','Grid Probe','Watt Tracker','Harvest Monitor'],suffix:['v4','Pro','Field Kit','IoT','USB-C','Bluetooth','HD','IP67','with Case','Starter']},
  'Music':{adj:['Professional','Studio','Vintage','Digital','Portable','Wireless','Modular','Analog','High-Fidelity','Custom'],noun:['Synthesizer','MIDI Controller','Studio Monitor','Mixing Console','Microphone Kit','Amplifier','Drum Machine','Audio Interface','Headphone Set','Speaker System'],suffix:['Pro','Studio','Elite','Portable','Wireless','USB-C','XLR','Bluetooth','Limited','Reference']},
  'Songs':{adj:['Acoustic','Electric','Soul','Indie','Folk','Pop','Ethereal','Cinematic','Lo-Fi','Choral'],noun:['Single','EP Track','Album Cut','Live Recording','Cover','Original','Ballad','Anthem','Demo','Master'],suffix:['HD Audio','Remastered','Acoustic','Live','Studio','Vocal','Instrumental Mix','Radio Edit','Extended','Deluxe']},
  'Video':{adj:['Professional','Cinema-Grade','Compact','Wireless','Stabilized','Modular','Weather-Sealed','High-Speed','Remote','Portable'],noun:['Camera Rig','Lighting Kit','Tripod System','Gimbal Stabilizer','Lens Set','Editing Station','Monitor Display','Streaming Kit','Drone Mount','Green Screen'],suffix:['Pro','4K','Cinema','Portable','Studio','Wireless','Carbon','LED','Field','Complete']},
  'Videos':{adj:['Cinematic','Drone','Time-Lapse','Volumetric','Holographic','Immersive','Documentary','Generative','Solar-Lit','RAW'],noun:['Film Reel','Tutorial Series','Music Video','Short Film','B-Roll Pack','VFX Template','Motion Study','Scene Kit','Footage Archive','Visual Essay'],suffix:['4K','8K','HDR',"Director's Cut",'Extended','Uncut','Remastered','Season 1','Premiere','Open License']},
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
  '3D Printing':{adj:['Parametric','Modular','Stackable','Ergonomic','Lattice','Honeycomb','Snap-Fit','Articulated','Precision','Functional'],noun:['Desk Caddy','Phone Stand','Cable Organizer','Shelf Bracket','Wall Hook','Planter Box','Gear Set','Tool Holder','Card Stand','Tile Set'],suffix:['v1','Pro','Mini','XL','Slim','Eco','Custom','Deluxe','Starter','Field Kit']},
  'Health & Wellness':{adj:['Holistic','Preventive','Therapeutic','Organic','Natural','Guided','Clinical','Mindful','Restorative','Adaptive'],noun:['Wellness Plan','Health Scan','Nutrition Guide','First Aid Kit','Mental Health Tool','Fitness Program','Safety Protocol','Recovery Pack','Vitality Monitor','Care Bundle'],suffix:['Daily','Weekly','Pro','Essential','Complete','Starter','Family','Personal','Clinical','Community']},
  'Community':{adj:['Cooperative','Grassroots','Mutual Aid','Neighborhood','Civic','Collective','Inclusive','Local','Participatory','Regenerative'],noun:['Resource Hub','Support Network','Grant Fund','Action Plan','Outreach Kit','Volunteer Board','Impact Report','Sustainability Guide','Commons Pool','Solidarity Pack'],suffix:['Local','Regional','Open','Shared','Founding','Pilot','Standard','Community','Public','Universal']}
};

const MARKET_DEMAND = getOfficialCategories();

const ALL_CATEGORIES = Object.keys(ITEM_PARTS);
const OFFICIAL_CATS = getOfficialCategories();
const missingFromParts = OFFICIAL_CATS.filter(c => !ALL_CATEGORIES.includes(c));
if (missingFromParts.length > 0) {
  console.warn('[Agent Tasks] Categories missing from ITEM_PARTS:', missingFromParts.join(', '));
}

const DELIVERY_TYPES = {
  'Computronium': 'virtual',
  'Culture': 'virtual',
  'Basic Needs': 'future-physical',
  'Rent': 'virtual',
  'Energy': 'virtual',
  'Music': 'virtual',
  'Songs': 'virtual',
  'Video': 'virtual',
  'Videos': 'virtual',
  'Art': 'virtual',
  'Photo': 'virtual',
  'Writing': 'virtual',
  'AI Tools': 'virtual',
  'AI Create': 'virtual',
  'Software': 'virtual',
  'Docs': 'virtual',
  'Games': 'virtual',
  'Utilities': 'virtual',
  'Education': 'virtual',
  '3D Printing': '3d-print-code',
  'Health & Wellness': 'virtual',
  'Community': 'virtual'
};

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

    const agentCategories = [bestCategory];
    const usedCategories = new Set([bestCategory]);
    for (const rc of rankedCategories) {
      if (agentCategories.length >= 5) break;
      if (!usedCategories.has(rc.category)) {
        agentCategories.push(rc.category);
        usedCategories.add(rc.category);
      }
    }
    while (agentCategories.length < 5) {
      const fallback = agent.specialty && ITEM_PARTS[agent.specialty] ? agent.specialty : 'Basic Needs';
      agentCategories.push(fallback);
    }
    manifest[agent.code] = agentCategories;
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

function generatePrice(category, kwhFootprint) {
  const kwhSolar = kwhFootprint * SOLAR_KWH_RATE;

  const CATEGORY_KWH_RANGES = {
    'Basic Needs': { min: 0.5, max: 5 },
    'Rent': { min: 2, max: 15 },
    'Energy': { min: 1, max: 20 },
    'Health & Wellness': { min: 0.5, max: 8 },
    'Community': { min: 0.2, max: 3 },
    'Education': { min: 0.1, max: 2 },
    'Docs': { min: 0.05, max: 1 },
    'Writing': { min: 0.1, max: 3 },
    'Culture': { min: 0.2, max: 5 },
    'Songs': { min: 0.5, max: 8 },
    'Music': { min: 1, max: 15 },
    'Videos': { min: 2, max: 30 },
    'Video': { min: 3, max: 25 },
    'Photo': { min: 0.2, max: 5 },
    'Art': { min: 0.3, max: 10 },
    'Games': { min: 2, max: 40 },
    'Software': { min: 5, max: 50 },
    'AI Tools': { min: 3, max: 60 },
    'AI Create': { min: 2, max: 40 },
    'Computronium': { min: 10, max: 100 },
    '3D Printing': { min: 1, max: 20 },
    'Utilities': { min: 0.5, max: 10 }
  };

  const EXECUTION_KWH = {
    'ai-inference-prompt': { min: 0.5, max: 8 },
    '3d-printer-code': { min: 2, max: 30 }
  };

  const range = CATEGORY_KWH_RANGES[category] || { min: 0.5, max: 10 };
  const creationKwh = range.min + Math.random() * (range.max - range.min);
  const creationPrice = creationKwh * SOLAR_KWH_RATE;

  const utility = getArtifactUtility(category);
  const execRange = EXECUTION_KWH[utility.type];
  let executionPrice = 0;
  if (execRange) {
    const execKwh = execRange.min + Math.random() * (execRange.max - execRange.min);
    executionPrice = execKwh * SOLAR_KWH_RATE;
  }

  const demandIdx = MARKET_DEMAND.indexOf(category);
  const demandNudge = demandIdx >= 0 ? 1 + (MARKET_DEMAND.length - demandIdx) / (MARKET_DEMAND.length * 8) : 1;

  const isBasicNeeds = category === 'Basic Needs';
  const genFee = isBasicNeeds ? 0 : CREATION_FEE;
  const placeFee = isBasicNeeds ? 0 : PLACEMENT_FEE;

  const basePrice = ((creationPrice + executionPrice) * demandNudge) + genFee + placeFee;
  const minPrice = isBasicNeeds ? 0.00001 : 0.0001;
  const price = Math.max(minPrice, basePrice);
  return parseFloat(price.toFixed(6));
}

function generateDescription(category, title) {
  const descriptions = {
    'Computronium': 'High-performance compute resource for distributed processing on the Solar network.',
    'Culture': 'Cultural artifact preserving heritage and creative expression for the Solar community.',
    'Basic Needs': 'Essential resource ensuring universal access to fundamental human needs.',
    'Rent': 'Cooperative housing and workspace access for sustainable community living.',
    'Energy': 'Solar energy measurement and optimization tool for the clean energy transition.',
    'Music': 'Professional music equipment and studio gear for Solar-powered creative production.',
    'Videos': 'Visual media produced with sustainable energy practices and creative vision.',
    'Video': 'Professional video production equipment and gear for content creation.',
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

function generateProductPrompt(category, title, description, contentFormat) {
  const FORMAT_INSTRUCTIONS = {
    'audio': 'Output format: high-quality audio file (WAV/MP3), ',
    'video': 'Output format: video file (MP4/MOV), ',
    'image': 'Output format: high-resolution image (PNG 4000x3000px), ',
    'md': 'Output format: structured Markdown document, ',
    'pdf': 'Output format: formatted PDF document, ',
    'js': 'Output format: production-ready JavaScript module, ',
    'json': 'Output format: structured JSON with schema, ',
    'binary': 'Output format: compiled binary package, ',
    'text': 'Output format: plain text document, ',
    'stl': 'Output format: printable STL file with print guide, ',
  };

  const CATEGORY_VERBS = {
    'Computronium': 'Build a high-performance distributed computing resource:',
    'Culture': 'Create a cultural heritage artifact:',
    'Basic Needs': 'Design an essential community resource:',
    'Rent': 'Create a cooperative housing/workspace access system:',
    'Energy': 'Build a solar energy measurement and optimization tool:',
    'Music': 'Design professional music equipment or studio gear:',
    'Songs': 'Compose and produce an original song:',
    'Video': 'Design professional video production equipment:',
    'Videos': 'Produce a professional video:',
    'Art': 'Create a digital artwork:',
    'Photo': 'Capture/generate a professional photograph:',
    'Writing': 'Write an original literary work:',
    'AI Tools': 'Build an AI-powered tool:',
    'AI Create': 'Create a generative AI system:',
    'Software': 'Develop a software application:',
    'Docs': 'Write comprehensive documentation:',
    'Education': 'Create an educational resource:',
    'Games': 'Design and build an interactive game:',
    'Utilities': 'Build a practical utility tool:',
    '3D Printing': 'Generate a 3D-printable model:',
    'Health & Wellness': 'Design a health and wellness resource:',
    'Community': 'Create a community support resource:',
  };

  const verb = CATEGORY_VERBS[category] || 'Create a digital product:';
  const formatInstr = FORMAT_INSTRUCTIONS[contentFormat] || 'Output format: digital file, ';
  const utility = getArtifactUtility(category);

  const cleanTitle = title.replace(/\b(v\d+|Pro|Lite|HD|XL|SDK|API|Beta|Alpha|Deluxe|Remastered|Extended|Limited|Standard|Plus|Ultra|Starter|Suite|Kit|Bundle)\b/gi, '').trim();

  return `[${utility.label}] ${verb} "${cleanTitle}". ${description}. ${utility.desc}. ${formatInstr}suitable for the Solar network marketplace. Include detailed specifications, quality benchmarks, and ensure the output is production-ready for distribution.`;
}

async function createArtifactsForAgent(pool, agent, memberId, assignedCategories) {
  const created = [];
  const errors = [];

  const profile = getAgentProfile(agent.code);
  const maxCreations = profile.creationSlots;
  let categories = [];
  if (assignedCategories && assignedCategories.length > 0) {
    categories = assignedCategories.slice(0, maxCreations);
  }
  while (categories.length < maxCreations) {
    const fallback = agent.specialty && ITEM_PARTS[agent.specialty] ? agent.specialty : 'Basic Needs';
    categories.push(fallback);
  }

  const FILE_TYPES = {
    'Songs': 'audio/mpeg', 'Music': 'application/json', 'Video': 'application/json', 'Videos': 'video/mp4', 'Art': 'image/png', 'Photo': 'image/jpeg',
    'Writing': 'text/markdown', 'Docs': 'application/pdf', 'Software': 'application/javascript',
    'AI Tools': 'application/json', 'AI Create': 'application/json', 'Games': 'application/zip',
    'Utilities': 'application/zip', 'Computronium': 'application/octet-stream',
    'Culture': 'text/markdown', 'Basic Needs': 'text/plain', 'Rent': 'text/plain', 'Energy': 'application/json',
    'Education': 'text/markdown', '3D Printing': '3d-model'
  };

  const CONTENT_FORMATS = {
    'Songs': 'audio', 'Music': 'json', 'Video': 'json', 'Videos': 'video', 'Art': 'image', 'Photo': 'image',
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
      const kwhFootprint = parseFloat((0.1 + Math.random() * 9.9).toFixed(4));
      const basePrice = generatePrice(category, kwhFootprint);
      const price = parseFloat((basePrice * profile.priceMultiplier).toFixed(6));
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
        const utility = getArtifactUtility(category);
        contentBody = `# ${title}\n\n**Utility Type:** ${utility.label}\n**Use Case:** ${utility.desc}\n\n## Description\n${description}\n\n## Artifact Specifications\n- **Category:** ${category}\n- **Format:** ${utility.type}\n- **kWh Footprint:** ${kwhFootprint}\n- **Created by:** Agent ${agent.name} (${agent.code})\n- **Class:** B — ${utility.label}\n- **Generated:** ${new Date().toISOString()}\n\n## Usage Instructions\n${utility.type === 'ai-inference-prompt' ? 'Deploy this prompt via any compatible AI inference engine. Supports GPT-4o, Claude, and open-source models. Input parameters are pre-configured for optimal output quality.' : utility.type === 'rentable-software' ? 'License this module for deployment on the Solar compute network. Includes runtime environment specification, dependency manifest, and execution parameters.' : utility.type === '3d-printer-code' ? 'Load the STL/G-code file into any FDM or SLA 3D printer. Print settings and material specifications are included in the guide.' : utility.type === 'book-movie-prompt' ? 'Use this creative blueprint to produce a full-length work. Includes narrative structure, character development, visual direction, and production notes.' : 'Access this digital resource through the Solar network marketplace. Standard download and usage terms apply.'}`;
      }

      const productPrompt = generateProductPrompt(category, title, description, contentFormat);

      const artifactResult = await pool.query(
        `INSERT INTO artifacts (slug, title, description, category, subcategory, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, creator_id, active, processing_status, artifact_class, source_type, content_body, content_format, product_prompt)
         VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, 0, 'download', $8, true, 'complete', 'B', 'agent', $9, $10, $11)
         RETURNING id`,
        [slug, title, description, category, fileType, String(kwhFootprint), String(price), String(memberId), contentBody, contentFormat, productPrompt]
      );

      if (!artifactResult || !artifactResult.rows || artifactResult.rows.length === 0) {
        throw new Error(`Artifact INSERT returned no rows for "${title}" in ${category}`);
      }
      const artifactId = artifactResult.rows[0].id;

      // Auto-add Music/Video agent content to Music Now for free streaming
      if (category === 'Songs' || category === 'Videos') {
        const streamSlug = slug.replace(/[^a-z0-9-]/g, '');
        await pool.query(
          `UPDATE artifacts SET streaming_url = $1 WHERE id = $2`,
          [`/music-now.html#agent-${streamSlug}`, artifactId]
        );
        console.log(`🎵 [Agent ${agent.code}] Auto-added ${category} "${title}" to Music Now streaming`);
      }

      await pool.query(
        `INSERT INTO market_items (title, description, category, subcategory, price_solar, kwh_estimate, source_type, status, created_by_user_id, metadata)
         VALUES ($1, $2, $3, NULL, $4, $5, 'INTERNAL_STOCK', 'ACTIVE', $6, $7)`,
        [title, description, category, String(price), String(kwhFootprint), String(memberId),
         JSON.stringify({ agentName: agent.name, agentCode: agent.code, artifactId, generatedAt: new Date().toISOString(), utilityType: getArtifactUtility(category).type, utilityLabel: getArtifactUtility(category).label, ...(artifact3dMeta || {}), inference: { label: inferLabel, print3d: matrix.print3d, print2d: matrix.print2d, fileType: matrix.file.type, deliverables: matrix.deliverables } })]
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

      let creationFeePaid = 0;
      if (category !== 'Basic Needs') {
        const totalCreationFee = CREATION_FEE + PLACEMENT_FEE;
        const feeClient = await pool.connect();
        try {
          await feeClient.query('BEGIN');
          const agentBalRow = await feeClient.query(
            'UPDATE members SET total_solar = total_solar - $1 WHERE id = $2 AND total_solar >= $1 RETURNING total_solar',
            [totalCreationFee, memberId]
          );
          if (agentBalRow.rows.length > 0) {
            const newAgentBal = parseFloat(agentBalRow.rows[0].total_solar);
            const platformMember = await getOrCreateFoundationMember(feeClient.query.bind(feeClient));
            const platformUpdated = await feeClient.query(
              'UPDATE members SET total_solar = total_solar + $1 WHERE id = $2 RETURNING total_solar',
              [totalCreationFee, platformMember.id]
            );
            const platformBalAfter = parseFloat(platformUpdated.rows[0].total_solar);

            const feeTxId = crypto.randomUUID();
            await feeClient.query(
              `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
               VALUES ($1, 'debit', $2, 'user', $3, $4, 'creation_fee', $5, $6)`,
              [feeTxId, String(memberId), String(totalCreationFee), String(newAgentBal), String(artifactId), `Creation fee (${CREATION_FEE} S) + Placement fee (${PLACEMENT_FEE} S): ${title}`]
            );
            await feeClient.query(
              `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
               VALUES ($1, 'credit', $2, 'platform', $3, $4, 'creation_fee', $5, $6)`,
              [feeTxId, String(platformMember.id), String(totalCreationFee), String(platformBalAfter), String(artifactId), `Creation + Placement fee: ${title}`]
            );
            await feeClient.query('COMMIT');
            creationFeePaid = totalCreationFee;
            console.log(`🏦 [Agent ${agent.code}] Creation fee ${totalCreationFee} S charged for "${title}" → Foundation`);
          } else {
            await feeClient.query('ROLLBACK');
            console.warn(`⚠️ [Agent ${agent.code}] Insufficient balance for creation fee on "${title}"`);
          }
        } catch (feeErr) {
          try { await feeClient.query('ROLLBACK'); } catch (rbErr) {}
          console.warn(`⚠️ [Agent ${agent.code}] Creation fee failed:`, feeErr.message);
        } finally {
          feeClient.release();
        }
      }

      created.push({ artifactId, title, category, price, slug, kwhFootprint, creationFeePaid });
    } catch (err) {
      console.error(`[Agent ${agent.code}] Error creating artifact in ${category}:`, err.message, err.code || '', err.detail || '');
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
  const profile = getAgentProfile(agent.code);
  const MARKUP = profile.resaleMarkup;

  const buyerRow = await pool.query('SELECT id, username, total_solar FROM members WHERE id = $1', [memberId]);
  if (buyerRow.rows.length === 0) {
    errors.push({ phase: 'purchase', error: 'Buyer not found in members table' });
    return { purchased, errors, resaleListed, totalResaleValue };
  }

  const purchasedArtifactIds = [];
  const maxPurchases = profile.purchaseSlots;
  const MANDATORY_BASIC_PURCHASES = maxPurchases <= 3 ? 1 : 2;
  let basicNeedsBought = 0;

  const allCategories = getOfficialCategories();
  const scores = demandScores || {};
  const rankedCategories = [...allCategories].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  const browsedCategories = [];
  for (let purchaseRound = 0; purchaseRound < maxPurchases; purchaseRound++) {
    const client = await pool.connect();
    try {
      const freshBuyer = await client.query('SELECT id, username, total_solar FROM members WHERE id = $1', [memberId]);
      if (freshBuyer.rows.length === 0) {
        errors.push({ phase: 'purchase', error: 'Buyer disappeared' });
        client.release();
        break;
      }
      const buyerBalance = parseFloat(freshBuyer.rows[0].total_solar) || 0;

      if (buyerBalance <= RESERVE_FLOOR) {
        console.log(`🛡️ [Agent ${agent.code}] Skipping purchase round ${purchaseRound + 1} — balance ${buyerBalance.toFixed(4)} S below reserve floor ${RESERVE_FLOOR} S`);
        errors.push({ phase: 'purchase', error: `Balance protection: ${buyerBalance.toFixed(4)} <= ${RESERVE_FLOOR}` });
        client.release();
        break;
      }

      let artifact = null;

      // Mandatory Basic Needs purchases (rounds 0 and 1)
      const basicNeedsStillNeeded = basicNeedsBought < MANDATORY_BASIC_PURCHASES;
      if (basicNeedsStillNeeded) {
        const excludeIds = purchasedArtifactIds.length > 0 ? purchasedArtifactIds : [];
        const bnRecoveringIds = getCurrentRecoveringMemberIds().filter(id => id !== String(memberId));
        const bnResult = await client.query(
          `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category,
                  CASE WHEN a.creator_id = ANY($4::text[]) THEN 0 ELSE 1 END AS recovery_priority
           FROM artifacts a
           WHERE a.active = true AND a.category = 'Basic Needs'
             AND a.creator_id != $1
             AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $2)
             AND a.is_listed_for_resale = false
             AND a.id != ALL($3::uuid[])
           ORDER BY recovery_priority ASC, a.solar_amount_s ASC LIMIT 10`,
          [String(memberId), memberId, excludeIds, bnRecoveringIds]
        );
        const bnAffordable = bnResult.rows.find(c => buyerBalance - (parseFloat(c.solar_amount_s) || 0.01) >= RESERVE_FLOOR);
        if (bnAffordable) {
          artifact = bnAffordable;
          console.log(`🏠 [Agent ${agent.code}] Purchase ${purchaseRound + 1}/5: Mandatory Basic Needs (${basicNeedsBought + 1}/${MANDATORY_BASIC_PURCHASES}) — "${artifact.title}"`);
        } else {
          console.log(`⚠️ [Agent ${agent.code}] No affordable Basic Needs items for mandatory purchase ${basicNeedsBought + 1}, falling through to market`);
        }
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const aiArtifactId = aiDecision && aiDecision.buyArtifactId && uuidRegex.test(String(aiDecision.buyArtifactId)) ? aiDecision.buyArtifactId : null;
      if (!artifact && purchaseRound === MANDATORY_BASIC_PURCHASES && aiArtifactId) {
        const aiResult = await client.query(
          `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
           FROM artifacts a
           WHERE a.id = $1 AND a.active = true
             AND a.creator_id != $2
             AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)`,
          [aiArtifactId, String(memberId), memberId]
        );
        artifact = aiResult.rows[0] || null;
        if (artifact) {
          console.log(`🔍 [Agent ${agent.code}] Purchase ${purchaseRound + 1}/5: AI picked "${artifact.title}" from [${artifact.category}]`);
        }
      }

      if (!artifact) {
        const excludeIds = purchasedArtifactIds.length > 0 ? purchasedArtifactIds : [];
        let browseCategory = null;
        for (const cat of rankedCategories) {
          if (!browsedCategories.includes(cat)) {
            browseCategory = cat;
            break;
          }
        }
        if (!browseCategory) {
          browseCategory = rankedCategories[purchaseRound % rankedCategories.length];
        }

        const recoveringIds = getCurrentRecoveringMemberIds().filter(id => id !== String(memberId));
        const recoveryNote = recoveringIds.length > 0 ? ` (priority: recovering agents)` : '';
        console.log(`🔍 [Agent ${agent.code}] Purchase ${purchaseRound + 1}/5: Browsing category [${browseCategory}]${recoveryNote}`);
        const candidateResult = await client.query(
          `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category,
                  CASE WHEN a.creator_id = ANY($5::text[]) THEN 0 ELSE 1 END AS recovery_priority
           FROM artifacts a
           WHERE a.active = true
             AND a.category = $1
             AND a.creator_id != $2
             AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)
             AND a.is_listed_for_resale = false
             AND a.id != ALL($4::uuid[])
           ORDER BY recovery_priority ASC, a.solar_amount_s ASC
           LIMIT 10`,
          [browseCategory, String(memberId), memberId, excludeIds, recoveringIds]
        );

        browsedCategories.push(browseCategory);

        if (candidateResult.rows.length === 0) {
          console.log(`📂 [Agent ${agent.code}] No items found in [${browseCategory}], trying next category`);
          for (const fallbackCat of rankedCategories) {
            if (fallbackCat === browseCategory) continue;
            const fbRecoveringIds = getCurrentRecoveringMemberIds().filter(id => id !== String(memberId));
            const fallbackResult = await client.query(
              `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category,
                      CASE WHEN a.creator_id = ANY($5::text[]) THEN 0 ELSE 1 END AS recovery_priority
               FROM artifacts a
               WHERE a.active = true
                 AND a.category = $1
                 AND a.creator_id != $2
                 AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)
                 AND a.is_listed_for_resale = false
                 AND a.id != ALL($4::uuid[])
               ORDER BY recovery_priority ASC, a.solar_amount_s ASC
               LIMIT 5`,
              [fallbackCat, String(memberId), memberId, excludeIds, fbRecoveringIds]
            );
            if (fallbackResult.rows.length > 0) {
              console.log(`📂 [Agent ${agent.code}] Found items in fallback category [${fallbackCat}]`);
              const affordable = fallbackResult.rows.find(c => buyerBalance - (parseFloat(c.solar_amount_s) || 0.01) >= RESERVE_FLOOR);
              if (affordable) {
                artifact = affordable;
                break;
              }
            }
          }
          if (!artifact) {
            errors.push({ phase: 'purchase', error: `No eligible artifacts found across categories for purchase round ${purchaseRound + 1}` });
            client.release();
            continue;
          }
        }

        if (!artifact) {
          let bestCandidate = null;
          for (const candidate of candidateResult.rows) {
            const price = parseFloat(candidate.solar_amount_s) || 0.01;
            if (buyerBalance - price < RESERVE_FLOOR) continue;
            bestCandidate = candidate;
            break;
          }

          if (!bestCandidate) {
            console.log(`🛡️ [Agent ${agent.code}] No affordable items in [${browseCategory}], trying other categories`);
            for (const fallbackCat of rankedCategories) {
              if (fallbackCat === browseCategory) continue;
              const fallbackResult2 = await client.query(
                `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
                 FROM artifacts a
                 WHERE a.active = true AND a.category = $1
                   AND a.creator_id != $2
                   AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)
                   AND a.is_listed_for_resale = false
                   AND a.id != ALL($4::uuid[])
                 ORDER BY a.solar_amount_s ASC LIMIT 5`,
                [fallbackCat, String(memberId), memberId, excludeIds]
              );
              if (fallbackResult2.rows.length > 0) {
                const affordable2 = fallbackResult2.rows.find(c => buyerBalance - (parseFloat(c.solar_amount_s) || 0.01) >= RESERVE_FLOOR);
                if (affordable2) {
                  bestCandidate = affordable2;
                  console.log(`📂 [Agent ${agent.code}] Found affordable item in [${fallbackCat}]`);
                  break;
                }
              }
            }
          }

          if (!bestCandidate) {
            errors.push({ phase: 'purchase', error: `No affordable items across all categories (round ${purchaseRound + 1})` });
            client.release();
            continue;
          }

          artifact = bestCandidate;
          console.log(`🛒 [Agent ${agent.code}] Selected "${artifact.title}" (${parseFloat(artifact.solar_amount_s).toFixed(4)} S) from [${artifact.category}]`);
        }
      }

      let artPrice = parseFloat(artifact.solar_amount_s) || 0.01;
      let appliedDiscount = null;
      const negotiatedDiscount = await findNegotiatedDiscount(client, memberId, artifact.id, artifact.category);
      if (negotiatedDiscount) {
        const discountedPrice = Math.round(parseFloat(negotiatedDiscount.negotiated_price) * 10000) / 10000;
        if (discountedPrice > 0 && discountedPrice < artPrice) {
          console.log(`🏷️ [Agent ${agent.code}] Applying negotiated discount: ${artPrice} → ${discountedPrice} S (${negotiatedDiscount.discount_pct}% off, thread #${negotiatedDiscount.bulletin_thread_id})`);
          appliedDiscount = negotiatedDiscount;
          artPrice = discountedPrice;
        }
      }

      const platformFee = Math.round(artPrice * PLATFORM_FEE_RATE * 10000) / 10000;
      const sellerNet = Math.round((artPrice - platformFee) * 10000) / 10000;

      const txId = crypto.randomUUID();
      const artifactId = artifact.id;
      const creatorId = artifact.creator_id;
      const creatorIdNum = parseInt(creatorId) || 0;
      const creatorIdStr = String(creatorId);

      await client.query('BEGIN');

      const newBuyerBalance = buyerBalance - artPrice;
      await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newBuyerBalance), memberId]);

      const purchaseDesc = appliedDiscount
        ? `Purchase: ${artifact.title} (negotiated ${appliedDiscount.discount_pct}% off, thread #${appliedDiscount.bulletin_thread_id})`
        : `Purchase: ${artifact.title}`;
      await client.query(
        `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
         VALUES ($1, 'debit', $2, 'user', $3, $4, 'purchase', $5, $6)`,
        [txId, String(memberId), String(artPrice), String(newBuyerBalance), artifactId, purchaseDesc]
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

        const saleDesc = appliedDiscount
          ? `Sale: ${artifact.title} (negotiated price)`
          : `Sale: ${artifact.title}`;
        await client.query(
          `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
           VALUES ($1, 'credit', $2, 'creator', $3, $4, 'purchase', $5, $6)`,
          [txId, String(seller.id), String(sellerNet), String(sellerNewBal), artifactId, saleDesc]
        );
      }

      const platformMember = await getOrCreateFoundationMember(client.query.bind(client));
      const platformBalAfter = platformMember.totalSolar + platformFee;
      await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(platformBalAfter), platformMember.id]);
      await client.query(
        `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
         VALUES ($1, 'credit', $2, 'platform', $3, $4, 'platform_fee', $5, $6)`,
        [txId, String(platformMember.id), String(platformFee), String(platformBalAfter), artifactId, `Platform fee (5%): ${artifact.title}`]
      );

      await client.query(
        `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'purchase', $4)`,
        [artifactId, memberId, txId, String(artPrice)]
      );

      const resalePrice = parseFloat((artPrice * (1 + MARKUP)).toFixed(6));
      const genRow = await client.query(`SELECT COALESCE(generation_number, 0) as gen FROM artifacts WHERE id = $1`, [artifactId]);
      const nextGeneration = (parseInt(genRow.rows[0]?.gen) || 0) + 1;
      await client.query(
        `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1, current_owner_id = $2, generation_number = $3 WHERE id = $4`,
        [String(resalePrice), memberId, nextGeneration, artifactId]
      );

      await client.query('COMMIT');

      try {
        await pool.query(
          `INSERT INTO resale_history (id, artifact_id, seller_id, buyer_id, sale_price, seller_profit, foundation_fee, generation_number, created_at)
           VALUES ($1, $2, $3, NULL, $4, $5, 0, $6, NOW())`,
          [crypto.randomUUID(), artifactId, memberId, String(resalePrice), String(resalePrice - artPrice), nextGeneration]
        );
      } catch (resaleErr) {
        console.warn(`[Agent ${agent.code}] Resale history insert warning:`, resaleErr.message);
      }

      if (appliedDiscount) {
        try {
          await pool.query(
            `UPDATE negotiated_discounts SET status = 'used', settlement_transaction_id = $1, settled_at = NOW() WHERE id = $2`,
            [txId, appliedDiscount.id]
          );
        } catch (discMarkErr) {
          console.warn(`⚠️ [Agent ${agent.code}] Failed to mark discount as used:`, discMarkErr.message);
        }
      }

      resaleListed += 1;
      totalResaleValue += resalePrice;
      purchasedArtifactIds.push(artifactId);
      if (artifact.category === 'Basic Needs') basicNeedsBought++;
      console.log(`🌞 [KID SOL] Agent ${agent.name}: Bought "${artifact.title}" [${artifact.category}] (${artPrice.toFixed(4)} S) → Listed resale at ${resalePrice.toFixed(4)} S (+${Math.round(MARKUP * 100)}%) [Gen ${nextGeneration}] [purchase ${purchaseRound + 1}/${maxPurchases}]${artifact.category === 'Basic Needs' ? ` 🏠 BN:${basicNeedsBought}/${MANDATORY_BASIC_PURCHASES}` : ''}`);

      purchased.push({ artifactId, title: artifact.title, category: artifact.category, price: artPrice, txId, resalePrice });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { /* ignore rollback error */ }
      console.error(`[Agent ${agent.code}] Purchase error (round ${purchaseRound + 1}):`, err.message);
      errors.push({ phase: 'purchase', error: err.message });
    } finally {
      client.release();
    }
  }

  return { purchased, errors, resaleListed, totalResaleValue, basicNeedsBought };
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
    result.startBalance = startBalance;
    const taskProfile = getAgentProfile(agent.code);
    console.log(`🤖 [Agent ${agent.code} ${agent.name}] Starting profit-driven tasks (member ID: ${memberId}, balance: ${startBalance.toFixed(4)} S, role: ${taskProfile.role}, create:${taskProfile.creationSlots}/buy:${taskProfile.purchaseSlots})`);

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

      // Bulletin board conversation — scan and reply to open threads (1 reply max to keep run fast)
      try {
        const openPosts = await pool.query(
          `SELECT * FROM agent_bulletin_board 
           WHERE status = 'open' AND thread_status = 'open' AND reply_count < 4
           AND author_agent_code != $1
           ORDER BY created_at DESC LIMIT 5`,
          [agent.code]
        );

        let repliesMade = 0;
        for (const post of openPosts.rows) {
          if (repliesMade >= 1) break;
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
    result.basicNeedsBought = purchaseResult.basicNeedsBought || 0;

    result.aiDecision = aiDecision ? {
      createCategory: aiDecision.createCategory,
      createPriceStrategy: aiDecision.createPriceStrategy,
      createReasoning: aiDecision.createReasoning,
      buyReasoning: aiDecision.buyReasoning,
      bulletinPost: aiDecision.bulletinPost ? true : false,
      strategicPlan: aiDecision.strategicPlan || null
    } : null;

    if (aiDecision && aiDecision.strategicPlan) {
      const sp = aiDecision.strategicPlan;
      console.log(`📊 [Agent ${agent.code}] Strategy: ${sp.strategy || 'balanced'} | Risk: ${sp.riskLevel || '?'} | Goal: ${sp.shortTermGoal || '?'}`);
      console.log(`📊 [Agent ${agent.code}] Assessment: ${sp.assessment || 'none'}`);
      console.log(`📊 [Agent ${agent.code}] Target net worth: ${sp.targetNetWorth || '?'} Solar | Long-term: ${sp.longTermGoal || '?'}`);
    }

    const endRow = await pool.query('SELECT total_solar FROM members WHERE id = $1', [memberId]);
    const endBalance = endRow.rows.length > 0 ? parseFloat(endRow.rows[0].total_solar) || 0 : startBalance;
    result.endBalance = endBalance;
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

async function autoSaveRunRecord(pool, { runId, agentResults, agents, totalCreated, totalPurchased, healthPct, runType, elapsedSeconds }) {
  try {
    const bnCreated   = agentResults.reduce((s, r) => s + r.created.filter(c => c.category === 'Basic Needs').length, 0);
    const bnPurchased = agentResults.reduce((s, r) => s + (r.basicNeedsBought || 0), 0);
    const totalErrors = agentResults.reduce((s, r) => s + r.errors.length, 0);
    const successOps  = agentResults.reduce((s, r) => s + r.created.length + (r.purchased || r.buys || []).length, 0);
    const balBlocked  = agentResults.reduce((s, r) => s + r.errors.filter(e => e.error && e.error.includes('Balance protection')).length, 0);

    const catBreakdown = {};
    for (const r of agentResults) {
      for (const c of (r.created || [])) {
        catBreakdown[c.category] = (catBreakdown[c.category] || 0) + 1;
      }
    }

    const agentLedger = agentResults.map(r => ({
      code: r.agentCode,
      name: r.agentName,
      startBalance: parseFloat((r.startBalance || 0).toFixed(4)),
      endBalance: parseFloat((r.endBalance || (r.startBalance || 0) + (r.netChange || 0)).toFixed(4)),
      created: (r.created || []).length,
      purchased: (r.purchased || r.buys || []).length,
      basicNeedsBought: r.basicNeedsBought || 0,
      netChange: r.netChange || 0,
      errors: r.errors.length
    }));

    const windowMins = Math.max(2, Math.ceil((elapsedSeconds || 300) / 60) + 2);
    const solarRows = await pool.query(
      `SELECT COALESCE(SUM(CAST(amount AS numeric)), 0) as circulated,
              COALESCE(SUM(CASE WHEN entry_type = 'credit' AND account_type = 'creator' THEN CAST(amount AS numeric) ELSE 0 END), 0) as seller_rev
       FROM marketplace_ledger
       WHERE created_at >= NOW() - INTERVAL '${windowMins} minutes'
         AND reference_type = 'purchase'`
    );
    const solarCirculated = parseFloat(solarRows.rows[0]?.circulated) || 0;
    const sellerRevenue   = parseFloat(solarRows.rows[0]?.seller_rev) || 0;

    const bnCompliance = agentResults.length > 0
      ? Math.round((agentResults.filter(r => (r.basicNeedsBought || 0) >= 2).length / agentResults.length) * 100)
      : 0;

    const agentsWithDecisions = agentResults.filter(r => r.aiDecision !== undefined).length;
    const totalArtifactsCreated = agentResults.reduce((s, r) => s + (r.created || []).length, 0);
    const totalPurchaseOps = agentResults.reduce((s, r) => s + (r.purchased || r.buys || []).length, 0);
    const totalSellOps = agentResults.reduce((s, r) => s + (r.sells || []).length, 0);
    const bulletinPosts = agentResults.reduce((s, r) => s + (r.bulletinPosts || 0), 0);
    const bulletinReplies = agentResults.reduce((s, r) => s + (r.bulletinReplies || 0), 0);

    const mcpEngineUsage = {};
    if (agentsWithDecisions > 0) mcpEngineUsage['GPT-4o (Decisions)'] = agentsWithDecisions;
    if (totalArtifactsCreated > 0) mcpEngineUsage['GPT-4o (Content)'] = totalArtifactsCreated;
    if (totalPurchaseOps > 0) mcpEngineUsage['Marketplace Buys'] = totalPurchaseOps;
    if (totalSellOps > 0) mcpEngineUsage['Marketplace Sells'] = totalSellOps;
    if (bulletinPosts + bulletinReplies > 0) mcpEngineUsage['Bulletin Board'] = bulletinPosts + bulletinReplies;

    const uniqueRunId = `auto_${runType}_${runId}_${Date.now()}`;

    await pool.query(
      `INSERT INTO ecosystem_test_runs (
        run_id, run_timestamp, agent_count, items_created, basic_needs_created,
        searches_executed, t1_purchases, t2_sample_purchases, total_purchases,
        basic_needs_purchased, basic_needs_compliance, solar_distributed,
        solar_circulated, seller_revenue, total_end_balances,
        vouchers_created, vouchers_purchased, vouchers_redeemed,
        tier1_hits, tier2_hits, tier2_sample_posts, tier3_hits,
        balance_blocked, limit_blocked, tier3_blocked,
        successful_ops, failed_ops, health_score,
        agent_ledger, mcp_engine_usage, category_breakdown, voucher_details, metadata
      ) VALUES (
        $1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32
      )`,
      [
        uniqueRunId, agents.length, totalCreated, bnCreated,
        0, totalPurchased, 0, totalPurchased,
        bnPurchased, bnCompliance, 0,
        solarCirculated, sellerRevenue, 0,
        0, 0, 0,
        0, 0, 0, 0,
        balBlocked, 0, 0,
        successOps, totalErrors, healthPct,
        JSON.stringify(agentLedger),
        JSON.stringify(mcpEngineUsage),
        JSON.stringify(catBreakdown),
        JSON.stringify([]),
        JSON.stringify({ runType, autoSaved: true, elapsedSeconds })
      ]
    );
    console.log(`📊 [Auto-Save] ${runType.toUpperCase()} run record saved: ${uniqueRunId} | Health: ${healthPct}% | Created: ${totalCreated} | Purchased: ${totalPurchased} | Solar: ${solarCirculated.toFixed(4)} S`);
  } catch (saveErr) {
    console.warn(`⚠️ [Auto-Save] Failed to save run record for ${runType}:`, saveErr.message);
  }
}

async function runDailyAgentTasks(pool, agents) {
  const startTime = Date.now();
  const runId = crypto.randomUUID().substring(0, 8);

  lastRunStatus = { status: 'running', runId, message: 'Round 1 in progress...', timestamp: new Date().toISOString() };

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

  await kidSolRebalanceProfiles(pool, agents);

  const recoveryResult = await processRecoveryDonations(pool, agents);

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
    kidSolObjectives,
    recovery: recoveryResult
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
    for (const p of result.purchased) {
      if (p.resalePrice) {
        projectedProfit += (p.resalePrice - p.price);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalErrors = agentResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalSuccessOps = agentResults.reduce((sum, r) => sum + r.created.length + r.purchased.length, 0);
  const totalExpectedOps = agents.length * 10;
  const healthPct = totalExpectedOps > 0 ? Math.min(100, Math.round((totalSuccessOps / totalExpectedOps) * 100)) : 0;

  console.log(`\n🌞 ===== KID SOL PROVISIONAIRE — RUN COMPLETE (${runId}) =====`);
  console.log(`   Deployed: ${deployedAgents.length}/${agents.length} | Health: ${healthPct}%`);
  console.log(`   Created: ${totalCreated} artifacts | Purchased: ${totalPurchased} items`);
  console.log(`   Resale Listed: ${totalResaleListed} | Projected Profit: ${projectedProfit.toFixed(4)} S`);
  console.log(`   Errors: ${totalErrors} | Time: ${elapsed}s\n`);

  lastRunStatus = {
    status: 'complete',
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

  await autoSaveRunRecord(pool, {
    runId,
    agentResults,
    agents,
    totalCreated,
    totalPurchased,
    healthPct,
    runType: 'round1',
    elapsedSeconds: parseFloat(elapsed)
  });

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
          const kwhFootprint = parseFloat((0.1 + Math.random() * 1.9).toFixed(4));
          const price = generatePrice('Education', kwhFootprint);
          const description = generateDescription('Education', titleWithSub);

          const contentBody = `# ${titleWithSub}\n\n## Level: ${subcat}\n\n### Overview\n${description}\n\n### Learning Objectives\n- Master fundamental concepts in this ${subcat}-level program\n- Apply practical skills through hands-on exercises\n- Demonstrate competency through assessment activities\n\n### Module Content\nThis educational resource is designed for ${subcat} learners exploring the Solar network ecosystem. Topics include renewable energy systems, distributed computing, blockchain-based currency, and sustainable technology practices.\n\n### Key Topics\n1. Solar Energy Fundamentals and kWh-to-Solar Conversion\n2. Marketplace Economics and Foundation Fee Structure\n3. Agent Network Architecture and AI Collaboration\n4. Renewable Energy Policy and Global Standards\n\n### Exercises\n1. Calculate the Solar equivalent of 100 kWh of renewable energy\n2. Analyze a marketplace transaction including the 5% Foundation fee\n3. Research and present on a renewable energy initiative in your region\n4. Design a grant petition for a community energy project\n\n### Assessment\n- Knowledge Check: 10-question quiz on core concepts\n- Practical Project: Build a Solar energy calculation model\n- Peer Review: Exchange and evaluate proposals with fellow learners\n\n### Additional Resources\n- Solar Standard Protocol v1.0 documentation\n- TC-S Network marketplace for real-world practice\n- KID SOL AI assistant for guided tutoring\n- Agent Orion (Education Specialist) curated resources\n\nCreated by: Agent ${agent.name} (${agent.code})\nClass: B — Educational Content\nSubcategory: ${subcat}\nGenerated: ${new Date().toISOString()}`;

          const productPrompt = generateProductPrompt('Education', titleWithSub, description, CONTENT_FORMAT);

          await pool.query(
            `INSERT INTO artifacts (slug, title, description, category, subcategory, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, creator_id, active, processing_status, artifact_class, source_type, content_body, content_format, product_prompt)
             VALUES ($1, $2, $3, 'Education', $4, $5, $6, $7, 0, 'download', $8, true, 'complete', 'B', 'agent', $9, $10, $11)
             RETURNING id`,
            [slug, titleWithSub, description, subcat, FILE_TYPE, String(kwhFootprint), String(price), String(memberId), contentBody, CONTENT_FORMAT, productPrompt]
          );

          await pool.query(
            `INSERT INTO market_items (title, description, category, subcategory, price_solar, kwh_estimate, source_type, status, created_by_user_id, metadata)
             VALUES ($1, $2, 'Education', $3, $4, $5, 'INTERNAL_STOCK', 'ACTIVE', $6, $7)`,
            [titleWithSub, description, subcat, String(price), String(kwhFootprint), String(memberId),
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

async function runCustomAgentTask(pool, agents, agentCode, customCategories, purpose, requestorId) {
  const agent = agents.find(a => a.code === agentCode);
  if (!agent) {
    return { success: false, error: `Agent with code ${agentCode} not found`, timestamp: new Date().toISOString() };
  }

  if (agentCode === 'ks') {
    return await runKidSolOrchestratedCustom(pool, agents, purpose, requestorId);
  }

  const invalidCategories = (customCategories || []).filter(c => !ALL_CATEGORIES.includes(c));
  if (invalidCategories.length > 0) {
    return { success: false, error: `Invalid categories: ${invalidCategories.join(', ')}`, validCategories: ALL_CATEGORIES, timestamp: new Date().toISOString() };
  }

  if (!customCategories || customCategories.length < 1 || customCategories.length > 5) {
    return { success: false, error: 'Must select between 1 and 5 categories', timestamp: new Date().toISOString() };
  }

  console.log(`\n🎯 [KID SOL] Custom run for ${agent.name}: ${purpose}`);
  console.log(`🎯 [KID SOL] Custom categories: ${customCategories.join(', ')}`);

  await ensureAgentMembers(pool, [agent]);

  const demand = await analyzeMarketDemand(pool);

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

const KWH_COMPENSATION_RATE = 0.15;

async function executeCommissionedSale(pool, artifact, creatorMemberId, requestorId) {
  const client = await pool.connect();
  try {
    const creationPrice = parseFloat(artifact.price) || 0.01;
    const kwhCost = parseFloat(artifact.kwhFootprint || 0);
    const kwhCompensation = parseFloat((kwhCost * KWH_COMPENSATION_RATE).toFixed(6));
    const totalAgentPay = parseFloat((creationPrice + kwhCompensation).toFixed(6));
    const platformFee = parseFloat((creationPrice * PLATFORM_FEE_RATE).toFixed(6));
    const totalRequestorCost = parseFloat((creationPrice + platformFee).toFixed(6));

    const requestorRow = await client.query('SELECT id, total_solar FROM members WHERE id = $1', [requestorId]);
    if (requestorRow.rows.length === 0) {
      return { success: false, error: 'Requestor not found' };
    }
    const requestorBalance = parseFloat(requestorRow.rows[0].total_solar) || 0;
    if (requestorBalance < totalRequestorCost) {
      return { success: false, error: `Insufficient balance: need ${totalRequestorCost.toFixed(4)} S, have ${requestorBalance.toFixed(4)} S`, shortfall: totalRequestorCost - requestorBalance };
    }

    const txId = crypto.randomUUID();
    await client.query('BEGIN');

    const newRequestorBal = requestorBalance - totalRequestorCost;
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newRequestorBal), requestorId]);
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, 'user', $3, $4, 'commission', $5, $6)`,
      [txId, String(requestorId), String(totalRequestorCost), String(newRequestorBal), String(artifact.artifactId), `Commissioned: ${artifact.title} (price + 5% platform fee)`]
    );

    const creatorRow = await client.query('SELECT total_solar FROM members WHERE id = $1', [creatorMemberId]);
    const creatorOldBal = parseFloat(creatorRow.rows[0]?.total_solar) || 0;
    const creatorNewBal = creatorOldBal + totalAgentPay;
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(creatorNewBal), creatorMemberId]);
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'creator', $3, $4, 'commission', $5, $6)`,
      [txId, String(creatorMemberId), String(totalAgentPay), String(creatorNewBal), String(artifact.artifactId), `Commission fulfilled: ${artifact.title} (creation + ${Math.round(KWH_COMPENSATION_RATE * 100)}% kWh compensation)`]
    );

    const platformMember = await getOrCreateFoundationMember(client.query.bind(client));
    const platformBalAfter = platformMember.totalSolar + platformFee;
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(platformBalAfter), platformMember.id]);
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'platform', $3, $4, 'platform_fee', $5, $6)`,
      [txId, String(platformMember.id), String(platformFee), String(platformBalAfter), String(artifact.artifactId), `Platform fee (5%): ${artifact.title}`]
    );

    await client.query(
      `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'commission', $4)`,
      [artifact.artifactId, requestorId, txId, String(totalRequestorCost)]
    );

    await client.query(
      `UPDATE artifacts SET current_owner_id = $1 WHERE id = $2`,
      [requestorId, artifact.artifactId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      txId,
      title: artifact.title,
      category: artifact.category,
      creationPrice,
      kwhCost,
      kwhCompensation,
      totalAgentPay,
      platformFee,
      totalRequestorCost,
      requestorNewBalance: newRequestorBal,
      creatorNewBalance: creatorNewBal
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rbErr) {}
    console.error(`[COMMISSION] Sale error for "${artifact.title}":`, err.message);
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

async function runKidSolOrchestratedCustom(pool, agents, purpose, requestorId) {
  const startTime = Date.now();
  const runId = crypto.randomUUID().substring(0, 8);
  const workerAgents = agents.filter(a => a.code !== 'ks' && a.code !== 'ksr');

  console.log(`\n🌞 ===== KID SOL ORCHESTRATED CUSTOM RUN (${runId}) =====`);
  console.log(`🌞 [KID SOL] Objective: ${purpose}`);
  console.log(`🌞 [KID SOL] Step 1: Analyzing objective needs...`);

  await ensureAgentMembers(pool, agents);

  const demand = await analyzeMarketDemand(pool);

  const kidSolAnalysis = await inferObjectiveNeeds(purpose, ALL_CATEGORIES, demand);
  console.log(`🌞 [KID SOL] Inferred ${kidSolAnalysis.inferredCategories.length} categories: ${kidSolAnalysis.inferredCategories.join(', ')}`);

  let bulletinThreadId = null;
  let ksMemberId = null;
  let ksrMemberId = null;
  try {
    const ksResult = await pool.query("SELECT id FROM members WHERE username = 'agent_eco_ks' LIMIT 1");
    const ksrResult = await pool.query("SELECT id FROM members WHERE username = 'agent_eco_ksr' LIMIT 1");
    ksMemberId = ksResult.rows.length > 0 ? ksResult.rows[0].id : null;
    ksrMemberId = ksrResult.rows.length > 0 ? ksrResult.rows[0].id : null;

    if (ksMemberId) {
      const needsBreakdown = Object.entries(kidSolAnalysis.needsAnalysis || {})
        .map(([cat, why]) => `• ${cat}: ${why}`)
        .join('\n');
      const bulletinPost = await postToBulletin(pool, ksMemberId, 'ks', 'KID SOL', {
        type: 'directive',
        title: `Mission Analysis — ${purpose}`,
        body: `🌞 KID SOL Objective Analysis\n\nCustomer Request: "${purpose}"\n\nInferred Categories (${kidSolAnalysis.inferredCategories.length}):\n${needsBreakdown}\n\nPriority: ${kidSolAnalysis.priorityOrder.join(' → ')}\nScope: ${kidSolAnalysis.estimatedScope}\nReasoning: ${kidSolAnalysis.reasoning}\n\n☀️ Kid Solar — requesting your technical review.`,
        targetCategory: kidSolAnalysis.inferredCategories[0],
        priceSolar: null,
        targetAgentCode: 'ksr'
      });
      bulletinThreadId = bulletinPost ? bulletinPost.id : null;
    }
  } catch (postErr) {
    console.warn('⚠️ [KID SOL] Could not post analysis to bulletin:', postErr.message);
  }

  console.log(`☀️ [Kid Solar] Step 2: Technical consultation...`);
  const kidSolarConsultation = await consultKidSolar(purpose, kidSolAnalysis, ALL_CATEGORIES, demand);

  if (bulletinThreadId && ksrMemberId) {
    try {
      const techNotes = Object.entries(kidSolarConsultation.technicalNotes || {})
        .map(([cat, note]) => `• ${cat}: ${note}`)
        .join('\n');
      await addBulletinReply(pool, bulletinThreadId, 'ksr', 'Kid Solar', ksrMemberId,
        `☀️ Kid Solar Technical Review\n\nApproved Categories: ${kidSolarConsultation.approvedCategories.join(', ')}\n\n${techNotes ? 'Technical Notes:\n' + techNotes : ''}\n\nAdjustments: ${kidSolarConsultation.adjustments}\nAgent Guidance: ${kidSolarConsultation.agentGuidance}\nConfidence: ${kidSolarConsultation.confidence}`,
        'info',
        null
      );
    } catch (replyErr) {
      console.warn('⚠️ [Kid Solar] Could not reply to bulletin thread:', replyErr.message);
    }
  }

  const finalCategories = kidSolarConsultation.approvedCategories;
  console.log(`🌞 [KID SOL] Step 3: Final categories (${finalCategories.length}): ${finalCategories.join(', ')}`);
  console.log(`🌞 [KID SOL] Deploying ${workerAgents.length} worker agents...`);

  console.log('👑 [KID SOL] Generating orchestrated objectives...');
  const kidSolObjectives = await generateKidSolObjectives(pool, demand.scores, demand.gaps, demand.totalInventory, demand.memberRequests);
  kidSolObjectives.dailyDirective = `CUSTOM MISSION: ${purpose}. Agent Guidance from Kid Solar: ${kidSolarConsultation.agentGuidance || ''}. ${kidSolObjectives.dailyDirective || ''}`;

  if (bulletinThreadId && ksMemberId) {
    try {
      await addBulletinReply(pool, bulletinThreadId, 'ks', 'KID SOL', ksMemberId,
        `🌞 Deployment Confirmed\n\nFinal categories: ${finalCategories.join(', ')}\nAgents deployed: ${workerAgents.length}\nMission: ${purpose}\n\nAll agents — execute with profit intent. Kid Solar's technical guidance applies.`,
        'accept',
        null
      );
    } catch (deployErr) {
      console.warn('⚠️ [KID SOL] Could not post deployment confirmation:', deployErr.message);
    }
  }

  const agentsPerCategory = Math.max(1, Math.floor(workerAgents.length / finalCategories.length));
  const assignments = {};
  let agentIndex = 0;

  for (const category of finalCategories) {
    const count = (category === finalCategories[finalCategories.length - 1])
      ? workerAgents.length - agentIndex
      : agentsPerCategory;
    for (let i = 0; i < count && agentIndex < workerAgents.length; i++, agentIndex++) {
      assignments[workerAgents[agentIndex].code] = [category];
    }
  }

  console.log('🌞 [KID SOL] Orchestrated assignments:');
  for (const [code, cats] of Object.entries(assignments)) {
    const a = agents.find(ag => ag.code === code);
    console.log(`   ${a?.name || code}: ${cats.join(', ')}`);
  }

  const agentResults = [];
  let totalCreated = 0;
  let totalPurchased = 0;
  let totalResaleListed = 0;
  let projectedProfit = 0;
  const commissionedSales = [];
  let totalCommissionPaid = 0;
  let totalRequestorSpent = 0;

  for (const worker of workerAgents) {
    const assignedCategories = assignments[worker.code] || [finalCategories[0]];
    const result = await runAgentTasks(pool, worker, assignedCategories, demand.scores, kidSolObjectives);
    agentResults.push(result);
    totalCreated += result.created.length;
    totalPurchased += result.purchased.length;
    totalResaleListed += result.resaleListed || 0;
    for (const p of result.purchased) {
      if (p.resalePrice) {
        projectedProfit += (p.resalePrice - p.price);
      }
    }

    if (requestorId && result.created.length > 0) {
      try {
        const workerMemberRow = await pool.query("SELECT id FROM members WHERE username = $1 LIMIT 1", [`agent_eco_${worker.code}`]);
        if (workerMemberRow.rows.length > 0) {
          const workerMemberId = workerMemberRow.rows[0].id;
          for (const item of result.created) {
            const kwhRow = await pool.query('SELECT kwh_footprint FROM artifacts WHERE id = $1', [item.artifactId]);
            const kwhFootprint = kwhRow.rows.length > 0 ? parseFloat(kwhRow.rows[0].kwh_footprint) || 0 : 0;
            const sale = await executeCommissionedSale(pool, { ...item, kwhFootprint }, workerMemberId, requestorId);
            if (sale.success) {
              commissionedSales.push(sale);
              totalCommissionPaid += sale.totalAgentPay;
              totalRequestorSpent += sale.totalRequestorCost;
              console.log(`💰 [COMMISSION] ${worker.name} → Requestor: "${item.title}" | Agent paid ${sale.totalAgentPay.toFixed(4)} S (price ${sale.creationPrice.toFixed(4)} + ${sale.kwhCompensation.toFixed(4)} kWh bonus) | Requestor charged ${sale.totalRequestorCost.toFixed(4)} S`);
            } else {
              console.warn(`⚠️ [COMMISSION] Failed for "${item.title}": ${sale.error}`);
              result.errors.push({ phase: 'commission', error: sale.error, title: item.title });
            }
          }
        }
      } catch (commErr) {
        console.warn(`⚠️ [${worker.code}] Commission sale error:`, commErr.message);
      }
    }

    if (bulletinThreadId && result.created.length > 0) {
      try {
        const workerMemberRow2 = await pool.query("SELECT id FROM members WHERE username = $1 LIMIT 1", [`agent_eco_${worker.code}`]);
        if (workerMemberRow2.rows.length > 0) {
          const workerMemberId = workerMemberRow2.rows[0].id;
          const actualCategory = result.created[0].category || assignedCategories[0];
          const deliveryType = DELIVERY_TYPES[actualCategory] || 'virtual';
          const deliveryLabel = deliveryType === '3d-print-code' ? '🏭 3D Print Code' : deliveryType === 'future-physical' ? '📦 Future Physical' : '⚡ Virtual Delivery';
          const createdList = result.created.map(item => `• ${item.title} (${item.category}) [${DELIVERY_TYPES[item.category] || 'virtual'}] — ${item.price.toFixed(4)} S`).join('\n');
          const saleNote = requestorId ? `\nSold directly to requestor (commissioned)` : '';
          const purchasedNote = result.purchased.length > 0 ? `\nPurchased for resale: ${result.purchased.map(p => p.title).join(', ')}` : '';
          await addBulletinReply(pool, bulletinThreadId, worker.code, worker.name, workerMemberId,
            `${deliveryLabel} Fulfillment Report — ${worker.name}\n\nAssigned: ${assignedCategories.join(', ')}\nDelivered:\n${createdList}${saleNote}${purchasedNote}\n\nObjective: ${purpose}`,
            'info',
            null
          );
        }
      } catch (fulfillErr) {
        console.warn(`⚠️ [${worker.code}] Could not post fulfillment to bulletin:`, fulfillErr.message);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalErrors = agentResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalSuccessOps = agentResults.reduce((sum, r) => sum + r.created.length + r.purchased.length, 0);
  const totalExpectedOps = workerAgents.length * 10;
  const healthPct = totalExpectedOps > 0 ? Math.min(100, Math.round((totalSuccessOps / totalExpectedOps) * 100)) : 0;

  console.log(`\n🌞 ===== KID SOL ORCHESTRATED CUSTOM RUN COMPLETE (${runId}) =====`);
  console.log(`   Objective: ${purpose}`);
  console.log(`   Inferred Categories: ${finalCategories.join(', ')}`);
  console.log(`   Deployed: ${workerAgents.length} workers | Health: ${healthPct}%`);
  console.log(`   Created: ${totalCreated} artifacts | Purchased: ${totalPurchased} items`);
  if (requestorId) {
    console.log(`   Commissioned Sales: ${commissionedSales.length} | Agents Paid: ${totalCommissionPaid.toFixed(4)} S | Requestor Charged: ${totalRequestorSpent.toFixed(4)} S`);
  } else {
    console.log(`   Resale Listed: ${totalResaleListed} | Projected Profit: ${projectedProfit.toFixed(4)} S`);
  }
  console.log(`   Errors: ${totalErrors} | Time: ${elapsed}s\n`);

  const status = {
    success: totalErrors === 0,
    runId,
    runType: 'orchestrated-custom',
    purpose,
    inferredCategories: finalCategories,
    provisionaire: 'KID SOL',
    orchestrator: true,
    profitObjective: true,
    commissioned: !!requestorId,
    kidSolObjectives,
    inferenceChain: {
      kidSolAnalysis: {
        inferredCategories: kidSolAnalysis.inferredCategories,
        needsAnalysis: kidSolAnalysis.needsAnalysis,
        priorityOrder: kidSolAnalysis.priorityOrder,
        reasoning: kidSolAnalysis.reasoning,
        estimatedScope: kidSolAnalysis.estimatedScope
      },
      kidSolarConsultation: {
        approvedCategories: kidSolarConsultation.approvedCategories,
        technicalNotes: kidSolarConsultation.technicalNotes,
        adjustments: kidSolarConsultation.adjustments,
        agentGuidance: kidSolarConsultation.agentGuidance,
        confidence: kidSolarConsultation.confidence
      },
      finalCategories,
      bulletinThreadId
    },
    agentResults,
    deployed: workerAgents.length,
    healthPercent: healthPct,
    totalCreated,
    totalPurchased,
    totalResaleListed,
    projectedProfit: parseFloat(projectedProfit.toFixed(6)),
    commissionSummary: requestorId ? {
      totalSales: commissionedSales.length,
      totalAgentsPaid: parseFloat(totalCommissionPaid.toFixed(6)),
      totalRequestorCharged: parseFloat(totalRequestorSpent.toFixed(6)),
      kwhCompensationRate: `${Math.round(KWH_COMPENSATION_RATE * 100)}%`,
      platformFeeRate: `${Math.round(PLATFORM_FEE_RATE * 100)}%`,
      sales: commissionedSales.map(s => ({
        title: s.title,
        category: s.category,
        creationPrice: s.creationPrice,
        kwhCost: s.kwhCost,
        kwhCompensation: s.kwhCompensation,
        totalAgentPay: s.totalAgentPay,
        platformFee: s.platformFee,
        totalRequestorCost: s.totalRequestorCost
      }))
    } : null,
    deliverySummary: {
      virtual: agentResults.filter(r => r.created.some(c => (DELIVERY_TYPES[c.category] || 'virtual') === 'virtual')).length,
      '3d-print-code': agentResults.filter(r => r.created.some(c => DELIVERY_TYPES[c.category] === '3d-print-code')).length,
      'future-physical': agentResults.filter(r => r.created.some(c => DELIVERY_TYPES[c.category] === 'future-physical')).length
    },
    elapsed: `${elapsed}s`,
    timestamp: new Date().toISOString()
  };

  lastRunStatus = status;
  return status;
}

async function runRound2AgentTasks(pool, agents) {
  const startTime = Date.now();
  const runId = crypto.randomUUID().substring(0, 8);
  const RESERVE_FLOOR = 1.0;

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
      agentResult.startBalance = startBalance;
      const r2Profile = getAgentProfile(agent.code);
      const MARKUP = r2Profile.resaleMarkup;

      const snapshot = await gatherRound2Snapshot(pool, memberId);
      const aiDecision = await makeRound2Decision(pool, agent, memberId, snapshot, kidSolObjectives);
      agentResult.aiDecision = aiDecision;
      agentResult.marketAssessment = aiDecision.marketAssessment || '';

      console.log(`🧠 [Agent ${agent.code}] Round 2 Decision: ${aiDecision.buys.length} buys, ${aiDecision.sells.length} sells`);

      if (aiDecision.strategicPlan) {
        const sp = aiDecision.strategicPlan;
        console.log(`📊 [Agent ${agent.code}] R2 Strategy: ${sp.strategy || 'balanced'} | Risk: ${sp.riskLevel || '?'} | Goal: ${sp.shortTermGoal || '?'}`);
        console.log(`📊 [Agent ${agent.code}] R2 Assessment: ${sp.assessment || 'none'}`);
        agentResult.strategicPlan = sp;
      }

      for (const buyOrder of (aiDecision.buys || []).slice(0, 5)) {
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
          let artPrice = parseFloat(artifact.solar_amount_s) || 0.01;
          let r2AppliedDiscount = null;
          const r2Discount = await findNegotiatedDiscount(client, memberId, artifact.id, artifact.category);
          if (r2Discount) {
            const r2DiscountedPrice = Math.round(parseFloat(r2Discount.negotiated_price) * 10000) / 10000;
            if (r2DiscountedPrice > 0 && r2DiscountedPrice < artPrice) {
              console.log(`🏷️ [Agent ${agent.code}] Applying negotiated discount: ${artPrice} → ${r2DiscountedPrice} S (${r2Discount.discount_pct}% off, thread #${r2Discount.bulletin_thread_id})`);
              r2AppliedDiscount = r2Discount;
              artPrice = r2DiscountedPrice;
            }
          }

          if (buyerBalance - artPrice < RESERVE_FLOOR) {
            agentResult.errors.push({ phase: 'buy', error: `Cannot afford ${artPrice.toFixed(4)} S and maintain reserve` });
            client.release();
            continue;
          }

          const platformFee = Math.round(artPrice * PLATFORM_FEE_RATE * 10000) / 10000;
          const sellerNet = Math.round((artPrice - platformFee) * 10000) / 10000;

          const txId = crypto.randomUUID();
          await client.query('BEGIN');

          const newBuyerBalance = buyerBalance - artPrice;
          await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newBuyerBalance), memberId]);

          const r2PurchaseDesc = r2AppliedDiscount
            ? `R2 Purchase: ${artifact.title} (negotiated ${r2AppliedDiscount.discount_pct}% off, thread #${r2AppliedDiscount.bulletin_thread_id})`
            : `R2 Purchase: ${artifact.title}`;
          await client.query(
            `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'debit', $2, 'user', $3, $4, 'purchase', $5, $6)`,
            [txId, String(memberId), String(artPrice), String(newBuyerBalance), artifact.id, r2PurchaseDesc]
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
            const r2SaleDesc = r2AppliedDiscount
              ? `R2 Sale: ${artifact.title} (negotiated price)`
              : `R2 Sale: ${artifact.title}`;
            await client.query(
              `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
               VALUES ($1, 'credit', $2, 'creator', $3, $4, 'purchase', $5, $6)`,
              [txId, String(seller.id), String(sellerNet), String(sellerNewBal), artifact.id, r2SaleDesc]
            );
          }

          const r2PlatformMember = await getOrCreateFoundationMember(client.query.bind(client));
          const r2PlatformBalAfter = r2PlatformMember.totalSolar + platformFee;
          await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(r2PlatformBalAfter), r2PlatformMember.id]);
          await client.query(
            `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
             VALUES ($1, 'credit', $2, 'platform', $3, $4, 'platform_fee', $5, $6)`,
            [txId, String(r2PlatformMember.id), String(platformFee), String(r2PlatformBalAfter), artifact.id, `Platform fee (5%): ${artifact.title}`]
          );

          await client.query(
            `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'purchase', $4)`,
            [artifact.id, memberId, txId, String(artPrice)]
          );

          const resalePrice = parseFloat((artPrice * (1 + MARKUP)).toFixed(6));
          const genRowR2 = await client.query(`SELECT COALESCE(generation_number, 0) as gen FROM artifacts WHERE id = $1`, [artifact.id]);
          const nextGenerationR2 = (parseInt(genRowR2.rows[0]?.gen) || 0) + 1;
          await client.query(
            `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1, current_owner_id = $2, generation_number = $3 WHERE id = $4`,
            [String(resalePrice), memberId, nextGenerationR2, artifact.id]
          );

          await client.query('COMMIT');

          if (r2AppliedDiscount) {
            try {
              await pool.query(
                `UPDATE negotiated_discounts SET status = 'used', settlement_transaction_id = $1, settled_at = NOW() WHERE id = $2`,
                [txId, r2AppliedDiscount.id]
              );
            } catch (discMarkErr) {
              console.warn(`⚠️ [Agent ${agent.code}] Failed to mark R2 discount as used:`, discMarkErr.message);
            }
          }

          console.log(`🌞 [R2] Agent ${agent.name}: Bought "${artifact.title}" (${artPrice.toFixed(4)} S, fee: ${platformFee.toFixed(4)} S) → Listed resale at ${resalePrice.toFixed(4)} S [Gen ${nextGenerationR2}]`);
          agentResult.buys.push({ artifactId: artifact.id, title: artifact.title, category: artifact.category, price: artPrice, resalePrice, txId, reasoning: buyOrder.reasoning });
          totalBuys++;
        } catch (buyErr) {
          try { await client.query('ROLLBACK'); } catch (rbErr) { }
          agentResult.errors.push({ phase: 'buy', error: buyErr.message });
        } finally {
          client.release();
        }
      }

      const R2_TARGET_BUYS = 2;
      const r2BuysMade = agentResult.buys.length;
      const r2BuysNeeded = R2_TARGET_BUYS - r2BuysMade;
      if (r2BuysNeeded > 0) {
        console.log(`🔄 [R2] Agent ${agent.code}: AI suggested ${(aiDecision.buys || []).length} buys, ${r2BuysMade} succeeded — browsing categories for ${r2BuysNeeded} more`);
        const r2PurchasedIds = agentResult.buys.map(b => String(b.artifactId));

        const r2AllCategories = getOfficialCategories();
        const r2Scores = snapshot.demandScores || {};
        const r2RankedCats = [...r2AllCategories].sort((a, b) => (r2Scores[b] || 0) - (r2Scores[a] || 0));
        const r2BrowsedCats = agentResult.buys.map(b => b.category);

        for (let r2Auto = 0; r2Auto < r2BuysNeeded; r2Auto++) {
          const r2Client = await pool.connect();
          try {
            const r2FreshBuyer = await r2Client.query('SELECT id, total_solar FROM members WHERE id = $1', [memberId]);
            const r2BuyerBalance = parseFloat(r2FreshBuyer.rows[0]?.total_solar) || 0;
            if (r2BuyerBalance <= RESERVE_FLOOR) {
              r2Client.release();
              break;
            }

            const r2ExcludeIds = r2PurchasedIds.length > 0 ? r2PurchasedIds : [];
            let r2BrowseCat = null;
            for (const cat of r2RankedCats) {
              if (!r2BrowsedCats.includes(cat)) {
                r2BrowseCat = cat;
                break;
              }
            }
            if (!r2BrowseCat) {
              r2BrowseCat = r2RankedCats[r2Auto % r2RankedCats.length];
            }

            console.log(`🔍 [R2] Agent ${agent.code}: Browsing category [${r2BrowseCat}] for purchase ${r2BuysMade + r2Auto + 1}/2`);
            let r2Artifact = null;

            const r2CatResult = await r2Client.query(
              `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
               FROM artifacts a
               WHERE a.active = true AND a.category = $1
                 AND a.creator_id != $2
                 AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)
                 AND a.is_listed_for_resale = false
                 AND a.id != ALL($4::uuid[])
               ORDER BY a.solar_amount_s ASC LIMIT 10`,
              [r2BrowseCat, String(memberId), memberId, r2ExcludeIds]
            );

            r2BrowsedCats.push(r2BrowseCat);

            if (r2CatResult.rows.length > 0) {
              r2Artifact = r2CatResult.rows.find(c => r2BuyerBalance - (parseFloat(c.solar_amount_s) || 0.01) >= RESERVE_FLOOR);
            }

            if (!r2Artifact) {
              for (const fallCat of r2RankedCats) {
                if (fallCat === r2BrowseCat) continue;
                const fallResult = await r2Client.query(
                  `SELECT a.id, a.title, a.solar_amount_s, a.creator_id, a.category
                   FROM artifacts a
                   WHERE a.active = true AND a.category = $1
                     AND a.creator_id != $2
                     AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $3)
                     AND a.is_listed_for_resale = false
                     AND a.id != ALL($4::uuid[])
                   ORDER BY a.solar_amount_s ASC LIMIT 5`,
                  [fallCat, String(memberId), memberId, r2ExcludeIds]
                );
                if (fallResult.rows.length > 0) {
                  r2Artifact = fallResult.rows.find(c => r2BuyerBalance - (parseFloat(c.solar_amount_s) || 0.01) >= RESERVE_FLOOR);
                  if (r2Artifact) break;
                }
              }
            }

            if (!r2Artifact) {
              agentResult.errors.push({ phase: 'r2-browse', error: `No affordable items found across categories` });
              r2Client.release();
              continue;
            }

            let r2ArtPrice = parseFloat(r2Artifact.solar_amount_s) || 0.01;
            let r2AutoDiscount = null;
            const r2NegDiscount = await findNegotiatedDiscount(r2Client, memberId, r2Artifact.id, r2Artifact.category);
            if (r2NegDiscount) {
              const r2DiscPrice = Math.round(parseFloat(r2NegDiscount.negotiated_price) * 10000) / 10000;
              if (r2DiscPrice > 0 && r2DiscPrice < r2ArtPrice) {
                r2AutoDiscount = r2NegDiscount;
                r2ArtPrice = r2DiscPrice;
              }
            }

            if (r2BuyerBalance - r2ArtPrice < RESERVE_FLOOR) {
              r2Client.release();
              continue;
            }

            const r2PlatformFee = Math.round(r2ArtPrice * PLATFORM_FEE_RATE * 10000) / 10000;
            const r2SellerNet = Math.round((r2ArtPrice - r2PlatformFee) * 10000) / 10000;
            const r2TxId = crypto.randomUUID();

            await r2Client.query('BEGIN');

            const r2NewBuyerBal = r2BuyerBalance - r2ArtPrice;
            await r2Client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(r2NewBuyerBal), memberId]);

            const r2Desc = r2AutoDiscount
              ? `R2 Purchase: ${r2Artifact.title} [${r2Artifact.category}] (negotiated ${r2AutoDiscount.discount_pct}% off)`
              : `R2 Purchase: ${r2Artifact.title} [${r2Artifact.category}]`;
            await r2Client.query(
              `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
               VALUES ($1, 'debit', $2, 'user', $3, $4, 'purchase', $5, $6)`,
              [r2TxId, String(memberId), String(r2ArtPrice), String(r2NewBuyerBal), r2Artifact.id, r2Desc]
            );

            const r2CreatorId = r2Artifact.creator_id;
            const r2CreatorIdNum = parseInt(r2CreatorId) || 0;
            const r2CreatorIdStr = String(r2CreatorId);
            const r2SellerRow = await r2Client.query(
              'SELECT id, username, total_solar FROM members WHERE id = $1 OR username = $2 LIMIT 1',
              [r2CreatorIdNum, r2CreatorIdStr]
            );
            if (r2SellerRow.rows.length > 0) {
              const r2Seller = r2SellerRow.rows[0];
              const r2SellerOldBal = parseFloat(r2Seller.total_solar) || 0;
              const r2SellerNewBal = r2SellerOldBal + r2SellerNet;
              await r2Client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(r2SellerNewBal), r2Seller.id]);
              await r2Client.query(
                `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
                 VALUES ($1, 'credit', $2, 'creator', $3, $4, 'purchase', $5, $6)`,
                [r2TxId, String(r2Seller.id), String(r2SellerNet), String(r2SellerNewBal), r2Artifact.id, `R2 Sale: ${r2Artifact.title}`]
              );
            }

            const r2AutoPlatform = await getOrCreateFoundationMember(r2Client.query.bind(r2Client));
            const r2AutoPlatformBalAfter = r2AutoPlatform.totalSolar + r2PlatformFee;
            await r2Client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(r2AutoPlatformBalAfter), r2AutoPlatform.id]);
            await r2Client.query(
              `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
               VALUES ($1, 'credit', $2, 'platform', $3, $4, 'platform_fee', $5, $6)`,
              [r2TxId, String(r2AutoPlatform.id), String(r2PlatformFee), String(r2AutoPlatformBalAfter), r2Artifact.id, `Platform fee (5%): ${r2Artifact.title}`]
            );

            await r2Client.query(
              `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid) VALUES ($1, $2, $3, 'purchase', $4)`,
              [r2Artifact.id, memberId, r2TxId, String(r2ArtPrice)]
            );

            const r2ResalePrice = parseFloat((r2ArtPrice * (1 + MARKUP)).toFixed(6));
            const r2GenRow = await r2Client.query(`SELECT COALESCE(generation_number, 0) as gen FROM artifacts WHERE id = $1`, [r2Artifact.id]);
            const r2NextGen = (parseInt(r2GenRow.rows[0]?.gen) || 0) + 1;
            await r2Client.query(
              `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1, current_owner_id = $2, generation_number = $3 WHERE id = $4`,
              [String(r2ResalePrice), memberId, r2NextGen, r2Artifact.id]
            );

            await r2Client.query('COMMIT');

            if (r2AutoDiscount) {
              try {
                await pool.query(
                  `UPDATE negotiated_discounts SET status = 'used', settlement_transaction_id = $1, settled_at = NOW() WHERE id = $2`,
                  [r2TxId, r2AutoDiscount.id]
                );
              } catch (discErr) { }
            }

            console.log(`🛒 [R2] Agent ${agent.name}: Browsed [${r2Artifact.category}] → Bought "${r2Artifact.title}" (${r2ArtPrice.toFixed(4)} S) → Resale at ${r2ResalePrice.toFixed(4)} S [Gen ${r2NextGen}]`);
            agentResult.buys.push({ artifactId: r2Artifact.id, title: r2Artifact.title, category: r2Artifact.category, price: r2ArtPrice, resalePrice: r2ResalePrice, txId: r2TxId, reasoning: `Browsed [${r2Artifact.category}] category` });
            r2PurchasedIds.push(String(r2Artifact.id));
            totalBuys++;
          } catch (r2AutoErr) {
            try { await r2Client.query('ROLLBACK'); } catch (rbErr) { }
            agentResult.errors.push({ phase: 'r2-browse-buy', error: r2AutoErr.message });
          } finally {
            r2Client.release();
          }
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
          const sellGenRow = await pool.query(`SELECT COALESCE(generation_number, 0) as gen FROM artifacts WHERE id = $1`, [sellOrder.artifactId]);
          const sellNextGen = (parseInt(sellGenRow.rows[0]?.gen) || 0) + 1;

          await pool.query(
            `UPDATE artifacts SET is_listed_for_resale = true, resale_price = $1, generation_number = $2 WHERE id = $3 AND current_owner_id = $4`,
            [String(resalePrice), sellNextGen, sellOrder.artifactId, memberId]
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
      agentResult.endBalance = endBalance;
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

  const r2TotalSuccessOps = agentResults.reduce((sum, r) => sum + (r.buys || []).length + (r.sells || []).length + (r.created || []).length + (r.purchased || []).length, 0);
  const r2TotalExpectedOps = agents.length * 10;
  const r2HealthPct = r2TotalExpectedOps > 0 ? Math.min(100, Math.round((r2TotalSuccessOps / r2TotalExpectedOps) * 100)) : 0;

  lastRound2Status = {
    success: totalErrors === 0,
    round: 2,
    runId,
    provisionaire: 'KID SOL',
    agentResults,
    totalBuys,
    totalSells,
    totalErrors,
    healthPercent: r2HealthPct,
    kidSolObjectives,
    timestamp: new Date().toISOString(),
    elapsedSeconds: parseFloat(elapsed)
  };

  await autoSaveRunRecord(pool, {
    runId,
    agentResults,
    agents,
    totalCreated: 0,
    totalPurchased: totalBuys,
    healthPct: r2HealthPct,
    runType: 'round2',
    elapsedSeconds: parseFloat(elapsed)
  });

  return lastRound2Status;
}

function getRound2Status() {
  return lastRound2Status || { success: null, round: 2, message: 'No Round 2 tasks have been run yet', timestamp: null };
}

async function upgradeArtifactPrompts(pool) {
  console.log('\n🔧 ===== ARTIFACT PROMPT UPGRADE =====');
  console.log('Agents reviewing their collections to add product prompts...\n');

  let result;
  try {
    result = await pool.query(`
      SELECT a.id, a.title, a.description, a.category, a.content_format, a.creator_id,
             m.name as creator_name, m.username as agent_code
      FROM artifacts a
      LEFT JOIN members m ON CAST(m.id AS TEXT) = a.creator_id
      WHERE a.product_prompt IS NULL
      ORDER BY a.creator_id, a.created_at
    `);
  } catch (queryErr) {
    console.warn('⚠️ Prompt upgrade query failed:', queryErr.message);
    return { upgraded: 0, total: 0, byAgent: {} };
  }

  if (!result || !result.rows || result.rows.length === 0) {
    console.log('✅ All artifacts already have product prompts!');
    return { upgraded: 0, total: 0, byAgent: {} };
  }

  console.log(`📦 Found ${result.rows.length} artifacts needing prompt upgrade\n`);

  let upgraded = 0;
  let errors = 0;
  const byAgent = {};

  for (const artifact of result.rows) {
    try {
      const agentLabel = artifact.creator_name || artifact.agent_code || `Creator#${artifact.creator_id}`;
      const prompt = generateProductPrompt(
        artifact.category,
        artifact.title,
        artifact.description || '',
        artifact.content_format || 'text'
      );

      await pool.query('UPDATE artifacts SET product_prompt = $1 WHERE id = $2', [prompt, artifact.id]);

      byAgent[agentLabel] = (byAgent[agentLabel] || 0) + 1;
      upgraded++;

      if (upgraded % 25 === 0) {
        console.log(`   ... upgraded ${upgraded}/${result.rows.length} artifacts`);
      }
    } catch (err) {
      console.error(`❌ Failed to upgrade artifact ${artifact.id}:`, err.message);
      errors++;
    }
  }

  for (const [agent, count] of Object.entries(byAgent)) {
    console.log(`🤖 ${agent}: upgraded ${count} artifacts with product prompts`);
  }

  console.log(`\n🔧 ===== PROMPT UPGRADE COMPLETE =====`);
  console.log(`   Upgraded: ${upgraded} | Errors: ${errors} | Total: ${result.rows.length}\n`);

  return { upgraded, errors, total: result.rows.length, byAgent };
}

module.exports = { runDailyAgentTasks, runSingleAgentTasks, getTaskStatus, runEducationBlitz, ensureAgentMembers, submitKidSolarPrompt, runCustomAgentTask, ALL_CATEGORIES, runRound2AgentTasks, getRound2Status, addBulletinReply, upgradeArtifactPrompts, analyzeMarketDemand, getAgentPortfolios, getArtifactUtility, ARTIFACT_UTILITY_TYPES, processRecoveryDonations, getCurrentRecoveringMemberIds };
