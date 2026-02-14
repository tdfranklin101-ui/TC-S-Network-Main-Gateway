/**
 * AI Automatic Promotion Service for TC-S Network Foundation Market
 * Indexes market categories and inventories to automatically promote member content
 */

class AIPromotionService {
  constructor(memberContentService, marketDataService, pool) {
    this.memberContentService = memberContentService;
    this.marketDataService = marketDataService;
    this.pool = pool;
    this.promotionHistory = new Map();
    this.categoryIndexes = new Map();
    this.performanceMetrics = new Map();
    this.promotionQueue = [];
    this.totalArtifactsIndexed = 0;
    this._dbArtifactsCache = null;
    this._dbArtifactsCacheTime = 0;
    
    this.promotionAlgorithms = {
      trending: this.identifyTrendingContent.bind(this),
      newMember: this.promoteNewMemberContent.bind(this),
      underperforming: this.boostUnderperformingContent.bind(this),
      seasonal: this.applySeasonalPromotion.bind(this),
      crossCategory: this.findCrossCategoryOpportunities.bind(this),
      qualityScore: this.promoteHighQualityContent.bind(this)
    };

    this.startPromotionCycle();
  }

  /**
   * Get cached DB artifacts, re-querying only if cache is older than 5 minutes
   */
  async getDbArtifacts() {
    const CACHE_TTL = 5 * 60 * 1000;
    if (this._dbArtifactsCache && (Date.now() - this._dbArtifactsCacheTime) < CACHE_TTL) {
      return this._dbArtifactsCache;
    }

    if (!this.pool) {
      return null;
    }

    try {
      const [artifactsResult, marketItemsResult] = await Promise.all([
        this.pool.query('SELECT id, title, description, category, solar_amount_s AS price_solar, kwh_footprint, file_type, delivery_url, content_body, source_type, artifact_class, creator_id, created_at FROM artifacts WHERE active = true'),
        this.pool.query("SELECT id, title, description, category, price_solar, kwh_estimate, source_type, status, metadata, created_by_user_id, created_at FROM market_items WHERE status = 'ACTIVE'")
      ]);

      const artifacts = artifactsResult.rows || [];
      const marketItems = marketItemsResult.rows || [];

      const seen = new Set();
      const merged = [];

      for (const a of artifacts) {
        const key = `${(a.title || '').toLowerCase().trim()}::${(a.category || '').toLowerCase().trim()}`;
        seen.add(key);
        merged.push({ ...a, _source: 'artifacts' });
      }

      for (const m of marketItems) {
        const key = `${(m.title || '').toLowerCase().trim()}::${(m.category || '').toLowerCase().trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push({ ...m, _source: 'market_items' });
        }
      }

      console.log(`📦 DB index: ${artifacts.length} artifacts + ${marketItems.length} market_items → ${merged.length} after dedup`);

      this._dbArtifactsCache = merged;
      this._dbArtifactsCacheTime = Date.now();
      return merged;
    } catch (error) {
      console.error('Error fetching DB artifacts:', error);
      return null;
    }
  }

  /**
   * Start the automatic promotion cycle
   */
  startPromotionCycle() {
    console.log('🤖 AI Promotion Service started - analyzing market content every 30 minutes');
    
    this.runPromotionAnalysis();
    
    setInterval(() => {
      this.runPromotionAnalysis();
    }, 30 * 60 * 1000);
  }

  /**
   * Run comprehensive promotion analysis
   */
  async runPromotionAnalysis() {
    try {
      console.log('🔍 Running AI promotion analysis...');
      
      await this.indexMarketCategories();
      await this.analyzeInventoryGaps();
      
      const promotionRecommendations = await this.generatePromotionRecommendations();
      
      await this.executeAutomaticPromotions(promotionRecommendations);
      
      this.updatePerformanceMetrics();
      
      console.log(`✅ AI promotion analysis complete - ${promotionRecommendations.length} actions taken`);
    } catch (error) {
      console.error('AI promotion analysis error:', error);
    }
  }

  /**
   * Index market categories and analyze content distribution
   */
  async indexMarketCategories() {
    if (this.pool) {
      try {
        const dbItems = await this.getDbArtifacts();
        if (dbItems && dbItems.length > 0) {
          this.categoryIndexes.clear();

          const categoryMap = new Map();
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          for (const item of dbItems) {
            const rawCategory = item.category || 'other';
            const normalizedCategory = rawCategory.toLowerCase().trim();

            if (!categoryMap.has(normalizedCategory)) {
              categoryMap.set(normalizedCategory, []);
            }
            categoryMap.get(normalizedCategory).push(item);
          }

          for (const [category, items] of categoryMap) {
            const prices = items
              .map(i => parseFloat(i.price_solar) || 0)
              .filter(p => !isNaN(p));
            const avgPrice = prices.length > 0
              ? prices.reduce((sum, p) => sum + p, 0) / prices.length
              : 0;

            const recentItems = items.filter(i => {
              const createdAt = i.created_at ? new Date(i.created_at) : null;
              return createdAt && createdAt > sevenDaysAgo;
            }).length;

            const categoryAnalysis = {
              totalItems: items.length,
              avgPrice,
              recentItems,
              priceGaps: this.identifyPriceGapsFromDb(items),
              contentGaps: this.identifyContentGapsFromDb(items),
              lastAnalyzed: new Date().toISOString()
            };

            this.categoryIndexes.set(category, categoryAnalysis);
          }

          this.totalArtifactsIndexed = dbItems.length;
          const categoryCount = categoryMap.size;
          console.log(`📊 Indexed ${dbItems.length} artifacts across ${categoryCount} categories from database`);
          return;
        }
      } catch (error) {
        console.error('DB indexing failed, falling back to memberContentService:', error);
      }
    }

    const marketContent = this.memberContentService.getMarketplaceContent();
    
    this.categoryIndexes.clear();
    
    const categories = ['music', 'art', 'documents', 'software', 'videos', 'ebooks', 'templates', 'courses', 'other'];
    
    categories.forEach(category => {
      const categoryContent = marketContent.content.filter(c => c.category === category);
      
      const categoryAnalysis = {
        totalItems: categoryContent.length,
        avgPrice: categoryContent.reduce((sum, c) => sum + c.pricingSolar, 0) / categoryContent.length || 0,
        totalViews: categoryContent.reduce((sum, c) => sum + c.stats.views, 0),
        totalDownloads: categoryContent.reduce((sum, c) => sum + c.stats.downloads, 0),
        avgRating: categoryContent.reduce((sum, c) => sum + this.memberContentService.calculateContentRating(c), 0) / categoryContent.length || 0,
        
        recentUploads: categoryContent.filter(c => 
          new Date(c.uploadDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        highPerformers: categoryContent.filter(c => 
          c.stats.views > 100 || c.stats.downloads > 10
        ),
        
        priceGaps: this.identifyPriceGaps(categoryContent),
        contentGaps: this.identifyContentGaps(categoryContent),
        
        lastAnalyzed: new Date().toISOString()
      };
      
      this.categoryIndexes.set(category, categoryAnalysis);
    });

    this.totalArtifactsIndexed = marketContent.content.length;
    console.log(`📊 Indexed ${categories.length} market categories`);
  }

  /**
   * Identify price gaps from DB items
   */
  identifyPriceGapsFromDb(items) {
    if (items.length === 0) return [];
    
    const prices = items
      .map(i => parseFloat(i.price_solar) || 0)
      .filter(p => p > 0)
      .sort((a, b) => a - b);
    const gaps = [];
    
    for (let i = 1; i < prices.length; i++) {
      const gap = prices[i] - prices[i-1];
      if (gap > 0.005) {
        gaps.push({
          lowerPrice: prices[i-1],
          upperPrice: prices[i],
          gapSize: gap,
          opportunity: 'price_point_opportunity'
        });
      }
    }
    
    return gaps;
  }

  /**
   * Identify content gaps from DB items
   */
  identifyContentGapsFromDb(items) {
    const gaps = [];
    
    const descriptions = items
      .map(i => i.description || '')
      .filter(d => d.length > 0);
    
    const words = {};
    descriptions.forEach(desc => {
      const tokens = desc.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const unique = new Set(tokens);
      unique.forEach(word => {
        words[word] = (words[word] || 0) + 1;
      });
    });

    Object.entries(words).forEach(([word, frequency]) => {
      if (frequency <= 2 && items.length > 10) {
        gaps.push({
          type: 'keyword_gap',
          keyword: word,
          frequency: frequency,
          opportunity: 'underrepresented_subtopic'
        });
      }
    });

    return gaps;
  }

  /**
   * Analyze inventory gaps and opportunities
   */
  async analyzeInventoryGaps() {
    const gapAnalysis = {
      underrepresentedCategories: [],
      overrepresentedCategories: [],
      pricingOpportunities: [],
      qualityGaps: [],
      timeBasedGaps: []
    };

    const totalContent = Array.from(this.categoryIndexes.values())
      .reduce((sum, cat) => sum + cat.totalItems, 0);
    const avgContentPerCategory = totalContent / this.categoryIndexes.size;

    this.categoryIndexes.forEach((analysis, category) => {
      if (analysis.totalItems < avgContentPerCategory * 0.5) {
        gapAnalysis.underrepresentedCategories.push({
          category,
          currentItems: analysis.totalItems,
          opportunity: 'low_competition',
          recommendedActions: ['feature_new_content', 'recruit_creators', 'promotional_incentives']
        });
      } else if (analysis.totalItems > avgContentPerCategory * 2) {
        gapAnalysis.overrepresentedCategories.push({
          category,
          currentItems: analysis.totalItems,
          opportunity: 'high_competition',
          recommendedActions: ['quality_focus', 'price_differentiation', 'niche_targeting']
        });
      }

      const avgRating = analysis.avgRating || 0;

      if (analysis.avgPrice < 0.001 && avgRating > 3) {
        gapAnalysis.pricingOpportunities.push({
          category,
          currentAvgPrice: analysis.avgPrice,
          avgRating: avgRating,
          recommendation: 'price_increase_opportunity'
        });
      }

      if (avgRating > 0 && avgRating < 2.5) {
        gapAnalysis.qualityGaps.push({
          category,
          avgRating: avgRating,
          recommendation: 'quality_improvement_needed'
        });
      }
    });

    this.inventoryGaps = gapAnalysis;
    console.log(`🔍 Inventory gap analysis: ${gapAnalysis.underrepresentedCategories.length} underrepresented categories found`);
  }

  /**
   * Generate AI-powered promotion recommendations
   */
  async generatePromotionRecommendations() {
    const recommendations = [];

    for (const [algorithmName, algorithm] of Object.entries(this.promotionAlgorithms)) {
      try {
        const algorithmRecommendations = await algorithm();
        recommendations.push(...algorithmRecommendations.map(rec => ({
          ...rec,
          algorithm: algorithmName,
          confidence: rec.confidence || 0.7,
          timestamp: new Date().toISOString()
        })));
      } catch (error) {
        console.error(`Error in ${algorithmName} algorithm:`, error);
      }
    }

    recommendations.sort((a, b) => (b.confidence * b.priority) - (a.confidence * a.priority));

    return recommendations.slice(0, 20);
  }

  /**
   * Identify trending content for promotion
   */
  async identifyTrendingContent() {
    const recommendations = [];
    const marketContent = this.memberContentService.getMarketplaceContent();

    marketContent.content.forEach(content => {
      const recentViews = content.stats.views;
      const engagementRate = content.stats.downloads / Math.max(content.stats.views, 1);
      
      if (recentViews > 50 && engagementRate > 0.1) {
        recommendations.push({
          contentId: content.id,
          action: 'feature_trending',
          priority: 0.9,
          confidence: 0.8,
          reasoning: `High engagement rate: ${(engagementRate * 100).toFixed(1)}% with ${recentViews} views`,
          expectedImpact: 'increased_visibility',
          duration: '24_hours'
        });
      }
    });

    return recommendations;
  }

  /**
   * Promote new member content to give visibility boost
   */
  async promoteNewMemberContent() {
    const recommendations = [];
    const marketContent = this.memberContentService.getMarketplaceContent();

    const newContent = marketContent.content.filter(content => {
      const uploadDate = new Date(content.uploadDate);
      const hoursAgo = (Date.now() - uploadDate) / (1000 * 60 * 60);
      return hoursAgo <= 48 && content.stats.views < 10;
    });

    newContent.forEach(content => {
      recommendations.push({
        contentId: content.id,
        action: 'new_member_boost',
        priority: 0.7,
        confidence: 0.9,
        reasoning: 'New member content deserves initial visibility boost',
        expectedImpact: 'member_retention',
        duration: '48_hours'
      });
    });

    return recommendations;
  }

  /**
   * Boost underperforming high-quality content
   */
  async boostUnderperformingContent() {
    const recommendations = [];
    const marketContent = this.memberContentService.getMarketplaceContent();

    marketContent.content.forEach(content => {
      const quality = this.memberContentService.calculateContentRating(content);
      const visibility = content.stats.views;
      
      if (quality >= 4 && visibility < 25) {
        recommendations.push({
          contentId: content.id,
          action: 'quality_boost',
          priority: 0.8,
          confidence: 0.75,
          reasoning: `High quality (${quality}/5) but low visibility (${visibility} views)`,
          expectedImpact: 'discovery_improvement',
          duration: '72_hours'
        });
      }
    });

    return recommendations;
  }

  /**
   * Apply seasonal or time-based promotion logic
   */
  async applySeasonalPromotion() {
    const recommendations = [];
    const currentDate = new Date();
    const hour = currentDate.getHours();
    const dayOfWeek = currentDate.getDay();

    const marketContent = this.memberContentService.getMarketplaceContent();

    if (hour >= 17 && hour <= 23) {
      const musicContent = marketContent.content.filter(c => c.category === 'music');
      musicContent.slice(0, 3).forEach(content => {
        recommendations.push({
          contentId: content.id,
          action: 'time_based_promotion',
          priority: 0.6,
          confidence: 0.6,
          reasoning: 'Music content promotion during evening hours',
          expectedImpact: 'time_optimized_engagement',
          duration: '6_hours'
        });
      });
    }

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const entertainmentContent = marketContent.content.filter(c => 
        c.category === 'videos' || c.category === 'music' || c.category === 'art'
      );
      entertainmentContent.slice(0, 5).forEach(content => {
        recommendations.push({
          contentId: content.id,
          action: 'weekend_promotion',
          priority: 0.7,
          confidence: 0.65,
          reasoning: 'Entertainment content promotion during weekend',
          expectedImpact: 'leisure_time_engagement',
          duration: '48_hours'
        });
      });
    }

    return recommendations;
  }

  /**
   * Find cross-category promotion opportunities
   */
  async findCrossCategoryOpportunities() {
    const recommendations = [];
    const marketContent = this.memberContentService.getMarketplaceContent();

    const memberContent = new Map();
    marketContent.content.forEach(content => {
      if (!memberContent.has(content.memberId)) {
        memberContent.set(content.memberId, []);
      }
      memberContent.get(content.memberId).push(content);
    });

    memberContent.forEach((contents, memberId) => {
      const categories = new Set(contents.map(c => c.category));
      if (categories.size > 1) {
        const bestContent = contents.sort((a, b) => 
          (b.stats.views + b.stats.downloads) - (a.stats.views + a.stats.downloads)
        )[0];

        recommendations.push({
          contentId: bestContent.id,
          action: 'cross_category_promotion',
          priority: 0.6,
          confidence: 0.7,
          reasoning: `Multi-category creator with content in ${categories.size} categories`,
          expectedImpact: 'creator_ecosystem_growth',
          duration: '72_hours'
        });
      }
    });

    return recommendations;
  }

  /**
   * Promote high-quality content to maintain marketplace standards
   */
  async promoteHighQualityContent() {
    const recommendations = [];
    const marketContent = this.memberContentService.getMarketplaceContent();

    const sortedByQuality = marketContent.content
      .map(content => ({
        ...content,
        qualityScore: this.memberContentService.calculateContentRating(content)
      }))
      .sort((a, b) => b.qualityScore - a.qualityScore);

    const top10Percent = sortedByQuality.slice(0, Math.max(1, Math.floor(sortedByQuality.length * 0.1)));

    top10Percent.forEach(content => {
      recommendations.push({
        contentId: content.id,
        action: 'quality_showcase',
        priority: 0.8,
        confidence: 0.9,
        reasoning: `Top quality content (${content.qualityScore}/5) - showcase marketplace standards`,
        expectedImpact: 'brand_quality_positioning',
        duration: '24_hours'
      });
    });

    return recommendations;
  }

  /**
   * Execute automatic promotions based on recommendations
   */
  async executeAutomaticPromotions(recommendations) {
    let executed = 0;

    for (const recommendation of recommendations) {
      try {
        const success = await this.executePromotion(recommendation);
        if (success) {
          executed++;
          
          this.promotionHistory.set(`${recommendation.contentId}_${Date.now()}`, {
            ...recommendation,
            executed: true,
            executedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Failed to execute promotion for ${recommendation.contentId}:`, error);
      }
    }

