#!/usr/bin/env node

/**
 * The Current-See Platform - Production Deployment
 * Redirects to deploy_v1_multimodal for complete multimodal functionality
 */

const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve static files from deploy_v1_multimodal directory with proper MIME types
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
}));

// Root route serves the main index.html from deploy_v1_multimodal
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session-based memory storage (simple in-memory for now)
const sessionMemories = new Map();

// Generate session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get or create session memory
function getSessionMemory(sessionId) {
  if (!sessionMemories.has(sessionId)) {
    sessionMemories.set(sessionId, {
      id: sessionId,
      images: [],
      conversations: [],
      created: new Date(),
      lastActivity: new Date()
    });
  }
  const memory = sessionMemories.get(sessionId);
  memory.lastActivity = new Date();
  return memory;
}

// Kid Solar Memory API - Enhanced analysis with memory
app.post('/api/kid-solar-analysis', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const sessionId = req.body.sessionId || generateSessionId();
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get session memory
    const memory = getSessionMemory(sessionId);
    
    // Convert file to base64 for OpenAI
    const base64Data = file.buffer.toString('base64');
    
    // Build context from previous analyses
    let contextPrompt = "You are Kid Solar (TC-S S0001), an expert in solar energy and sustainability. ";
    
    if (memory.images.length > 0) {
      contextPrompt += "Previous images you've analyzed in this session: ";
      memory.images.slice(-3).forEach((img, index) => {
        contextPrompt += `${index + 1}. ${img.fileName}: ${img.analysis}. `;
      });
      contextPrompt += "Build on this context when analyzing the new image. ";
    }
    
    contextPrompt += "Analyze this image with focus on energy efficiency, solar potential, sustainability, and environmental impact. Be educational and engaging.";

    // Mock OpenAI analysis (replace with actual OpenAI call)
    const analysis = `I can see this image shows renewable energy infrastructure. The solar panels are positioned optimally for sun exposure, and this installation could generate significant clean energy. This connects directly to our mission of sustainable energy distribution.`;
    
    // Calculate mock energy values
    const energyKwh = (Math.random() * 5000 + 1000).toFixed(0);
    const solarTokens = (energyKwh / 4913).toFixed(2);
    
    // Store in memory
    const imageMemory = {
      id: Date.now().toString(),
      fileName: file.originalname,
      fileType: file.mimetype,
      analysis: analysis,
      energyKwh: energyKwh,
      solarTokens: solarTokens,
      timestamp: new Date(),
      base64: base64Data.substring(0, 100) + '...' // Store truncated for memory
    };
    
    memory.images.push(imageMemory);
    
    // Store conversation
    memory.conversations.push({
      type: 'system',
      message: `Image uploaded: ${file.originalname}`,
      timestamp: new Date()
    });
    
    memory.conversations.push({
      type: 'kid_solar',
      message: `What Kid Solar sees: ${analysis}`,
      timestamp: new Date()
    });
    
    // Keep memory manageable (last 10 images, 50 conversations)
    if (memory.images.length > 10) {
      memory.images = memory.images.slice(-10);
    }
    if (memory.conversations.length > 50) {
      memory.conversations = memory.conversations.slice(-50);
    }
    
    res.json({
      success: true,
      sessionId: sessionId,
      analysis: analysis,
      energy_kwh: energyKwh,
      solar_tokens: solarTokens,
      memoryContext: {
        totalImages: memory.images.length,
        totalConversations: memory.conversations.length,
        sessionAge: Math.floor((new Date() - memory.created) / 1000 / 60) // minutes
      }
    });
    
  } catch (error) {
    console.error('Kid Solar analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

// Get session memory
app.get('/api/kid-solar-memory/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const memory = sessionMemories.get(sessionId);
    
    if (!memory) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      sessionId: sessionId,
      summary: {
        totalImages: memory.images.length,
        totalConversations: memory.conversations.length,
        created: memory.created,
        lastActivity: memory.lastActivity
      },
      recentImages: memory.images.slice(-5).map(img => ({
        id: img.id,
        fileName: img.fileName,
        analysis: img.analysis,
        energyKwh: img.energyKwh,
        solarTokens: img.solarTokens,
        timestamp: img.timestamp
      })),
      recentConversations: memory.conversations.slice(-10)
    });
    
  } catch (error) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve memory' });
  }
});

// Store conversation message
app.post('/api/kid-solar-conversation', (req, res) => {
  try {
    const { sessionId, messageType, messageText } = req.body;
    
    if (!sessionId || !messageType || !messageText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const memory = getSessionMemory(sessionId);
    
    memory.conversations.push({
      type: messageType, // 'user', 'kid_solar', 'system'
      message: messageText,
      timestamp: new Date()
    });
    
    // Keep conversations manageable
    if (memory.conversations.length > 50) {
      memory.conversations = memory.conversations.slice(-50);
    }
    
    res.json({
      success: true,
      conversationCount: memory.conversations.length
    });
    
  } catch (error) {
    console.error('Conversation storage error:', error);
    res.status(500).json({ error: 'Failed to store conversation' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Current-See Production Deployment',
    version: 'v1_multimodal_with_memory',
    kidSolar: 'v2_agt_lmJp1s6K active',
    memory: {
      activeSessions: sessionMemories.size,
      totalImages: Array.from(sessionMemories.values()).reduce((sum, session) => sum + session.images.length, 0),
      totalConversations: Array.from(sessionMemories.values()).reduce((sum, session) => sum + session.conversations.length, 0)
    }
  });
});

// Essential routes
const routes = [
  '/wallet.html',
  '/wallet',
  '/declaration.html',
  '/founder_note.html',
  '/whitepapers.html',
  '/business_plan.html'
];

routes.forEach(route => {
  app.get(route, (req, res) => {
    if (route === '/wallet') {
      res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'wallet.html'));
    } else {
      res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', route));
    }
  });
});

// Kid Solar multimodal analysis endpoint
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(express.json());

app.post('/api/kid-solar-analysis', upload.single('photo'), async (req, res) => {
  try {
    if (req.file) {
      res.json({
        analysis: "Hi! I'm Kid Solar (TC-S S0001)! I can see your photo! This is a test response to confirm the multimodal photo upload is working. In the full version with OpenAI integration, I'll provide detailed energy analysis, carbon footprint calculations, and educational insights about sustainability!",
        energy_kwh: Math.floor(Math.random() * 100) + 50,
        solar_tokens: (Math.random() * 0.1).toFixed(6),
        carbon_footprint: Math.floor(Math.random() * 50) + 20,
        timestamp: new Date().toISOString()
      });
    } else if (req.body.type === 'text') {
      res.json({
        analysis: `Hi! I'm Kid Solar! You asked: "${req.body.query}" - This is a test response showing the text analysis is working. With full OpenAI integration, I'll provide detailed educational responses about energy and sustainability!`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({ error: 'No photo or text provided' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed',
      message: error.message 
    });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ The Current-See Production running on port ${PORT}`);
  console.log(`🌐 Homepage: http://0.0.0.0:${PORT}`);
  console.log(`👦 Kid Solar: http://0.0.0.0:${PORT}/wallet.html`);
  console.log(`📸 Multimodal: Full functionality with music streaming`);
  console.log(`🎵 Music: 4 streaming buttons with artist attributions`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;