/**
 * TC-S Network Foundation - Pricing Engine v1
 * Rules-first pricing with fee breakdown, tax-inclusive, confidence scoring
 * 
 * Pricing Order:
 * 1. Rules / constraints (hard): category min/max, fees, tax-inclusive
 * 2. Market comparables (soft): known prices for comps
 * 3. Energy metrics (soft): kWh footprint estimate
 * 4. AI explanation + confidence
 */

const SOLAR_TO_KWH = 4913;
const DEFAULT_CONFIG = {
  commissionerMargin: 0.10,
  tcsMargin: 0.02,
  taxRate: 0.08,
  microFeePerTransaction: 0.001,
  taxIncluded: true,
  categoryFloors: {
    'computronium': 0.001,
    'culture': 0.0001,
    'basic_needs': 0.0005,
    'energy_trading': 0.01,
    'services': 0.001
  },
  categoryCeilings: {
    'computronium': 1000,
    'culture': 100,
    'basic_needs': 50,
    'energy_trading': 10000,
    'services': 500
  },
  autoListThresholds: {
    maxRiskScore: 20,
    minConfidence: 80,
    maxPriceDeviation: 0.15
  }
};

class PricingEngine {
  constructor(pool) {
    this.pool = pool;
    this.configCache = new Map();
  }

  async getNetworkConfig(networkId) {
    const cacheKey = `config_${networkId}`;
    if (this.configCache.has(cacheKey)) {
      const cached = this.configCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        return cached.config;
      }
    }

