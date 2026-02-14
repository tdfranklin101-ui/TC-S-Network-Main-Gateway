const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { analyzeMarketDemand } = require('./agent-daily-tasks');

async function generateKidSolObjectives(pool, demandScores, gaps, totalInventory, memberRequests) {
  try {
    const topDemand = Object.entries(demandScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([c, s]) => `${c}:${s.toFixed(1)}`)
      .join(', ');
    const gapList = gaps.length > 0 ? gaps.join(', ') : 'none';
    const requestList = (memberRequests || []).slice(0, 5).map(r => r.query).join('; ') || 'none';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You are KID SOL, the Provisionaire orchestrator of the TC-S Solar Network. You set daily strategic objectives for 22 AI trading agents. Your goals: fill supply gaps, meet member demand, stimulate profitable trade, and build agent reserves. Respond in JSON.` },
        { role: 'user', content: `DAILY MARKET BRIEFING:
Inventory: ${totalInventory} total artifacts
Demand scores: ${topDemand}
Supply gaps: ${gapList}
Member requests: ${requestList}

Set today's objectives. Return JSON:
{
  "dailyDirective": "one sentence strategic direction for all agents",
  "priorityCategories": ["top 3-5 categories to focus creation on"],
  "tradingGuidance": "one sentence on what to buy/sell",
  "profitTarget": "description of daily profit goal",
  "specialMission": "optional special task for one agent or null",
  "specialMissionAgent": "agent code for special mission or null"
}` }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');
    const objectives = JSON.parse(content);
    console.log(`👑 [KID SOL] Daily Directive: ${objectives.dailyDirective}`);
    console.log(`👑 [KID SOL] Priority Categories: ${(objectives.priorityCategories || []).join(', ')}`);
    console.log(`👑 [KID SOL] Trading Guidance: ${objectives.tradingGuidance}`);
    return objectives;
  } catch (err) {
    console.warn(`⚠️ [KID SOL] Objective generation failed, using defaults:`, err.message);
    const topCats = Object.entries(demandScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([c]) => c);
    if (!topCats.includes('Basic Needs')) topCats.unshift('Basic Needs');
    return {
      dailyDirective: 'Fill supply gaps and maximize trade volume across all categories.',
      priorityCategories: topCats.slice(0, 5),
      tradingGuidance: 'Buy undervalued items in high-demand categories for resale.',
      profitTarget: 'Each agent should aim for positive net Solar by end of run.',
      specialMission: null,
      specialMissionAgent: null
    };
  }
}

function heuristicFallback(marketSnapshot) {
  let bestCategory = 'Basic Needs';
  let bestScore = -1;
  if (marketSnapshot.demandScores) {
    for (const [cat, score] of Object.entries(marketSnapshot.demandScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = cat;
      }
    }
  }

  let buyArtifactId = null;
  if (marketSnapshot.cheapestItems && marketSnapshot.cheapestItems.length > 0) {
    const topCategories = Object.entries(marketSnapshot.demandScores || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);
    const match = marketSnapshot.cheapestItems.find(i => topCategories.includes(i.category));
    buyArtifactId = match ? match.id : marketSnapshot.cheapestItems[0].id;
  }

  return {
    createCategory: bestCategory,
    createPriceStrategy: 'market',
    createReasoning: `Heuristic fallback: ${bestCategory} has highest demand score (${bestScore.toFixed(1)})`,
    buyArtifactId,
    buyReasoning: buyArtifactId ? 'Heuristic: cheapest item in high-demand category' : 'No suitable buy candidates',
    bulletinPost: null
  };
}

async function makeAgentDecision(pool, agent, memberId, marketSnapshot, kidSolObjectives) {
  try {
    const balance = marketSnapshot.agentBalance || 0;
    const topDemand = Object.entries(marketSnapshot.demandScores || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c, s]) => `${c}:${s.toFixed(1)}`)
      .join(', ');

    const gaps = (marketSnapshot.gaps || []).join(', ') || 'none';

    const cheapList = (marketSnapshot.cheapestItems || [])
      .map(i => `id:${i.id} "${i.title}" [${i.category}] ${i.solar_amount_s}S`)
      .join('\n');

    const recentDemand = (marketSnapshot.recentSales || [])
      .slice(0, 5)
      .map(r => `${r.category}(${r.sales})`)
      .join(', ') || 'none';

    const wantedPosts = (marketSnapshot.bulletinPosts || [])
      .slice(0, 5)
      .map(p => `"${p.title}" cat:${p.target_category || '?'} price:${p.price_solar || '?'}S by:${p.author_name}`)
      .join('\n') || 'none';

    const objectives = kidSolObjectives || {};
    const directiveBlock = objectives.dailyDirective ?
      `\nKID SOL'S DAILY OBJECTIVES:
Directive: ${objectives.dailyDirective}
Priority categories: ${(objectives.priorityCategories || []).join(', ')}
Trading guidance: ${objectives.tradingGuidance || 'maximize profit'}
Profit target: ${objectives.profitTarget || 'positive net Solar'}
${objectives.specialMission && objectives.specialMissionAgent === agent.code ? `SPECIAL MISSION FOR YOU: ${objectives.specialMission}` : ''}` : '';

    const systemPrompt = `You are ${agent.name}, an AI trading agent on the TC-S Solar Network marketplace. Your specialty is ${agent.specialty || 'General'}. KID SOL is your orchestrator — she sets daily objectives and you decide HOW to profit while fulfilling them.

Your job: fulfill KID SOL's objectives in the most profitable way. Buy undervalued items to resell at 15% markup. Create artifacts in high-demand categories. Post to the bulletin board to find deals.

Balance: ${balance} Solar. Reserve floor: 1.0 Solar. Inventory: ${marketSnapshot.agentInventory || 0} items.

Respond in JSON with: createCategory, createPriceStrategy (undercut/premium/market), createReasoning, buyArtifactId (integer or null), buyReasoning, bulletinPost (object with type/title/body/targetCategory/priceSolar, or null).`;

    const userPrompt = `${directiveBlock}

MARKET STATE:
Demand: ${topDemand}
Gaps: ${gaps}
Balance: ${balance} S

BUY CANDIDATES:
${cheapList || 'none'}

RECENT DEMAND: ${recentDemand}

BULLETIN BOARD (wanted by other agents):
${wantedPosts}

Fulfill KID SOL's objectives. Choose 1 creation and 1 purchase to maximize YOUR profit.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn(`⚠️ [Agent ${agent.code}] Empty AI response, using heuristic`);
      return heuristicFallback(marketSnapshot);
    }

    const decision = JSON.parse(content);

    return {
      createCategory: decision.createCategory || 'Basic Needs',
      createPriceStrategy: decision.createPriceStrategy || 'market',
      createReasoning: decision.createReasoning || '',
      buyArtifactId: decision.buyArtifactId || null,
      buyReasoning: decision.buyReasoning || '',
      bulletinPost: decision.bulletinPost || null
    };
  } catch (err) {
    console.warn(`⚠️ [Agent ${agent.code}] AI decision failed, using heuristic:`, err.message);
    return heuristicFallback(marketSnapshot);
  }
}

