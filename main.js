/**
 * TC-S Network Foundation Digital Artifact Marketplace
 * FileFlow Deployment Version
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
const LedgerService = require('./server/ledger-service');
const AuthBridge = require('./server/auth-bridge');
const DatabaseService = require('./server/database');

class MarketplaceApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    
    // Initialize services
    this.db = new DatabaseService();
    this.aiCurator = new AICurator();
    this.fileManager = new ArtifactFileManager();
    this.auth = new AuthBridge();
    this.ledger = new LedgerService(this.db);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.db.healthCheck();
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          marketplace: 'active',
          database: health,
          services: {
            aiCurator: 'active',
            ledger: 'active',
            auth: 'active'
          }
        });
      } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
      }
    });

    // Marketplace routes
    this.app.get('/api/artifacts/available', async (req, res) => {
      try {
        const artifacts = await this.db.getArtifacts();
        res.json(artifacts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/market/stats', async (req, res) => {
      try {
        const stats = await this.db.getMarketplaceStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/artifact/:id', async (req, res) => {
      try {
        const artifact = await this.db.getArtifactById(req.params.id);
        if (!artifact) {
          return res.status(404).json({ error: 'Artifact not found' });
        }
        res.json(artifact);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Purchase route
    this.app.post('/api/purchase', this.auth.requireAuth(), async (req, res) => {
      try {
        const { artifactId, userId } = req.body;
        const artifact = await this.db.getArtifactById(artifactId);
        
        if (!artifact) {
          return res.status(404).json({ error: 'Artifact not found' });
        }

        const result = await this.ledger.processPurchase({
          userId: userId || 'demo_user',
          artifactId: artifactId,
          price: artifact.price,
          sellerId: artifact.creatorId
        });

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Balance route
    this.app.get('/api/balance/:userId', async (req, res) => {
      try {
        const balance = await this.ledger.getUserBalance(req.params.userId);
        res.json({ balance, currency: 'SOLAR' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start() {
    try {
      await this.db.init();
      
      this.app.listen(this.port, '0.0.0.0', () => {
        console.log('📊 Marketplace Database initialized with', this.db.artifacts?.length || 0, 'artifacts');
        console.log('🚀 TC-S Network Foundation Digital Artifact Marketplace');
        console.log('🌐 FileFlow Deployment - Running on port', this.port);
        console.log('🤖 AI Curation: Active');
        console.log('📊 Ledger System: Active');
        console.log('🔗 Foundation Bridge: Ready');
        console.log('⚡ FILEFLOW MARKETPLACE - READY FOR USERS');
        console.log('📱 New URL: https://fileflow--tdfranklin101.replit.app');
      });
    } catch (error) {
      console.error('❌ Marketplace startup failed:', error);
      process.exit(1);
    }
  }
}

// Start the marketplace
const marketplace = new MarketplaceApp();
marketplace.start();

module.exports = MarketplaceApp;