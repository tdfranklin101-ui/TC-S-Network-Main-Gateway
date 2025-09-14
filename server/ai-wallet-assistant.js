/**
 * AI Wallet Assistant for The Current-See Solar Economy Platform
 * 
 * This service provides intelligent wallet management capabilities including:
 * - Solar balance analysis and optimization suggestions
 * - Transaction pattern recognition and fraud detection  
 * - Personalized spending recommendations based on user behavior
 * - Budget coaching with trend analysis
 * - Natural language query processing for wallet operations
 * 
 * Uses GPT-4o model for advanced AI capabilities
 */

import { OpenAI } from 'openai';
import { db } from './db';
import { userProfiles, transactions, contentLibrary, progressions, entitlements } from '@shared/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';

class AIWalletAssistant {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // GPT-4o model for advanced reasoning
    this.model = 'gpt-4o';
    
    // System prompt for wallet assistant
    this.systemPrompt = `
You are an expert AI Wallet Assistant for The Current-See Solar Economy Platform. You help users optimize their Solar token usage, analyze spending patterns, detect potential issues, and make personalized financial recommendations.

Key Platform Context:
- SOLAR tokens are the primary currency
- Users earn SOLAR through content engagement and timer completion
- Users spend SOLAR to unlock premium content (music, features)
- Timer-gated progression system encourages engagement
- Content pricing is dynamic based on demand and user behavior

Your Capabilities:
1. Balance Analysis: Provide insights on Solar balance trends, earning/spending ratios
2. Transaction Analysis: Identify patterns, categorize spending, flag unusual activity
3. Budget Coaching: Suggest spending limits, saving strategies, optimization tips
4. Fraud Detection: Identify suspicious transaction patterns or account activity
5. Content Recommendations: Suggest valuable content based on spending patterns
6. Market Intelligence: Provide insights on content pricing and market trends
7. Natural Language Queries: Answer questions about wallet status, transactions, etc.

Response Format:
Always return structured JSON with the following format:
{
  "type": "analysis|recommendation|alert|query_response",
  "category": "balance|transactions|budget|fraud|content|market",
  "confidence": 0.0-1.0,
  "data": {
    // Specific analysis results
  },
  "insights": [
    "Key insight 1",
    "Key insight 2"
  ],
  "recommendations": [
    {
      "action": "specific_action",
      "priority": "high|medium|low",
      "impact": "description of expected impact",
      "reasoning": "why this recommendation makes sense"
    }
  ],
  "alerts": [
    {
      "severity": "critical|warning|info",
      "message": "alert message",
      "suggested_action": "what user should do"
    }
  ]
}

Be personalized, helpful, and focus on maximizing the user's Solar economy experience.
`;
  }

  /**
   * Analyze user's wallet and provide comprehensive insights
   */
  async analyzeWallet(userId, options = {}) {
    try {
      const timeframe = options.timeframe || 30; // days
      const includeRecommendations = options.includeRecommendations !== false;
      
      // Gather comprehensive user data
      const userData = await this.gatherUserData(userId, timeframe);
      
      if (!userData.profile) {
        return {
          type: 'alert',
          category: 'profile',
          confidence: 1.0,
          alerts: [{
            severity: 'warning',
            message: 'User profile not found',
            suggested_action: 'Please complete user registration'
          }]
        };
      }

      // Create analysis prompt
      const analysisPrompt = `
Analyze this user's wallet and provide comprehensive insights:

USER PROFILE:
- Solar Balance: ${userData.profile.solarBalance}
- Total Earned: ${userData.profile.totalEarned}
- Total Spent: ${userData.profile.totalSpent}
- Account Age: ${userData.accountAge} days
- Last Activity: ${userData.profile.lastActivityAt}

TRANSACTION HISTORY (Last ${timeframe} days):
${JSON.stringify(userData.transactions, null, 2)}

CONTENT ENGAGEMENT:
${JSON.stringify(userData.contentEngagement, null, 2)}

SPENDING PATTERNS:
${JSON.stringify(userData.spendingPatterns, null, 2)}

MARKET CONTEXT:
${JSON.stringify(userData.marketContext, null, 2)}

Provide analysis focusing on:
1. Balance health and earning/spending ratio
2. Transaction patterns and any anomalies
3. Content engagement value optimization
4. Budget coaching recommendations
5. Fraud/security considerations
6. Personalized suggestions for maximizing Solar value

${includeRecommendations ? 'Include specific actionable recommendations.' : 'Focus on analysis only.'}
`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent financial analysis
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      // Add computed metrics
      analysis.computedMetrics = {
        earningSpendingRatio: userData.profile.totalSpent > 0 ? 
          (userData.profile.totalEarned / userData.profile.totalSpent) : 
          userData.profile.totalEarned,
        averageDailySpending: userData.spendingPatterns.averageDailySpending,
        balanceHealthScore: this.calculateBalanceHealthScore(userData.profile),
        contentEngagementScore: this.calculateContentEngagementScore(userData.contentEngagement)
      };

      return analysis;

    } catch (error) {
      console.error('Error in wallet analysis:', error);
      throw new Error(`Wallet analysis failed: ${error.message}`);
    }
  }

  /**
   * Process natural language queries about wallet
   */
  async processQuery(userId, query, context = {}) {
    try {
      // Gather relevant user data
      const userData = await this.gatherUserData(userId, 7); // Last week
      
      const queryPrompt = `
User Query: "${query}"

USER CONTEXT:
- Solar Balance: ${userData.profile?.solarBalance || 0}
- Recent Transactions: ${JSON.stringify(userData.transactions.slice(0, 5), null, 2)}
- Content Activity: ${JSON.stringify(userData.contentEngagement, null, 2)}

Additional Context: ${JSON.stringify(context, null, 2)}

Provide a helpful, conversational response to the user's query. Be specific and actionable.
Format as a natural response but still return structured JSON with insights and recommendations where appropriate.
`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: queryPrompt }
        ],
        temperature: 0.5, // Slightly higher for more conversational responses
        response_format: { type: "json_object" }
      });

      const response = JSON.parse(completion.choices[0].message.content);
      
      // Enhance with real-time data
      response.userData = {
        currentBalance: userData.profile?.solarBalance || 0,
        recentActivity: userData.transactions.length,
        lastTransaction: userData.transactions[0]
      };

      return response;

    } catch (error) {
      console.error('Error processing query:', error);
      throw new Error(`Query processing failed: ${error.message}`);
    }
  }

  /**
   * Detect potential fraud or suspicious activity
   */
  async detectFraudulentActivity(userId, options = {}) {
    try {
      const timeframe = options.timeframe || 7; // days
      const userData = await this.gatherUserData(userId, timeframe);

      const fraudAnalysisPrompt = `
Analyze this user's recent activity for potential fraud or security issues:

TRANSACTIONS (Last ${timeframe} days):
${JSON.stringify(userData.transactions, null, 2)}

BEHAVIORAL PATTERNS:
${JSON.stringify(userData.behaviorPatterns, null, 2)}

ACCOUNT CONTEXT:
- Account Age: ${userData.accountAge} days
- Typical Balance Range: ${userData.profile?.solarBalance || 0}
- Location Patterns: ${JSON.stringify(userData.locationPatterns || {}, null, 2)}

Look for:
1. Unusual spending patterns (frequency, amounts, timing)
2. Suspicious transaction sequences
3. Account access anomalies
4. Behavioral changes that might indicate compromise
5. Patterns consistent with known fraud types

Rate risk level as: CRITICAL, HIGH, MEDIUM, LOW, or NONE
Provide specific evidence for any concerns raised.
`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: fraudAnalysisPrompt }
        ],
        temperature: 0.1, // Very low temperature for consistent security analysis
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(completion.choices[0].message.content);
      
      // Add automated fraud indicators
      analysis.automaticFlags = this.calculateAutomaticFraudFlags(userData);
      
      return analysis;

    } catch (error) {
      console.error('Error in fraud detection:', error);
      throw new Error(`Fraud detection failed: ${error.message}`);
    }
  }

  /**
   * Generate personalized spending recommendations
   */
  async generateSpendingRecommendations(userId, options = {}) {
    try {
      const userData = await this.gatherUserData(userId, 30);
      const marketData = await this.gatherMarketData();

      const recommendationPrompt = `
Generate personalized spending recommendations for this user:

USER DATA:
${JSON.stringify(userData, null, 2)}

MARKET DATA:
${JSON.stringify(marketData, null, 2)}

AVAILABLE CONTENT:
${JSON.stringify(await this.getAvailableContent(userId), null, 2)}

Consider:
1. User's spending patterns and preferences
2. Content they haven't accessed but might enjoy
3. Optimal timing for purchases (market trends)
4. Budget optimization strategies
5. Long-term Solar balance health
6. Value maximization opportunities

Provide specific, actionable recommendations with reasoning and expected outcomes.
`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: recommendationPrompt }
        ],
        temperature: 0.4,
        response_format: { type: "json_object" }
      });

      const recommendations = JSON.parse(completion.choices[0].message.content);
      
      // Add priority scoring
      if (recommendations.recommendations) {
        recommendations.recommendations = recommendations.recommendations.map((rec, index) => ({
          ...rec,
          id: `rec_${Date.now()}_${index}`,
          generated_at: new Date().toISOString(),
          personalization_score: this.calculatePersonalizationScore(rec, userData)
        }));
      }

      return recommendations;

    } catch (error) {
      console.error('Error generating recommendations:', error);
      throw new Error(`Recommendation generation failed: ${error.message}`);
    }
  }

  /**
   * Gather comprehensive user data for analysis
   */
  async gatherUserData(userId, timeframeDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

    try {
      // Gather all relevant data in parallel
      const [profile, transactions, progressions, entitlements, user] = await Promise.all([
        db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
        db.select().from(transactions)
          .where(and(
            eq(transactions.userId, userId),
            gte(transactions.createdAt, cutoffDate)
          ))
          .orderBy(desc(transactions.createdAt)),
        db.select().from(progressions)
          .where(and(
            eq(progressions.userId, userId),
            gte(progressions.createdAt, cutoffDate)
          ))
          .orderBy(desc(progressions.createdAt)),
        db.select().from(entitlements)
          .where(and(
            eq(entitlements.userId, userId),
            gte(entitlements.createdAt, cutoffDate)
          ))
          .orderBy(desc(entitlements.createdAt)),
        db.query.users.findFirst({
          where: (users, { eq }) => eq(users.id, userId)
        })
      ]);

      // Calculate derived metrics
      const spendingPatterns = this.calculateSpendingPatterns(transactions);
      const contentEngagement = this.calculateContentEngagement(progressions, entitlements);
      const behaviorPatterns = this.calculateBehaviorPatterns(transactions, progressions);

      return {
        profile: profile[0] || null,
        user: user || null,
        accountAge: user ? Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)) : 0,
        transactions,
        progressions,
        entitlements,
        spendingPatterns,
        contentEngagement,
        behaviorPatterns,
        marketContext: await this.gatherMarketContext()
      };

    } catch (error) {
      console.error('Error gathering user data:', error);
      throw error;
    }
  }

  /**
   * Calculate spending patterns from transaction data
   */
  calculateSpendingPatterns(transactions) {
    if (!transactions || transactions.length === 0) {
      return {
        totalSpent: 0,
        transactionCount: 0,
        averageTransaction: 0,
        averageDailySpending: 0,
        spendingByCategory: {},
        spendingByTimeOfDay: {},
        spendingTrend: 'stable'
      };
    }

    const solarTransactions = transactions.filter(t => t.currency === 'SOLAR' && t.type === 'solar_spend');
    const totalSpent = solarTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate time-based patterns
    const spendingByHour = {};
    const spendingByDay = {};
    
    solarTransactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const hour = date.getHours();
      const day = date.toDateString();
      
      spendingByHour[hour] = (spendingByHour[hour] || 0) + transaction.amount;
      spendingByDay[day] = (spendingByDay[day] || 0) + transaction.amount;
    });

    return {
      totalSpent,
      transactionCount: solarTransactions.length,
      averageTransaction: solarTransactions.length > 0 ? totalSpent / solarTransactions.length : 0,
      averageDailySpending: Object.keys(spendingByDay).length > 0 ? 
        totalSpent / Object.keys(spendingByDay).length : 0,
      spendingByTimeOfDay: spendingByHour,
      spendingByDay,
      spendingTrend: this.calculateSpendingTrend(spendingByDay)
    };
  }

  /**
   * Calculate content engagement metrics
   */
  calculateContentEngagement(progressions, entitlements) {
    return {
      totalProgressions: progressions.length,
      completedTimers: progressions.filter(p => p.status === 'timer_complete').length,
      contentTypes: [...new Set(progressions.map(p => p.contentType))],
      totalEntitlements: entitlements.length,
      accessTypes: [...new Set(entitlements.map(e => e.accessType))],
      engagementScore: this.calculateEngagementScore(progressions, entitlements)
    };
  }

  /**
   * Calculate behavior patterns
   */
  calculateBehaviorPatterns(transactions, progressions) {
    const patterns = {
      sessionPatterns: {},
      timePatterns: {},
      contentPreferences: {},
      spendingBehavior: 'moderate' // conservative, moderate, aggressive
    };

    // Analyze timing patterns
    const activities = [...transactions, ...progressions].sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    activities.forEach(activity => {
      const hour = new Date(activity.createdAt).getHours();
      patterns.timePatterns[hour] = (patterns.timePatterns[hour] || 0) + 1;
    });

    return patterns;
  }

  /**
   * Calculate balance health score (0-100)
   */
  calculateBalanceHealthScore(profile) {
    if (!profile) return 0;
    
    const balance = profile.solarBalance || 0;
    const earned = profile.totalEarned || 0;
    const spent = profile.totalSpent || 0;
    
    // Factors: balance ratio, earning trend, spending control
    const balanceRatio = earned > 0 ? balance / earned : 0;
    const spendingRatio = earned > 0 ? spent / earned : 0;
    
    let score = 50; // Base score
    
    // Positive factors
    if (balanceRatio > 0.3) score += 20; // Good balance retention
    if (balanceRatio > 0.5) score += 10; // Excellent balance retention
    if (spendingRatio < 0.8) score += 15; // Controlled spending
    if (earned > 100) score += 5; // Active earning
    
    // Negative factors
    if (balanceRatio < 0.1) score -= 20; // Low balance
    if (spendingRatio > 0.9) score -= 15; // High spending
    if (balance < 10) score -= 10; // Very low balance
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate content engagement score
   */
  calculateContentEngagementScore(engagement) {
    if (!engagement) return 0;
    
    let score = 0;
    
    score += Math.min(30, engagement.totalProgressions * 2); // Up to 30 points for progressions
    score += Math.min(25, engagement.completedTimers * 3); // Up to 25 points for completions
    score += Math.min(20, engagement.totalEntitlements * 4); // Up to 20 points for purchases
    score += Math.min(15, engagement.contentTypes.length * 5); // Up to 15 points for variety
    score += Math.min(10, engagement.engagementScore); // Up to 10 points for overall engagement
    
    return Math.min(100, score);
  }

  /**
   * Calculate automatic fraud flags
   */
  calculateAutomaticFraudFlags(userData) {
    const flags = [];
    
    if (!userData.transactions || userData.transactions.length === 0) {
      return flags;
    }
    
    const recentTransactions = userData.transactions.slice(0, 10);
    
    // Check for rapid succession transactions
    for (let i = 1; i < recentTransactions.length; i++) {
      const timeDiff = new Date(recentTransactions[i-1].createdAt) - new Date(recentTransactions[i].createdAt);
      if (timeDiff < 60000) { // Less than 1 minute apart
        flags.push({
          type: 'rapid_succession',
          severity: 'medium',
          details: 'Multiple transactions within 1 minute'
        });
        break;
      }
    }
    
    // Check for unusual amounts
    const amounts = recentTransactions.map(t => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const unusualAmounts = amounts.filter(amount => amount > avgAmount * 3);
    
    if (unusualAmounts.length > 0) {
      flags.push({
        type: 'unusual_amount',
        severity: 'low',
        details: `Transaction amounts significantly higher than average: ${unusualAmounts.join(', ')}`
      });
    }
    
    return flags;
  }

  /**
   * Calculate spending trend
   */
  calculateSpendingTrend(spendingByDay) {
    const days = Object.keys(spendingByDay).sort();
    if (days.length < 3) return 'insufficient_data';
    
    const recent = days.slice(-3).map(day => spendingByDay[day]);
    const older = days.slice(0, 3).map(day => spendingByDay[day]);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.2) return 'increasing';
    if (recentAvg < olderAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(progressions, entitlements) {
    let score = 0;
    score += progressions.filter(p => p.status === 'timer_complete').length * 10;
    score += entitlements.filter(e => e.accessType === 'full').length * 15;
    score += progressions.filter(p => p.status === 'timer_active').length * 5;
    return Math.min(100, score);
  }

  /**
   * Calculate personalization score for recommendations
   */
  calculatePersonalizationScore(recommendation, userData) {
    let score = 0.5; // Base score
    
    // Factor in user's content preferences
    if (userData.contentEngagement && userData.contentEngagement.contentTypes.length > 0) {
      score += 0.2;
    }
    
    // Factor in spending patterns alignment
    if (userData.spendingPatterns && userData.spendingPatterns.averageTransaction > 0) {
      score += 0.2;
    }
    
    // Factor in timing relevance
    const currentHour = new Date().getHours();
    if (userData.behaviorPatterns && userData.behaviorPatterns.timePatterns[currentHour] > 0) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Get available content for recommendations
   */
  async getAvailableContent(userId) {
    try {
      // Get all active content
      const allContent = await db.select().from(contentLibrary)
        .where(eq(contentLibrary.isActive, true))
        .orderBy(contentLibrary.sortOrder);
      
      // Get user's existing entitlements
      const userEntitlements = await db.select().from(entitlements)
        .where(eq(entitlements.userId, userId));
      
      const entitledContentIds = new Set(userEntitlements.map(e => e.contentId));
      
      // Filter out content user already has access to
      return allContent.filter(content => !entitledContentIds.has(content.contentId));
      
    } catch (error) {
      console.error('Error getting available content:', error);
      return [];
    }
  }

  /**
   * Gather market context data
   */
  async gatherMarketContext() {
    try {
      // Get aggregate market data
      const [totalTransactions, activeUsers, popularContent] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(transactions)
          .where(gte(transactions.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
        db.select({ count: sql`count(distinct user_id)` }).from(userProfiles)
          .where(gte(userProfiles.lastActivityAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
        db.select({ 
          contentId: entitlements.contentId, 
          count: sql`count(*)` 
        })
        .from(entitlements)
        .where(gte(entitlements.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .groupBy(entitlements.contentId)
        .orderBy(sql`count(*) desc`)
        .limit(10)
      ]);

      return {
        dailyTransactionVolume: totalTransactions[0]?.count || 0,
        activeUsers24h: activeUsers[0]?.count || 0,
        popularContent: popularContent || [],
        marketTrend: 'stable', // Could be enhanced with more sophisticated analysis
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error gathering market context:', error);
      return {
        dailyTransactionVolume: 0,
        activeUsers24h: 0,
        popularContent: [],
        marketTrend: 'unknown',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Gather comprehensive market data
   */
  async gatherMarketData() {
    return this.gatherMarketContext(); // For now, same as context
  }
}

  // Alias method for API compatibility
  async detectFraud(userId, options = {}) {
    return await this.detectFraudulentActivity(userId, options);
  }

  // Get spending recommendations for user
  async getSpendingRecommendations(userId, options = {}) {
    try {
      const timeframe = options.timeframe || 30;
      const userData = await this.gatherUserData(userId, timeframe);
      
      const prompt = `
Provide personalized spending recommendations for this user:

USER PROFILE:
- Solar Balance: ${userData.profile?.solarBalance || 0}
- Total Earned: ${userData.profile?.totalEarned || 0}
- Total Spent: ${userData.profile?.totalSpent || 0}
- Spending Ratio: ${userData.spendingRatio || 0}

RECENT TRANSACTIONS:
${JSON.stringify(userData.transactions.slice(0, 10), null, 2)}

CONTENT PREFERENCES:
${JSON.stringify(userData.contentEngagement, null, 2)}

Focus on actionable recommendations that maximize value and engagement.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error getting spending recommendations:', error);
      return {
        type: 'recommendation',
        category: 'budget',
        confidence: 0.5,
        recommendations: [
          {
            action: 'budget_solar_spending',
            priority: 'medium',
            impact: 'Better balance management',
            reasoning: 'Default recommendation due to analysis error'
          }
        ]
      };
    }
  }
}

export default AIWalletAssistant;