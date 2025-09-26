/**
 * Authentication Bridge for TC-S Marketplace
 */

class AuthBridge {
  constructor() {
    this.sessions = new Map();
  }

  async validateFoundationToken(token) {
    // Mock validation for standalone deployment
    return {
      id: 'demo_user',
      name: 'Demo User',
      email: 'demo@tc-s.net'
    };
  }

  async createMarketplaceSession(user) {
    const token = `marketplace_${Date.now()}`;
    this.sessions.set(token, user);
    return token;
  }

  requireAuth() {
    return (req, res, next) => {
      // Mock auth for standalone deployment
      req.user = { id: 'demo_user', name: 'Demo User' };
      next();
    };
  }
}

module.exports = AuthBridge;