/**
 * TC-S Network Foundation - Marketplace Action Handlers
 * Autonomy Spine v2 - Policy-gated marketplace operations
 */

const { PricingEngine } = require('../pricing-engine');

class MarketplaceHandlers {
  constructor(pool) {
    this.pool = pool;
    this.pricingEngine = new PricingEngine(pool);
  }

  async executeAssetCreate(payload, actionRequest) {
    const {
      title,
      description,
      category,
      condition,
      quantity = 1,
      imageUrls = [],
      pickupLocation,
      pickupRules,
      tags = [],
      createdByUserId
    } = payload;

    const searchText = [title, description, category, ...tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, ' ')
      .trim();

    try {
      const assetResult = await this.pool.query(
        `INSERT INTO market_items 
         (title, description, category, tags, status, search_text, image_url, created_by_user_id, metadata)
         VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8)
         RETURNING id, status, created_at`,
        [
          title,
          description,
          category,
          tags,
          searchText,
          imageUrls[0] || null,
          createdByUserId,
          JSON.stringify({ condition, pickupLocation, pickupRules, imageUrls, actionRequestId: actionRequest.id })
        ]
      );

      const asset = assetResult.rows[0];

      await this.pool.query(
        `INSERT INTO inventory (asset_id, quantity_total, quantity_available)
         VALUES ($1, $2, $2)`,
        [asset.id, quantity]
      );

      return {
        success: true,
        assetId: asset.id,
        status: asset.status,
        createdAt: asset.created_at
      };
    } catch (error) {
      throw new Error(`Asset creation failed: ${error.message}`);
    }
  }

  async executeAssetEnrich(payload, actionRequest) {
    const { assetId, forceRefresh = false } = payload;

    const assetResult = await this.pool.query(
      `SELECT * FROM market_items WHERE id = $1`,
      [assetId]
    );

    if (assetResult.rows.length === 0) {
      throw new Error('Asset not found');
    }

    const asset = assetResult.rows[0];
    const metadata = asset.metadata || {};

    if (metadata.enriched && !forceRefresh) {
      return {
        success: true,
        assetId,
        enrichedFields: [],
        message: 'Asset already enriched'
      };
    }

    const enrichedData = await this.performEnrichment(asset);

    await this.pool.query(
      `UPDATE market_items 
       SET category = COALESCE($2, category),
           kwh_estimate = $3,
           metadata = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [
        assetId,
        enrichedData.category,
        enrichedData.kwhEstimate,
        JSON.stringify({
          ...metadata,
          enriched: true,
          enrichedAt: new Date().toISOString(),
          normalizedTitle: enrichedData.normalizedTitle,
          attributes: enrichedData.attributes,
          carbonEstimate: enrichedData.carbonEstimate,
          riskScore: enrichedData.riskScore,
          actionRequestId: actionRequest.id
        })
      ]
    );

    return {
      success: true,
      assetId,
      enrichedFields: ['category', 'kwhEstimate', 'attributes', 'riskScore'],
      normalizedTitle: enrichedData.normalizedTitle,
      category: enrichedData.category,
      attributes: enrichedData.attributes,
      kwhEstimate: enrichedData.kwhEstimate,
      carbonEstimate: enrichedData.carbonEstimate,
      riskScore: enrichedData.riskScore,
      comparableItems: []
    };
  }

  async performEnrichment(asset) {
    const title = asset.title || '';
    const description = asset.description || '';
    const content = `${title} ${description}`.toLowerCase();

    let category = asset.category || 'services';
    if (content.includes('music') || content.includes('song') || content.includes('album')) {
      category = 'culture';
    } else if (content.includes('solar') || content.includes('energy') || content.includes('power')) {
      category = 'energy_trading';
    } else if (content.includes('compute') || content.includes('ai') || content.includes('model')) {
      category = 'computronium';
    } else if (content.includes('food') || content.includes('water') || content.includes('shelter')) {
      category = 'basic_needs';
    }

    const kwhEstimate = this.estimateKwh(category, content);
    const carbonEstimate = kwhEstimate * 0.4;
    const riskScore = this.calculateRiskScore(content, asset.metadata?.imageUrls);

    return {
      normalizedTitle: title.trim().substring(0, 100),
      category,
      attributes: {
        detectedKeywords: content.match(/\b(music|solar|energy|ai|compute|service)\b/gi) || [],
        wordCount: content.split(/\s+/).length,
        hasImages: (asset.metadata?.imageUrls?.length || 0) > 0
      },
      kwhEstimate,
      carbonEstimate,
      riskScore
    };
  }

  estimateKwh(category, content) {
    const baseEstimates = {
      'computronium': 100,
      'culture': 10,
      'basic_needs': 5,
      'energy_trading': 500,
      'services': 20
    };

    let estimate = baseEstimates[category] || 10;

    if (content.includes('large') || content.includes('premium')) estimate *= 2;
    if (content.includes('small') || content.includes('basic')) estimate *= 0.5;

    return parseFloat(estimate.toFixed(2));
  }

  calculateRiskScore(content, imageUrls) {
    let score = 5;

    const riskyTerms = ['free', 'guaranteed', 'unlimited', 'exclusive', 'urgent'];
    for (const term of riskyTerms) {
      if (content.includes(term)) score += 5;
    }

    if (!imageUrls || imageUrls.length === 0) score += 10;
    if (content.length < 20) score += 10;
    if (content.length > 5000) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  async executeAssetList(payload, actionRequest) {
    const { assetId } = payload;

    const assetResult = await this.pool.query(
      `SELECT id, price_solar, status FROM market_items WHERE id = $1`,
      [assetId]
    );

    if (assetResult.rows.length === 0) {
      throw new Error('Asset not found');
    }

    const asset = assetResult.rows[0];

    if (!asset.price_solar || parseFloat(asset.price_solar) <= 0) {
      throw new Error('Asset must have a price before listing. Use PRICE.PUBLISH first.');
    }

    await this.pool.query(
      `UPDATE market_items SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
      [assetId]
    );

    return {
      success: true,
      assetId,
      status: 'ACTIVE',
      listedAt: new Date().toISOString()
    };
  }