    console.log(`🚀 Executed ${executed}/${recommendations.length} automatic promotions`);
  }

  /**
   * Execute individual promotion action
   */
  async executePromotion(recommendation) {
    try {
      const { contentId, action, duration } = recommendation;

      const promotionData = {
        featured: action.includes('feature') || action.includes('showcase'),
        autoPromote: true,
        promotionStart: new Date().toISOString(),
        promotionEnd: new Date(Date.now() + this.parseDuration(duration)).toISOString(),
        promotionType: action,
        aiGenerated: true
      };

      const marketContent = this.memberContentService.getMarketplaceContent();
      const content = marketContent.content.find(c => c.id === contentId);
      
      if (!content) {
        console.error(`Content ${contentId} not found for promotion`);
        return false;
      }

      this.memberContentService.updateContentPromotion(contentId, content.memberId, promotionData);

      console.log(`📢 Promoted "${content.title}" with action: ${action}`);
      return true;
    } catch (error) {
      console.error('Promotion execution error:', error);
      return false;
    }
  }

  /**
   * Parse duration string to milliseconds
   */
  parseDuration(duration) {
    const durationMap = {
      '6_hours': 6 * 60 * 60 * 1000,
      '24_hours': 24 * 60 * 60 * 1000,
      '48_hours': 48 * 60 * 60 * 1000,
      '72_hours': 72 * 60 * 60 * 1000
    };
    return durationMap[duration] || 24 * 60 * 60 * 1000;
  }

  /**
   * Update performance metrics for promotion effectiveness
   */
  updatePerformanceMetrics() {
    const now = Date.now();
    const metrics = {
      totalPromotions: this.promotionHistory.size,
      promotionsToday: Array.from(this.promotionHistory.values()).filter(p => 
        new Date(p.executedAt) > new Date(now - 24 * 60 * 60 * 1000)
      ).length,
      algorithmPerformance: {},
      lastUpdated: new Date().toISOString()
    };

    Object.keys(this.promotionAlgorithms).forEach(algorithm => {
      const algorithmPromotions = Array.from(this.promotionHistory.values())
        .filter(p => p.algorithm === algorithm);
      
      metrics.algorithmPerformance[algorithm] = {
        totalExecuted: algorithmPromotions.length,
        avgConfidence: algorithmPromotions.reduce((sum, p) => sum + p.confidence, 0) / algorithmPromotions.length || 0,
        lastUsed: algorithmPromotions.length > 0 ? 
          algorithmPromotions[algorithmPromotions.length - 1].executedAt : null
      };
    });

    this.performanceMetrics.set('current', metrics);
  }

  /**
   * Identify price gaps in category
   */
  identifyPriceGaps(categoryContent) {
    if (categoryContent.length === 0) return [];
    
    const prices = categoryContent.map(c => c.pricingSolar).sort((a, b) => a - b);
    const gaps = [];
    
    for (let i = 1; i < prices.length; i++) {
      const gap = prices[i] - prices[i-1];
      if (gap > 0.005) {
        gaps.push({
          lowerPrice: prices[i-1],
          upperPrice: prices[i],
          gapSize: gap,
          opportunity: 'price_point_opportunity'
        });
      }
    }
    
    return gaps;
  }

  /**
   * Identify content gaps in category
   */
  identifyContentGaps(categoryContent) {
    const gaps = [];
    
    const allTags = categoryContent.flatMap(c => c.tags);
    const tagFrequency = {};
    allTags.forEach(tag => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });

    Object.entries(tagFrequency).forEach(([tag, frequency]) => {
      if (frequency <= 2 && categoryContent.length > 10) {
        gaps.push({
          type: 'tag_gap',
          tag: tag,
          frequency: frequency,
          opportunity: 'underrepresented_subtopic'
        });
      }
    });

    return gaps;
  }

  /**
   * Get current promotion analytics
   */
  getPromotionAnalytics() {
    return {
      categoryIndexes: Object.fromEntries(this.categoryIndexes),
      inventoryGaps: this.inventoryGaps,
      performanceMetrics: this.performanceMetrics.get('current'),
      totalArtifactsIndexed: this.totalArtifactsIndexed,
      recentPromotions: Array.from(this.promotionHistory.values())
        .filter(p => new Date(p.executedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
        .slice(0, 50)
    };
  }

  /**
   * Get AI promotion recommendations for specific content
   */
  getContentPromotionRecommendations(contentId) {
    const marketContent = this.memberContentService.getMarketplaceContent();
    const content = marketContent.content.find(c => c.id === contentId);
    
    if (!content) {
      throw new Error('Content not found');
    }

    const categoryAnalysis = this.categoryIndexes.get(content.category);
    const recommendations = [];

    if (categoryAnalysis) {
      if (categoryAnalysis.totalItems < 10) {
        recommendations.push({
          type: 'category_opportunity',
          message: `Low competition in ${content.category} category - excellent promotion opportunity`,
          action: 'increase_promotion_budget',
          priority: 'high'
        });
      }

      if (content.pricingSolar < categoryAnalysis.avgPrice * 0.8) {
        recommendations.push({
          type: 'pricing_strategy',
          message: 'Content is priced below category average - consider premium positioning',
          action: 'price_optimization',
          priority: 'medium'
        });
      }
    }

    const quality = this.memberContentService.calculateContentRating(content);
    if (quality >= 4) {
      recommendations.push({
        type: 'quality_showcase',
        message: 'High-quality content perfect for featured promotion',
        action: 'feature_content',
        priority: 'high'
      });
    }

    return recommendations;
  }
}

module.exports = AIPromotionService;