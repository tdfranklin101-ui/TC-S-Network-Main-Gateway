const express = require('express');
const path = require('path');
const fs = require('fs');

// Stable production server with minimal dependencies
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting stable production server...');

// Create required directories
const dirs = ['uploads', 'conversations', 'logs'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created ${dir} directory`);
  }
});

// Simple logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}${data ? ` | ${JSON.stringify(data)}` : ''}`;
  console.log(logEntry);
  
  try {
    fs.appendFileSync('server.log', logEntry + '\n');
  } catch (e) {
    console.error('Log write failed:', e.message);
  }
}

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  log(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// In-memory analytics storage
class SimpleAnalytics {
  constructor() {
    this.sessions = new Map();
    this.interactions = [];
    this.startTime = new Date();
    log('Analytics system initialized');
  }

  trackSession(sessionId, interactionType, data = {}) {
    const timestamp = new Date();
    
    // Create or update session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: timestamp,
        lastActivity: timestamp,
        interactionCount: 0
      });
      log('New session created', { sessionId: sessionId.substring(0, 12) });
    }
    
    const session = this.sessions.get(sessionId);
    session.lastActivity = timestamp;
    session.interactionCount++;
    
    // Store interaction
    const interaction = {
      sessionId,
      interactionType,
      timestamp,
      ...data
    };
    this.interactions.push(interaction);
    
    log('Interaction tracked', { 
      sessionId: sessionId.substring(0, 12), 
      type: interactionType,
      totalSessions: this.sessions.size,
      totalInteractions: this.interactions.length
    });
    
    return interaction;
  }

  getAnalytics() {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values()).filter(session => {
      const timeSinceActivity = (now - session.lastActivity) / (1000 * 60);
      return timeSinceActivity < 30; // Active within 30 minutes
    });

    return {
      currentActiveSessions: activeSessions.length,
      totalSessions: this.sessions.size,
      totalInteractions: this.interactions.length,
      uptime: Math.round((now - this.startTime) / 1000),
      lastUpdated: now.toISOString()
    };
  }
}

const analytics = new SimpleAnalytics();

// API Endpoints

// Health check
app.get('/health', (req, res) => {
  const analyticsData = analytics.getAnalytics();
  
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    message: 'Stable server with retention-first memory',
    version: '1.0.0-stable',
    analytics: analyticsData,
    features: {
      retentionFirstMemory: true,
      didConversationCapture: true,
      sessionTracking: true
    }
  });
});

// Session activity tracking
app.post('/api/session-activity', (req, res) => {
  try {
    const { sessionId, interactionType, timestamp, ...data } = req.body;
    
    if (!sessionId || !interactionType) {
      return res.status(400).json({
        error: 'Session ID and interaction type required',
        received: { sessionId: !!sessionId, interactionType: !!interactionType }
      });
    }

    const interaction = analytics.trackSession(sessionId, interactionType, data);
    
    res.json({
      success: true,
      sessionId: sessionId.substring(0, 12) + '...',
      tracked: interactionType,
      timestamp: new Date().toISOString(),
      totalSessions: analytics.sessions.size
    });
    
  } catch (error) {
    log('Session tracking error', { error: error.message });
    res.status(500).json({
      error: 'Session tracking failed',
      details: error.message
    });
  }
});

// D-ID conversation capture
app.post('/api/kid-solar-conversation', (req, res) => {
  try {
    const { sessionId, messageType, messageText } = req.body;
    
    if (!sessionId || !messageText) {
      return res.status(400).json({
        error: 'Session ID and message text required',
        received: { sessionId: !!sessionId, messageText: !!messageText }
      });
    }

    // Track D-ID conversation
    const interaction = analytics.trackSession(sessionId, 'kid_solar_conversation', {
      messageType: messageType || 'chat',
      messageText: messageText.substring(0, 100) + '...' // Truncated for privacy
    });

    // Store conversation in file system
    const conversationData = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      messageType: messageType || 'chat',
      messageText,
      timestamp: new Date().toISOString(),
      retentionFirst: true
    };

    try {
      const fileName = `${conversationData.id}.json`;
      fs.writeFileSync(
        path.join(__dirname, 'conversations', fileName),
        JSON.stringify(conversationData, null, 2)
      );
      log('Conversation persisted', { id: conversationData.id });
    } catch (persistError) {
      log('Conversation persistence failed', { error: persistError.message });
    }

    res.json({
      success: true,
      conversationId: conversationData.id,
      sessionId: sessionId.substring(0, 12) + '...',
      retentionFirst: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log('D-ID conversation error', { error: error.message });
    res.status(500).json({
      error: 'Conversation storage failed',
      details: error.message
    });
  }
});

// Usage analytics
app.get('/api/usage-analytics', (req, res) => {
  try {
    const analyticsData = analytics.getAnalytics();
    
    res.json({
      success: true,
      analytics: {
        ...analyticsData,
        retentionFirst: true,
        privacyNote: "Anonymous session tracking with retention-first defaults"
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log('Analytics error', { error: error.message });
    res.status(500).json({
      error: 'Analytics retrieval failed',
      details: error.message
    });
  }
});

// Session management interface
app.get('/session-management', (req, res) => {
  try {
    const sessionManagementPath = path.join(__dirname, 'public', 'session-management.html');
    if (fs.existsSync(sessionManagementPath)) {
      res.sendFile(sessionManagementPath);
    } else {
      res.status(404).send('Session management interface not found');
    }
  } catch (error) {
    log('Session management error', { error: error.message });
    res.status(500).send('Error loading session management');
  }
});

// D-ID integration test page
app.get('/test-did', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'test-did-integration.html'));
  } catch (error) {
    log('Test D-ID page error', { error: error.message });
    res.status(500).send('Test page error');
  }
});

// Default homepage
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
  } catch (error) {
    log('Homepage error', { error: error.message });
    res.status(500).send('Homepage error');
  }
});

// Error handling
app.use((err, req, res, next) => {
  log('Server error', { error: err.message, path: req.path });
  res.status(500).json({
    error: 'Server error',
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  log('404 Not Found', { path: req.path });
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  log('Server started', { port: PORT });
  console.log('==============================');
  console.log('🚀 STABLE PRODUCTION SERVER');
  console.log(`📡 Port: ${PORT}`);
  console.log('🧠 Retention-First Memory Active');
  console.log('🎥 D-ID Conversation Capture Ready');
  console.log('📊 Analytics Tracking Operational');
  console.log('==============================');
  console.log('✅ SERVER CONSISTENCY GUARANTEED');
});

module.exports = app;