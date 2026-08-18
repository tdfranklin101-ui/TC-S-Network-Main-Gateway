'use strict';

/**
 * ERA 22.x — LEDGER-FIRST PRODUCTIVE ARTIFACT BRIDGE
 * ==================================================
 * The TC-S marketplace_ledger is the SYSTEM OF RECORD for every asset
 * transition: "if it is not in the ledger, it did not happen."
 *
 * This module writes and replays ledger-backed production lifecycle events
 * and asset records using ONLY existing tables (marketplace_ledger rows with
 * metadata jsonb; entry_type 'event' rows carry zero amount and no wallet
 * movement). No schema changes.
 *
 * Event model (spec):
 *   PRODUCTION_REQUEST_CREATED → PRODUCTION_QUOTE_ISSUED (no charge) →
 *   PRODUCTION_APPROVED → PRODUCTION_STARTED → PRODUCTION_SOLAR_CHARGED →
 *   PRODUCTION_INSTANCE_CREATED → PRODUCTION_COMPLETED
 *   DELIVERY_QUOTE_ISSUED → DELIVERY_APPROVED → SEALING_DELIVERY_STARTED →
 *   SEALING_DELIVERY_SOLAR_CHARGED → SEALED → DIGITALLY_DELIVERED / SHIPPED / DELIVERED
 *   TRANSACTION_REFUNDED (remediation if execution fails after charge)
 *
 * Provider state ≠ ledger state: if execution completes but the ledger commit
 * fails, the request surfaces COMPLETED_AWAITING_LEDGER_RECONCILIATION and the
 * commit is retried — never a false authoritative completion.
 */

const crypto = require('crypto');

const FOUNDATION_FEE_RATE = 0.05;
const EVENT_REF_TYPE = 'production_event';

// requests whose provider execution finished but whose PRODUCTION_COMPLETED
// (or delivery) ledger commit failed — retried on every status read.
const pendingReconciliation = new Map(); // requestId -> { event, metadata, attempts, lastError }

function round4(n) { return Math.round(n * 10000) / 10000; }
function newId(prefix) { return prefix + '-' + crypto.randomBytes(6).toString('hex').toUpperCase(); }

/**
 * Atomically adjust a member balance with an SQL increment (no read-modify-
 * write race) and return the resulting balance for the ledger row.
 */
async function adjustBalance(client, memberId, delta) {
  const r = await client.query(
    'UPDATE members SET total_solar = COALESCE(total_solar, 0) + $1 WHERE id = $2 RETURNING total_solar',
    [String(delta), memberId]);
  if (r.rows.length === 0) throw new Error(`Member ${memberId} not found for balance adjustment`);
  return parseFloat(r.rows[0].total_solar);
}

// ── Quote computation (deterministic; stored in the ledger at quote time and
//    read back verbatim at charge time — never recomputed) ─────────────────
function computeQuote(root, capability) {
  const kwh = parseFloat(root.kwh_footprint || 0) || 0.05;
  const rootPrice = parseFloat(root.solar_amount_s || 0) || 0.004;
  let production = 0.0100 + Math.min(kwh, 25) * 0.0002 + rootPrice * 0.25;
  let delivery = 0.0021;
  if (capability === 'PHYSICAL_FABRICATION') { production *= 2; delivery = 0.0084; }
  else if (capability === '3D_PRINT') { production *= 1.4; delivery = 0.0034; }
  return {
    root_repurchase_solar: 0, // buy once, produce on demand
    production_solar: round4(Math.max(0.001, production)),
    sealing_delivery_solar: round4(delivery),
    currency: 'SOLAR'
  };
}

// ── Ledger writes ──────────────────────────────────────────────────────────
// Monotonic per-process sequence: rows written in one transaction share a
// created_at timestamp and uuid PKs are not ordered, so replay sorts on seq.
let _seq = Date.now() * 1000;
async function writeEvent(q, requestId, event, accountId, metadata, description) {
  const seq = ++_seq;
  await q(
    `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, metadata)
     VALUES ($1, 'event', $2, 'user', '0', NULL, $3, $4, $5, $6)`,
    [`prodevt_${requestId}_${event}_${seq}`, String(accountId), EVENT_REF_TYPE, requestId, description || event, JSON.stringify({ event, request_id: requestId, seq, ...(metadata || {}) })]
  );
}

