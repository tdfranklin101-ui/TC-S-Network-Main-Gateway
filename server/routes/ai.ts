import { Router } from 'express';
import { z } from 'zod';

// Import AI services - these are JavaScript modules with default exports
const AIWalletAssistantModule = require('../ai-wallet-assistant.js');
const AIMarketIntelligenceModule = require('../ai-market-intelligence.js');

// Extract the default exports (the classes)
const AIWalletAssistant = AIWalletAssistantModule.default || AIWalletAssistantModule;
const AIMarketIntelligence = AIMarketIntelligenceModule.default || AIMarketIntelligenceModule;

const router = Router();

// Initialize AI services
const aiWalletAssistant = new AIWalletAssistant();
const aiMarketIntelligence = new AIMarketIntelligence();

// Helper function to get user ID
function getUserId(req: any): string | null {
  return req.user?.id || req.session?.userId || null;
}

// Analyze user's wallet
router.get('/wallet/analyze', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to analyze your wallet'
      });
    }
    
    const timeframe = parseInt(req.query.timeframe as string) || 30;
    const analysis = await aiWalletAssistant.analyzeWallet(userId, { timeframe });
    
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing wallet:', error);
    res.status(500).json({
      error: 'Failed to analyze wallet',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get spending recommendations
router.get('/wallet/recommendations', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to get recommendations'
      });
    }
    
    const recommendations = await aiWalletAssistant.getSpendingRecommendations(userId);
    
    res.json({
      recommendations
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detect fraudulent activity
router.get('/wallet/fraud-check', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in for fraud detection'
      });
    }
    
    const fraudCheck = await aiWalletAssistant.detectFraud(userId);
    
    res.json({
      fraudDetected: fraudCheck.fraudDetected,
      riskLevel: fraudCheck.riskLevel,
      alerts: fraudCheck.alerts,
      recommendations: fraudCheck.recommendations
    });
  } catch (error) {
    console.error('Error checking fraud:', error);
    res.status(500).json({
      error: 'Failed to check for fraud',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Query wallet assistant with natural language
const querySchema = z.object({
  query: z.string().min(1).max(500),
  context: z.object({}).optional()
});

router.post('/wallet/query', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to query the wallet assistant'
      });
    }
    
    const { query, context } = querySchema.parse(req.body);
    
    const response = await aiWalletAssistant.processQuery(userId, query, context);
    
    res.json({
      response,
      query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Please provide a valid query',
        details: error.errors
      });
    }
    
    console.error('Error processing wallet query:', error);
    res.status(500).json({
      error: 'Failed to process query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get market intelligence analysis
router.get('/market/analysis', async (req, res) => {
  try {
    const contentType = req.query.contentType as string || 'all';
    const timeframe = parseInt(req.query.timeframe as string) || 7;
    
    const analysis = await aiMarketIntelligence.analyzeMarket(contentType, timeframe);
    
    res.json(analysis);
  } catch (error) {
    console.error('Error getting market analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze market',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get content pricing recommendations
router.get('/market/pricing/:contentType/:contentId', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    
    const pricingData = await aiMarketIntelligence.optimizePricing(contentId, 0, { contentType });
    
    res.json(pricingData);
  } catch (error) {
    console.error('Error getting pricing recommendations:', error);
    res.status(500).json({
      error: 'Failed to get pricing recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get market trends
router.get('/market/trends', async (req, res) => {
  try {
    const timeframe = parseInt(req.query.timeframe as string) || 30;
    
    const trends = await aiMarketIntelligence.generateMarketOverview({ timeframe, includeForecasts: true });
    
    res.json({
      trends,
      timeframe,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting market trends:', error);
    res.status(500).json({
      error: 'Failed to get market trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Chat with market intelligence AI
const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  context: z.object({}).optional()
});

router.post('/market/chat', async (req, res) => {
  try {
    const { message, context } = chatSchema.parse(req.body);
    
    const response = await aiMarketIntelligence.chat(message, context);
    
    res.json({
      response,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid message',
        message: 'Please provide a valid message',
        details: error.errors
      });
    }
    
    console.error('Error processing market chat:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;