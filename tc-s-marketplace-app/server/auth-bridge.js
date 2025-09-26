/**
 * Authentication Bridge Service
 * Handles seamless authentication between Foundation app and Marketplace app
 * Manages token exchange and user session synchronization
 */

const crypto = require('crypto');

class AuthBridge {
  constructor() {
    this.foundationTokens = new Map(); // Store validated Foundation tokens
    this.marketplaceSessions = new Map(); // Store marketplace sessions
    this.tokenExpirationTime = 24 * 60 * 60 * 1000; // 24 hours
    
    console.log('🔗 Authentication Bridge initialized');
  }

  /**
   * Validate token from Foundation app
   */
  async validateFoundationToken(foundationToken) {
    try {
      // In production, this would verify with Foundation app API
      // For now, simulate token validation
      
      if (!foundationToken || foundationToken.length < 10) {
        return null;
      }

      // Simulate Foundation user data
      const userData = {
        id: this.extractUserIdFromToken(foundationToken),
        username: 'foundation_user',
        email: 'user@tc-s.org',
        solarBalance: 10.0000,
        memberSince: '2025-01-01',
        foundationMember: true
      };

      // Cache the validated token
      this.foundationTokens.set(foundationToken, {
        user: userData,
        validatedAt: Date.now()
      });

      return userData;

    } catch (error) {
      console.error('Foundation token validation failed:', error);
      return null;
    }
  }

  /**
   * Create marketplace session for validated Foundation user
   */
  async createMarketplaceSession(user) {
    const sessionToken = this.generateSessionToken();
    
    const session = {
      token: sessionToken,
      userId: user.id,
      user: user,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      foundationSync: true
    };

    this.marketplaceSessions.set(sessionToken, session);
    
    console.log(`🎫 Created marketplace session for user: ${user.username}`);
    return sessionToken;
  }

  /**
   * Validate marketplace session token
   */
  async validateMarketplaceSession(sessionToken) {
    const session = this.marketplaceSessions.get(sessionToken);
    
    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.createdAt > this.tokenExpirationTime) {
      this.marketplaceSessions.delete(sessionToken);
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    
    return session.user;
  }

  /**
   * Sync user data between Foundation and Marketplace
   */
  async syncUserData(userId, updates) {
    try {
      // Update local session data
      for (const [token, session] of this.marketplaceSessions.entries()) {
        if (session.userId === userId) {
          session.user = { ...session.user, ...updates };
        }
      }

      // In production, would sync back to Foundation app
      console.log(`🔄 Synced user data for ${userId}:`, updates);
      
      return true;
    } catch (error) {
      console.error('User data sync failed:', error);
      return false;
    }
  }

  /**
   * Handle user logout
   */
  async logout(sessionToken) {
    const session = this.marketplaceSessions.get(sessionToken);
    
    if (session) {
      this.marketplaceSessions.delete(sessionToken);
      console.log(`👋 User logged out: ${session.user.username}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get active marketplace sessions count
   */
  getActiveSessionsCount() {
    // Clean expired sessions
    const now = Date.now();
    for (const [token, session] of this.marketplaceSessions.entries()) {
      if (now - session.createdAt > this.tokenExpirationTime) {
        this.marketplaceSessions.delete(token);
      }
    }
    
    return this.marketplaceSessions.size;
  }

  /**
   * Generate secure session token
   */
  generateSessionToken() {
    return `mkt_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Extract user ID from Foundation token (simplified)
   */
  extractUserIdFromToken(token) {
    // In production, would properly decode the token
    return `user_${crypto.createHash('md5').update(token).digest('hex').substr(0, 8)}`;
  }

  /**
   * Create authentication URL for Foundation app redirect
   */
  createFoundationAuthUrl(returnUrl = '/') {
    const foundationBaseUrl = process.env.FOUNDATION_URL || 'http://localhost:3000';
    const marketplaceUrl = process.env.MARKETPLACE_URL || 'http://localhost:3001';
    
    const authUrl = new URL('/auth/marketplace', foundationBaseUrl);
    authUrl.searchParams.set('return_to', `${marketplaceUrl}${returnUrl}`);
    
    return authUrl.toString();
  }

  /**
   * Middleware for protecting marketplace routes
   */
  requireAuth() {
    return async (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '') || 
                   req.cookies?.marketplace_session;

      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          authUrl: this.createFoundationAuthUrl(req.originalUrl)
        });
      }

      const user = await this.validateMarketplaceSession(token);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid or expired session',
          authUrl: this.createFoundationAuthUrl(req.originalUrl)
        });
      }

      req.user = user;
      next();
    };
  }
}

module.exports = AuthBridge;