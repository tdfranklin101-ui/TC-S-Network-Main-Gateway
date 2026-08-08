/**
 * TC-S Network Foundation — Economic Handlers
 * Era 21.1: Economic Autonomy
 *
 * Implements TRANSFER_SOLAR, PURCHASE_ARTIFACT, and AUDIT_TRANSACTION
 * through the governed agentic pipeline.
 *
 * Architectural contract:
 *   - No direct balance mutation outside a DB transaction
 *   - No policy bypass
 *   - Every handler emits marketplace_ledger entries (double-entry)
 *   - Idempotency protection on all mutation handlers
 *   - Failure rolls back all sides atomically
 */

'use strict';

const crypto = require('crypto');

// ── Foundation defaults ────────────────────────────────────────────────
const FOUNDATION_USERNAME = 'tcs_foundation';
const FOUNDATION_FEE_RATE = 0.05; // 5%

/**
 * Resolve the foundation member, creating it if absent.
 * Works inside an existing DB client transaction.
 */
async function getFoundationMember(client) {
  const r = await client.query(
    'SELECT id, username, total_solar, wallet_id FROM members WHERE username = $1 LIMIT 1',
    [FOUNDATION_USERNAME]
  );
  if (r.rows.length > 0) return r.rows[0];
  // Create if absent (should only happen in fresh dev environments)
  const ins = await client.query(
    `INSERT INTO members (username, name, email, total_solar, is_placeholder)
     VALUES ($1, $2, $3, '0', true) RETURNING id, username, total_solar, wallet_id`,
    [FOUNDATION_USERNAME, FOUNDATION_USERNAME, 'foundation@tcs.network']
  );
  return ins.rows[0];
}

/**
 * Generate a short idempotency-tagged note for transaction rows.
 */
function noteWithIdempotency(base, idempotencyKey) {
  return idempotencyKey ? `${base} [idem:${idempotencyKey}]` : base;
}

/**
 * Ensure a member has a linked wallet, creating one if absent.
 * Returns the wallet UUID.
 */
async function getOrCreateWallet(dbOrClient, member) {
  if (member.wallet_id) return member.wallet_id;
  const existing = await dbOrClient.query(
    'SELECT id FROM wallets WHERE user_id = $1 LIMIT 1',
    [String(member.id)]
  );
  let walletId;
  if (existing.rows.length > 0) {
    walletId = existing.rows[0].id;
  } else {
    const newW = await dbOrClient.query(
      'INSERT INTO wallets (user_id, balance_solar_s, balance_rays) VALUES ($1, $2, $3) RETURNING id',
      [String(member.id), '0', 0]
    );
    walletId = newW.rows[0].id;
  }
  await dbOrClient.query('UPDATE members SET wallet_id = $1 WHERE id = $2', [walletId, member.id]);
  member.wallet_id = walletId;
  return walletId;
}

// ══════════════════════════════════════════════════════════════════════
// TRANSFER_SOLAR
// ══════════════════════════════════════════════════════════════════════

/**
 * Move Solar between two members atomically.
 *
 * payload:
 *   source_member_id      — integer member.id
 *   destination_member_id — integer member.id
 *   amount                — numeric Solar amount (> 0)
 *   idempotency_key       — optional string (replay protection)
 *
 * returns: normalized result envelope (see spec Task 4)
 */
