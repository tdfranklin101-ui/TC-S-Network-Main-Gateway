import { Router } from 'express';
import Stripe from 'stripe';
import { storage } from '../storage';
import { insertTransactionSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Initialize Stripe with secret key
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

if (!stripe) {
  console.warn('Warning: Stripe not initialized - STRIPE_SECRET_KEY not found in environment');
}

// Helper function to get user ID
function getUserId(req: any): string | null {
  return req.user?.id || req.session?.userId || null;
}

// Create Stripe payment intent for Solar top-up
const createPaymentIntentSchema = z.object({
  amount: z.number().min(1).max(100000), // $1 to $1000
  solarAmount: z.number().min(50).max(10000) // 50 to 10,000 Solar tokens
});

router.post('/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error: 'Payment system unavailable',
        message: 'Stripe payment system is not configured'
      });
    }
    
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be registered to purchase Solar tokens'
      });
    }
    
    const { amount, solarAmount } = createPaymentIntentSchema.parse(req.body);
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert dollars to cents
      currency: 'usd',
      metadata: {
        userId,
        solarAmount: solarAmount.toString(),
        purpose: 'solar_topup'
      }
    });
    
    // Create pending transaction record
    const transaction = await storage.createTransaction({
      userId,
      type: 'stripe_topup',
      amount: solarAmount,
      currency: 'USD',
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      description: `Purchase ${solarAmount} Solar tokens for $${amount}`,
      metadata: {
        stripeAmount: amount * 100,
        solarAmount
      }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction.id
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid payment data',
        message: 'Please check your payment amount',
        details: error.errors
      });
    }
    
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Webhook handler for Stripe events
router.post('/stripe-webhook', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).send('Stripe not configured');
    }
    
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err}`);
    }
    
    // Handle payment intent succeeded
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Find the transaction
      const transactions = await storage.getUserTransactions(paymentIntent.metadata.userId);
      const transaction = transactions.find(t => t.stripePaymentIntentId === paymentIntent.id);
      
      if (transaction && transaction.status === 'pending') {
        // Update transaction status
        const updatedTransaction = await storage.updateTransactionStatus(
          transaction.id,
          'completed',
          new Date()
        );
        
        // Add Solar to user balance
        const solarAmount = parseInt(paymentIntent.metadata.solarAmount);
        await storage.updateSolarBalance(paymentIntent.metadata.userId, solarAmount);
        
        console.log(`Payment completed: Added ${solarAmount} Solar to user ${paymentIntent.metadata.userId}`);
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get payment status
router.get('/payment-status/:transactionId', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to check payment status'
      });
    }
    
    const { transactionId } = req.params;
    const transactions = await storage.getUserTransactions(userId);
    const transaction = transactions.find(t => t.id === transactionId);
    
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
      completedAt: transaction.completedAt
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      error: 'Failed to get payment status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get payment configuration (publishable key, etc.)
router.get('/config', (req, res) => {
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    configured: !!stripe && !!process.env.STRIPE_PUBLISHABLE_KEY
  });
});

export default router;