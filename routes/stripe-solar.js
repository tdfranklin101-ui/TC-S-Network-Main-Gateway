const Stripe = require('stripe');

const SOLAR_PACKS = {
  starter: { usd: 500, solar: 500, label: 'Starter — 500 Solar' },
  builder: { usd: 2500, solar: 2500, label: 'Builder — 2,500 Solar' },
  founder: { usd: 10000, solar: 10000, label: 'Founder — 10,000 Solar' },
};

const USD_TO_SOLAR_RATE = 100;
const KWH_TO_SOLAR_RATE = 1 / 4913;

const AGENT_CODES = [
  '01','02','03','04','05','06','07','08','09','10',
  '11','12','13','14','15','16','17','18','19','20'
];

let stripe;
function getStripe() {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function getAuthenticatedMemberId(req, sessionHelpers) {
  if (!sessionHelpers) return null;
  const { getCookie, getSession } = sessionHelpers;
  const sessionId = getCookie(req, 'tc_s_session');
  if (!sessionId) return null;
  const session = await getSession(sessionId);
  return session?.userId || null;
}

async function assignAgentToMember(pool, memberId) {
  const existing = await pool.query(
    `SELECT agent_code FROM agent_assignments WHERE member_id = $1 AND is_active = true LIMIT 1`,
    [memberId]
  );
  if (existing.rows.length > 0) return existing.rows[0].agent_code;

  const counts = await pool.query(
    `SELECT agent_code, COUNT(*) as cnt FROM agent_assignments WHERE is_active = true GROUP BY agent_code`
  );
  const usageMap = {};
  counts.rows.forEach(r => usageMap[r.agent_code] = parseInt(r.cnt));

  let bestCode = AGENT_CODES[0];
  let bestCount = usageMap[bestCode] || 0;
  for (const code of AGENT_CODES) {
    const c = usageMap[code] || 0;
    if (c < bestCount) { bestCode = code; bestCount = c; }
  }

  const agentMember = await pool.query(
    `SELECT id FROM members WHERE username = $1 LIMIT 1`,
    [`agent_eco_${bestCode}`]
  );
  const agentMemberId = agentMember.rows.length > 0 ? agentMember.rows[0].id : null;

  await pool.query(
    `INSERT INTO agent_assignments (id, member_id, agent_member_id, agent_code, is_active)
     VALUES (gen_random_uuid(), $1, $2, $3, true)`,
    [memberId, agentMemberId || memberId, bestCode]
  );

  console.log(`🤖 Agent ${bestCode} assigned to member ${memberId}`);
  return bestCode;
}

async function creditSolarToMember(pool, memberId, solarAmount, source, metadata) {
  const balRes = await pool.query(`SELECT total_solar FROM members WHERE id = $1`, [memberId]);
  if (balRes.rows.length === 0) throw new Error('Member not found');

  const currentBalance = parseFloat(balRes.rows[0].total_solar || '0');
  const newBalance = currentBalance + solarAmount;

  await pool.query(`UPDATE members SET total_solar = $1 WHERE id = $2`, [String(newBalance), memberId]);

  const txId = `solar_purchase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await pool.query(
    `INSERT INTO marketplace_ledger (id, transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, created_at)
     VALUES (gen_random_uuid(), $1, 'credit', $2, 'member', $3, $4, $5, $6, $7, NOW())`,
    [txId, String(memberId), String(solarAmount), String(newBalance), source, metadata.purchaseId || txId, `Solar credited: ${solarAmount} S via ${source}`]
  );

  return { newBalance, txId };
}

module.exports = function stripeSolarRoutes(req, res, pathname, pool, sessionHelpers) {
  if (!pathname.startsWith('/api/solar-checkout')) return false;

  if (pathname === '/api/solar-checkout/packs' && req.method === 'GET') {
    sendJSON(res, 200, {
      success: true,
      packs: Object.entries(SOLAR_PACKS).map(([key, pack]) => ({
        id: key,
        label: pack.label,
        usdCents: pack.usd,
        usdDisplay: `$${(pack.usd / 100).toFixed(0)}`,
        solar: pack.solar,
      })),
      usdToSolarRate: USD_TO_SOLAR_RATE,
      kwhToSolarRate: KWH_TO_SOLAR_RATE,
      recInfo: {
        description: 'Renewable Energy Certificates (RECs) can also fund Solar. 1 kWh verified = ~0.000204 Solar.',
        enabled: true,
      }
    });
    return true;
  }

  if (pathname === '/api/solar-checkout/create-session' && req.method === 'POST') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const body = await parseBody(req);
        const { packId } = body;

        if (!packId) {
          return sendJSON(res, 400, { error: 'packId required' });
        }

        const pack = SOLAR_PACKS[packId];
        if (!pack) {
          return sendJSON(res, 400, { error: 'Invalid pack ID' });
        }

        const member = await pool.query(`SELECT id, username, email FROM members WHERE id = $1`, [authMemberId]);
        if (member.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Member not found' });
        }

        const s = getStripe();
        const host = req.headers.host || 'localhost:5000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        const session = await s.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Solar Pack: ${pack.label}`,
                description: `${pack.solar} Solar tokens for the TC-S Network marketplace`,
              },
              unit_amount: pack.usd,
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${protocol}://${host}/member-dashboard.html?purchase=success&pack=${packId}`,
          cancel_url: `${protocol}://${host}/member-dashboard.html?purchase=cancelled`,
          metadata: {
            memberId: String(authMemberId),
            packId,
            solarAmount: String(pack.solar),
          },
          customer_email: member.rows[0].email || undefined,
        });

        await pool.query(
          `INSERT INTO solar_purchases (id, member_id, funding_source, stripe_session_id, usd_amount, solar_credited, exchange_rate, status)
           VALUES (gen_random_uuid(), $1, 'usd', $2, $3, $4, $5, 'pending')`,
          [authMemberId, session.id, (pack.usd / 100).toFixed(2), String(pack.solar), String(USD_TO_SOLAR_RATE)]
        );

        sendJSON(res, 200, { success: true, sessionId: session.id, url: session.url });
      } catch (err) {
        console.error('Stripe session creation error:', err.message);
        sendJSON(res, 500, { error: 'Failed to create checkout session' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/webhook' && req.method === 'POST') {
    (async () => {
      try {
        const rawBody = await getRawBody(req);
        const sig = req.headers['stripe-signature'];
        const s = getStripe();

        let event;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (webhookSecret) {
          if (!sig) {
            return sendJSON(res, 400, { error: 'Missing stripe-signature header' });
          }
          try {
            event = s.webhooks.constructEvent(rawBody, sig, webhookSecret);
          } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return sendJSON(res, 400, { error: 'Invalid signature' });
          }
        } else {
          console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set — accepting unsigned webhook (dev mode only)');
          event = JSON.parse(rawBody.toString());
        }

        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          const memberId = parseInt(session.metadata?.memberId);
          const solarAmount = parseInt(session.metadata?.solarAmount);
          const packId = session.metadata?.packId;

          if (memberId && solarAmount) {
            const existing = await pool.query(
              `SELECT id, status FROM solar_purchases WHERE stripe_session_id = $1 LIMIT 1`,
              [session.id]
            );

            if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
              console.log(`⚠️ Webhook replay ignored — session ${session.id} already completed`);
              return sendJSON(res, 200, { received: true, duplicate: true });
            }

            const purchaseId = `stripe_${session.id}`;
            const { newBalance, txId } = await creditSolarToMember(pool, memberId, solarAmount, 'usd_purchase', { purchaseId });

            await pool.query(
              `UPDATE solar_purchases SET status = 'completed', stripe_payment_intent_id = $1, completed_at = NOW()
               WHERE stripe_session_id = $2 AND status = 'pending'`,
              [session.payment_intent, session.id]
            );

            await assignAgentToMember(pool, memberId);

            console.log(`💰 Solar purchase complete: Member ${memberId} credited ${solarAmount} Solar (${packId}). New balance: ${newBalance}`);
          }
        }

        sendJSON(res, 200, { received: true });
      } catch (err) {
        console.error('Webhook processing error:', err.message);
        sendJSON(res, 500, { error: 'Webhook processing failed' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/rec-credit' && req.method === 'POST') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const body = await parseBody(req);
        const { kwhAmount, certificateId } = body;

        if (!kwhAmount) {
          return sendJSON(res, 400, { error: 'kwhAmount required' });
        }

        const kwh = parseFloat(kwhAmount);
        if (kwh <= 0 || kwh > 10000000) {
          return sendJSON(res, 400, { error: 'kWh amount must be between 0 and 10,000,000' });
        }

        const solarAmount = parseFloat((kwh * KWH_TO_SOLAR_RATE).toFixed(6));
        if (solarAmount <= 0) {
          return sendJSON(res, 400, { error: 'kWh amount too small to convert' });
        }

        const purchaseId = `rec_${Date.now()}`;
        const { newBalance } = await creditSolarToMember(pool, authMemberId, solarAmount, 'rec_credit', { purchaseId, certificateId });

        await pool.query(
          `INSERT INTO solar_purchases (id, member_id, funding_source, rec_kwh, rec_certificate_id, solar_credited, exchange_rate, status, completed_at)
           VALUES (gen_random_uuid(), $1, 'rec', $2, $3, $4, $5, 'completed', NOW())`,
          [authMemberId, String(kwh), certificateId || null, String(solarAmount), String(KWH_TO_SOLAR_RATE)]
        );

        await assignAgentToMember(pool, authMemberId);

        console.log(`⚡ REC credit: Member ${authMemberId} credited ${solarAmount} Solar from ${kwh} kWh (cert: ${certificateId || 'none'})`);
        sendJSON(res, 200, { success: true, solarCredited: solarAmount, newBalance, kwhUsed: kwh });
      } catch (err) {
        console.error('REC credit error:', err.message);
        sendJSON(res, 500, { error: 'REC credit processing failed' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/withdraw' && req.method === 'POST') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const body = await parseBody(req);
        const { solarAmount } = body;

        if (!solarAmount || isNaN(solarAmount)) {
          return sendJSON(res, 400, { error: 'solarAmount required (numeric)' });
        }

        const solar = parseFloat(solarAmount);
        const MIN_WITHDRAWAL = 500;
        if (solar < MIN_WITHDRAWAL) {
          return sendJSON(res, 400, { error: `Minimum withdrawal is ${MIN_WITHDRAWAL} Solar ($${(MIN_WITHDRAWAL / USD_TO_SOLAR_RATE).toFixed(0)})` });
        }

        const balRes = await pool.query(`SELECT total_solar FROM members WHERE id = $1`, [authMemberId]);
        if (balRes.rows.length === 0) {
          return sendJSON(res, 404, { error: 'Member not found' });
        }

        const currentBalance = parseFloat(balRes.rows[0].total_solar || '0');
        if (solar > currentBalance) {
          return sendJSON(res, 400, { error: `Insufficient balance. You have ${currentBalance.toFixed(4)} Solar.` });
        }

        const PLATFORM_FEE_RATE = 0.05;
        const platformFee = parseFloat((solar * PLATFORM_FEE_RATE).toFixed(6));
        const netSolar = parseFloat((solar - platformFee).toFixed(6));
        const usdPayout = parseFloat((netSolar / USD_TO_SOLAR_RATE).toFixed(2));

        if (usdPayout < 0.50) {
          return sendJSON(res, 400, { error: 'Payout too small after fees. Minimum payout is $0.50.' });
        }

        const newBalance = currentBalance - solar;
        await pool.query(`UPDATE members SET total_solar = $1 WHERE id = $2`, [String(newBalance), authMemberId]);

        const withdrawalId = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await pool.query(
          `INSERT INTO solar_withdrawals (id, member_id, solar_amount, platform_fee, net_solar, usd_payout, status, payout_method)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'stripe')`,
          [withdrawalId, authMemberId, String(solar), String(platformFee), String(netSolar), String(usdPayout)]
        );

        const txId = `withdrawal_${withdrawalId}`;
        await pool.query(
          `INSERT INTO marketplace_ledger (id, transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, created_at)
           VALUES (gen_random_uuid(), $1, 'debit', $2, 'member', $3, $4, 'withdrawal', $5, $6, NOW())`,
          [txId, String(authMemberId), String(solar), String(newBalance), withdrawalId, `Cash out: ${solar} Solar → $${usdPayout} USD (5% fee: ${platformFee} S)`]
        );

        await pool.query(
          `INSERT INTO marketplace_ledger (id, transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, created_at)
           VALUES (gen_random_uuid(), $1, 'credit', 'tcs_foundation', 'platform', $2, '0', 'platform_fee', $3, $4, NOW())`,
          [txId, String(platformFee), withdrawalId, `Withdrawal fee: ${platformFee} S from member ${authMemberId}`]
        );

        console.log(`💸 Withdrawal requested: Member ${authMemberId} cashing out ${solar} Solar → $${usdPayout} (fee: ${platformFee} S)`);

        sendJSON(res, 200, {
          success: true,
          withdrawal: {
            id: withdrawalId,
            solarDebited: solar,
            platformFee,
            netSolar,
            usdPayout,
            status: 'pending',
            newBalance,
          }
        });
      } catch (err) {
        console.error('Withdrawal error:', err.message);
        sendJSON(res, 500, { error: 'Withdrawal processing failed' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-withdrawals' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const withdrawals = await pool.query(
          `SELECT id, solar_amount, platform_fee, net_solar, usd_payout, status, payout_method, payout_reference, processed_at, created_at
           FROM solar_withdrawals WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [authMemberId]
        );

        const totalPending = withdrawals.rows.filter(w => w.status === 'pending')
          .reduce((sum, w) => sum + parseFloat(w.usd_payout || '0'), 0);
        const totalPaid = withdrawals.rows.filter(w => w.status === 'completed')
          .reduce((sum, w) => sum + parseFloat(w.usd_payout || '0'), 0);

        sendJSON(res, 200, {
          success: true,
          withdrawals: withdrawals.rows,
          totals: { pendingUsd: totalPending, paidUsd: totalPaid }
        });
      } catch (err) {
        console.error('Withdrawal history error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch withdrawals' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-purchases' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const purchases = await pool.query(
          `SELECT id, funding_source, usd_amount, rec_kwh, rec_certificate_id, solar_credited, exchange_rate, status, completed_at, created_at
           FROM solar_purchases WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [authMemberId]
        );

        const totalUsd = purchases.rows.filter(p => p.funding_source === 'usd' && p.status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.usd_amount || '0'), 0);
        const totalRecKwh = purchases.rows.filter(p => p.funding_source === 'rec' && p.status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.rec_kwh || '0'), 0);
        const totalSolar = purchases.rows.filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + parseFloat(p.solar_credited || '0'), 0);

        sendJSON(res, 200, {
          success: true,
          purchases: purchases.rows,
          totals: { usd: totalUsd, recKwh: totalRecKwh, solarCredited: totalSolar }
        });
      } catch (err) {
        console.error('Purchase history error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch purchases' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-agent' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const assignment = await pool.query(
          `SELECT aa.agent_code, aa.assigned_at, m.username as agent_username, m.name as agent_name, m.total_solar as agent_balance
           FROM agent_assignments aa
           LEFT JOIN members m ON m.id = aa.agent_member_id
           WHERE aa.member_id = $1 AND aa.is_active = true
           LIMIT 1`,
          [authMemberId]
        );

        if (assignment.rows.length === 0) {
          return sendJSON(res, 200, { success: true, assigned: false });
        }

        const agent = assignment.rows[0];

        const recentActivity = await pool.query(
          `SELECT ml.entry_type, ml.amount, ml.reference_type, ml.description, ml.created_at
           FROM marketplace_ledger ml
           WHERE ml.account_id = $1
           ORDER BY ml.created_at DESC LIMIT 20`,
          [agent.agent_username || `agent_eco_${agent.agent_code}`]
        );

        const todayCreated = await pool.query(
          `SELECT COUNT(*) as cnt FROM artifacts
           WHERE creator_id = $1 AND created_at >= CURRENT_DATE`,
          [agent.agent_username || `agent_eco_${agent.agent_code}`]
        );

        sendJSON(res, 200, {
          success: true,
          assigned: true,
          agent: {
            code: agent.agent_code,
            username: agent.agent_username,
            name: agent.agent_name,
            balance: parseFloat(agent.agent_balance || '0'),
            assignedAt: agent.assigned_at,
          },
          recentActivity: recentActivity.rows,
          todayStats: {
            created: parseInt(todayCreated.rows[0]?.cnt || '0'),
          }
        });
      } catch (err) {
        console.error('Agent info error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch agent info' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/member-ledger' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) {
          return sendJSON(res, 401, { error: 'Authentication required' });
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const ledger = await pool.query(
          `SELECT entry_type, amount, balance_after, reference_type, reference_id, description, created_at
           FROM marketplace_ledger
           WHERE account_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [String(authMemberId), limit]
        );

        const purchases = await pool.query(
          `SELECT funding_source, usd_amount, rec_kwh, solar_credited, status, completed_at
           FROM solar_purchases WHERE member_id = $1 AND status = 'completed'
           ORDER BY completed_at DESC LIMIT 20`,
          [authMemberId]
        );

        sendJSON(res, 200, {
          success: true,
          ledger: ledger.rows,
          solarPurchases: purchases.rows,
        });
      } catch (err) {
        console.error('Ledger error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch ledger' });
      }
    })();
    return true;
  }

  return false;
};

module.exports.assignAgentToMember = assignAgentToMember;
module.exports.creditSolarToMember = creditSolarToMember;
