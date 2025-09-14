import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import session from 'express-session';

// Extend Request interface to include user information and session
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
    };
    session: session.Session & {
      userId?: string;
      id?: string;
    };
    sessionID: string;
  }
}

/**
 * Middleware to enforce server-side content protection
 * Checks if user has proper entitlements before allowing access to protected content
 */
export async function enforceContentAccess(contentType: string, contentId: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user/session identifiers
      const userId = req.user?.id || req.session?.userId || null;
      const sessionId = req.session?.id || req.sessionID || null;

      // Check if user can access this content
      const accessInfo = await storage.canAccessContent(userId, sessionId, contentType, contentId);

      // Allow preview access always
      if (accessInfo.accessType === 'preview') {
        req.contentAccess = { 
          type: 'preview', 
          timeLimit: 30, // 30 seconds preview
          solarCost: accessInfo.solarCost 
        };
        return next();
      }

      // Allow full access for unlocked content
      if (accessInfo.accessType === 'full') {
        req.contentAccess = { type: 'full' };
        return next();
      }

      // Allow timer-complete content
      if (accessInfo.accessType === 'timer_complete') {
        req.contentAccess = { 
          type: 'timer_complete', 
          solarCost: accessInfo.solarCost 
        };
        return next();
      }

      // For active timers, allow access but with time limit
      if (accessInfo.accessType === 'timer_active' && accessInfo.timeRemaining) {
        req.contentAccess = { 
          type: 'timer_active', 
          timeRemaining: accessInfo.timeRemaining 
        };
        return next();
      }

      // Locked content - reject with payment options
      return res.status(402).json({
        error: 'Payment Required',
        message: 'This content requires payment or timer completion to access',
        accessType: 'locked',
        solarCost: accessInfo.solarCost,
        options: {
          timer: !userId ? 'Register first to start timer' : 'Start timer progression',
          payment: !userId ? 'Register first to pay with Solar' : `Pay ${accessInfo.solarCost} Solar tokens`,
          topup: !userId ? 'Register for additional Solar' : 'Earn more Solar daily or through platform activities'
        }
      });

    } catch (error) {
      console.error('Content access enforcement error:', error);
      return res.status(500).json({
        error: 'Access check failed',
        message: 'Unable to verify content access permissions'
      });
    }
  };
}

/**
 * Middleware to protect premium music tracks
 */
export const protectMusicTrack = (trackId: string) => {
  return enforceContentAccess('music_track', trackId);
};

/**
 * Middleware to protect premium features
 */
export const protectFeature = (featureId: string) => {
  return enforceContentAccess('feature', featureId);
};

/**
 * General content protection wrapper
 */
export const requireEntitlement = (contentType: string, contentId: string) => {
  return enforceContentAccess(contentType, contentId);
};

// Extend Request type to include contentAccess info
declare global {
  namespace Express {
    interface Request {
      contentAccess?: {
        type: 'preview' | 'timer_active' | 'timer_complete' | 'full';
        timeLimit?: number;
        timeRemaining?: number;
        solarCost?: number;
      };
    }
  }
}