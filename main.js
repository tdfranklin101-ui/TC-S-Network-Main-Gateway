/**
 * TC-S Network Foundation Digital Artifact Marketplace
 * Solar-powered Global Basic Income System
 * FileFlow Deployment Version
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// In-memory data storage for the marketplace
let artifacts = [];
let members = [];
let transactions = [];
let solarCounter = {
  totalSolar: 150000000,
  perSecond: 2.5,
  lastUpdate: Date.now()
};

// Solar calculation service
function updateSolarCounter() {
  const now = Date.now();
  const seconds = (now - solarCounter.lastUpdate) / 1000;
  solarCounter.totalSolar += seconds * solarCounter.perSecond;
  solarCounter.lastUpdate = now;
  return solarCounter;
}

// API Routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'TC-S Marketplace',
    timestamp: new Date().toISOString(),
    solarSystem: 'active'
  });
});

// Solar counter API
app.get('/api/solar', (req, res) => {
  const current = updateSolarCounter();
  res.json({
    totalSolar: Math.floor(current.totalSolar),
    perSecond: current.perSecond,
    timestamp: current.lastUpdate
  });
});

// Marketplace artifacts API
app.get('/api/artifacts', (req, res) => {
  res.json({
    artifacts: artifacts,
    total: artifacts.length,
    featured: artifacts.filter(a => a.featured).slice(0, 3)
  });
});

// Add new artifact
app.post('/api/artifacts', upload.single('file'), (req, res) => {
  try {
    const { title, description, solarPrice, creator, category } = req.body;
    
    const artifact = {
      id: Date.now().toString(),
      title: title || 'Digital Artifact',
      description: description || 'AI-curated digital artifact',
      solarPrice: parseInt(solarPrice) || 100,
      creator: creator || 'Anonymous Creator',
      category: category || 'Digital Art',
      featured: Math.random() > 0.7,
      uploadDate: new Date().toISOString(),
      file: req.file ? {
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    };
    
    artifacts.push(artifact);
    
    res.json({
      success: true,
      artifact: artifact,
      message: 'Artifact added to marketplace'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Member management API
app.get('/api/members', (req, res) => {
  res.json({
    members: members.map(m => ({
      id: m.id,
      name: m.name,
      solarBalance: m.solarBalance,
      joinDate: m.joinDate
    })),
    total: members.length
  });
});

// Add new member
app.post('/api/members', (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }
    
    const member = {
      id: Date.now().toString(),
      name: name,
      email: email,
      solarBalance: 1000, // Starting balance
      joinDate: new Date().toISOString(),
      walletAddress: `solar_${Date.now()}`
    };
    
    members.push(member);
    
    res.json({
      success: true,
      member: member,
      message: 'Member added to TC-S Network'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Purchase artifact
app.post('/api/purchase', (req, res) => {
  try {
    const { artifactId, memberId } = req.body;
    
    const artifact = artifacts.find(a => a.id === artifactId);
    const member = members.find(m => m.id === memberId);
    
    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: 'Artifact not found'
      });
    }
    
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }
    
    if (member.solarBalance < artifact.solarPrice) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient SOLAR balance'
      });
    }
    
    // Process transaction
    member.solarBalance -= artifact.solarPrice;
    
    const transaction = {
      id: Date.now().toString(),
      artifactId: artifactId,
      memberId: memberId,
      amount: artifact.solarPrice,
      timestamp: new Date().toISOString(),
      type: 'purchase'
    };
    
    transactions.push(transaction);
    
    res.json({
      success: true,
      transaction: transaction,
      newBalance: member.solarBalance,
      message: 'Purchase completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Transaction history
app.get('/api/transactions', (req, res) => {
  res.json({
    transactions: transactions,
    total: transactions.length
  });
});

// AI Curation endpoint (mock)
app.post('/api/ai-curate', (req, res) => {
  const { content, type } = req.body;
  
  // Mock AI curation response
  const curation = {
    score: Math.random() * 100,
    tags: ['digital', 'renewable', 'sustainable', 'innovative'],
    recommendation: 'Featured',
    aiDescription: `This ${type || 'artifact'} demonstrates innovative digital craftsmanship with strong renewable energy themes.`,
    solarValue: Math.floor(Math.random() * 500) + 50
  };
  
  res.json({
    success: true,
    curation: curation
  });
});

// Root route - serve main marketplace page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      '/health',
      '/api/solar',
      '/api/artifacts',
      '/api/members',
      '/api/purchase',
      '/api/transactions',
      '/api/ai-curate'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 TC-S Network Foundation Digital Artifact Marketplace');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log('⚡ Solar-powered marketplace active');
  console.log('🤖 AI curation system ready');
  console.log('💰 SOLAR ledger initialized');
  console.log('🔗 FileFlow deployment ready');
  
  // Initialize sample data
  initializeSampleData();
});

// Initialize sample marketplace data
function initializeSampleData() {
  // Sample artifacts
  artifacts.push(
    {
      id: '1',
      title: 'Solar Sunrise Digital Art',
      description: 'Beautiful digital artwork capturing the essence of renewable energy',
      solarPrice: 250,
      creator: 'EcoArtist',
      category: 'Digital Art',
      featured: true,
      uploadDate: new Date().toISOString()
    },
    {
      id: '2', 
      title: 'Sustainable Future NFT',
      description: 'A vision of our renewable energy future',
      solarPrice: 500,
      creator: 'FutureVision',
      category: 'NFT',
      featured: true,
      uploadDate: new Date().toISOString()
    },
    {
      id: '3',
      title: 'Clean Energy Music',
      description: 'Ambient sounds inspired by wind and solar power',
      solarPrice: 150,
      creator: 'SolarSound',
      category: 'Audio',
      featured: false,
      uploadDate: new Date().toISOString()
    }
  );
  
  // Sample members
  members.push(
    {
      id: '1',
      name: 'Solar Pioneer',
      email: 'pioneer@tc-s.net',
      solarBalance: 2500,
      joinDate: new Date().toISOString(),
      walletAddress: 'solar_1001'
    },
    {
      id: '2',
      name: 'Renewable Creator',
      email: 'creator@tc-s.net', 
      solarBalance: 1800,
      joinDate: new Date().toISOString(),
      walletAddress: 'solar_1002'
    }
  );
  
  console.log('📊 Sample marketplace data initialized');
  console.log(`   - ${artifacts.length} artifacts available`);
  console.log(`   - ${members.length} members registered`);
}

module.exports = app;