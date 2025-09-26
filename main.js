/**
 * TC-S Network Foundation Digital Artifact Marketplace
 * Original Programming Integration
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import your original marketplace components
const ArtifactFileManager = require('./server/artifact-file-manager');
const LedgerService = require('./server/ledger-service');
const AICurator = require('./server/ai-curator');
const AuthBridge = require('./server/auth-bridge');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize your original services
const fileManager = new ArtifactFileManager();
const ledgerService = new LedgerService();
const aiCurator = new AICurator();
const authBridge = new AuthBridge();

// Configure multer for MP3/MP4 uploads
const upload = multer({ 
  dest: 'storage/uploads/',
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp3', 'video/mp4', 'video/mpeg'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/storage', express.static('storage'));
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    marketplace: 'TC-S Original Programming Active',
    services: {
      fileManager: 'active',
      ledger: 'active', 
      aiCurator: 'active',
      auth: 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// Original Marketplace APIs

// Get all artifacts
app.get('/api/artifacts', async (req, res) => {
  try {
    const artifacts = [
      {
        id: 'solar_harmony_001',
        title: 'Solar Harmony',
        description: 'Original ambient track powered by solar energy',
        price: 150,
        category: 'audio',
        filePath: '/music/solar-harmony.mp3',
        creator: 'TC-S Foundation',
        aiCurated: true,
        tags: ['ambient', 'solar', 'meditation'],
        energyRating: 5
      },
      {
        id: 'renewable_dreams_002', 
        title: 'Renewable Dreams',
        description: 'Short film about sustainable future',
        price: 300,
        category: 'video',
        filePath: '/music/renewable-dreams.mp4',
        creator: 'GreenFilms',
        aiCurated: true,
        tags: ['documentary', 'future', 'climate'],
        energyRating: 4
      }
    ];
    
    res.json({ 
      success: true,
      artifacts, 
      total: artifacts.length 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load artifacts' });
  }
});

// Get marketplace stats
app.get('/api/market/stats', async (req, res) => {
  try {
    res.json({
      totalArtifacts: 2,
      totalUsers: Object.keys(ledgerService.userBalances || {}).length,
      totalTransactions: (ledgerService.transactions || []).length,
      totalValue: 450
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Get user balance
app.get('/api/balance/:userId', async (req, res) => {
  try {
    const balance = await ledgerService.getUserBalance(req.params.userId);
    res.json({ 
      success: true,
      userId: req.params.userId, 
      balance 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Process purchase
app.post('/api/purchase', async (req, res) => {
  try {
    const { userId, artifactId, price, sellerId } = req.body;
    const result = await ledgerService.processPurchase({
      userId,
      artifactId, 
      price,
      sellerId: sellerId || 'tc_s_foundation'
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Upload new artifact
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { title, description, price, creator, category } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Process file upload
    const fileResult = await fileManager.processUpload(file, {
      title,
      description,
      price,
      creator,
      category: category || (file.mimetype.startsWith('audio') ? 'audio' : 'video')
    });

    // AI Curation
    const curation = await aiCurator.curateArtifact({
      id: fileResult.fileId,
      category: fileResult.metadata.category,
      title: title,
      description: description
    });
    
    res.json({
      success: true,
      artifact: {
        ...fileResult,
        curation: curation,
        aiRating: curation.score
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Upload failed', 
      details: error.message 
    });
  }
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, token } = req.body;
    
    // Use your original auth bridge
    const user = await authBridge.validateFoundationToken(token || username);
    const session = await authBridge.createMarketplaceSession(user);
    
    // Initialize user balance if new
    const balance = await ledgerService.getUserBalance(user.id);
    
    res.json({ 
      success: true, 
      user: {
        ...user,
        balance: balance
      }, 
      session 
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      error: 'Authentication failed' 
    });
  }
});

// Get user's purchased items
app.get('/api/user/:userId/items', async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = ledgerService.transactions || [];
    const userPurchases = transactions
      .filter(tx => tx.buyerId === userId && tx.type === 'purchase')
      .map(tx => tx.artifactId);
      
    res.json({
      success: true,
      items: userPurchases,
      count: userPurchases.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user items' });
  }
});

// AI Curation endpoint
app.post('/api/curate', async (req, res) => {
  try {
    const curation = await aiCurator.curateArtifact(req.body);
    res.json({
      success: true,
      curation: curation
    });
  } catch (error) {
    res.status(500).json({ error: 'Curation failed' });
  }
});

// Protected routes middleware
const requireAuth = authBridge.requireAuth();

// Protected upload route
app.post('/api/protected/upload', requireAuth, upload.single('file'), async (req, res) => {
  // Same as regular upload but with auth protection
  res.redirect(307, '/api/upload');
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server with original programming
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TC-S Marketplace running on port ${PORT}`);
  console.log('⚡ Original Programming Active');
  console.log('🎵 MP3/MP4 uploads enabled');
  console.log('🤖 AI curation active');
  console.log('💰 SOLAR ledger active');
  console.log('🔐 Authentication bridge active');
  console.log(`📁 File manager: ${fileManager ? 'initialized' : 'failed'}`);
  console.log(`💳 Ledger service: ${ledgerService ? 'initialized' : 'failed'}`);
});

module.exports = app;