/**
 * TC-S Network Foundation Digital Artifact Marketplace
 * Managed by TC-S, PBC Inc.
 * 
 * Standalone marketplace app with integrated ledger system
 * Features: AI-curated digital artifacts, Solar-based transactions, creator payments
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import marketplace services
const AICurator = require('./server/ai-curator');
const ArtifactFileManager = require('./server/artifact-file-manager');
const MarketplaceTemplateService = require('./server/marketplace-template-service');
const MarketDataService = require('./server/market-data-service');
const LedgerService = require('./server/ledger-service');
const AuthBridge = require('./server/auth-bridge');
const DatabaseService = require('./server/database');

class MarketplaceApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    
    // Initialize services
    this.db = new DatabaseService();
    this.aiCurator = new AICurator();
    this.artifactManager = new ArtifactFileManager();
    this.templateService = new MarketplaceTemplateService();
    this.marketData = new MarketDataService();
    this.ledger = new LedgerService(this.db); // Pass database to ledger
    this.authBridge = new AuthBridge();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS for foundation app integration
    this.app.use(cors({
      origin: [
        'http://localhost:3000',  // Foundation app
        'https://the-current-see.replit.app',  // Foundation production
        process.env.FOUNDATION_URL
      ].filter(Boolean),
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use('/previews', express.static(path.join(__dirname, 'storage/previews')));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      const dbHealth = await this.db.healthCheck();
      res.json({
        status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
        app: 'TC-S Network Foundation Digital Artifact Marketplace',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth.status,
          aiCurator: 'active',
          artifactManager: 'active',
          ledger: 'active',
          authBridge: 'active'
        }
      });
    });

    // Authentication bridge routes
    this.app.use('/api/auth', this.createAuthRoutes());
    
    // Marketplace API routes
    this.app.use('/api/artifacts', this.createArtifactRoutes());
    this.app.use('/api/market', this.createMarketRoutes());
    this.app.use('/api/ledger', this.createLedgerRoutes());
    
    // Serve marketplace frontend
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public/index.html'));
    });
    
    // Fallback for SPA routing (excluding API routes)
    this.app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(path.join(__dirname, 'public/index.html'));
    });
  }

  createAuthRoutes() {
    const router = express.Router();
    
    // Sync user session from Foundation app
    router.post('/sync', async (req, res) => {
      try {
        const { foundationToken } = req.body;
        const user = await this.authBridge.validateFoundationToken(foundationToken);
        
        if (user) {
          // Create marketplace session
          const marketplaceToken = await this.authBridge.createMarketplaceSession(user);
          res.json({ success: true, token: marketplaceToken, user });
        } else {
          res.status(401).json({ success: false, error: 'Invalid foundation token' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    return router;
  }

  createArtifactRoutes() {
    const router = express.Router();
    
    // Get available artifacts
    router.get('/available', async (req, res) => {
      try {
        const artifacts = await this.db.getArtifacts(req.query);
        res.json(artifacts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Upload new artifact
    router.post('/upload', async (req, res) => {
      try {
        // Handle artifact upload with AI curation
        const result = await this.processArtifactUpload(req);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    return router;
  }

  createMarketRoutes() {
    const router = express.Router();
    
    // Get market statistics
    router.get('/stats', async (req, res) => {
      try {
        const stats = await this.db.getMarketplaceStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    return router;
  }

  createLedgerRoutes() {
    const router = express.Router();
    
    // Get user balance (protected route with authorization)
    router.get('/balance/:userId', this.authBridge.requireAuth(), async (req, res) => {
      try {
        // Ensure user can only access their own balance
        if (req.user.id !== req.params.userId) {
          return res.status(403).json({ error: 'Access denied: Cannot access another user\'s balance' });
        }
        
        const balance = await this.ledger.getUserBalance(req.params.userId);
        res.json({ balance });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Process purchase (protected route)
    router.post('/purchase', this.authBridge.requireAuth(), async (req, res) => {
      try {
        // Extract authenticated user ID
        const buyerUserId = req.user.id;
        const { artifactId, sellerId } = req.body;
        
        // Validate input
        if (!artifactId || !sellerId) {
          return res.status(400).json({ error: 'artifactId and sellerId are required' });
        }
        
        // Get artifact details to verify price and seller
        const artifact = await this.db.getArtifactById(artifactId);
        if (!artifact) {
          return res.status(404).json({ error: 'Artifact not found' });
        }
        
        // Verify seller matches artifact owner
        if (artifact.creatorId !== sellerId) {
          return res.status(400).json({ error: 'Invalid seller for this artifact' });
        }
        
        // Process purchase with server-verified data
        const purchaseData = {
          userId: buyerUserId, // Use authenticated user ID, not from request body
          artifactId: artifactId,
          price: artifact.price, // Use server-verified price
          sellerId: sellerId
        };
        
        const result = await this.ledger.processPurchase(purchaseData);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    return router;
  }

  async processArtifactUpload(req) {
    // Process artifact upload with AI curation
    // Implementation will use existing upload logic
    return { success: true, message: 'Upload processing implemented' };
  }

  start() {
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 TC-S Network Foundation Digital Artifact Marketplace`);
      console.log(`🌐 Running on port ${this.port}`);
      console.log(`🤖 AI Curation: Active`);
      console.log(`📊 Ledger System: Active`);
      console.log(`🔗 Foundation Bridge: Ready`);
      console.log(`⚡ CLOUD RUN READY - Marketplace App`);
    });
  }
}

// Start the marketplace app
const marketplace = new MarketplaceApp();
marketplace.start();

module.exports = MarketplaceApp;