async function executeTransferSolar(payload, _request, pool) {
  const { source_member_id, destination_member_id, amount, idempotency_key } = payload || {};

  // ── Validation ────────────────────────────────────────────────────
  const transferAmount = parseFloat(amount);
  if (!amount || isNaN(transferAmount) || transferAmount <= 0) {
    throw new Error('INVALID_AMOUNT: amount must be a positive number');
  }
  if (String(source_member_id) === String(destination_member_id)) {
    throw new Error('SELF_TRANSFER_NOT_ALLOWED');
  }
  if (!source_member_id || !destination_member_id) {
    throw new Error('MISSING_PARTIES: source_member_id and destination_member_id are required');
  }

  // ── Idempotency check (pre-transaction, read-only) ─────────────────
  if (idempotency_key) {
    const existing = await pool.query(
      "SELECT id FROM transactions WHERE note LIKE $1 AND transaction_class = 'solar_transfer' AND transaction_type = 'debit' LIMIT 1",
      [`%[idem:${idempotency_key}]%`]
    );
    if (existing.rows.length > 0) {
      return {
        idempotent: true,
        transaction_id: existing.rows[0].id,
        message: 'Transfer already processed (idempotency replay)',
      };
    }
  }

  // ── Load members ──────────────────────────────────────────────────
  const [srcRes, dstRes] = await Promise.all([
    pool.query('SELECT id, username, total_solar, wallet_id FROM members WHERE id = $1', [source_member_id]),
    pool.query('SELECT id, username, total_solar, wallet_id FROM members WHERE id = $1', [destination_member_id]),
  ]);
  if (srcRes.rows.length === 0) throw new Error(`SOURCE_NOT_FOUND: member ${source_member_id}`);
  if (dstRes.rows.length === 0) throw new Error(`DESTINATION_NOT_FOUND: member ${destination_member_id}`);

  const source = srcRes.rows[0];
  const destination = dstRes.rows[0];
  const sourceBalance = parseFloat(source.total_solar || 0);
  const destBalance = parseFloat(destination.total_solar || 0);

  if (sourceBalance < transferAmount) {
    throw new Error(`INSUFFICIENT_BALANCE: source has ${sourceBalance} Solar, transfer requires ${transferAmount}`);
  }

  // Ensure wallets exist (transactions.wallet_id is NOT NULL)
  await getOrCreateWallet(pool, source);
  await getOrCreateWallet(pool, destination);

  // ── Atomic execution ──────────────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newSourceBalance = parseFloat((sourceBalance - transferAmount).toFixed(6));
    const newDestBalance = parseFloat((destBalance + transferAmount).toFixed(6));
    const ledgerId = `transfer_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const debitNote = noteWithIdempotency(`Solar transfer to ${destination.username}`, idempotency_key);
    const creditNote = noteWithIdempotency(`Solar transfer from ${source.username}`, idempotency_key);

    // Update balances
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newSourceBalance), source.id]);
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newDestBalance), destination.id]);

    // Debit transaction record
    const txRes = await client.query(
      `INSERT INTO transactions (type, wallet_id, amount_s, amount_rays, note, created_at, transaction_class, transaction_type)
       VALUES ('transfer', $1, $2, $3, $4, NOW(), 'solar_transfer', 'debit') RETURNING id`,
      [source.wallet_id, transferAmount, Math.round(transferAmount * 1000000), debitNote]
    );
    const transactionId = txRes.rows[0].id;

    // Credit transaction record
    await client.query(
      `INSERT INTO transactions (type, wallet_id, amount_s, amount_rays, note, created_at, transaction_class, transaction_type)
       VALUES ('transfer', $1, $2, $3, $4, NOW(), 'solar_transfer', 'credit')`,
      [destination.wallet_id, transferAmount, Math.round(transferAmount * 1000000), creditNote]
    );

    // Marketplace ledger — double-entry
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, 'member', $3, $4, 'solar_transfer', $5, $6)`,
      [ledgerId, String(source.id), transferAmount, newSourceBalance, transactionId, debitNote]
    );
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'member', $3, $4, 'solar_transfer', $5, $6)`,
      [ledgerId, String(destination.id), transferAmount, newDestBalance, transactionId, creditNote]
    );

    await client.query('COMMIT');

    return {
      transaction_id: transactionId,
      source: { id: source.id, username: source.username },
      destination: { id: destination.id, username: destination.username },
      amount: transferAmount,
      currency: 'SOLAR',
      pre_balance_source: sourceBalance,
      post_balance_source: newSourceBalance,
      pre_balance_destination: destBalance,
      post_balance_destination: newDestBalance,
      audit_reference: ledgerId,
      idempotency_key: idempotency_key || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════════════
// PURCHASE_ARTIFACT
// ══════════════════════════════════════════════════════════════════════

/**
 * Governed artifact purchase lifecycle (spec Task 5, 16-step).
 *
 * payload:
 *   buyer_member_id    — integer member.id
 *   market_item_id     — varchar market_items.id
 *   idempotency_key    — optional (replay protection)
 *
 * returns: normalized purchase result envelope
 */
async function executePurchaseArtifact(payload, _request, pool) {
  const { buyer_member_id, market_item_id, idempotency_key } = payload || {};

  if (!buyer_member_id) throw new Error('MISSING_BUYER: buyer_member_id required');
  if (!market_item_id) throw new Error('MISSING_LISTING: market_item_id required');

  // ── Idempotency check ─────────────────────────────────────────────
  if (idempotency_key) {
    const existing = await pool.query(
      'SELECT id FROM artifact_copies WHERE metadata->>\'idempotency_key\' = $1 LIMIT 1',
      [idempotency_key]
    );
    if (existing.rows.length > 0) {
      return { idempotent: true, copy_id: existing.rows[0].id, message: 'Purchase already processed' };
    }
  }

  // ── 1-6: Validate parties and listing ────────────────────────────
  const [buyerRes, listingRes] = await Promise.all([
    pool.query('SELECT id, username, total_solar, wallet_id FROM members WHERE id = $1', [buyer_member_id]),
    pool.query('SELECT * FROM market_items WHERE id = $1', [market_item_id]),
  ]);

  if (buyerRes.rows.length === 0) throw new Error(`BUYER_NOT_FOUND: member ${buyer_member_id}`);
  const buyer = buyerRes.rows[0];

  if (listingRes.rows.length === 0) throw new Error(`LISTING_NOT_FOUND: market_item ${market_item_id}`);
  const listing = listingRes.rows[0];

  if (listing.status !== 'ACTIVE') {
    throw new Error(`LISTING_NOT_ACTIVE: market_item ${market_item_id} status is ${listing.status}`);
  }

  const price = parseFloat(listing.price_solar || 0);
  if (price <= 0) throw new Error('INVALID_PRICE: listing has no valid price');

  // ── Resolve artifacts.id for this market_item ─────────────────────
  // artifact_copies.artifact_id FKs to artifacts.id (not market_items.id).
  // Find or create a canonical artifacts record for this market_item.
  const artSlug = `market_item_${market_item_id}`;
  let artifactId;
  const cachedArtId = listing.metadata && listing.metadata.artifact_id;
  if (cachedArtId) {
    // Previously resolved — verify it still exists
    const artCheck = await pool.query('SELECT id FROM artifacts WHERE id = $1', [cachedArtId]);
    if (artCheck.rows.length > 0) artifactId = cachedArtId;
  }
  if (!artifactId) {
    const existingArt = await pool.query('SELECT id FROM artifacts WHERE slug = $1 LIMIT 1', [artSlug]);
    if (existingArt.rows.length > 0) {
      artifactId = existingArt.rows[0].id;
    } else {
      const sellerId = listing.created_by_user_id ? String(listing.created_by_user_id) : 'system';
      const newArt = await pool.query(
        `INSERT INTO artifacts (slug, title, category, file_type, kwh_footprint, solar_amount_s, rays_amount, delivery_mode, creator_id)
         VALUES ($1, $2, $3, 'digital', 0, $4, $5, 'download', $6) RETURNING id`,
        [artSlug, listing.title, listing.category || 'Digital Artifact', String(price), Math.round(price * 1000000), sellerId]
      );
      artifactId = newArt.rows[0].id;
    }
    // Cache artifact_id on market_item so future purchases reuse the same record
    await pool.query(
      "UPDATE market_items SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{artifact_id}', $1::jsonb) WHERE id = $2",
      [JSON.stringify(artifactId), market_item_id]
    );
  }

  // Check buyer does not already own this item (re-purchase prevention)
  const alreadyOwned = await pool.query(
    'SELECT id FROM artifact_copies WHERE artifact_id = $1 AND owner_id = $2 AND is_active = true LIMIT 1',
    [artifactId, buyer.id]
  );
  if (alreadyOwned.rows.length > 0) {
    throw new Error('ALREADY_OWNED: buyer already owns this item');
  }

  // Validate buyer balance
  const buyerBalance = parseFloat(buyer.total_solar || 0);
  if (buyerBalance < price) {
    throw new Error(`INSUFFICIENT_BALANCE: buyer has ${buyerBalance} Solar, price is ${price}`);
  }

  // ── 7-9: Calculate fees ───────────────────────────────────────────
  const foundationFee = parseFloat((price * FOUNDATION_FEE_RATE).toFixed(6));
  const sellerNet = parseFloat((price - foundationFee).toFixed(6));

  // ── Validate seller ───────────────────────────────────────────────
  // created_by_user_id is text in market_items; members.id is integer.
  // Try integer parse first; fall back to username match.
  let seller = null;
  if (listing.created_by_user_id) {
    const sellerId = parseInt(listing.created_by_user_id, 10);
    const sellerRes = !isNaN(sellerId)
      ? await pool.query('SELECT id, username, total_solar, wallet_id FROM members WHERE id = $1 LIMIT 1', [sellerId])
      : await pool.query('SELECT id, username, total_solar, wallet_id FROM members WHERE username = $1 LIMIT 1', [listing.created_by_user_id]);
    if (sellerRes.rows.length > 0) seller = sellerRes.rows[0];
  }

  // Ensure buyer wallet exists (transactions.wallet_id NOT NULL)
  await getOrCreateWallet(pool, buyer);
  if (seller) await getOrCreateWallet(pool, seller);

  // ── 10-16: Atomic execution ───────────────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load foundation inside transaction for consistency
    const foundation = await getFoundationMember(client);
    const foundationBalance = parseFloat(foundation.total_solar || 0);
    // Ensure foundation wallet exists (may be a placeholder without one)
    await getOrCreateWallet(client, foundation);

    const newBuyerBalance = parseFloat((buyerBalance - price).toFixed(6));
    const newFoundationBalance = parseFloat((foundationBalance + foundationFee).toFixed(6));
    const txId = crypto.randomUUID(); // transactions.id is uuid type
    const ledgerId = `purch_ledger_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 10: Debit buyer
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newBuyerBalance), buyer.id]);

    // 11: Credit seller (if known)
    let sellerBalanceBefore = null;
    let sellerBalanceAfter = null;
    if (seller) {
      sellerBalanceBefore = parseFloat(seller.total_solar || 0);
      sellerBalanceAfter = parseFloat((sellerBalanceBefore + sellerNet).toFixed(6));
      await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(sellerBalanceAfter), seller.id]);
    }

    // 12: Allocate foundation fee
    await client.query('UPDATE members SET total_solar = $1 WHERE id = $2', [String(newFoundationBalance), foundation.id]);

    // Transaction records
    await client.query(
      `INSERT INTO transactions (id, type, wallet_id, artifact_id, amount_s, amount_rays, note, created_at, transaction_class, transaction_type)
       VALUES ($1, 'purchase', $2, $3, $4, $5, $6, NOW(), 'artifact_purchase', 'debit')`,
      [txId, buyer.wallet_id, market_item_id, price, Math.round(price * 1000000),
       noteWithIdempotency(`Purchase: ${listing.title}`, idempotency_key)]
    );
    if (seller) {
      await client.query(
        `INSERT INTO transactions (type, wallet_id, artifact_id, amount_s, amount_rays, note, created_at, transaction_class, transaction_type)
         VALUES ('sale', $1, $2, $3, $4, $5, NOW(), 'artifact_purchase', 'credit')`,
        [seller.wallet_id, market_item_id, sellerNet, Math.round(sellerNet * 1000000), `Sale: ${listing.title}`]
      );
    }
    await client.query(
      `INSERT INTO transactions (type, wallet_id, artifact_id, amount_s, amount_rays, note, created_at, transaction_class, transaction_type)
       VALUES ('foundation_fee', $1, $2, $3, $4, $5, NOW(), 'artifact_purchase', 'credit')`,
      [foundation.wallet_id, market_item_id, foundationFee, Math.round(foundationFee * 1000000),
       `Foundation fee (${FOUNDATION_FEE_RATE * 100}%): ${listing.title}`]
    );

    // Marketplace ledger — double entry
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'debit', $2, 'buyer', $3, $4, 'artifact_purchase', $5, $6)`,
      [ledgerId, String(buyer.id), price, newBuyerBalance, market_item_id, `Purchase: ${listing.title}`]
    );
    if (seller) {
      await client.query(
        `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
         VALUES ($1, 'credit', $2, 'seller', $3, $4, 'artifact_purchase', $5, $6)`,
        [ledgerId, String(seller.id), sellerNet, sellerBalanceAfter, market_item_id, `Sale: ${listing.title}`]
      );
    }
    await client.query(
      `INSERT INTO marketplace_ledger (transaction_id, entry_type, account_id, account_type, amount, balance_after, reference_type, reference_id, description)
       VALUES ($1, 'credit', $2, 'foundation', $3, $4, 'foundation_fee', $5, $6)`,
      [ledgerId, String(foundation.id), foundationFee, newFoundationBalance, market_item_id, `Foundation fee: ${listing.title}`]
    );

    // 13: Create ownership record
    const copyMeta = JSON.stringify({
      market_item_id,
      purchase_ledger_id: ledgerId,
      idempotency_key: idempotency_key || null,
      era: '21.1',
    });
    const copyRes = await client.query(
      `INSERT INTO artifact_copies (artifact_id, owner_id, purchase_transaction_id, acquired_method, solar_paid, is_active, metadata)
       VALUES ($1, $2, $3, 'purchase', $4, true, $5) RETURNING id`,
      [artifactId, buyer.id, txId, String(price), copyMeta]
    );
    const copyId = copyRes.rows[0].id;

    await client.query('COMMIT');

    return {
      transaction_id: txId,
      copy_id: copyId,
      buyer: { id: buyer.id, username: buyer.username },
      seller: seller ? { id: seller.id, username: seller.username } : null,
      listing: { id: market_item_id, title: listing.title, status: listing.status },
      price,
      foundation_fee: foundationFee,
      seller_net: sellerNet,
      currency: 'SOLAR',
      pre_balance_buyer: buyerBalance,
      post_balance_buyer: newBuyerBalance,
      pre_balance_seller: sellerBalanceBefore,
      post_balance_seller: sellerBalanceAfter,
      pre_balance_foundation: foundationBalance,
      post_balance_foundation: newFoundationBalance,
      audit_reference: ledgerId,
      idempotency_key: idempotency_key || null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════════════
// AUDIT_TRANSACTION
// ══════════════════════════════════════════════════════════════════════

/**
 * Deterministically verify a completed transaction against network rules.
 * NO LLM. Pure math and DB record comparison.
 *
 * payload:
 *   transaction_id  — the debit transaction row id (uuid)
 *
 * returns: { verdict: 'PASS'|'PASS_WITH_WARNING'|'FAIL', findings: [...] }
 */
async function executeAuditTransaction(payload, _request, pool) {
  const { transaction_id } = payload || {};
  if (!transaction_id) throw new Error('MISSING_TRANSACTION_ID');

  const findings = [];
  let verdict = 'PASS';

  // ── Load primary transaction ──────────────────────────────────────
  const txRes = await pool.query('SELECT * FROM transactions WHERE id = $1', [transaction_id]);
  if (txRes.rows.length === 0) {
    return {
      verdict: 'FAIL',
      findings: [{ code: 'TX_NOT_FOUND', severity: 'CRITICAL', detail: `No transaction found for id ${transaction_id}` }],
    };
  }
  const tx = txRes.rows[0];

  // ── Load ledger group ─────────────────────────────────────────────
  // Find ledger entry that references this transaction as reference_id
  const ledgerRes = await pool.query(
    'SELECT * FROM marketplace_ledger WHERE reference_id = $1 OR transaction_id IN (SELECT transaction_id FROM marketplace_ledger WHERE reference_id = $1 LIMIT 1)',
    [transaction_id]
  );
  const ledger = ledgerRes.rows;

  // If no ledger entries at all, that's a warning (some older transfers predate ledger)
  if (ledger.length === 0) {
    findings.push({ code: 'NO_LEDGER_ENTRIES', severity: 'WARNING', detail: 'No marketplace_ledger entries found for this transaction' });
    verdict = 'PASS_WITH_WARNING';
  } else {
    // ── Verify double-entry balance ─────────────────────────────────
    const debits = ledger.filter(e => e.entry_type === 'debit');
    const credits = ledger.filter(e => e.entry_type === 'credit');

    const totalDebit = debits.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalCredit = credits.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);

    if (diff > 0.000001) {
      findings.push({
        code: 'LEDGER_IMBALANCE',
        severity: 'CRITICAL',
        detail: `Debit total ${totalDebit} ≠ credit total ${totalCredit} (diff: ${diff})`,
      });
      verdict = 'FAIL';
    } else {
      findings.push({ code: 'LEDGER_BALANCED', severity: 'INFO', detail: `Debit and credit totals match: ${totalDebit} Solar` });
    }

    // ── Verify transaction amount matches ledger debit ──────────────
    const txAmount = parseFloat(tx.amount_s || 0);
    if (Math.abs(txAmount - totalDebit) > 0.000001) {
      findings.push({
        code: 'AMOUNT_MISMATCH',
        severity: 'CRITICAL',
        detail: `Transaction amount_s (${txAmount}) differs from ledger debit total (${totalDebit})`,
      });
      verdict = 'FAIL';
    }

    // ── Check for foundation fee on purchases ───────────────────────
    if (tx.transaction_class === 'artifact_purchase') {
      const foundationEntry = ledger.find(e => e.account_type === 'foundation');
      const sellerEntry = ledger.find(e => e.account_type === 'seller');
      if (!foundationEntry) {
        findings.push({ code: 'MISSING_FOUNDATION_FEE', severity: 'WARNING', detail: 'No foundation fee ledger entry found' });
        if (verdict === 'PASS') verdict = 'PASS_WITH_WARNING';
      } else {
        const expectedFee = parseFloat((totalDebit * FOUNDATION_FEE_RATE).toFixed(6));
        const actualFee = parseFloat(foundationEntry.amount || 0);
        if (Math.abs(expectedFee - actualFee) > 0.001) {
          findings.push({
            code: 'FOUNDATION_FEE_INCORRECT',
            severity: 'WARNING',
            detail: `Expected ~${expectedFee} Solar foundation fee (${FOUNDATION_FEE_RATE * 100}%), found ${actualFee}`,
          });
          if (verdict === 'PASS') verdict = 'PASS_WITH_WARNING';
        } else {
          findings.push({ code: 'FOUNDATION_FEE_CORRECT', severity: 'INFO', detail: `Foundation fee ${actualFee} Solar (${FOUNDATION_FEE_RATE * 100}%)` });
        }
      }
    }
  }

  // ── Ownership check for artifact purchases ────────────────────────
  if (tx.transaction_class === 'artifact_purchase' && tx.artifact_id) {
    const copyRes = await pool.query(
      'SELECT id, owner_id FROM artifact_copies WHERE purchase_transaction_id = $1 LIMIT 1',
      [transaction_id]
    );
    if (copyRes.rows.length === 0) {
      findings.push({
        code: 'MISSING_OWNERSHIP_RECORD',
        severity: 'CRITICAL',
        detail: 'No artifact_copies record references this transaction — ownership may be missing',
      });
      verdict = 'FAIL';
    } else {
      findings.push({
        code: 'OWNERSHIP_RECORD_PRESENT',
        severity: 'INFO',
        detail: `Ownership record ${copyRes.rows[0].id} assigned to member ${copyRes.rows[0].owner_id}`,
      });
    }
  }

  // ── Duplicate settlement check ────────────────────────────────────
  // For solar transfers: check there isn't a second debit with identical idempotency key
  if (tx.note && tx.note.includes('[idem:')) {
    const idemMatch = tx.note.match(/\[idem:([^\]]+)\]/);
    if (idemMatch) {
      const idemKey = idemMatch[1];
      const dupeRes = await pool.query(
        "SELECT COUNT(*) as cnt FROM transactions WHERE note LIKE $1 AND transaction_type = 'debit'",
        [`%[idem:${idemKey}]%`]
      );
      const dupeCount = parseInt(dupeRes.rows[0].cnt, 10);
      if (dupeCount > 1) {
        findings.push({
          code: 'DUPLICATE_IDEMPOTENCY_KEY',
          severity: 'CRITICAL',
          detail: `Found ${dupeCount} debit transactions with idempotency key ${idemKey}`,
        });
        verdict = 'FAIL';
      } else {
        findings.push({ code: 'NO_DUPLICATE', severity: 'INFO', detail: 'Idempotency key unique — no duplicate settlement' });
      }
    }
  }

  return {
    verdict,
    transaction_id,
    transaction_class: tx.transaction_class,
    transaction_type: tx.transaction_type,
    amount: parseFloat(tx.amount_s || 0),
    currency: 'SOLAR',
    findings,
    audited_at: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// EconomicHandlers class — mirrors pattern of MarketplaceHandlers
// ══════════════════════════════════════════════════════════════════════

class EconomicHandlers {
  constructor(pool) {
    this.pool = pool;
  }

  async executeTransferSolar(payload, request) {
    return executeTransferSolar(payload, request, this.pool);
  }

  async executePurchaseArtifact(payload, request) {
    return executePurchaseArtifact(payload, request, this.pool);
  }

  async executeAuditTransaction(payload, request) {
    return executeAuditTransaction(payload, request, this.pool);
  }
}

module.exports = { EconomicHandlers, executeTransferSolar, executePurchaseArtifact, executeAuditTransaction };