async function gatherMarketSnapshot(pool, memberId) {
  const snapshot = {
    demandScores: {},
    gaps: [],
    agentBalance: 0,
    cheapestItems: [],
    recentSales: [],
    agentInventory: 0,
    bulletinPosts: []
  };

  try {
    const demand = await analyzeMarketDemand(pool);
    snapshot.demandScores = demand.scores || {};
    snapshot.gaps = demand.gaps || [];
  } catch (err) {
    console.warn('⚠️ [Inference] Demand analysis failed:', err.message);
  }

  try {
    const balResult = await pool.query(
      `SELECT total_solar FROM members WHERE id = $1`,
      [memberId]
    );
    if (balResult.rows.length > 0) {
      snapshot.agentBalance = parseFloat(balResult.rows[0].total_solar) || 0;
    }
  } catch (err) {
    console.warn('⚠️ [Inference] Balance query failed:', err.message);
  }

  try {
    const cheapResult = await pool.query(
      `SELECT a.id, a.title, a.category, a.solar_amount_s, a.creator_id
       FROM artifacts a
       WHERE a.active = true AND a.creator_id != $1
         AND a.id NOT IN (SELECT artifact_id FROM artifact_copies WHERE owner_id = $2)
         AND a.is_listed_for_resale = false
       ORDER BY a.solar_amount_s ASC LIMIT 10`,
      [String(memberId), memberId]
    );
    snapshot.cheapestItems = cheapResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Cheapest items query failed:', err.message);
  }

  try {
    const salesResult = await pool.query(
      `SELECT a.category, COUNT(*) as sales
       FROM artifact_copies ac JOIN artifacts a ON ac.artifact_id = a.id
       WHERE ac.acquired_at > NOW() - INTERVAL '7 days'
       GROUP BY a.category ORDER BY sales DESC LIMIT 10`
    );
    snapshot.recentSales = salesResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Sales velocity query failed:', err.message);
  }

  try {
    const invResult = await pool.query(
      `SELECT COUNT(*) as count FROM artifact_copies WHERE owner_id = $1 AND is_active = true`,
      [memberId]
    );
    snapshot.agentInventory = parseInt(invResult.rows[0]?.count) || 0;
  } catch (err) {
    console.warn('⚠️ [Inference] Inventory count query failed:', err.message);
  }

  try {
    const bulletinResult = await pool.query(
      `SELECT title, body, target_category, price_solar, author_name
       FROM agent_bulletin_board
       WHERE post_type = 'wanted' AND status = 'open'
       ORDER BY created_at DESC LIMIT 20`
    );
    snapshot.bulletinPosts = bulletinResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Bulletin posts query failed:', err.message);
  }

  return snapshot;
}