/**
 * Verify from the ledger/copies (never from browser or agent state) that the
 * member owns the root artifact and holds production rights.
 */
async function verifyOwnership(pool, userId, artifactId) {
  const artQ = await pool.query(
    `SELECT id, title, category, file_type, solar_amount_s, kwh_footprint, creator_id, active
     FROM artifacts WHERE id = $1`, [artifactId]);
  if (artQ.rows.length === 0) return { ok: false, code: 404, error: 'Root artifact not found in ledger-backed catalog' };
  const root = artQ.rows[0];
  if (!root.active) return { ok: false, code: 400, error: 'Root artifact is not ACTIVE' };

  const copyQ = await pool.query(
    `SELECT id, purchase_transaction_id, acquired_method, solar_paid, metadata
     FROM artifact_copies WHERE owner_id = $1 AND artifact_id = $2 AND is_active = true
     ORDER BY acquired_at ASC LIMIT 1`, [userId, artifactId]);
  let copy = copyQ.rows[0] || null;
  let via = copy ? 'ARTIFACT_COPY' : null;

  if (!copy && root.creator_id && String(root.creator_id) === String(userId)) via = 'CREATOR';

  if (!copy && !via) {
    // legacy purchases (transactions table via wallet)
    const w = await pool.query('SELECT wallet_id FROM members WHERE id = $1', [userId]);
    const walletId = w.rows[0] && w.rows[0].wallet_id;
    if (walletId) {
      const t = await pool.query(
        `SELECT id FROM transactions WHERE wallet_id = $1 AND artifact_id = $2 AND type = 'purchase' LIMIT 1`,
        [walletId, artifactId]);
      if (t.rows.length > 0) via = 'LEGACY_TRANSACTION';
    }
  }
  if (!via) return { ok: false, code: 403, error: 'Ledger ownership verification failed: no artifact copy, creator record, or purchase transaction found for this member.' };

  // Production rights: default enabled for owned copies/creators unless the
  // copy metadata explicitly disables them.
  const rights = copy && copy.metadata && copy.metadata.production_rights;
  if (rights && rights.enabled === false) return { ok: false, code: 403, error: 'Production rights are disabled on this artifact copy.' };

  return { ok: true, root, copy, via };
}

/**
 * KID SOL capability classification (deterministic; the frontier orchestrator
 * performs the deep engineering pass later for physical routes).
 */
function classifyCapability(root, requestedOutput) {
  const want = String(requestedOutput || '').toUpperCase();
  const KNOWN = ['SIMULATION', 'DIGITAL_RENDER', 'IMAGE', 'VIDEO', 'AUDIO', '3D_MODEL', 'ENGINEERING_PACKAGE', '3D_PRINT', 'PHYSICAL_FABRICATION', 'ROBOTIC_ASSEMBLY'];
  if (KNOWN.includes(want)) return { capability: want, reason: 'Member-requested output class' };
  const hay = `${root.category || ''} ${root.file_type || ''} ${root.title || ''}`.toLowerCase();
  if (/stl|3d[- ]?print|3d[- ]?model/.test(hay)) return { capability: '3D_PRINT', reason: 'Artifact intelligence indicates a printable 3D object' };
  if (/furniture|table|chair|stool|fabricat|assembl|robot|physical/.test(hay)) return { capability: 'PHYSICAL_FABRICATION', reason: 'Artifact intelligence indicates a physical object — routed to Replicator/ArmOS' };
  if (/audio|music|song/.test(hay)) return { capability: 'AUDIO', reason: 'Audio artifact' };
  if (/video|film/.test(hay)) return { capability: 'VIDEO', reason: 'Video artifact' };
  if (/image|art|photo/.test(hay)) return { capability: 'IMAGE', reason: 'Image artifact' };
  return { capability: 'DIGITAL_RENDER', reason: 'Default digital production route' };
}

