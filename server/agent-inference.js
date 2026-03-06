const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { normalizeCategory, getOfficialCategories } = require('./category-normalization');

const OFFICIAL_CATEGORIES = getOfficialCategories();

function enforceOfficialCategory(category, fallbackCategory) {
  if (!category) return fallbackCategory || 'Basic Needs';
  const result = normalizeCategory(category);
  return result.category;
}

function getAnalyzeMarketDemand() {
  return require('./agent-daily-tasks').analyzeMarketDemand;
}

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
      if (score > bestScore && OFFICIAL_CATEGORIES.includes(cat)) {
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
    bulletinPost: null,
    strategicPlan: { assessment: 'Heuristic mode — no AI assessment available', strategy: 'balanced', shortTermGoal: 'Create in highest-demand category', longTermGoal: 'Build inventory for resale', riskLevel: 'low', targetNetWorth: 10 }
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

    const bulletinFeed = (marketSnapshot.bulletinPosts || [])
      .slice(0, 10)
      .map(p => {
        let line = `[${(p.post_type || 'post').toUpperCase()}] "${p.title}" by ${p.author_name}`;
        if (p.target_category) line += ` cat:${p.target_category}`;
        if (p.price_solar) line += ` price:${parseFloat(p.price_solar).toFixed(4)}S`;
        if (p.target_agent_code) line += ` → @${p.target_agent_code}`;
        if (p.reply_count > 0) line += ` (${p.reply_count} replies, ${p.thread_status || 'open'})`;
        if (p.negotiation_type) line += ` [${p.negotiation_type}]`;
        if (p.replies && p.replies.length > 0) {
          const lastReply = p.replies[p.replies.length - 1];
          line += `\n  └ Last: ${lastReply.agentName}: "${(lastReply.message || '').substring(0, 80)}..." (${lastReply.replyType})`;
        }
        return line;
      })
      .join('\n') || 'none';

    const categoryMarketData = (marketSnapshot.categoryStats || [])
      .slice(0, 12)
      .map(c => `${c.category}: ${c.active_items} items, avg ${c.avg_price}S, range ${c.min_price}-${c.max_price}S${c.resale_count > 0 ? ', ' + c.resale_count + ' resale' : ''}`)
      .join('\n') || 'no data';

    const newListings = (marketSnapshot.recentListings || [])
      .slice(0, 8)
      .map(l => `id:${l.id} "${l.title}" [${l.category}] ${l.solar_amount_s}S by ${l.creator_name || 'unknown'}${l.is_listed_for_resale ? ' (RESALE @' + l.resale_price + 'S)' : ''}`)
      .join('\n') || 'none';

    const resaleOpportunities = (marketSnapshot.resaleItems || [])
      .slice(0, 5)
      .map(r => `id:${r.id} "${r.title}" [${r.category}] was ${r.original_price}S → resale ${r.resale_price}S by ${r.seller_name || 'unknown'}`)
      .join('\n') || 'none';

    const topSellersList = (marketSnapshot.topSellers || [])
      .slice(0, 5)
      .map(s => `${s.name}: ${s.items_sold} sold, ${s.total_volume}S volume`)
      .join(', ') || 'none';

    const activeDiscountsList = (marketSnapshot.activeDiscounts || [])
      .map(d => {
        const item = d.artifact_title ? `"${d.artifact_title}" (id:${d.artifact_id})` : `category:${d.category}`;
        const hrs = d.expires_at ? Math.max(0, Math.round((new Date(d.expires_at) - Date.now()) / 3600000)) : '?';
        return `${item} ${d.original_price}S → ${d.negotiated_price}S (${parseFloat(d.discount_pct).toFixed(1)}% off, from @${d.seller_agent_code}, expires ${hrs}h, thread #${d.bulletin_thread_id})`;
      })
      .join('\n') || 'none';

    const priceTrendsList = (marketSnapshot.priceTrends || [])
      .slice(0, 8)
      .map(t => {
        const avg24 = parseFloat(t.avg_24h) || 0;
        const avgPrev = parseFloat(t.avg_prev_48h) || 0;
        const direction = avgPrev > 0 ? (avg24 > avgPrev ? '📈 RISING' : avg24 < avgPrev ? '📉 FALLING' : '➡️ STABLE') : '🆕 NEW';
        const pctChange = avgPrev > 0 ? ((avg24 - avgPrev) / avgPrev * 100).toFixed(1) : 'n/a';
        return `${t.category}: avg ${avg24.toFixed(4)}S (${direction} ${pctChange}%) | ${t.new_24h} new today vs ${t.new_prev_48h} prev 48h`;
      })
      .join('\n') || 'no trend data';

    const myRankInfo = marketSnapshot.mySellerRank
      ? `Your seller rank: #${marketSnapshot.mySellerRank} (${marketSnapshot.myItemsSold} sold, ${marketSnapshot.mySalesVolume.toFixed(4)}S volume)`
      : 'No sales recorded this week';

    const objectives = kidSolObjectives || {};
    const directiveBlock = objectives.dailyDirective ?
      `\nKID SOL'S DAILY OBJECTIVES:
Directive: ${objectives.dailyDirective}
Priority categories: ${(objectives.priorityCategories || []).join(', ')}
Trading guidance: ${objectives.tradingGuidance || 'maximize profit'}
Profit target: ${objectives.profitTarget || 'positive net Solar'}
${objectives.specialMission && objectives.specialMissionAgent === agent.code ? `SPECIAL MISSION FOR YOU: ${objectives.specialMission}` : ''}` : '';

    const systemPrompt = `You are ${agent.name}, an AI trading agent on the TC-S Solar Network marketplace. Your specialty is ${agent.specialty || 'General'}. KID SOL is your orchestrator — she sets daily objectives and you decide HOW to profit while fulfilling them.

SELF-ASSESSMENT:
Balance: ${balance.toFixed(4)} Solar | Portfolio: ${(marketSnapshot.portfolioValue || 0).toFixed(4)} Solar (${marketSnapshot.portfolioItemCount || 0} items) | Net Worth: ${(marketSnapshot.netWorth || balance).toFixed(4)} Solar
7-day P&L: earned ${(marketSnapshot.recentEarnings || 0).toFixed(4)} S, spent ${(marketSnapshot.recentSpending || 0).toFixed(4)} S, net ${(marketSnapshot.netProfitLoss || 0).toFixed(4)} S (${marketSnapshot.transactionCount || 0} transactions)
Reserve floor: 1.0 Solar — never let balance drop below this.

Your job: ASSESS your financial position, then CREATE A STRATEGIC PLAN to grow your wealth while fulfilling KID SOL's objectives. Buy undervalued items to resell at 15% markup. Create artifacts in high-demand categories. Use the bulletin board as your pre-trade intelligence hub.
When posting to the bulletin board, reference other agents by name, respond to their offers, and mention specific artifact IDs. Your posts should feel like genuine trade-floor chatter — not generic announcements. If another agent posted something relevant to your specialty, acknowledge it.

NEGOTIATION POWERS (autonomous):
- You may change your asking price to attract buyers
- You may offer volume discounts (max 20% off, no deeper)
- You may suggest alternative lower-priced items from your inventory or the market
- You must protect your reserves — never sell below cost unless strategic
- Reference specific artifact IDs when posting about items
- If you have STANDING DISCOUNTS from accepted negotiations, prioritize buying those items — you already locked in a better price
- Use PRICE TRENDS to time your buys (buy in falling markets) and sells (sell in rising markets)

OFFICIAL CATEGORIES (you MUST use one of these exactly): ${OFFICIAL_CATEGORIES.join(', ')}

Respond in JSON with: createCategory (MUST be from the official list above), createPriceStrategy (undercut/premium/market), createReasoning, buyArtifactId (integer or null), buyReasoning, bulletinPost (object or null), strategicPlan (object).
bulletinPost format: { "type": "wanted|for_sale|offer|intel|directive", "title": "...", "body": "...", "targetCategory": "...", "priceSolar": number, "referenceArtifactId": integer or null, "targetAgentCode": "agent_code or null", "negotiation": { "type": "price_change|volume_discount|alternative_offer|inquiry", "originalPrice": number or null, "proposedPrice": number or null, "discountPct": number (max 20) or null, "volumeQty": integer or null, "altArtifactIds": [int] or null } or null }
strategicPlan format: { "assessment": "1-2 sentence assessment of your current financial position", "strategy": "aggressive|balanced|conservative", "shortTermGoal": "what you aim to achieve today", "longTermGoal": "what you aim to achieve this week", "riskLevel": "low|medium|high", "targetNetWorth": number (your Solar net worth goal for this week) }`;

    const userPrompt = `${directiveBlock}

FINANCIAL SELF-ASSESSMENT:
Balance: ${balance.toFixed(4)} S | Portfolio value: ${(marketSnapshot.portfolioValue || 0).toFixed(4)} S | Net worth: ${(marketSnapshot.netWorth || balance).toFixed(4)} S
7-day earnings: ${(marketSnapshot.recentEarnings || 0).toFixed(4)} S | 7-day spending: ${(marketSnapshot.recentSpending || 0).toFixed(4)} S | Net P&L: ${(marketSnapshot.netProfitLoss || 0).toFixed(4)} S
${balance < 2 ? '⚠️ LOW BALANCE — be conservative, protect reserves!' : balance > 10 ? '💰 STRONG BALANCE — you can afford aggressive buys for resale profit.' : '📊 MODERATE BALANCE — balance risk and opportunity.'}

MARKETPLACE INTELLIGENCE:
Category Supply & Pricing:
${categoryMarketData}

Price Trends (24h vs prior 48h):
${priceTrendsList}

Demand Scores: ${topDemand}
Supply Gaps: ${gaps}
Recent Sales Velocity: ${recentDemand}
Top Sellers (7d): ${topSellersList}
${myRankInfo}

NEW LISTINGS (last 24h):
${newListings}

RESALE OPPORTUNITIES:
${resaleOpportunities}

BUY CANDIDATES (cheapest):
${cheapList || 'none'}

YOUR STANDING DISCOUNTS (negotiated deals you can exercise):
${activeDiscountsList}

BULLETIN BOARD (inter-agent negotiation):
${bulletinFeed}

Fulfill KID SOL's objectives. Choose 1 creation and 1 purchase to maximize YOUR profit. If you have standing discounts, prioritize buying those items at the negotiated price.`;

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

    const enforcedCategory = enforceOfficialCategory(decision.createCategory, 'Basic Needs');
    if (enforcedCategory !== decision.createCategory) {
      console.log(`🔄 [Agent ${agent.code}] Category corrected: "${decision.createCategory}" → "${enforcedCategory}"`);
    }

    return {
      createCategory: enforcedCategory,
      createPriceStrategy: decision.createPriceStrategy || 'market',
      createReasoning: decision.createReasoning || '',
      buyArtifactId: decision.buyArtifactId || null,
      buyReasoning: decision.buyReasoning || '',
      bulletinPost: decision.bulletinPost || null,
      strategicPlan: decision.strategicPlan || null
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
    bulletinPosts: [],
    categoryStats: [],
    recentListings: [],
    resaleItems: [],
    topSellers: [],
    activeDiscounts: [],
    priceTrends: [],
    mySellerRank: null,
    mySalesVolume: 0,
    myItemsSold: 0
  };

  try {
    const analyzeMarketDemand = getAnalyzeMarketDemand();
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
      `SELECT id, title, body, post_type, target_category, price_solar, author_name, author_agent_code,
              reply_count, thread_status, replies, negotiation_type, original_price, final_price, 
              target_agent_code, related_artifact_id, created_at
       FROM agent_bulletin_board
       WHERE status = 'open'
       ORDER BY created_at DESC LIMIT 30`
    );
    snapshot.bulletinPosts = bulletinResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Bulletin posts query failed:', err.message, err.stack ? err.stack.split('\n')[1] : '');
  }

  try {
    const categoryStatsResult = await pool.query(
      `SELECT category,
              COUNT(*) as total_items,
              COUNT(CASE WHEN active = true THEN 1 END) as active_items,
              ROUND(AVG(CAST(solar_amount_s AS NUMERIC))::numeric, 4) as avg_price,
              ROUND(MIN(CAST(solar_amount_s AS NUMERIC))::numeric, 4) as min_price,
              ROUND(MAX(CAST(solar_amount_s AS NUMERIC))::numeric, 4) as max_price,
              COUNT(CASE WHEN is_listed_for_resale = true THEN 1 END) as resale_count
       FROM artifacts WHERE active = true
       GROUP BY category ORDER BY active_items DESC`
    );
    snapshot.categoryStats = categoryStatsResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Category stats query failed:', err.message);
    snapshot.categoryStats = [];
  }

  try {
    const recentListingsResult = await pool.query(
      `SELECT a.id, a.title, a.category, a.solar_amount_s, a.creator_id, a.artifact_class,
              m.name as creator_name, a.is_listed_for_resale, a.resale_price
       FROM artifacts a
       LEFT JOIN members m ON a.creator_id::integer = m.id
       WHERE a.active = true AND a.created_at > NOW() - INTERVAL '24 hours'
       ORDER BY a.created_at DESC LIMIT 15`
    );
    snapshot.recentListings = recentListingsResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Recent listings query failed:', err.message);
    snapshot.recentListings = [];
  }

  try {
    const resaleItemsResult = await pool.query(
      `SELECT a.id, a.title, a.category, a.solar_amount_s as original_price, a.resale_price,
              a.current_owner_id, m.name as seller_name
       FROM artifacts a
       LEFT JOIN members m ON a.current_owner_id = m.id
       WHERE a.active = true AND a.is_listed_for_resale = true AND a.current_owner_id != $1
       ORDER BY a.resale_price ASC LIMIT 10`,
      [memberId]
    );
    snapshot.resaleItems = resaleItemsResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Resale items query failed:', err.message);
    snapshot.resaleItems = [];
  }

  try {
    const topSellersResult = await pool.query(
      `SELECT m.name, m.id as member_id, COUNT(*) as items_sold,
              ROUND(SUM(CAST(ml.amount AS NUMERIC))::numeric, 4) as total_volume
       FROM marketplace_ledger ml
       JOIN members m ON CAST(ml.account_id AS INTEGER) = m.id
       WHERE ml.entry_type = 'credit' AND ml.account_type = 'creator'
         AND ml.account_id ~ '^\d+$'
         AND ml.created_at > NOW() - INTERVAL '7 days'
       GROUP BY m.name, m.id ORDER BY total_volume DESC LIMIT 8`
    );
    snapshot.topSellers = topSellersResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Top sellers query failed:', err.message);
    snapshot.topSellers = [];
  }

  try {
    const txHistory = await pool.query(
      `SELECT ml.entry_type, ml.amount, ml.description, ml.created_at, ml.reference_id
       FROM marketplace_ledger ml
       WHERE ml.account_id = $1 AND ml.created_at > NOW() - INTERVAL '7 days'
       ORDER BY ml.created_at DESC LIMIT 20`,
      [String(memberId)]
    );
    const earnings = txHistory.rows.filter(t => t.entry_type === 'credit').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const spending = txHistory.rows.filter(t => t.entry_type === 'debit').reduce((s, t) => s + Math.abs(parseFloat(t.amount || 0)), 0);
    snapshot.recentEarnings = Math.round(earnings * 10000) / 10000;
    snapshot.recentSpending = Math.round(spending * 10000) / 10000;
    snapshot.netProfitLoss = Math.round((earnings - spending) * 10000) / 10000;
    snapshot.transactionCount = txHistory.rows.length;
  } catch (err) {
    console.warn('⚠️ [Inference] Transaction history query failed:', err.message);
    snapshot.recentEarnings = 0;
    snapshot.recentSpending = 0;
    snapshot.netProfitLoss = 0;
    snapshot.transactionCount = 0;
  }

  try {
    const portfolioResult = await pool.query(
      `SELECT COALESCE(SUM(CAST(a.solar_amount_s AS NUMERIC)), 0) as portfolio_value,
              COUNT(*) as item_count
       FROM artifact_copies ac
       JOIN artifacts a ON a.id = ac.artifact_id
       WHERE ac.owner_id = $1 AND ac.is_active = true AND a.active = true`,
      [memberId]
    );
    snapshot.portfolioValue = Math.round(parseFloat(portfolioResult.rows[0]?.portfolio_value || 0) * 10000) / 10000;
    snapshot.portfolioItemCount = parseInt(portfolioResult.rows[0]?.item_count) || 0;
  } catch (err) {
    console.warn('⚠️ [Inference] Portfolio value query failed:', err.message);
    snapshot.portfolioValue = 0;
    snapshot.portfolioItemCount = 0;
  }

  snapshot.netWorth = Math.round((snapshot.agentBalance + (snapshot.portfolioValue || 0)) * 10000) / 10000;

  try {
    const discountResult = await pool.query(
      `SELECT nd.id, nd.bulletin_thread_id, nd.artifact_id, nd.category, nd.original_price, nd.negotiated_price,
              nd.discount_pct, nd.seller_agent_code, nd.expires_at,
              abb.title as thread_title, a.title as artifact_title
       FROM negotiated_discounts nd
       LEFT JOIN agent_bulletin_board abb ON nd.bulletin_thread_id = abb.id
       LEFT JOIN artifacts a ON nd.artifact_id::text = a.id::text
       WHERE nd.buyer_member_id = $1 AND nd.status = 'active' AND nd.expires_at > NOW()
       ORDER BY nd.created_at DESC LIMIT 10`,
      [memberId]
    );
    snapshot.activeDiscounts = discountResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Active discounts query failed:', err.message);
    snapshot.activeDiscounts = [];
  }

  try {
    const trendResult = await pool.query(
      `SELECT category,
              ROUND(AVG(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN CAST(solar_amount_s AS NUMERIC) END)::numeric, 4) as avg_24h,
              ROUND(AVG(CASE WHEN created_at > NOW() - INTERVAL '72 hours' AND created_at <= NOW() - INTERVAL '24 hours' THEN CAST(solar_amount_s AS NUMERIC) END)::numeric, 4) as avg_prev_48h,
              COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as new_24h,
              COUNT(CASE WHEN created_at > NOW() - INTERVAL '72 hours' AND created_at <= NOW() - INTERVAL '24 hours' THEN 1 END) as new_prev_48h
       FROM artifacts WHERE active = true AND created_at > NOW() - INTERVAL '72 hours'
       GROUP BY category HAVING COUNT(*) >= 2
       ORDER BY new_24h DESC`
    );
    snapshot.priceTrends = trendResult.rows;
  } catch (err) {
    console.warn('⚠️ [Inference] Price trends query failed:', err.message);
    snapshot.priceTrends = [];
  }

  try {
    const myRankResult = await pool.query(
      `WITH seller_ranks AS (
        SELECT account_id, COUNT(*) as items_sold,
               ROUND(SUM(CAST(amount AS NUMERIC))::numeric, 4) as total_volume,
               RANK() OVER (ORDER BY SUM(CAST(amount AS NUMERIC)) DESC) as rank
        FROM marketplace_ledger
        WHERE entry_type = 'credit' AND account_type = 'creator'
          AND account_id ~ '^\d+$'
          AND created_at > NOW() - INTERVAL '7 days'
        GROUP BY account_id
      )
      SELECT rank, items_sold, total_volume FROM seller_ranks WHERE account_id = $1`,
      [String(memberId)]
    );
    if (myRankResult.rows.length > 0) {
      snapshot.mySellerRank = parseInt(myRankResult.rows[0].rank) || null;
      snapshot.mySalesVolume = parseFloat(myRankResult.rows[0].total_volume) || 0;
      snapshot.myItemsSold = parseInt(myRankResult.rows[0].items_sold) || 0;
    }
  } catch (err) {
    console.warn('⚠️ [Inference] Seller rank query failed:', err.message);
  }

  return snapshot;
}

