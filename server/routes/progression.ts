import { Router } from 'express';
import { storage } from '../storage';
import { insertProgressionSchema, insertEntitlementSchema, insertTransactionSchema, insertUserProfileSchema, users } from '@shared/schema';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import session from 'express-session';

// Create the missing insertUserSchema
const insertUserSchema = createInsertSchema(users);

// Extend Request interface to include session
declare module 'express-serve-static-core' {
  interface Request {
    session: session.Session & {
      userId?: string;
      id?: string;
    };
    sessionID: string;
  }
}

const router = Router();

// Helper function to get user ID or session ID
function getUserIdentifier(req: any): { userId: string | null, sessionId: string | null } {
  const userId = req.user?.id || null;
  const sessionId = req.session?.id || req.sessionID || null;
  return { userId, sessionId };
}

// Check content access status
router.get('/content/:contentType/:contentId/access', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const { userId, sessionId } = getUserIdentifier(req);
    
    const accessInfo = await storage.canAccessContent(userId, sessionId, contentType, contentId);
    
    res.json({
      canAccess: accessInfo.canAccess,
      accessType: accessInfo.accessType,
      timeRemaining: accessInfo.timeRemaining,
      solarCost: accessInfo.solarCost,
      progression: accessInfo.progression,
      entitlement: accessInfo.entitlement,
      userBalance: accessInfo.userBalance
    });
  } catch (error) {
    console.error('Error checking content access:', error);
    res.status(500).json({ 
      error: 'Failed to check content access',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start timer for content
router.post('/content/:contentType/:contentId/start-timer', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const { userId, sessionId } = getUserIdentifier(req);
    const { duration } = req.body;
    
    if (!duration || duration <= 0) {
      return res.status(400).json({
        error: 'Invalid duration',
        message: 'Timer duration must be a positive number'
      });
    }
    
    const progression = await storage.startTimer(userId, sessionId, contentType, contentId, duration);
    
    res.json({
      success: true,
      progression,
      message: 'Timer started successfully'
    });
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ 
      error: 'Failed to start timer',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Complete timer
router.post('/progression/:progressionId/complete', async (req, res) => {
  try {
    const { progressionId } = req.params;
    
    const progression = await storage.completeTimer(progressionId);
    
    if (!progression) {
      return res.status(404).json({
        error: 'Progression not found',
        message: 'Timer progression not found or already completed'
      });
    }
    
    res.json({
      success: true,
      progression,
      message: 'Timer completed successfully'
    });
  } catch (error) {
    console.error('Error completing timer:', error);
    res.status(500).json({ 
      error: 'Failed to complete timer',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unlock content with Solar payment
router.post('/content/:contentType/:contentId/unlock', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const { userId, sessionId } = getUserIdentifier(req);
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be registered to unlock content with Solar'
      });
    }
    
    const result = await storage.unlockWithSolar(userId, contentType, contentId);
    
    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        message: result.message
      });
    }
    
    res.json({
      success: true,
      entitlement: result.entitlement,
      transaction: result.transaction,
      newBalance: result.newBalance,
      message: 'Content unlocked successfully'
    });
  } catch (error) {
    console.error('Error unlocking content:', error);
    res.status(500).json({ 
      error: 'Failed to unlock content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Register user (for timer-gated progression)
const registerUserSchema = insertUserSchema.extend({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1)
});

router.post('/register', async (req, res) => {
  try {
    const validatedData = registerUserSchema.parse(req.body);
    const { sessionId } = getUserIdentifier(req);
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'An account with this email address already exists'
      });
    }
    
    // Create user
    const user = await storage.createUser(validatedData);
    
    // Create user profile with registration bonus
    const userProfile = await storage.createUserProfile({
      userId: user.id,
      solarBalance: 100, // Registration bonus
      totalEarned: 100,
      registrationBonus: true
    });
    
    // Transfer any existing session progressions to the new user
    if (sessionId) {
      await storage.transferSessionProgressions(sessionId, user.id);
    }
    
    // Set user in session
    if (req.session) {
      req.session.userId = user.id;
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      profile: userProfile,
      message: 'Registration successful! You received 100 Solar as a welcome bonus.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid registration data',
        details: error.errors
      });
    }
    
    console.error('Error registering user:', error);
    res.status(500).json({ 
      error: 'Failed to register user',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const { userId } = getUserIdentifier(req);
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view your profile'
      });
    }
    
    const user = await storage.getUser(userId);
    const profile = await storage.getUserProfile(userId);
    
    if (!user || !profile) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User profile not found'
      });
    }
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      profile: {
        solarBalance: profile.solarBalance,
        totalEarned: profile.totalEarned,
        totalSpent: profile.totalSpent,
        registrationBonus: profile.registrationBonus
      }
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ 
      error: 'Failed to get user profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user progressions
router.get('/progressions', async (req, res) => {
  try {
    const { userId, sessionId } = getUserIdentifier(req);
    
    const progressions = await storage.getUserProgressions(userId, sessionId);
    
    res.json({
      progressions
    });
  } catch (error) {
    console.error('Error getting progressions:', error);
    res.status(500).json({ 
      error: 'Failed to get progressions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user entitlements
router.get('/entitlements', async (req, res) => {
  try {
    const { userId, sessionId } = getUserIdentifier(req);
    
    const entitlements = await storage.getUserEntitlements(userId, sessionId);
    
    res.json({
      entitlements
    });
  } catch (error) {
    console.error('Error getting entitlements:', error);
    res.status(500).json({ 
      error: 'Failed to get entitlements',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;