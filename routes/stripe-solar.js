const Stripe = require('stripe');
const { COMPLIANCE_POLICY, isSettlementEnabled, validateSettlementMode } = require('../lib/compliancePolicy');
const { getNetworkFees, getFeeLabel, calculateFee } = require('../lib/feePolicy');
const { getDashboardTabs } = require('../lib/dashboardTabs');

const KWH_PER_SOLAR = 4913;
const USD_PER_KWH = 0.45;
const USD_PER_SOLAR = KWH_PER_SOLAR * USD_PER_KWH;
const SOLAR_PER_USD = 1 / USD_PER_SOLAR;
const KWH_TO_SOLAR_RATE = 1 / KWH_PER_SOLAR;

const SOLAR_PACKS = {
  starter:  { usd: 500,   solar: parseFloat((5   * SOLAR_PER_USD).toFixed(6)), label: 'Starter — $5' },
  builder:  { usd: 2500,  solar: parseFloat((25  * SOLAR_PER_USD).toFixed(6)), label: 'Builder — $25' },
  founder:  { usd: 10000, solar: parseFloat((100 * SOLAR_PER_USD).toFixed(6)), label: 'Founder — $100' },
};

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

async function getNetworkConfig(pool, networkId) {
  const id = networkId || 'default';
  const result = await pool.query(`SELECT * FROM networks WHERE id = $1 LIMIT 1`, [id]);
  if (result.rows.length === 0) {
    return {
      id: 'default', name: 'TC-S Main Network', slug: 'tcs-main', status: 'active',
      settlement_mode: 'disabled', allow_fiat_activation: true, allow_rec_activation: true,
      allow_member_to_member_transfers: true, allow_agent_trading: true,
      allow_agent_commissions: true, marketplace_scope: 'curated',
      network_rules: null, reserve_policy: null,
    };
  }
  return result.rows[0];
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

  const txId = `solar_activation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await pool.query(
    `INSERT INTO marketplace_ledger (id, transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, created_at)
     VALUES (gen_random_uuid(), $1, 'credit', $2, 'member', $3, $4, $5, $6, $7, NOW())`,
    [txId, String(memberId), String(solarAmount), String(newBalance), source, metadata.purchaseId || txId, `Solar activated: ${solarAmount} S via ${source}`]
  );

  return { newBalance, txId };
}

module.exports = function stripeSolarRoutes(req, res, pathname, pool, sessionHelpers) {
  if (!pathname.startsWith('/api/solar-checkout') && !pathname.startsWith('/api/network')) return false;

  if (pathname === '/api/network/config' && req.method === 'GET') {
    (async () => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const networkId = url.searchParams.get('network') || 'default';
        const config = await getNetworkConfig(pool, networkId);
        const fees = getNetworkFees(config);
        const tabs = getDashboardTabs(config);

        sendJSON(res, 200, {
          success: true,
          network: {
            id: config.id,
            name: config.name,
            slug: config.slug,
            status: config.status,
            settlement_mode: config.settlement_mode,
            allow_fiat_activation: config.allow_fiat_activation,
            allow_rec_activation: config.allow_rec_activation,
            allow_member_to_member_transfers: config.allow_member_to_member_transfers,
            allow_agent_trading: config.allow_agent_trading,
            allow_agent_commissions: config.allow_agent_commissions,
            marketplace_scope: config.marketplace_scope,
            network_rules: config.network_rules,
            reserve_policy: config.reserve_policy,
          },
          fees,
          tabs,
          compliance: {
            marketplaceDescription: COMPLIANCE_POLICY.approvedMarketplaceDescription,
            settlementDisclaimer: isSettlementEnabled(config) ? COMPLIANCE_POLICY.approvedSettlementDisclaimer : COMPLIANCE_POLICY.settlementDisabledNotice,
            closedLoopNotice: COMPLIANCE_POLICY.closedLoopNotice,
            platformPositioning: COMPLIANCE_POLICY.platformPositioning,
            agentDescription: COMPLIANCE_POLICY.agentMarketplaceDescription,
            orchestratorDescription: COMPLIANCE_POLICY.orchestratorDescription,
          },
          energy: { usdPerSolar: USD_PER_SOLAR, solarPerUsd: SOLAR_PER_USD, usdPerKwh: USD_PER_KWH, kwhPerSolar: KWH_PER_SOLAR },
        });
      } catch (err) {
        console.error('Network config error:', err.message);
        sendJSON(res, 500, { error: 'Failed to load network config' });
      }
    })();
    return true;
  }

  if (pathname === '/api/network/admin/update' && req.method === 'POST') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

        const memberCheck = await pool.query(`SELECT role FROM members WHERE id = $1`, [authMemberId]);
        if (memberCheck.rows.length === 0) return sendJSON(res, 404, { error: 'Member not found' });
        const memberRole = (memberCheck.rows[0].role || '').toLowerCase();
        if (memberRole !== 'admin' && memberRole !== 'super_admin' && memberRole !== 'owner') {
          return sendJSON(res, 403, { error: 'Admin access required. Only network administrators can modify network settings.' });
        }

        const body = await parseBody(req);
        const { networkId, settlement_mode, allow_fiat_activation, allow_rec_activation,
                allow_agent_trading, allow_agent_commissions, allow_member_to_member_transfers,
                marketplace_scope, network_rules, reserve_policy, name } = body;

        if (settlement_mode && !validateSettlementMode(settlement_mode)) {
          return sendJSON(res, 400, { error: `Invalid settlement mode. Must be one of: ${COMPLIANCE_POLICY.validSettlementModes.join(', ')}` });
        }

        const id = networkId || 'default';
        const fields = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
        if (settlement_mode !== undefined) { fields.push(`settlement_mode = $${idx++}`); values.push(settlement_mode); }
        if (allow_fiat_activation !== undefined) { fields.push(`allow_fiat_activation = $${idx++}`); values.push(allow_fiat_activation); }
        if (allow_rec_activation !== undefined) { fields.push(`allow_rec_activation = $${idx++}`); values.push(allow_rec_activation); }
        if (allow_agent_trading !== undefined) { fields.push(`allow_agent_trading = $${idx++}`); values.push(allow_agent_trading); }
        if (allow_agent_commissions !== undefined) { fields.push(`allow_agent_commissions = $${idx++}`); values.push(allow_agent_commissions); }
        if (allow_member_to_member_transfers !== undefined) { fields.push(`allow_member_to_member_transfers = $${idx++}`); values.push(allow_member_to_member_transfers); }
        if (marketplace_scope !== undefined) { fields.push(`marketplace_scope = $${idx++}`); values.push(marketplace_scope); }
        if (network_rules !== undefined) { fields.push(`network_rules = $${idx++}`); values.push(JSON.stringify(network_rules)); }
        if (reserve_policy !== undefined) { fields.push(`reserve_policy = $${idx++}`); values.push(JSON.stringify(reserve_policy)); }

        if (fields.length === 0) return sendJSON(res, 400, { error: 'No fields to update' });

        fields.push(`updated_at = NOW()`);
        values.push(id);

        await pool.query(`UPDATE networks SET ${fields.join(', ')} WHERE id = $${idx}`, values);

        const updated = await getNetworkConfig(pool, id);
        sendJSON(res, 200, { success: true, network: updated });
      } catch (err) {
        console.error('Network admin update error:', err.message);
        sendJSON(res, 500, { error: 'Failed to update network config' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/packs' && req.method === 'GET') {
    (async () => {
      try {
        const config = await getNetworkConfig(pool, 'default');
        sendJSON(res, 200, {
          success: true,
          packs: Object.entries(SOLAR_PACKS).map(([key, pack]) => ({
            id: key,
            label: pack.label,
            usdCents: pack.usd,
            usdDisplay: `$${(pack.usd / 100).toFixed(0)}`,
            solar: pack.solar,
            solarDisplay: pack.solar.toFixed(6),
          })),
          usdPerSolar: USD_PER_SOLAR,
          solarPerUsd: SOLAR_PER_USD,
          usdPerKwh: USD_PER_KWH,
          kwhPerSolar: KWH_PER_SOLAR,
          allowFiatActivation: config.allow_fiat_activation,
          allowRecActivation: config.allow_rec_activation,
          recInfo: {
            description: `Verified renewable generation may activate Solar according to the Solar Standard: 1 Solar = ${KWH_PER_SOLAR} kWh. 1 kWh = ${KWH_TO_SOLAR_RATE.toFixed(6)} Solar.`,
            enabled: config.allow_rec_activation,
          }
        });
      } catch (err) {
        console.error('Packs error:', err.message);
        sendJSON(res, 500, { error: 'Failed to load packs' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/create-session' && req.method === 'POST') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

        const config = await getNetworkConfig(pool, 'default');
        if (!config.allow_fiat_activation) {
          return sendJSON(res, 403, { error: 'fiat_activation_disabled', message: 'Fiat activation is not enabled for this network.' });
        }

        const body = await parseBody(req);
        const { packId } = body;
        if (!packId) return sendJSON(res, 400, { error: 'packId required' });

        const pack = SOLAR_PACKS[packId];
        if (!pack) return sendJSON(res, 400, { error: 'Invalid pack ID' });

        const member = await pool.query(`SELECT id, username, email FROM members WHERE id = $1`, [authMemberId]);
        if (member.rows.length === 0) return sendJSON(res, 404, { error: 'Member not found' });

        const s = getStripe();
        const host = req.headers.host || 'localhost:5000';
        const protocol = host.includes('localhost') ? 'http' : 'https';

        const session = await s.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Solar Activation: ${pack.label}`,
                description: `Activate ${pack.solar.toFixed(6)} Solar for TC-S marketplace participation`,
              },
              unit_amount: pack.usd,
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${protocol}://${host}/member-dashboard.html?activation=success&pack=${packId}`,
          cancel_url: `${protocol}://${host}/member-dashboard.html?activation=cancelled`,
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
          [authMemberId, session.id, (pack.usd / 100).toFixed(2), String(pack.solar), String(SOLAR_PER_USD)]
        );

        sendJSON(res, 200, { success: true, sessionId: session.id, url: session.url });
      } catch (err) {
        console.error('Stripe session creation error:', err.message);
        sendJSON(res, 500, { error: 'Failed to create activation session' });
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
          if (!sig) return sendJSON(res, 400, { error: 'Missing stripe-signature header' });
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
          const solarAmount = parseFloat(session.metadata?.solarAmount);
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

            const purchaseId = `fiat_activation_${session.id}`;
            const { newBalance } = await creditSolarToMember(pool, memberId, solarAmount, 'fiat_activation', { purchaseId });

            await pool.query(
              `UPDATE solar_purchases SET status = 'completed', stripe_payment_intent_id = $1, completed_at = NOW()
               WHERE stripe_session_id = $2 AND status = 'pending'`,
              [session.payment_intent, session.id]
            );

            await assignAgentToMember(pool, memberId);
            console.log(`⚡ Fiat activation complete: Member ${memberId} activated ${solarAmount} Solar (${packId}). New balance: ${newBalance}`);
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
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

        const config = await getNetworkConfig(pool, 'default');
        if (!config.allow_rec_activation) {
          return sendJSON(res, 403, { error: 'rec_activation_disabled', message: 'REC activation is not enabled for this network.' });
        }

        const body = await parseBody(req);
        const { kwhAmount, certificateId } = body;
        if (!kwhAmount) return sendJSON(res, 400, { error: 'kwhAmount required' });

        const kwh = parseFloat(kwhAmount);
        if (kwh <= 0 || kwh > 10000000) return sendJSON(res, 400, { error: 'kWh amount must be between 0 and 10,000,000' });

        const solarAmount = parseFloat((kwh * KWH_TO_SOLAR_RATE).toFixed(6));
        if (solarAmount <= 0) return sendJSON(res, 400, { error: 'kWh amount too small to convert' });

        const purchaseId = `rec_activation_${Date.now()}`;
        const { newBalance } = await creditSolarToMember(pool, authMemberId, solarAmount, 'rec_activation', { purchaseId, certificateId });

        await pool.query(
          `INSERT INTO solar_purchases (id, member_id, funding_source, rec_kwh, rec_certificate_id, solar_credited, exchange_rate, status, completed_at)
           VALUES (gen_random_uuid(), $1, 'rec', $2, $3, $4, $5, 'completed', NOW())`,
          [authMemberId, String(kwh), certificateId || null, String(solarAmount), String(SOLAR_PER_USD)]
        );

        await assignAgentToMember(pool, authMemberId);
        console.log(`⚡ REC activation: Member ${authMemberId} activated ${solarAmount} Solar from ${kwh} kWh (cert: ${certificateId || 'pending verification'})`);
        sendJSON(res, 200, { success: true, solarActivated: solarAmount, newBalance, kwhUsed: kwh, status: 'pending_verification' });
      } catch (err) {
        console.error('REC activation error:', err.message);
        sendJSON(res, 500, { error: 'REC activation processing failed' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/settlement-request' && req.method === 'POST') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

        const config = await getNetworkConfig(pool, 'default');
        if (!isSettlementEnabled(config)) {
          return sendJSON(res, 403, {
            error: 'settlement_disabled',
            message: 'This network is configured as a closed-loop Solar marketplace and does not offer settlement.'
          });
        }

        const body = await parseBody(req);
        const { solarAmount, complianceAcknowledged } = body;

        if (!solarAmount || isNaN(solarAmount)) return sendJSON(res, 400, { error: 'solarAmount required (numeric)' });
        if (!complianceAcknowledged) return sendJSON(res, 400, { error: 'You must acknowledge the settlement compliance terms.' });

        const solar = parseFloat(solarAmount);
        const MIN_SETTLEMENT = 0.001;
        if (solar < MIN_SETTLEMENT) {
          return sendJSON(res, 400, { error: `Minimum settlement request is ${MIN_SETTLEMENT} Solar` });
        }

        const balRes = await pool.query(`SELECT total_solar FROM members WHERE id = $1`, [authMemberId]);
        if (balRes.rows.length === 0) return sendJSON(res, 404, { error: 'Member not found' });

        const currentBalance = parseFloat(balRes.rows[0].total_solar || '0');
        if (solar > currentBalance) {
          return sendJSON(res, 400, { error: `Insufficient balance. You have ${currentBalance.toFixed(6)} Solar.` });
        }

        const fees = getNetworkFees(config);
        const feeRate = fees.settlementAdministrativeFeePercent / 100;
        const platformFee = parseFloat((solar * feeRate).toFixed(6));
        const netSolar = parseFloat((solar - platformFee).toFixed(6));
        const estimatedUsd = parseFloat((solar * USD_PER_SOLAR).toFixed(2));
        const netEstimatedUsd = parseFloat((netSolar * USD_PER_SOLAR).toFixed(2));

        const newBalance = currentBalance - solar;
        await pool.query(`UPDATE members SET total_solar = $1 WHERE id = $2`, [String(newBalance), authMemberId]);

        const settlementId = `stl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await pool.query(
          `INSERT INTO solar_settlement_requests (id, member_id, network_id, requested_solar_amount, estimated_usd_value, platform_fee_amount, net_estimated_usd, status, settlement_mode, compliance_acknowledged)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)`,
          [settlementId, authMemberId, config.id, String(solar), String(estimatedUsd), String(platformFee), String(netEstimatedUsd), config.settlement_mode, complianceAcknowledged]
        );

        const txId = `settlement_${settlementId}`;
        await pool.query(
          `INSERT INTO marketplace_ledger (id, transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, created_at)
           VALUES (gen_random_uuid(), $1, 'debit', $2, 'member', $3, $4, 'settlement_hold', $5, $6, NOW())`,
          [txId, String(authMemberId), String(solar), String(newBalance), settlementId, `Settlement hold: ${solar} S (USD ref value: $${estimatedUsd}, admin fee: ${platformFee} S)`]
        );

        await pool.query(
          `INSERT INTO marketplace_ledger (id, transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, created_at)
           VALUES (gen_random_uuid(), $1, 'credit', 'tcs_foundation', 'platform', $2, '0', 'administrative_settlement_fee', $3, $4, NOW())`,
          [txId, String(platformFee), settlementId, `Administrative settlement fee: ${platformFee} S from member ${authMemberId}`]
        );

        console.log(`📋 Settlement request: Member ${authMemberId} requesting ${solar} Solar settlement (USD ref: $${estimatedUsd}, fee: ${platformFee} S)`);

        sendJSON(res, 200, {
          success: true,
          settlement: {
            id: settlementId,
            requestedSolar: solar,
            platformFee,
            netSolar,
            estimatedUsd,
            netEstimatedUsd,
            status: 'pending',
            newBalance,
            disclaimer: COMPLIANCE_POLICY.approvedSettlementDisclaimer,
          }
        });
      } catch (err) {
        console.error('Settlement request error:', err.message);
        sendJSON(res, 500, { error: 'Settlement request processing failed' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-settlements' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

        const settlements = await pool.query(
          `SELECT id, requested_solar_amount, estimated_usd_value, platform_fee_amount, net_estimated_usd, status, settlement_mode, compliance_acknowledged, admin_notes, created_at, updated_at
           FROM solar_settlement_requests WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [authMemberId]
        );

        const legacy = await pool.query(
          `SELECT id, solar_amount as requested_solar_amount, platform_fee as platform_fee_amount, usd_payout as net_estimated_usd, status, created_at
           FROM solar_withdrawals WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [authMemberId]
        );

        const allRequests = [...settlements.rows, ...legacy.rows.map(l => ({ ...l, legacy: true }))];
        allRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const pending = allRequests.filter(r => ['pending', 'under_review'].includes(r.status));
        const processed = allRequests.filter(r => r.status === 'processed' || r.status === 'completed');

        sendJSON(res, 200, {
          success: true,
          settlements: allRequests,
          totals: {
            pendingCount: pending.length,
            processedCount: processed.length,
          }
        });
      } catch (err) {
        console.error('Settlement history error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch settlement history' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/withdraw' && req.method === 'POST') {
    (async () => {
      const config = await getNetworkConfig(pool, 'default');
      if (!isSettlementEnabled(config)) {
        return sendJSON(res, 403, {
          error: 'settlement_disabled',
          message: 'This network is configured as a closed-loop Solar marketplace and does not offer settlement.'
        });
      }
      return sendJSON(res, 301, { error: 'Use /api/solar-checkout/settlement-request instead', redirect: '/api/solar-checkout/settlement-request' });
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-withdrawals' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

        const withdrawals = await pool.query(
          `SELECT id, solar_amount, platform_fee, net_solar, usd_payout, status, payout_method, payout_reference, processed_at, created_at
           FROM solar_withdrawals WHERE member_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [authMemberId]
        );

        sendJSON(res, 200, {
          success: true,
          withdrawals: withdrawals.rows,
        });
      } catch (err) {
        console.error('Legacy withdrawal history error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch history' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-purchases' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

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
          totals: { usd: totalUsd, recKwh: totalRecKwh, solarActivated: totalSolar }
        });
      } catch (err) {
        console.error('Activation history error:', err.message);
        sendJSON(res, 500, { error: 'Failed to fetch activations' });
      }
    })();
    return true;
  }

  if (pathname === '/api/solar-checkout/my-agent' && req.method === 'GET') {
    (async () => {
      try {
        const authMemberId = await getAuthenticatedMemberId(req, sessionHelpers);
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

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
          todayStats: { created: parseInt(todayCreated.rows[0]?.cnt || '0') },
          agentDescription: COMPLIANCE_POLICY.agentMarketplaceDescription,
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
        if (!authMemberId) return sendJSON(res, 401, { error: 'Authentication required' });

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
          solarActivations: purchases.rows,
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
