import { Router } from 'express';
import { storage } from '../storage';
import { insertTransactionSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Helper function to get user ID
function getUserId(req: any): string | null {
  return req.user?.id || req.session?.userId || null;
}

// Helper function to get session ID
function getSessionId(req: any): string {
  return req.session.id;
}

// Solar payment schema for content unlocking
const solarPaymentSchema = z.object({
  contentId: z.string().min(1),
  contentType: z.string().min(1),
  solarCost: z.number().min(1).max(1000) // 1 to 1000 Solar tokens
});

// Create Solar payment for content access
router.post('/solar-payment', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = getUserId(req);
    
    const { contentId, contentType, solarCost } = solarPaymentSchema.parse(req.body);
    
    // Check if user has enough Solar balance (if they're registered)
    let hasEnoughBalance = true;
    let userProfile = null;
    if (userId) {
      userProfile = await storage.getUserProfile(userId);
      if (!userProfile || (userProfile.solarBalance || 0) < solarCost) {
        hasEnoughBalance = false;
      }
    } else {
      // For anonymous users, allow Solar payment with session tracking
      // This enables demo functionality without registration
      console.log(`Anonymous Solar payment for session: ${sessionId}`);
    }
    
    if (!hasEnoughBalance && userId) {
      return res.status(400).json({
        error: 'Insufficient Solar balance',
        message: `You need ${solarCost} Solar tokens but only have ${userProfile?.solarBalance || 0}`,
        required: solarCost,
        available: userProfile?.solarBalance || 0
      });
    }
    
    // Create Solar transaction record (sessionId stored in metadata for anonymous users)
    const transaction = await storage.createTransaction({
      userId: userId || null,
      type: 'solar_spend',
      amount: solarCost,
      currency: 'SOLAR',
      status: 'completed',
      description: `Solar payment for ${contentType} access: ${contentId}`,
      metadata: {
        sessionId: userId ? null : sessionId, // Store sessionId in metadata for anonymous users
        contentId,
        contentType,
        solarCost,
        paymentMethod: 'solar_balance'
      }
    });
    
    // Deduct Solar from user balance (if registered)
    if (userId && hasEnoughBalance) {
      await storage.updateSolarBalance(userId, -solarCost);
    }
    
    // Create entitlement for the content
    await storage.createEntitlement({
      userId: userId || null,
      sessionId: userId ? null : sessionId,
      contentType,
      contentId,
      accessType: 'full',
      purchaseMethod: 'solar',
      solarCost
    });
    
    console.log(`Solar payment completed: ${solarCost} Solar for ${contentType} ${contentId} (${userId ? 'user: ' + userId : 'session: ' + sessionId})`);
    
    res.json({
      success: true,
      transactionId: transaction.id,
      message: `Access granted! Paid ${solarCost} Solar tokens`,
      solarCost,
      contentId,
      contentType,
      remainingBalance: userId && userProfile ? (userProfile.solarBalance || 0) - solarCost : null
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid payment data',
        message: 'Please check your payment details',
        details: error.errors
      });
    }
    
    console.error('Error processing Solar payment:', error);
    res.status(500).json({
      error: 'Payment processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user's Solar balance and transaction history
router.get('/solar-balance', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.json({
        balance: 0,
        registered: false,
        message: 'Register to track your Solar balance'
      });
    }
    
    const userProfile = await storage.getUserProfile(userId);
    const transactions = await storage.getUserTransactions(userId);
    
    res.json({
      balance: userProfile?.solarBalance || 0,
      totalEarned: userProfile?.totalEarned || 0,
      totalSpent: userProfile?.totalSpent || 0,
      registered: true,
      recentTransactions: transactions.slice(0, 10), // Last 10 transactions
      lastActivity: userProfile?.lastActivityAt
    });
    
  } catch (error) {
    console.error('Error getting Solar balance:', error);
    res.status(500).json({
      error: 'Failed to get balance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get payment status
router.get('/payment-status/:transactionId', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = getUserId(req);
    const { transactionId } = req.params;
    
    // Get transactions for the user or filter by session in metadata
    let transactions;
    if (userId) {
      transactions = await storage.getUserTransactions(userId);
    } else {
      // For anonymous users, return empty transactions for now
      // Full session-based transaction history would require database schema updates
      transactions = [];
    }
    
    const transaction = transactions.find((t: any) => t.id === transactionId);
    
    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found',
        message: 'Payment transaction not found'
      });
    }
    
    res.json({
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt,
      metadata: transaction.metadata
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      error: 'Failed to get payment status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Solar payment system configuration
router.get('/config', (req, res) => {
  res.json({
    paymentSystem: 'solar',
    solarEnabled: true,
    registrationBonus: 100, // New users get 100 Solar tokens
    dailyAllocation: 10, // Daily Solar token allocation
    minimumPayment: 1,
    maximumPayment: 1000,
    message: 'Solar-powered payment system - no external payments required'
  });
});

// Check content access for user/session
router.get('/access/:contentType/:contentId', async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const userId = getUserId(req);
    const { contentType, contentId } = req.params;
    
    // Check for existing entitlement
    let entitlement;
    if (userId) {
      // Check user entitlements using existing storage method
      try {
        entitlement = await storage.getEntitlement(userId, contentType, contentId);
      } catch (error) {
        entitlement = null;
      }
    } else {
      // For anonymous users, check session-based entitlements
      try {
        entitlement = await storage.getEntitlement(sessionId, contentType, contentId);
      } catch (error) {
        entitlement = null;
      }
    }
    
    if (entitlement) {
      res.json({
        hasAccess: true,
        accessType: entitlement.accessType,
        purchaseMethod: entitlement.purchaseMethod,
        grantedAt: entitlement.createdAt
      });
    } else {
      res.json({
        hasAccess: false,
        message: 'Payment required for full access'
      });
    }
    
  } catch (error) {
    console.error('Error checking content access:', error);
    res.status(500).json({
      error: 'Access check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;