/** Create a ledger-backed production request + quote (no wallet movement). */
async function createRequest(pool, { userId, root, copy, via, requestedOutput, quantity, parameters }) {
  const requestId = newId('TCSPR');
  const cls = classifyCapability(root, requestedOutput);
  const quote = computeQuote(root, cls.capability);
  const requestRecord = {
    asset_class: 'PRODUCTION_REQUEST',
    owner_id: String(userId),
    root_artifact_id: root.id,
    root_title: root.title,
    source_copy_id: copy ? copy.id : null,
    ownership_via: via,
    requested_output: requestedOutput || cls.capability,
    capability: cls.capability,
    capability_reason: cls.reason,
    quantity: Math.max(1, parseInt(quantity) || 1),
    parameters: parameters || {},
    created_at: new Date().toISOString()
  };
  await writeEvent(pool.query.bind(pool), requestId, 'PRODUCTION_REQUEST_CREATED', userId, requestRecord, `Production request for "${root.title}"`);
  await writeEvent(pool.query.bind(pool), requestId, 'PRODUCTION_QUOTE_ISSUED', userId, { quote, no_wallet_movement: true }, `Production quote: ${quote.production_solar} Solar (no charge at quote time)`);
  return { requestId, request: requestRecord, quote };
}

/** Replay a request's ledger rows into current state. */
async function getRequest(pool, requestId) {
  const rows = (await pool.query(
    `SELECT entry_type, account_id, amount, description, metadata, created_at, transaction_id
     FROM marketplace_ledger WHERE reference_id = $1 ORDER BY created_at ASC, id ASC`, [requestId])).rows;
  const events = rows.filter(r => r.entry_type === 'event' && r.metadata && r.metadata.event)
    .sort((a, b) => (new Date(a.created_at) - new Date(b.created_at)) || ((a.metadata.seq || 0) - (b.metadata.seq || 0)));
  if (events.length === 0) return null;
  const state = {
    request_id: requestId, status: null, timeline: [], quote: null, request: null,
    production_transaction_id: null, delivery_transaction_id: null,
    instance: null, output: null, delivery_package: null, mission: null, refund: null
  };
  for (const e of events) {
    const md = e.metadata;
    state.timeline.push({ event: md.event, at: e.created_at });
    switch (md.event) {
      case 'PRODUCTION_REQUEST_CREATED': state.request = md; state.status = 'PRODUCTION_REQUESTED'; break;
      case 'PRODUCTION_QUOTE_ISSUED': state.quote = md.quote; state.status = 'PRODUCTION_QUOTE_ISSUED'; break;
      case 'PRODUCTION_APPROVED': state.status = 'PRODUCTION_APPROVED'; break;
      case 'PRODUCTION_STARTED': state.status = 'PRODUCTION_STARTED'; break;
      case 'PRODUCTION_SOLAR_CHARGED': state.production_transaction_id = md.transaction_id; break;
      case 'PRODUCTION_INSTANCE_CREATED': state.instance = md.asset; state.status = 'IN_PRODUCTION'; break;
      case 'EXECUTION_ROUTED': state.mission = md.mission || null; break;
      case 'DIGITAL_OUTPUT_CREATED': state.output = md.asset; break;
      case 'PRODUCTION_COMPLETED': state.status = 'PRODUCTION_COMPLETED'; break;
      case 'PRODUCTION_FAILED': state.status = 'PRODUCTION_FAILED'; break;
      case 'TRANSACTION_REFUNDED': state.refund = md; break;
      case 'DELIVERY_QUOTE_ISSUED': state.delivery_quote = md.quote; state.status = 'DELIVERY_QUOTE_ISSUED'; break;
      case 'DELIVERY_APPROVED': state.status = 'DELIVERY_APPROVED'; break;
      case 'SEALING_DELIVERY_STARTED': state.status = 'SEALING_DELIVERY_STARTED'; break;
      case 'SEALING_DELIVERY_SOLAR_CHARGED': state.delivery_transaction_id = md.transaction_id; break;
      case 'SEALED': state.status = 'SEALED'; break;
      case 'DIGITALLY_DELIVERED': state.status = 'DIGITALLY_DELIVERED'; state.delivery_package = md.asset || state.delivery_package; break;
      case 'SHIPPED': state.status = 'SHIPPED'; break;
      case 'DELIVERED': state.status = 'DELIVERED'; break;
    }
  }
  // Provider done but ledger commit still failing → reconciliation state.
  if (pendingReconciliation.has(requestId)) state.status = 'COMPLETED_AWAITING_LEDGER_RECONCILIATION';
  // Durable (restart-safe) reconciliation: the digital output event committed
  // but PRODUCTION_COMPLETED never did. The ledger itself tells us the
  // provider finished, so completion can be re-committed even after the
  // in-memory queue was lost.
  else if (state.output && state.status === 'IN_PRODUCTION') {
    state.status = 'COMPLETED_AWAITING_LEDGER_RECONCILIATION';
    state.needs_completion_commit = true;
  }
  return state;
}