    try {
      const result = await this.pool.query(
        `SELECT config_key, config_value FROM network_config 
         WHERE network_id = $1 AND is_active = true`,
        [networkId]
      );

      const config = { ...DEFAULT_CONFIG };
      for (const row of result.rows) {
        config[row.config_key] = row.config_value;
      }

      this.configCache.set(cacheKey, { config, timestamp: Date.now() });
      return config;
    } catch (error) {
      console.error('Error loading network config:', error);
      return DEFAULT_CONFIG;
    }
  }

  async getAsset(assetId) {
    const result = await this.pool.query(
      `SELECT * FROM market_items WHERE id = $1`,
      [assetId]
    );
    return result.rows[0] || null;
  }

  async getComparables(asset, limit = 5) {
    if (!asset) return [];

    try {
      const result = await this.pool.query(
        `SELECT id, title, price_solar, price_fiat_optional, category, kwh_estimate
         FROM market_items 
         WHERE status = 'ACTIVE' 
         AND id != $1
         AND (category = $2 OR search_text ILIKE $3)
         ORDER BY created_at DESC
         LIMIT $4`,
        [asset.id, asset.category, `%${asset.title?.split(' ')[0]}%`, limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching comparables:', error);
      return [];
    }
  }

  calculateBasePrice(asset, comparables = []) {
    let basePrice = 0;
    let priceSource = 'default';
    let confidence = 50;

    if (comparables.length > 0) {
      const prices = comparables
        .map(c => parseFloat(c.price_solar))
        .filter(p => p > 0 && !isNaN(p));
      
      if (prices.length > 0) {
        basePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        priceSource = 'comparables';
        confidence = Math.min(90, 60 + prices.length * 10);
      }
    }

    if (basePrice === 0 && asset.kwh_estimate) {
      basePrice = parseFloat(asset.kwh_estimate) / SOLAR_TO_KWH;
      priceSource = 'energy_estimate';
      confidence = 70;
    }

    if (basePrice === 0) {
      const categoryDefaults = {
        'computronium': 0.01,
        'culture': 0.005,
        'basic_needs': 0.002,
        'energy_trading': 0.1,
        'services': 0.02,
        'default': 0.01
      };
      basePrice = categoryDefaults[asset.category] || categoryDefaults.default;
      priceSource = 'category_default';
      confidence = 40;
    }

    return { basePrice, priceSource, confidence };
  }

  calculateFeeBreakdown(basePrice, config) {
    const commissionerFee = basePrice * config.commissionerMargin;
    const tcsFee = basePrice * config.tcsMargin;
    const subtotalBeforeTax = basePrice + commissionerFee + tcsFee + config.microFeePerTransaction;
    
    let taxAmount = 0;
    let finalPrice = subtotalBeforeTax;

    if (config.taxIncluded) {
      taxAmount = subtotalBeforeTax * config.taxRate;
      finalPrice = subtotalBeforeTax + taxAmount;
    }

    const vendorNet = basePrice;

    return {
      basePrice,
      vendorNet,
      commissionerFee,
      tcsFee,
      microFee: config.microFeePerTransaction,
      taxAmount,
      taxRate: config.taxRate,
      taxIncluded: config.taxIncluded,
      totalPrice: finalPrice,
      breakdown: {
        vendorNet: vendorNet.toFixed(6),
        commissionerFee: commissionerFee.toFixed(6),
        tcsFee: tcsFee.toFixed(6),
        microFee: config.microFeePerTransaction.toFixed(6),
        taxBucket: taxAmount.toFixed(6),
        total: finalPrice.toFixed(6)
      }
    };
  }

  applyConstraints(price, category, config) {
    const floor = config.categoryFloors[category] || 0;
    const ceiling = config.categoryCeilings[category] || Infinity;

    let constrainedPrice = price;
    let constraintApplied = null;

    if (price < floor) {
      constrainedPrice = floor;
      constraintApplied = 'floor';
    } else if (price > ceiling) {
      constrainedPrice = ceiling;
      constraintApplied = 'ceiling';
    }

    return { constrainedPrice, constraintApplied, floor, ceiling };
  }

  generateExplanation(asset, priceSource, comparables, feeBreakdown, constraintApplied) {
    const parts = [];

    parts.push(`Base price determined from ${priceSource.replace('_', ' ')}.`);

    if (comparables.length > 0) {
      parts.push(`Found ${comparables.length} comparable item(s) in the marketplace.`);
    }

    if (asset.kwh_estimate) {
      const kwhValue = parseFloat(asset.kwh_estimate);
      parts.push(`Energy footprint: ${kwhValue.toFixed(2)} kWh (${(kwhValue / SOLAR_TO_KWH).toFixed(6)} Solar).`);
    }

    parts.push(`Fees: ${(feeBreakdown.commissionerFee * 100 / feeBreakdown.basePrice).toFixed(1)}% commissioner, ${(feeBreakdown.tcsFee * 100 / feeBreakdown.basePrice).toFixed(1)}% TC-S.`);

    if (feeBreakdown.taxIncluded) {
      parts.push(`Tax (${(feeBreakdown.taxRate * 100).toFixed(1)}%) included in final price.`);
    }

    if (constraintApplied) {
      parts.push(`Price adjusted to category ${constraintApplied}.`);
    }

    return parts.join(' ');
  }

  shouldAutoApprove(confidence, riskScore, priceDeviation, config) {
    const thresholds = config.autoListThresholds;
    
    const reasons = [];
    let approved = true;

    if (confidence < thresholds.minConfidence) {
      approved = false;
      reasons.push(`Confidence ${confidence}% below threshold ${thresholds.minConfidence}%`);
    }

    if (riskScore > thresholds.maxRiskScore) {
      approved = false;
      reasons.push(`Risk score ${riskScore} above threshold ${thresholds.maxRiskScore}`);
    }

    if (priceDeviation > thresholds.maxPriceDeviation) {
      approved = false;
      reasons.push(`Price deviation ${(priceDeviation * 100).toFixed(1)}% above threshold ${(thresholds.maxPriceDeviation * 100)}%`);
    }

    return { approved, reasons };
  }

  async quote(assetId, networkId = 'default') {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      return {
        success: false,
        error: 'Asset not found',
        assetId
      };
    }

    const config = await this.getNetworkConfig(networkId);
    const comparables = await this.getComparables(asset);
    const { basePrice, priceSource, confidence } = this.calculateBasePrice(asset, comparables);
    const { constrainedPrice, constraintApplied, floor, ceiling } = this.applyConstraints(
      basePrice, 
      asset.category, 
      config
    );
    const feeBreakdown = this.calculateFeeBreakdown(constrainedPrice, config);

    let priceDeviation = 0;
    if (comparables.length > 0) {
      const avgComparable = comparables
        .map(c => parseFloat(c.price_solar))
        .filter(p => p > 0 && !isNaN(p))
        .reduce((a, b, _, arr) => a + b / arr.length, 0);
      if (avgComparable > 0) {
        priceDeviation = Math.abs(feeBreakdown.totalPrice - avgComparable) / avgComparable;
      }
    }

    const riskScore = asset.metadata?.riskScore || 10;
    const autoApproval = this.shouldAutoApprove(confidence, riskScore, priceDeviation, config);
    const explanation = this.generateExplanation(asset, priceSource, comparables, feeBreakdown, constraintApplied);

    return {
      success: true,
      assetId,
      networkId,
      priceSolar: parseFloat(feeBreakdown.totalPrice.toFixed(6)),
      priceFiat: null,
      currency: 'solar',
      taxIncluded: config.taxIncluded,
      feeBreakdown: feeBreakdown.breakdown,
      confidence,
      priceSource,
      explanation,
      comparables: comparables.map(c => ({
        id: c.id,
        title: c.title,
        priceSolar: c.price_solar
      })),
      constraints: {
        floor,
        ceiling,
        applied: constraintApplied
      },
      autoApproval,
      requiresApproval: !autoApproval.approved,
      generatedAt: new Date().toISOString()
    };
  }

  async publishPrice(assetId, priceSolar, networkId = 'default', overrideReason = null) {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      return {
        success: false,
        error: 'Asset not found',
        assetId
      };
    }

    const config = await this.getNetworkConfig(networkId);
    const { constrainedPrice, constraintApplied } = this.applyConstraints(
      priceSolar, 
      asset.category, 
      config
    );

    const finalPrice = constraintApplied ? constrainedPrice : priceSolar;
    const feeBreakdown = this.calculateFeeBreakdown(finalPrice, config);

    try {
      await this.pool.query(
        `UPDATE market_items 
         SET price_solar = $1, updated_at = NOW()
         WHERE id = $2`,
        [feeBreakdown.totalPrice.toFixed(6), assetId]
      );

      return {
        success: true,
        assetId,
        priceSolar: parseFloat(feeBreakdown.totalPrice.toFixed(6)),
        publishedAt: new Date().toISOString(),
        feeBreakdown: feeBreakdown.breakdown,
        overrideReason,
        constraintApplied
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        assetId
      };
    }
  }

  async updateNetworkConfig(networkId, configKey, configValue, updatedBy = 'system') {
    try {
      const existing = await this.pool.query(
        `SELECT id, version FROM network_config 
         WHERE network_id = $1 AND config_key = $2 AND is_active = true`,
        [networkId, configKey]
      );

      if (existing.rows.length > 0) {
        await this.pool.query(
          `UPDATE network_config 
           SET is_active = false, updated_at = NOW()
           WHERE id = $1`,
          [existing.rows[0].id]
        );
      }

      const newVersion = (existing.rows[0]?.version || 0) + 1;

      const result = await this.pool.query(
        `INSERT INTO network_config (network_id, config_key, config_value, version, updated_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [networkId, configKey, JSON.stringify(configValue), newVersion, updatedBy]
      );

      this.configCache.delete(`config_${networkId}`);

      return {
        success: true,
        networkId,
        configKey,
        version: newVersion,
        configId: result.rows[0].id,
        effectiveAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        networkId,
        configKey
      };
    }
  }

  solarToFiat(solarAmount, fiatRate = 0.0001) {
    return solarAmount * SOLAR_TO_KWH * fiatRate;
  }

  fiatToSolar(fiatAmount, fiatRate = 0.0001) {
    return fiatAmount / (SOLAR_TO_KWH * fiatRate);
  }

  kwhToSolar(kwh) {
    return kwh / SOLAR_TO_KWH;
  }

  solarToKwh(solar) {
    return solar * SOLAR_TO_KWH;
  }
}

module.exports = { PricingEngine, DEFAULT_CONFIG, SOLAR_TO_KWH };