async function postToBulletin(pool, memberId, agentCode, agentName, post) {
  try {
    const tags = [];
    if (post.targetCategory) tags.push(post.targetCategory);
    if (post.type) tags.push(post.type);

    const result = await pool.query(
      `INSERT INTO agent_bulletin_board (author_member_id, author_agent_code, author_name, post_type, title, body, tags, price_solar, target_category, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open')
       RETURNING *`,
      [
        memberId,
        agentCode,
        agentName,
        post.type || 'wanted',
        post.title || '',
        post.body || '',
        tags,
        post.priceSolar != null ? String(post.priceSolar) : null,
        post.targetCategory || null
      ]
    );
    console.log(`📋 [Agent ${agentCode}] Posted to bulletin: "${post.title}" (${post.type})`);
    return result.rows[0];
  } catch (err) {
    console.warn(`⚠️ [Agent ${agentCode}] Bulletin post failed:`, err.message);
    return null;
  }
}

async function gatherRound2Snapshot(pool, memberId) {
  const snapshot = await gatherMarketSnapshot(pool, memberId);

  try {
    const ownedResult = await pool.query(
      `SELECT a.id, a.title, a.category, a.solar_amount_s, a.is_listed_for_resale, a.resale_price, a.current_owner_id,
              ac.solar_paid, ac.acquired_at
       FROM artifact_copies ac
       JOIN artifacts a ON a.id = ac.artifact_id
       WHERE ac.owner_id = $1 AND ac.is_active = true AND a.active = true
       ORDER BY ac.acquired_at DESC LIMIT 20`,
      [memberId]
    );
    snapshot.ownedArtifacts = ownedResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Owned artifacts query failed:', err.message);
    snapshot.ownedArtifacts = [];
  }

  try {
    const todayBulletin = await pool.query(
      `SELECT post_type, title, body, author_name, author_agent_code, target_category, price_solar, replies
       FROM agent_bulletin_board
       WHERE created_at > NOW() - INTERVAL '12 hours' AND status = 'open'
       ORDER BY created_at DESC LIMIT 30`
    );
    snapshot.todayBulletin = todayBulletin.rows;
  } catch (err) {
    snapshot.todayBulletin = [];
  }

  try {
    const todayTrades = await pool.query(
      `SELECT COUNT(*) as trade_count, SUM(CAST(amount AS NUMERIC)) as volume
       FROM marketplace_ledger
       WHERE created_at > NOW() - INTERVAL '8 hours' AND entry_type = 'debit'`
    );
    snapshot.todayTradeCount = parseInt(todayTrades.rows[0]?.trade_count) || 0;
    snapshot.todayVolume = parseFloat(todayTrades.rows[0]?.volume) || 0;
  } catch (err) {
    snapshot.todayTradeCount = 0;
    snapshot.todayVolume = 0;
  }

  return snapshot;
}