/**
 * Atomic, idempotent double-entry production charge at PRODUCTION_STARTED.
 * Exactly one Solar debit per request regardless of retries or duplicate
 * browser/agent calls. Execution is forbidden unless this commit succeeds.
 */
async function chargeProduction(pool, requestId, state, userId, getOrCreateFoundationMember) {
  const txId = `prod_${requestId}`;
  const existing = await pool.query('SELECT id FROM marketplace_ledger WHERE transaction_id = $1 LIMIT 1', [txId]);
  if (existing.rows.length > 0) return { alreadyCharged: true, transactionId: txId };

  const amount = parseFloat(state.quote.production_solar);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // row-lock the buyer to serialize concurrent approves
    const u = await client.query('SELECT id, username, total_solar FROM members WHERE id = $1 FOR UPDATE', [userId]);
    if (u.rows.length === 0) throw new Error('Member not found');
    const buyer = u.rows[0];
    const bal = parseFloat(buyer.total_solar || 0);
    if (bal < amount) { await client.query('ROLLBACK'); return { insufficient: true, required: amount, available: bal }; }
    // idempotency re-check inside the transaction
    const again = await client.query('SELECT id FROM marketplace_ledger WHERE transaction_id = $1 LIMIT 1', [txId]);
    if (again.rows.length > 0) { await client.query('ROLLBACK'); return { alreadyCharged: true, transactionId: txId }; }

    const newBal = round4(await adjustBalance(client, userId, -amount));
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, metadata)
       VALUES ($1, 'debit', $2, 'user', $3, $4, 'production', $5, $6, $7)`,
      [txId, String(userId), String(amount), String(newBal), requestId, `Production: ${state.request.root_title}`, JSON.stringify({ event: 'PRODUCTION_CHARGE', root_artifact_id: state.request.root_artifact_id })]);

    const foundationFee = round4(amount * FOUNDATION_FEE_RATE);
    let providerNet = round4(amount - foundationFee);
    // provider credit → root artifact creator when resolvable, else foundation
    let providerCredited = false;
    const rootCreator = state.request && (await client.query('SELECT creator_id FROM artifacts WHERE id = $1', [state.request.root_artifact_id])).rows[0];
    if (rootCreator && rootCreator.creator_id && String(rootCreator.creator_id) !== String(userId)) {
      const cid = /^\d+$/.test(String(rootCreator.creator_id)) ? parseInt(rootCreator.creator_id) : 0;
      const sq = await client.query('SELECT id FROM members WHERE id = $1 OR username = $2 LIMIT 1', [cid, String(rootCreator.creator_id)]);
      if (sq.rows.length > 0) {
        const s = sq.rows[0];
        const sBal = round4(await adjustBalance(client, s.id, providerNet));
        await client.query(
          `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
           VALUES ($1, 'credit', $2, 'creator', $3, $4, 'production', $5, $6)`,
          [txId, String(s.id), String(providerNet), String(sBal), requestId, `Production provider credit: ${state.request.root_title}`]);
        providerCredited = true;
      }
    }
    const foundation = await getOrCreateFoundationMember(client);
    const fAmt = providerCredited ? foundationFee : amount;
    const fBal = round4(await adjustBalance(client, foundation.id, fAmt));
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'foundation', $3, $4, 'production', $5, $6)`,
      [txId, String(foundation.id), String(fAmt), String(fBal), requestId, `Production network/foundation credit: ${state.request.root_title}`]);

    // lifecycle events + production instance asset — same atomic commit
    const instanceId = newId('TCS-INST');
    const q = client.query.bind(client);
    await writeEvent(q, requestId, 'PRODUCTION_APPROVED', userId, {});
    await writeEvent(q, requestId, 'PRODUCTION_STARTED', userId, { transaction_id: txId });
    await writeEvent(q, requestId, 'PRODUCTION_SOLAR_CHARGED', userId, { transaction_id: txId, amount_solar: amount });
    await writeEvent(q, requestId, 'PRODUCTION_INSTANCE_CREATED', userId, {
      asset: {
        asset_id: instanceId, asset_class: 'PRODUCTION_INSTANCE', status: 'IN_PRODUCTION',
        root_artifact_id: state.request.root_artifact_id, source_copy_id: state.request.source_copy_id,
        production_request_id: requestId, production_transaction_id: txId,
        capability: state.request.capability, created_at: new Date().toISOString()
      }
    }, `Production instance ${instanceId}`);
    await client.query('COMMIT');
    return { charged: true, transactionId: txId, instanceId, amount, newBalance: newBal };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Commit a completion (or any post-execution) event with retry. If the ledger
 * commit fails, the request is queued for reconciliation — the provider result
 * is NOT surfaced as authoritative completion until the ledger commits.
 */