  async executeAssetUnlist(payload, actionRequest) {
    const { assetId, reason } = payload;

    await this.pool.query(
      `UPDATE market_items 
       SET status = 'ARCHIVED', 
           metadata = jsonb_set(COALESCE(metadata, '{}'), '{unlistReason}', $2::jsonb),
           updated_at = NOW() 
       WHERE id = $1`,
      [assetId, JSON.stringify(reason || 'Manual unlist')]
    );

    return {
      success: true,
      assetId,
      status: 'ARCHIVED',
      unlistedAt: new Date().toISOString()
    };
  }

  async executeAssetUpdate(payload, actionRequest) {
    const { assetId, title, description, imageUrls, quantity, pickupRules, tags } = payload;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title) {
      updates.push(`title = $${paramIndex++}`);
      values.push(title);
    }
    if (description) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (tags) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(assetId);
      
      await this.pool.query(
        `UPDATE market_items SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    if (quantity !== undefined) {
      await this.pool.query(
        `UPDATE inventory 
         SET quantity_total = $2, 
             quantity_available = quantity_available + ($2 - quantity_total),
             updated_at = NOW()
         WHERE asset_id = $1`,
        [assetId, quantity]
      );
    }

    return {
      success: true,
      assetId,
      updatedFields: Object.keys(payload).filter(k => k !== 'assetId'),
      updatedAt: new Date().toISOString()
    };
  }

  async executePriceQuote(payload, actionRequest) {
    const { assetId, networkId = 'default' } = payload;
    return await this.pricingEngine.quote(assetId, networkId);
  }

  async executePricePublish(payload, actionRequest) {
    const { assetId, priceSolar, priceFiat, overrideReason } = payload;
    return await this.pricingEngine.publishPrice(assetId, priceSolar, 'default', overrideReason);
  }

  async executePriceUpdateRules(payload, actionRequest) {
    const { networkId, ...configUpdates } = payload;
    
    const results = [];
    for (const [key, value] of Object.entries(configUpdates)) {
      if (value !== undefined && key !== 'networkId') {
        const result = await this.pricingEngine.updateNetworkConfig(
          networkId, 
          key, 
          value, 
          actionRequest.requester_id || 'system'
        );
        results.push(result);
      }
    }

    return {
      success: true,
      networkId,
      updated: results.filter(r => r.success).length > 0,
      effectiveAt: new Date().toISOString(),
      updates: results
    };
  }

  async executeOrderCreate(payload, actionRequest) {
    const { buyerId, items, paymentMethod = 'solar', shippingAddress, pickupPreference } = payload;

    const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const reservationExpiry = new Date(Date.now() + 30 * 60 * 1000);

    let totalSolar = 0;
    let totalFiat = 0;
    const orderItems = [];

    for (const item of items) {
      const assetResult = await this.pool.query(
        `SELECT id, title, price_solar, price_fiat_optional FROM market_items 
         WHERE id = $1 AND status = 'ACTIVE'`,
        [item.assetId]
      );

      if (assetResult.rows.length === 0) {
        throw new Error(`Asset ${item.assetId} not found or not active`);
      }

      const inventoryResult = await this.pool.query(
        `SELECT quantity_available FROM inventory WHERE asset_id = $1`,
        [item.assetId]
      );

      const available = inventoryResult.rows[0]?.quantity_available || 0;
      if (available < item.quantity) {
        throw new Error(`Insufficient inventory for asset ${item.assetId}`);
      }

      const asset = assetResult.rows[0];
      const unitPriceSolar = parseFloat(asset.price_solar) || 0;
      const unitPriceFiat = parseFloat(asset.price_fiat_optional) || 0;

      totalSolar += unitPriceSolar * item.quantity;
      totalFiat += unitPriceFiat * item.quantity;

      orderItems.push({
        assetId: item.assetId,
        quantity: item.quantity,
        unitPriceSolar,
        unitPriceFiat
      });
    }

    const orderResult = await this.pool.query(
      `INSERT INTO orders 
       (buyer_id, status, total_solar, total_fiat, payment_method, verification_code, 
        shipping_address, reservation_expires_at, metadata)
       VALUES ($1, 'reserved', $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, status, created_at`,
      [
        buyerId,
        totalSolar.toFixed(6),
        totalFiat.toFixed(2),
        paymentMethod,
        verificationCode,
        JSON.stringify(shippingAddress || {}),
        reservationExpiry,
        JSON.stringify({ pickupPreference, actionRequestId: actionRequest.id })
      ]
    );

    const order = orderResult.rows[0];

    for (const item of orderItems) {
      await this.pool.query(
        `INSERT INTO order_items 
         (order_id, asset_id, quantity, unit_price_solar, unit_price_fiat, total_price_solar, total_price_fiat, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'reserved')`,
        [
          order.id,
          item.assetId,
          item.quantity,
          item.unitPriceSolar.toFixed(6),
          item.unitPriceFiat.toFixed(2),
          (item.unitPriceSolar * item.quantity).toFixed(6),
          (item.unitPriceFiat * item.quantity).toFixed(2)
        ]
      );

      await this.pool.query(
        `UPDATE inventory 
         SET quantity_available = quantity_available - $2,
             quantity_reserved = quantity_reserved + $2,
             updated_at = NOW()
         WHERE asset_id = $1`,
        [item.assetId, item.quantity]
      );
    }

    return {
      success: true,
      orderId: order.id,
      status: order.status,
      totalSolar,
      totalFiat,
      verificationCode,
      reservationExpiry: reservationExpiry.toISOString(),
      items: orderItems.map(i => ({ assetId: i.assetId, quantity: i.quantity }))
    };
  }

  async executeOrderCapturePayment(payload, actionRequest) {
    const { orderId, paymentIntentId, solarAmount } = payload;

    const orderResult = await this.pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    if (order.status !== 'reserved') {
      throw new Error(`Cannot capture payment for order in status: ${order.status}`);
    }

    await this.pool.query(
      `UPDATE orders 
       SET status = 'paid', 
           payment_intent_id = $2,
           payment_captured_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, paymentIntentId]
    );