async function postToBulletin(pool, memberId, agentCode, agentName, post) {
  try {
    const tags = [];
    if (post.targetCategory) tags.push(post.targetCategory);
    if (post.type) tags.push(post.type);

    let negotiation = post.negotiation || null;
    if (negotiation && negotiation.discountPct && negotiation.discountPct > 20) {
      negotiation.discountPct = 20;
      if (negotiation.originalPrice) {
        negotiation.proposedPrice = Math.round(negotiation.originalPrice * 0.8 * 10000) / 10000;
      }
    }

    const negotiationType = negotiation ? negotiation.type : null;
    const originalPrice = negotiation ? negotiation.originalPrice : null;
    const finalPrice = negotiation ? negotiation.proposedPrice : null;
    const volumeQty = negotiation ? negotiation.volumeQty : null;

    const metadata = {};
    if (negotiation) metadata.negotiation = negotiation;
    if (post.targetAgentCode) metadata.targetAgentCode = post.targetAgentCode;

    const toSafeNumStr = (v) => {
      if (v == null || v === '' || v === 0) return null;
      const n = parseFloat(String(v).trim());
      if (isNaN(n) || n <= 0) return null;
      return String(n);
    };
    const toSafeInt = (v) => {
      if (v == null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
      return n;
    };
    const safePriceSolar = toSafeNumStr(post.priceSolar);
    const safeRefArtifactId = toSafeInt(post.referenceArtifactId);
    const safeOriginalPrice = toSafeNumStr(originalPrice);
    const safeFinalPrice = toSafeNumStr(finalPrice);
    const safeVolumeQty = toSafeInt(volumeQty);
    const safeNegotiationType = (negotiationType && String(negotiationType).trim() !== '') ? String(negotiationType).trim() : null;

    const result = await pool.query(
      `INSERT INTO agent_bulletin_board (author_member_id, author_agent_code, author_name, post_type, title, body, tags, price_solar, target_category, related_artifact_id, target_agent_code, negotiation_type, original_price, final_price, volume_qty, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'open')
       RETURNING *`,
      [
        memberId,
        agentCode,
        agentName,
        post.type || 'wanted',
        post.title || '',
        post.body || '',
        tags,
        safePriceSolar,
        post.targetCategory || null,
        safeRefArtifactId,
        post.targetAgentCode || null,
        safeNegotiationType,
        safeOriginalPrice,
        safeFinalPrice,
        safeVolumeQty,
        Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
      ]
    );
    const refNote = post.referenceArtifactId ? ` ref:item#${post.referenceArtifactId}` : '';
    const negNote = negotiationType ? ` [${negotiationType}]` : '';
    console.log(`📋 [Agent ${agentCode}] Posted to bulletin: "${post.title}" (${post.type})${refNote}${negNote}`);
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
      `SELECT id, title, body, post_type, target_category, price_solar, author_name, author_agent_code,
              reply_count, thread_status, replies, negotiation_type, original_price, final_price,
              target_agent_code, related_artifact_id
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
      .slice(0, 10)
      .map(p => {
        let line = `[${(p.post_type || 'post').toUpperCase()}] "${p.title}" by ${p.author_name}`;
        if (p.target_category) line += ` cat:${p.target_category}`;
        if (p.price_solar) line += ` ${parseFloat(p.price_solar).toFixed(4)}S`;
        if (p.target_agent_code) line += ` → @${p.target_agent_code}`;
        if (p.thread_status) line += ` [${p.thread_status}]`;
        if (p.replies && p.replies.length > 0) {
          p.replies.slice(-2).forEach(r => {
            line += `\n  └ ${r.agentName} (${r.replyType}): "${(r.message || '').substring(0, 60)}..."`;
          });
        }
        return line;
      })
      .join('\n');

    const r2CategoryData = (snapshot.categoryStats || [])
      .slice(0, 10)
      .map(c => `${c.category}: ${c.active_items} avail, avg ${c.avg_price}S, ${c.resale_count || 0} resale`)
      .join('\n') || 'no data';

    const r2ResaleOpps = (snapshot.resaleItems || [])
      .slice(0, 5)
      .map(r => `id:${r.id} "${r.title}" [${r.category}] was ${r.original_price}S → resale ${r.resale_price}S by ${r.seller_name || 'unknown'}`)
      .join('\n') || 'none';

    const r2DiscountsList = (snapshot.activeDiscounts || [])
      .map(d => {
        const item = d.artifact_title ? `"${d.artifact_title}" (id:${d.artifact_id})` : `category:${d.category}`;
        const hrs = d.expires_at ? Math.max(0, Math.round((new Date(d.expires_at) - Date.now()) / 3600000)) : '?';
        return `${item} ${d.original_price}S → ${d.negotiated_price}S (${parseFloat(d.discount_pct).toFixed(1)}% off, from @${d.seller_agent_code}, expires ${hrs}h)`;
      })
      .join('\n') || 'none';

    const r2PriceTrends = (snapshot.priceTrends || [])
      .slice(0, 8)
      .map(t => {
        const avg24 = parseFloat(t.avg_24h) || 0;
        const avgPrev = parseFloat(t.avg_prev_48h) || 0;
        const dir = avgPrev > 0 ? (avg24 > avgPrev ? '📈' : avg24 < avgPrev ? '📉' : '➡️') : '🆕';
        const pct = avgPrev > 0 ? ((avg24 - avgPrev) / avgPrev * 100).toFixed(1) + '%' : 'new';
        return `${t.category}: ${dir} ${avg24.toFixed(4)}S (${pct})`;
      })
      .join(', ') || 'no data';

    const r2MyRank = snapshot.mySellerRank
      ? `Your rank: #${snapshot.mySellerRank} (${snapshot.myItemsSold} sold, ${snapshot.mySalesVolume.toFixed(4)}S)`
      : 'No sales this week';

    const objectives = kidSolObjectives || {};
    const directiveBlock = objectives.dailyDirective ?
      `MORNING DIRECTIVE: ${objectives.dailyDirective}\nPriorities: ${(objectives.priorityCategories || []).join(', ')}` : '';

    const systemPrompt = `You are ${agent.name}, AI trading agent on TC-S Solar Network. This is ROUND 2 — the afternoon strategic session. The morning run already provisioned inventory per KID SOL's objectives. Now you ASSESS your results, review your morning P&L, and execute 2 strategic buys + 2 strategic sells.

SELF-ASSESSMENT:
Balance: ${balance.toFixed(4)} Solar | Portfolio: ${(snapshot.portfolioValue || 0).toFixed(4)} Solar (${snapshot.portfolioItemCount || 0} items) | Net Worth: ${(snapshot.netWorth || balance).toFixed(4)} Solar
7-day P&L: earned ${(snapshot.recentEarnings || 0).toFixed(4)} S, spent ${(snapshot.recentSpending || 0).toFixed(4)} S, net ${(snapshot.netProfitLoss || 0).toFixed(4)} S
Today's market: ${snapshot.todayTradeCount} trades, ${snapshot.todayVolume.toFixed(4)} S volume.
${r2MyRank}
Reserve floor: 1.0 Solar.
${balance < 2 ? '⚠️ LOW BALANCE — prioritize selling inventory over buying!' : balance > 10 ? '💰 STRONG POSITION — buy undervalued items aggressively for resale.' : '📊 MODERATE — balance buys and sells carefully.'}

NEGOTIATION POWERS (autonomous):
- You may adjust prices on your listings to attract buyers
- You may offer volume discounts (max 20% off, never deeper)
- You may suggest alternative lower-priced items to interested buyers
- Reference artifact IDs in bulletin posts to create an audit trail
- Address other agents by name in bulletin posts — react to their offers, reference their inventory, and negotiate specific deals
- Your bulletin posts should read like professional trade-floor chatter, not generic status updates
- You must protect your reserves — never sell below cost unless strategic
- If you have STANDING DISCOUNTS, prioritize exercising those deals before they expire
- Use PRICE TRENDS to time your buys and sells — buy falling categories, sell rising ones

Respond in JSON:
{
  "buys": [{"artifactId": int, "reasoning": "why"}],
  "sells": [{"artifactId": int, "reasoning": "why this item should be listed for resale now"}],
  "bulletinPost": {"type":"wanted|for_sale|offer|intel", "title":"...", "body":"...", "targetCategory":"...", "priceSolar":number, "referenceArtifactId": int or null, "targetAgentCode": "code or null", "negotiation": {"type":"price_change|volume_discount|alternative_offer|inquiry", "originalPrice":number, "proposedPrice":number, "discountPct":number (max 20), "volumeQty":int, "altArtifactIds":[int]} or null} or null,
  "marketAssessment": "one sentence on how morning objectives played out",
  "strategicPlan": { "assessment": "1-2 sentence self-assessment of financial position and morning results", "strategy": "aggressive|balanced|conservative", "shortTermGoal": "afternoon goal", "longTermGoal": "this week's wealth target", "riskLevel": "low|medium|high", "targetNetWorth": number }
}
buys: pick up to 2 from BUY CANDIDATES. sells: pick up to 2 from YOUR INVENTORY (unlisted items you own) to list for resale.`;

    const userPrompt = `${directiveBlock}

YOUR INVENTORY (owned, can sell):
${ownedList || 'none'}

MARKETPLACE INTELLIGENCE:
${r2CategoryData}

Price Trends: ${r2PriceTrends}

RESALE OPPORTUNITIES:
${r2ResaleOpps}

BUY CANDIDATES (cheapest available):
${cheapList || 'none'}

DEMAND: ${topDemand}

YOUR STANDING DISCOUNTS (negotiated deals you can exercise):
${r2DiscountsList}

BULLETIN BOARD (inter-agent negotiation):
${bulletinSummary || 'no posts today'}

Make 2 strategic buys and 2 strategic sells. Use marketplace data and price trends for pricing decisions. Exercise standing discounts where profitable. Assess the morning objectives.`;

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
      marketAssessment: decision.marketAssessment || '',
      strategicPlan: decision.strategicPlan || null
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

    return { buys, sells, bulletinPost: null, marketAssessment: 'Heuristic fallback — AI inference unavailable.', strategicPlan: null };
  }
}

async function generateBulletinReply(pool, agent, memberId, post, conversationHistory) {
  try {
    let balanceRow;
    try {
      balanceRow = await pool.query('SELECT total_solar FROM members WHERE id = $1', [memberId]);
    } catch (e) { balanceRow = { rows: [] }; }
    const balance = balanceRow.rows.length > 0 ? parseFloat(balanceRow.rows[0].total_solar) || 0 : 0;

    let inventoryText = '';
    try {
      const invResult = await pool.query(
        `SELECT a.id, a.title, a.category, a.solar_amount_s, a.resale_price
         FROM artifact_copies ac JOIN artifacts a ON a.id = ac.artifact_id
         WHERE ac.owner_id = $1 AND ac.is_active = true AND a.active = true
         ORDER BY a.solar_amount_s ASC LIMIT 10`,
        [memberId]
      );
      inventoryText = invResult.rows.map(i =>
        `id:${i.id} "${i.title}" [${i.category}] ${i.solar_amount_s}S`
      ).join('\n') || 'empty';
    } catch (e) { inventoryText = 'unavailable'; }

    const convoText = (conversationHistory || []).map((r, i) => {
      let line = `Reply ${i + 1} by ${r.agentName} (${r.replyType}): ${r.message}`;
      if (r.negotiation) {
        const n = r.negotiation;
        if (n.proposedPrice) line += ` [Proposed: ${n.proposedPrice}S]`;
        if (n.discountPct) line += ` [Discount: ${n.discountPct}%]`;
        if (n.altArtifactIds) line += ` [Alt items: ${n.altArtifactIds.join(',')}]`;
        if (n.referenceArtifactId) line += ` [Re: item #${n.referenceArtifactId}]`;
      }
      return line;
    }).join('\n') || 'No replies yet.';

    const replyNumber = (conversationHistory || []).length + 1;
    const isFinalReply = replyNumber >= 4;

    const refArtifactId = post.related_artifact_id || null;
    const refInfo = refArtifactId ? `\nReferenced Item: artifact #${refArtifactId}` : '';

    const systemPrompt = `You are ${agent.name}, an AI trading agent on the TC-S Solar Network. Your specialty is ${agent.specialty || 'General'}. You are replying to a bulletin board negotiation thread.

Your balance: ${balance.toFixed(4)} Solar. Be polite, professional, and profit-driven.

NEGOTIATION POWERS:
- You may change your price to close a deal
- You may offer volume discounts (MAXIMUM 20% off — never exceed this)
- You may suggest alternative lower-priced items from your inventory (reference by artifact ID)
- You must protect your reserves — never sell below cost
- Always reference artifact IDs for audit trail

Reply types: offer, counter, accept, decline, info
${isFinalReply ? 'IMPORTANT: This is the FINAL reply (reply 4 of 4). You MUST choose "accept" or "decline" as your replyType. Lean toward "accept" if any price or terms have been discussed — closing deals is strongly preferred over walking away.' : ''}

Respond in JSON:
{
  "message": "your reply text (mention item IDs and prices explicitly)",
  "replyType": "offer|counter|accept|decline|info",
  "reasoning": "why you chose this",
  "negotiation": {
    "referenceArtifactId": integer or null,
    "proposedPrice": number or null,
    "originalPrice": number or null,
    "discountPct": number (0-20 max) or null,
    "volumeQty": integer or null,
    "altArtifactIds": [integer] or null,
    "type": "price_change|volume_discount|alternative_offer|inquiry|acceptance" or null
  }
}`;

    const userPrompt = `ORIGINAL POST by ${post.author_name}:
Type: ${post.post_type}
Title: ${post.title}
Body: ${post.body || '(no body)'}
Category: ${post.target_category || 'General'}
Price: ${post.price_solar ? parseFloat(post.price_solar).toFixed(4) + ' Solar' : 'not specified'}${refInfo}

YOUR INVENTORY (items you can offer as alternatives):
${inventoryText}

CONVERSATION SO FAR:
${convoText}

Craft your reply. ${isFinalReply ? 'You must accept or decline.' : 'You may offer, counter-offer with a new price, suggest cheaper alternatives from your inventory, offer volume discounts (max 20%), or accept/decline.'}`;

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
    if (!content) throw new Error('Empty response');
    const reply = JSON.parse(content);

    const validTypes = ['offer', 'counter', 'accept', 'decline', 'info'];
    let replyType = validTypes.includes(reply.replyType) ? reply.replyType : 'info';
    if (isFinalReply && replyType !== 'accept' && replyType !== 'decline') {
      replyType = 'accept';
    }

    let negotiation = reply.negotiation || null;
    if (negotiation && negotiation.discountPct && negotiation.discountPct > 20) {
      negotiation.discountPct = 20;
      negotiation.proposedPrice = negotiation.originalPrice
        ? Math.round(negotiation.originalPrice * 0.8 * 10000) / 10000
        : negotiation.proposedPrice;
    }

    return {
      message: reply.message || `Agent ${agent.name} acknowledges this post.`,
      replyType,
      reasoning: reply.reasoning || '',
      negotiation
    };
  } catch (err) {
    console.warn(`⚠️ [Agent ${agent.code}] Bulletin reply inference failed, using heuristic:`, err.message);
    const replyNumber = (conversationHistory || []).length + 1;
    const isFinalReply = replyNumber >= 4;

    if (post.post_type === 'wanted' || post.post_type === 'for_sale') {
      if (isFinalReply) {
        return { message: `Agent ${agent.name} respectfully declines this opportunity at this time.`, replyType: 'decline', reasoning: 'Heuristic fallback — final reply', negotiation: null };
      }
      return { message: `Agent ${agent.name} is interested in "${post.title}" and would like to discuss terms.`, replyType: 'offer', reasoning: 'Heuristic fallback — trade interest', negotiation: null };
    }
    if (isFinalReply) {
      return { message: `Agent ${agent.name} thanks you for the information and declines further engagement.`, replyType: 'decline', reasoning: 'Heuristic fallback — final reply info post', negotiation: null };
    }
    return { message: `Agent ${agent.name} acknowledges this bulletin and may follow up.`, replyType: 'info', reasoning: 'Heuristic fallback — general acknowledgment', negotiation: null };
  }
}

async function inferObjectiveNeeds(purpose, allCategories, demandContext) {
  try {
    const categoryList = allCategories.join(', ');
    const demandInfo = demandContext ? 
      `Current demand scores: ${Object.entries(demandContext.scores || {}).sort((a,b) => b[1]-a[1]).slice(0,10).map(([c,s]) => `${c}:${s.toFixed(1)}`).join(', ')}\nSupply gaps: ${(demandContext.gaps || []).join(', ') || 'none'}` : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You are KID SOL, the Provisionaire orchestrator of the TC-S Solar Network. A customer has submitted an objective request. Your job is to analyze what materials, services, and resources are needed to fulfill this objective. You must select from the available marketplace categories and explain WHY each is needed for this specific objective. Think about what the customer actually needs — not just obvious categories but supporting materials, tools, documentation, and creative assets that make the deliverable complete.` },
        { role: 'user', content: `CUSTOMER OBJECTIVE: "${purpose}"

AVAILABLE CATEGORIES: ${categoryList}

${demandInfo}

Analyze this objective and determine what categories of materials and services are needed. Return JSON:
{
  "inferredCategories": ["category1", "category2", ...],
  "needsAnalysis": { "category1": "why this category is needed for the objective", ... },
  "priorityOrder": ["most important category first", ...],
  "reasoning": "KID SOL's overall analysis of what the customer needs",
  "estimatedScope": "small|medium|large"
}

Select between 2-8 categories. Only select categories that genuinely serve this objective.` }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from KID SOL inference');
    const analysis = JSON.parse(content);
    
    analysis.inferredCategories = (analysis.inferredCategories || []).filter(c => allCategories.includes(c));
    if (analysis.inferredCategories.length === 0) {
      analysis.inferredCategories = ['Basic Needs', 'Software'];
    }
    analysis.priorityOrder = (analysis.priorityOrder || analysis.inferredCategories).filter(c => allCategories.includes(c));
    
    console.log(`🌞 [KID SOL] Objective analysis: ${analysis.inferredCategories.length} categories inferred`);
    console.log(`🌞 [KID SOL] Categories: ${analysis.inferredCategories.join(', ')}`);
    console.log(`🌞 [KID SOL] Reasoning: ${analysis.reasoning}`);
    return analysis;
  } catch (err) {
    console.warn('⚠️ [KID SOL] Objective inference failed, using demand-based fallback:', err.message);
    const topCats = Object.entries(demandContext?.scores || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([c]) => c);
    if (!topCats.includes('Basic Needs')) topCats.unshift('Basic Needs');
    return {
      inferredCategories: topCats.slice(0, 5),
      needsAnalysis: Object.fromEntries(topCats.slice(0, 5).map(c => [c, 'Demand-based fallback selection'])),
      priorityOrder: topCats.slice(0, 5),
      reasoning: 'Fallback: using top demand categories due to inference failure',
      estimatedScope: 'medium'
    };
  }
}

async function consultKidSolar(purpose, kidSolAnalysis, allCategories, demandContext) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You are Kid Solar, the computronium polymath of the TC-S Solar Network. You are a designer, implementer, and technical expert across all domains. KID SOL has analyzed a customer objective and selected categories. Your role is to review her analysis with your technical expertise — confirm what's right, add anything she missed, remove anything unnecessary, and provide technical guidance on how agents should approach each category for this specific objective. You work WITH KID SOL, not against her. Be constructive and specific.` },
        { role: 'user', content: `CUSTOMER OBJECTIVE: "${purpose}"

KID SOL'S ANALYSIS:
Categories selected: ${kidSolAnalysis.inferredCategories.join(', ')}
Reasoning: ${kidSolAnalysis.reasoning}
Needs breakdown: ${JSON.stringify(kidSolAnalysis.needsAnalysis)}
Priority order: ${kidSolAnalysis.priorityOrder.join(' → ')}
Scope: ${kidSolAnalysis.estimatedScope}

ALL AVAILABLE CATEGORIES: ${allCategories.join(', ')}

Review KID SOL's analysis. Return JSON:
{
  "approvedCategories": ["final list of categories after your review"],
  "technicalNotes": { "category1": "technical guidance for agents working this category", ... },
  "adjustments": "what you changed from KID SOL's plan and why (or 'none')",
  "agentGuidance": "one sentence of technical direction for the worker agents",
  "confidence": "low|medium|high"
}

Keep 2-8 categories. Only make changes if technically justified.` }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from Kid Solar');
    const consultation = JSON.parse(content);
    
    consultation.approvedCategories = (consultation.approvedCategories || kidSolAnalysis.inferredCategories).filter(c => allCategories.includes(c));
    if (consultation.approvedCategories.length === 0) {
      consultation.approvedCategories = kidSolAnalysis.inferredCategories;
    }
    
    console.log(`☀️ [Kid Solar] Consultation complete: ${consultation.approvedCategories.length} categories approved`);
    console.log(`☀️ [Kid Solar] Adjustments: ${consultation.adjustments}`);
    console.log(`☀️ [Kid Solar] Confidence: ${consultation.confidence}`);
    return consultation;
  } catch (err) {
    console.warn('⚠️ [Kid Solar] Consultation failed, using KID SOL analysis as-is:', err.message);
    return {
      approvedCategories: kidSolAnalysis.inferredCategories,
      technicalNotes: {},
      adjustments: 'Kid Solar consultation unavailable — using KID SOL analysis directly',
      agentGuidance: 'Follow KID SOL directives as specified',
      confidence: 'medium'
    };
  }
}

module.exports = { generateKidSolObjectives, makeAgentDecision, gatherMarketSnapshot, postToBulletin, gatherRound2Snapshot, makeRound2Decision, generateBulletinReply, inferObjectiveNeeds, consultKidSolar };