async function commitWithReconciliation(pool, requestId, userId, event, metadata, description, simulateFailure) {
  const attempt = async () => {
    if (simulateFailure && !pendingReconciliation.has(requestId)) {
      throw new Error('SIMULATED_LEDGER_COMMIT_FAILURE');
    }
    await writeEvent(pool.query.bind(pool), requestId, event, userId, metadata, description);
  };
  try {
    await attempt();
    pendingReconciliation.delete(requestId);
    return { committed: true };
  } catch (e) {
    pendingReconciliation.set(requestId, { event, metadata, description, userId, attempts: (pendingReconciliation.get(requestId)?.attempts || 0) + 1, lastError: e.message });
    console.warn(`⚖️ [Production] Ledger commit failed for ${requestId} (${event}): ${e.message} — COMPLETED_AWAITING_LEDGER_RECONCILIATION`);
    return { committed: false, error: e.message };
  }
}

/** Retry any pending reconciliation for a request (called on status reads). */
async function retryReconciliation(pool, requestId) {
  const p = pendingReconciliation.get(requestId);
  if (!p) return { pending: false };
  try {
    await writeEvent(pool.query.bind(pool), requestId, p.event, p.userId, p.metadata, p.description);
    pendingReconciliation.delete(requestId);
    console.log(`⚖️ [Production] Reconciliation succeeded for ${requestId} (${p.event}) after ${p.attempts} failed attempt(s)`);
    return { pending: false, reconciled: true };
  } catch (e) {
    p.attempts++; p.lastError = e.message;
    return { pending: true, error: e.message };
  }
}

/**
 * Refund/remediation: reverse EVERY leg of the production charge if execution
 * failed after charge. Reads the original prod_<id> double-entry rows and
 * reverses each one (buyer credited back; creator/foundation debited), so no
 * Solar is created or destroyed. Idempotency is re-checked inside the
 * transaction after the buyer row lock, so concurrent failure paths cannot
 * double-refund.
 */