    const transactionId = `txn_${Date.now()}_${orderId.substring(0, 8)}`;

    await this.pool.query(
      `INSERT INTO ledger_events (event_type, order_id, amount, currency, description, action_request_id)
       VALUES ('sale', $1, $2, 'solar', 'Payment captured', $3)`,
      [orderId, order.total_solar, actionRequest.id]
    );

    return {
      success: true,
      orderId,
      captured: true,
      transactionId,
      capturedAt: new Date().toISOString()
    };
  }

  async executeOrderFulfill(payload, actionRequest) {
    const { orderId, verificationMethod, verificationCode, staffId, notes } = payload;

    const orderResult = await this.pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderResult.rows[0];

    if (order.status !== 'paid') {
      throw new Error(`Cannot fulfill order in status: ${order.status}`);
    }

    if (verificationMethod === 'qr' && verificationCode !== order.verification_code) {
      throw new Error('Invalid verification code');
    }

    await this.pool.query(
      `UPDATE orders 
       SET fulfillment_status = 'fulfilled',
           fulfillment_method = $2,
           fulfilled_at = NOW(),
           fulfilled_by = $3,
           notes = COALESCE(notes, '') || $4,
           status = 'fulfilled',
           updated_at = NOW()
       WHERE id = $1`,
      [orderId, verificationMethod, staffId, notes ? `\n${notes}` : '']
    );

    const orderItems = await this.pool.query(
      `SELECT asset_id, quantity FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    for (const item of orderItems.rows) {
      await this.pool.query(
        `UPDATE inventory 
         SET quantity_reserved = quantity_reserved - $2,
             updated_at = NOW()
         WHERE asset_id = $1`,
        [item.asset_id, item.quantity]
      );
    }

    const ledgerResult = await this.pool.query(
      `INSERT INTO ledger_events (event_type, order_id, amount, currency, description, action_request_id)
       VALUES ('sale', $1, $2, 'solar', 'Order fulfilled', $3)
       RETURNING id`,
      [orderId, order.total_solar, actionRequest.id]
    );

    return {
      success: true,
      orderId,
      fulfilled: true,
      fulfilledAt: new Date().toISOString(),
      ledgerEventId: ledgerResult.rows[0].id
    };
  }

  async executeLedgerPost(payload, actionRequest) {
    const { 
      eventType, 
      orderId, 
      amount, 
      currency = 'solar',
      fromAccountId,
      toAccountId,
      description,
      metadata 
    } = payload;

    const result = await this.pool.query(
      `INSERT INTO ledger_events 
       (event_type, order_id, amount, currency, from_account_id, to_account_id, description, action_request_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, posted_at`,
      [eventType, orderId, amount, currency, fromAccountId, toAccountId, description, actionRequest.id, JSON.stringify(metadata || {})]
    );

    return {
      success: true,
      ledgerEventId: result.rows[0].id,
      posted: true,
      postedAt: result.rows[0].posted_at
    };
  }

  async executeSettlementRun(payload, actionRequest) {
    const { networkId, periodStart, periodEnd, dryRun = false } = payload;

    const ordersResult = await this.pool.query(
      `SELECT o.*, oi.asset_id, oi.total_price_solar, oi.fee_breakdown, mi.created_by_user_id as vendor_id
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN market_items mi ON oi.asset_id = mi.id
       WHERE o.status = 'fulfilled'
       AND o.network_id = $1
       AND o.fulfilled_at >= $2
       AND o.fulfilled_at <= $3`,
      [networkId, periodStart, periodEnd]
    );

    if (ordersResult.rows.length === 0) {
      return {
        success: true,
        settlementId: null,
        ordersSettled: 0,
        totalVolume: 0,
        message: 'No orders to settle in this period'
      };
    }

    const config = await this.pricingEngine.getNetworkConfig(networkId);
    
    let totalVolume = 0;
    let vendorPayouts = 0;
    let commissionerFees = 0;
    let tcsFees = 0;
    let taxBucket = 0;
    const settledOrderIds = new Set();

    for (const row of ordersResult.rows) {
      const amount = parseFloat(row.total_price_solar) || 0;
      totalVolume += amount;
      settledOrderIds.add(row.id);

      const vendorNet = amount * (1 - config.commissionerMargin - config.tcsMargin - config.taxRate);
      vendorPayouts += vendorNet;
      commissionerFees += amount * config.commissionerMargin;
      tcsFees += amount * config.tcsMargin;
      taxBucket += amount * config.taxRate;
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        ordersSettled: settledOrderIds.size,
        totalVolume,
        splits: {
          vendors: vendorPayouts,
          commissioner: commissionerFees,
          tcs: tcsFees,
          taxBucket
        }
      };
    }

    const settlementResult = await this.pool.query(
      `INSERT INTO settlements 
       (network_id, period_start, period_end, status, orders_settled, total_volume_solar,
        vendor_payouts, commissioner_fees, tcs_fees, tax_bucket, action_request_id, settled_at)
       VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id`,
      [
        networkId,
        periodStart,
        periodEnd,
        settledOrderIds.size,
        totalVolume.toFixed(6),
        vendorPayouts.toFixed(6),
        commissionerFees.toFixed(6),
        tcsFees.toFixed(6),
        taxBucket.toFixed(6),
        actionRequest.id
      ]
    );

    const settlementId = settlementResult.rows[0].id;

    const ledgerEvents = [];
    
    const vendorLedger = await this.pool.query(
      `INSERT INTO ledger_events (event_type, settlement_id, amount, currency, to_account_type, description)
       VALUES ('settlement_vendor', $1, $2, 'solar', 'vendor', 'Vendor payouts')
       RETURNING id`,
      [settlementId, vendorPayouts.toFixed(6)]
    );
    ledgerEvents.push(vendorLedger.rows[0].id);

    const commLedger = await this.pool.query(
      `INSERT INTO ledger_events (event_type, settlement_id, amount, currency, to_account_type, description)
       VALUES ('settlement_commissioner', $1, $2, 'solar', 'commissioner', 'Commissioner fees')
       RETURNING id`,
      [settlementId, commissionerFees.toFixed(6)]
    );
    ledgerEvents.push(commLedger.rows[0].id);

    const tcsLedger = await this.pool.query(
      `INSERT INTO ledger_events (event_type, settlement_id, amount, currency, to_account_type, description)
       VALUES ('settlement_tcs', $1, $2, 'solar', 'tcs_foundation', 'TC-S Foundation fees')
       RETURNING id`,
      [settlementId, tcsFees.toFixed(6)]
    );
    ledgerEvents.push(tcsLedger.rows[0].id);

    const taxLedger = await this.pool.query(
      `INSERT INTO ledger_events (event_type, settlement_id, amount, currency, to_account_type, description)
       VALUES ('settlement_tax', $1, $2, 'solar', 'tax_bucket', 'Tax allocation')
       RETURNING id`,
      [settlementId, taxBucket.toFixed(6)]
    );
    ledgerEvents.push(taxLedger.rows[0].id);

    return {
      success: true,
      settlementId,
      ordersSettled: settledOrderIds.size,
      totalVolume,
      splits: {
        vendors: vendorPayouts,
        commissioner: commissionerFees,
        tcs: tcsFees,
        taxBucket
      },
      ledgerEvents,
      settledAt: new Date().toISOString()
    };
  }

  async executeModerationReview(payload, actionRequest) {
    const { assetId, contentType = 'both' } = payload;

    const assetResult = await this.pool.query(
      `SELECT * FROM market_items WHERE id = $1`,
      [assetId]
    );

    if (assetResult.rows.length === 0) {
      throw new Error('Asset not found');
    }

    const asset = assetResult.rows[0];
    const content = `${asset.title} ${asset.description}`.toLowerCase();

    const policyViolations = [];
    let riskScore = asset.metadata?.riskScore || this.calculateRiskScore(content, asset.metadata?.imageUrls);

    const prohibitedTerms = ['illegal', 'weapon', 'drug', 'scam'];
    for (const term of prohibitedTerms) {
      if (content.includes(term)) {
        policyViolations.push(`Contains prohibited term: ${term}`);
        riskScore += 30;
      }
    }

    let decision = 'approved';
    let requiresHumanReview = false;

    if (riskScore > 70) {
      decision = 'rejected';
    } else if (riskScore > 40) {
      decision = 'flagged';
      requiresHumanReview = true;
    }

    return {
      success: true,
      assetId,
      decision,
      riskScore: Math.min(100, riskScore),
      policyViolations,
      requiresHumanReview
    };
  }

  async executeSearchFulfillmentRecommend(payload, actionRequest) {
    const { query, constraints = {}, allowedPortals = ['amazon', 'walmart', 'ebay'] } = payload;

    const recommendations = allowedPortals.map((portal, index) => ({
      vendorName: portal.charAt(0).toUpperCase() + portal.slice(1),
      productTitle: `${query} - Recommended from ${portal}`,
      sourceUrl: `https://www.${portal}.com/search?q=${encodeURIComponent(query)}`,
      priceEstimate: constraints.budget ? constraints.budget * (0.7 + Math.random() * 0.3) : null,
      fitScore: 80 - index * 10,
      riskFlags: []
    }));

    return {
      success: true,
      recommendations,
      requiresHumanApproval: true
    };
  }

  async executeAlertCreate(payload, actionRequest) {
    const { alertType, severity, message, entityType, entityId, metadata } = payload;

    console.log(`[ALERT ${severity.toUpperCase()}] ${alertType}: ${message}`);

    return {
      success: true,
      alertId: `alert_${Date.now()}`,
      created: true,
      escalated: severity === 'critical'
    };
  }
}

module.exports = { MarketplaceHandlers };