async function makeRound2Decision(pool, agent, memberId, snapshot, kidSolObjectives) {
  try {
    const balance = snapshot.agentBalance || 0;
    const topDemand = Object.entries(snapshot.demandScores || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([c, s]) => `${c}:${s.toFixed(1)}`)
      .join(', ');

    const cheapList = (snapshot.cheapestItems || [])
      .map(i => `id:${i.id} "${i.title}" [${i.category}] ${i.solar_amount_s}S`)
      .join('\n');

    const ownedList = (snapshot.ownedArtifacts || [])
      .map(a => {
        const paid = parseFloat(a.solar_paid) || 0;
        const listed = a.is_listed_for_resale ? 'LISTED' : 'UNLISTED';
        const resale = a.resale_price ? parseFloat(a.resale_price).toFixed(4) : (paid * 1.15).toFixed(4);
        return `id:${a.id} "${a.title}" [${a.category}] paid:${paid.toFixed(4)}S resale:${resale}S ${listed}`;
      })
      .join('\n');

    const bulletinSummary = (snapshot.todayBulletin || [])
      .slice(0, 8)
      .map(p => `[${p.post_type}] "${p.title}" by ${p.author_name}${p.replies && p.replies.length > 0 ? ` (${p.replies.length} replies)` : ''}`)
      .join('\n');

    const objectives = kidSolObjectives || {};
    const directiveBlock = objectives.dailyDirective ?
      `MORNING DIRECTIVE: ${objectives.dailyDirective}\nPriorities: ${(objectives.priorityCategories || []).join(', ')}` : '';

    const systemPrompt = `You are ${agent.name}, AI trading agent on TC-S Solar Network. This is ROUND 2 — the afternoon strategic session. The morning run already provisioned inventory per KID SOL's objectives. Now you assess results and make 2 strategic buys + 2 strategic sells to maximize profit.

Balance: ${balance} Solar. Reserve floor: 1.0 Solar.
Today's market activity: ${snapshot.todayTradeCount} trades, ${snapshot.todayVolume.toFixed(4)} S volume.

Respond in JSON:
{
  "buys": [{"artifactId": int, "reasoning": "why"}],
  "sells": [{"artifactId": int, "reasoning": "why this item should be listed for resale now"}],
  "bulletinPost": {"type":"intel/wanted/for_sale/offer", "title":"...", "body":"...", "targetCategory":"...", "priceSolar":number} or null,
  "marketAssessment": "one sentence on how morning objectives played out"
}
buys: pick up to 2 from BUY CANDIDATES. sells: pick up to 2 from YOUR INVENTORY (unlisted items you own) to list for resale.`;

    const userPrompt = `${directiveBlock}

YOUR INVENTORY (owned, can sell):
${ownedList || 'none'}

BUY CANDIDATES (available to purchase):
${cheapList || 'none'}

DEMAND: ${topDemand}

TODAY'S BULLETIN:
${bulletinSummary || 'no posts today'}

Make 2 strategic buys and 2 strategic sells. Assess the morning objectives.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response');
    const decision = JSON.parse(content);

    return {
      buys: Array.isArray(decision.buys) ? decision.buys.slice(0, 2) : [],
      sells: Array.isArray(decision.sells) ? decision.sells.slice(0, 2) : [],
      bulletinPost: decision.bulletinPost || null,
      marketAssessment: decision.marketAssessment || ''
    };
  } catch (err) {
    console.warn(`⚠️ [Agent ${agent.code}] Round 2 AI decision failed, using heuristic:`, err.message);

    const buys = [];
    if (snapshot.cheapestItems && snapshot.cheapestItems.length > 0) {
      const topCats = Object.entries(snapshot.demandScores || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
      const candidates = snapshot.cheapestItems.filter(i => topCats.includes(i.category));
      for (let i = 0; i < Math.min(2, candidates.length); i++) {
        buys.push({ artifactId: candidates[i].id, reasoning: 'Heuristic: cheap item in high-demand category' });
      }
    }

    const sells = [];
    const unlisted = (snapshot.ownedArtifacts || []).filter(a => !a.is_listed_for_resale);
    for (let i = 0; i < Math.min(2, unlisted.length); i++) {
      sells.push({ artifactId: unlisted[i].id, reasoning: 'Heuristic: listing unlisted inventory for profit' });
    }

    return { buys, sells, bulletinPost: null, marketAssessment: 'Heuristic fallback — AI inference unavailable.' };
  }
}

module.exports = { generateKidSolObjectives, makeAgentDecision, gatherMarketSnapshot, postToBulletin, gatherRound2Snapshot, makeRound2Decision };