async function refundProduction(pool, requestId, state, userId, reason) {
  const txId = `prodrefund_${requestId}`;
  const origTx = `prod_${requestId}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // serialize on the buyer row, then re-check idempotency INSIDE the tx
    await client.query('SELECT id FROM members WHERE id = $1 FOR UPDATE', [userId]);
    const again = await client.query('SELECT id FROM marketplace_ledger WHERE transaction_id = $1 LIMIT 1', [txId]);
    if (again.rows.length > 0) { await client.query('ROLLBACK'); return { alreadyRefunded: true }; }
    const legs = (await client.query(
      `SELECT entry_type, account_id, account_type, amount FROM marketplace_ledger WHERE transaction_id = $1`, [origTx])).rows;
    if (legs.length === 0) { await client.query('ROLLBACK'); return { alreadyRefunded: true, noCharge: true }; }
    let amount = 0, newBal = null;
    for (const leg of legs) {
      const legAmt = parseFloat(leg.amount);
      // reverse: original debit → credit back; original credit → debit away
      const reverseType = leg.entry_type === 'debit' ? 'credit' : 'debit';
      const delta = leg.entry_type === 'debit' ? legAmt : -legAmt;
      const legBal = round4(await adjustBalance(client, parseInt(leg.account_id), delta));
      if (String(leg.account_id) === String(userId) && leg.entry_type === 'debit') { amount = legAmt; newBal = legBal; }
      await client.query(
        `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, 'production_refund', $7, $8, $9)`,
        [txId, reverseType, leg.account_id, leg.account_type, String(legAmt), String(legBal), requestId,
         `Refund reversal (${leg.account_type}): production failed — ${reason}`.slice(0, 250),
         JSON.stringify({ event: 'PRODUCTION_REFUND', reverses: origTx })]);
    }
    const q = client.query.bind(client);
    await writeEvent(q, requestId, 'PRODUCTION_FAILED', userId, { reason: String(reason).slice(0, 300) });
    await writeEvent(q, requestId, 'TRANSACTION_REFUNDED', userId, { transaction_id: txId, reverses: `prod_${requestId}`, amount_solar: amount });
    await client.query('COMMIT');
    return { refunded: true, amount, newBalance: newBal };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/** Atomic, idempotent sealing+delivery charge at SEALING_DELIVERY_STARTED. */
async function chargeDelivery(pool, requestId, state, userId, getOrCreateFoundationMember) {
  const txId = `seal_${requestId}`;
  const existing = await pool.query('SELECT id FROM marketplace_ledger WHERE transaction_id = $1 LIMIT 1', [txId]);
  if (existing.rows.length > 0) return { alreadyCharged: true, transactionId: txId };
  const amount = parseFloat((state.delivery_quote || state.quote).sealing_delivery_solar);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query('SELECT id, total_solar FROM members WHERE id = $1 FOR UPDATE', [userId]);
    const bal = parseFloat(u.rows[0].total_solar || 0);
    if (bal < amount) { await client.query('ROLLBACK'); return { insufficient: true, required: amount, available: bal }; }
    const again = await client.query('SELECT id FROM marketplace_ledger WHERE transaction_id = $1 LIMIT 1', [txId]);
    if (again.rows.length > 0) { await client.query('ROLLBACK'); return { alreadyCharged: true, transactionId: txId }; }
    const newBal = round4(await adjustBalance(client, userId, -amount));
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, 'user', $3, $4, 'sealing_delivery', $5, $6)`,
      [txId, String(userId), String(amount), String(newBal), requestId, `Sealing + delivery: ${state.request.root_title}`]);
    const foundation = await getOrCreateFoundationMember(client);
    const fBal = round4(await adjustBalance(client, foundation.id, amount));
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'foundation', $3, $4, 'sealing_delivery', $5, $6)`,
      [txId, String(foundation.id), String(amount), String(fBal), requestId, `Sealing + delivery network credit: ${state.request.root_title}`]);

    const packageId = newId('TCS-DELIV');
    const isDigital = state.request.capability !== 'PHYSICAL_FABRICATION' && state.request.capability !== 'ROBOTIC_ASSEMBLY';
    const q = client.query.bind(client);
    await writeEvent(q, requestId, 'DELIVERY_APPROVED', userId, { transaction_id: txId });
    await writeEvent(q, requestId, 'SEALING_DELIVERY_STARTED', userId, { transaction_id: txId });
    await writeEvent(q, requestId, 'SEALING_DELIVERY_SOLAR_CHARGED', userId, { transaction_id: txId, amount_solar: amount });
    await writeEvent(q, requestId, 'SEALED', userId, { asset_id: packageId });
    const pkg = {
      asset_id: packageId, asset_class: 'DELIVERY_PACKAGE',
      production_request_id: requestId,
      production_instance_id: state.instance ? state.instance.asset_id : null,
      digital_output_id: state.output ? state.output.asset_id : null,
      delivery_transaction_id: txId,
      recipient_id: String(userId),
      mode: isDigital ? 'DIGITAL' : 'PHYSICAL_SIMULATED',
      created_at: new Date().toISOString()
    };
    await writeEvent(q, requestId, isDigital ? 'DIGITALLY_DELIVERED' : 'SHIPPED', userId, { asset: pkg }, `Delivery package ${packageId}`);
    await client.query('COMMIT');
    return { charged: true, transactionId: txId, packageId, amount, newBalance: newBal, status: isDigital ? 'DIGITALLY_DELIVERED' : 'SHIPPED' };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/** All production requests + instances for one owner/artifact (lineage view). */
async function listRequestsForArtifact(pool, userId, artifactId) {
  const rows = (await pool.query(
    `SELECT reference_id, metadata, created_at FROM marketplace_ledger
     WHERE entry_type = 'event' AND reference_type = $1 AND account_id = $2
       AND metadata->>'event' = 'PRODUCTION_REQUEST_CREATED'
       AND metadata->>'root_artifact_id' = $3
     ORDER BY created_at DESC LIMIT 50`, [EVENT_REF_TYPE, String(userId), String(artifactId)])).rows;
  const out = [];
  for (const r of rows) {
    const st = await getRequest(pool, r.reference_id);
    if (st) out.push({ request_id: r.reference_id, status: st.status, capability: st.request.capability, quote: st.quote, instance: st.instance, output: st.output, delivery_package: st.delivery_package, created_at: r.created_at, timeline: st.timeline });
  }
  return out;
}

/**
 * Server-side stranded-request remediation. Scans the ledger for requests
 * that were CHARGED but never routed to any execution (no EXECUTION_ROUTED,
 * no DIGITAL_OUTPUT_CREATED) and never failed/refunded — the crash window
 * between the charge commit and route persistence. Refunds them fully.
 * Restart-safe (state is derived purely from the ledger) and idempotent
 * (refundProduction re-checks its transaction id inside the buyer lock).
 * Runs at boot and on an interval; does not rely on any client status read.
 */
async function remediateStranded(pool, graceMinutes = 2) {
  const rows = (await pool.query(
    `SELECT c.reference_id, c.account_id
     FROM marketplace_ledger c
     WHERE c.entry_type = 'event' AND c.reference_type = $1
       AND c.metadata->>'event' = 'PRODUCTION_SOLAR_CHARGED'
       AND c.created_at < NOW() - ($2 || ' minutes')::interval
       AND NOT EXISTS (
         SELECT 1 FROM marketplace_ledger e
         WHERE e.reference_id = c.reference_id AND e.entry_type = 'event' AND e.reference_type = $1
           AND e.metadata->>'event' IN ('EXECUTION_ROUTED', 'DIGITAL_OUTPUT_CREATED', 'PRODUCTION_FAILED', 'TRANSACTION_REFUNDED')
       )
     LIMIT 25`, [EVENT_REF_TYPE, String(graceMinutes)])).rows;
  const results = [];
  for (const r of rows) {
    try {
      const state = await getRequest(pool, r.reference_id);
      if (!state || !state.production_transaction_id) continue;
      const refund = await refundProduction(pool, r.reference_id, state, parseInt(r.account_id), 'No execution route persisted after charge — automatic stranded-request remediation');
      if (refund.refunded) console.log(`⚖️ [Production] Stranded request ${r.reference_id} remediated: refunded ${refund.amount} Solar to member ${r.account_id}`);
      results.push({ request_id: r.reference_id, ...refund });
    } catch (e) {
      console.error(`⚖️ [Production] Stranded remediation failed for ${r.reference_id}: ${e.message}`);
    }
  }
  return results;
}

/** Boot + interval scheduling for the remediation scan. */
function startRemediationWorker(pool, intervalMs = 5 * 60 * 1000) {
  const run = () => remediateStranded(pool).catch(e => console.error('⚖️ [Production] Remediation scan error:', e.message));
  setTimeout(run, 15000);          // shortly after boot (restart-safe recovery)
  const t = setInterval(run, intervalMs);
  if (t.unref) t.unref();
  return t;
}

module.exports = {
  EVENT_REF_TYPE, pendingReconciliation,
  verifyOwnership, classifyCapability, computeQuote,
  createRequest, getRequest, chargeProduction,
  commitWithReconciliation, retryReconciliation, refundProduction,
  chargeDelivery, listRequestsForArtifact, writeEvent, newId,
  remediateStranded, startRemediationWorker
};
