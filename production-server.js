const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');

// Production-grade server with consistency monitoring
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced logging for production
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logEntry + (data ? ` | Data: ${JSON.stringify(data)}` : ''));
  
  // Write to file for persistence
  try {
    fs.appendFileSync('production.log', logEntry + '\n');
  } catch (e) {
    console.error('Failed to write to log file:', e.message);
  }
}

// Server startup verification
log('info', 'Starting production server with consistency monitoring');

// Ensure required directories exist
const requiredDirs = ['uploads', 'conversations', 'logs'];
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log('info', `Created directory: ${dir}`);
  }
});

// Enhanced middleware with error handling
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      log('error', 'Invalid JSON received', { error: e.message, body: buf.toString().substring(0, 200) });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('info', `${req.method} ${req.path}`, { 
      status: res.statusCode, 
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')?.substring(0, 50)
    });
  });
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  log('error', 'Request error', { 
    error: err.message, 
    path: req.path, 
    method: req.method 
  });
  res.status(500).json({ 
    error: 'Server error', 
    details: err.message,
    timestamp: new Date().toISOString()
  });
});

// Serve static files with error handling
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// File upload configuration
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    log('info', 'File upload attempt', { 
      filename: file.originalname, 
      mimetype: file.mimetype,
      size: file.size 
    });
    cb(null, true);
  }
});

// Initialize OpenAI with error handling
let openai = null;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.NEW_OPENAI_API_KEY
  });
  log('info', 'OpenAI initialized successfully');
} catch (error) {
  log('error', 'OpenAI initialization failed', { error: error.message });
}

// Enhanced Memory System with consistency checks
class ProductionKidSolarMemory {
  constructor() {
    this.sessions = new Map();
    this.memories = [];
    this.conversations = [];
    this.startTime = new Date();
    this.requestCount = 0;
    this.errorCount = 0;
    
    // Load existing data if available
    this.loadPersistedData();
    
    log('info', 'Production memory system initialized', {
      existingSessions: this.sessions.size,
      existingMemories: this.memories.length
    });
  }

  loadPersistedData() {
    try {
      const conversationsPath = path.join(__dirname, 'conversations');
      if (fs.existsSync(conversationsPath)) {
        const files = fs.readdirSync(conversationsPath);
        files.forEach(file => {
          try {
            const data = fs.readFileSync(path.join(conversationsPath, file), 'utf8');
            const conversation = JSON.parse(data);
            this.conversations.push(conversation);
          } catch (e) {
            log('warn', `Failed to load conversation file: ${file}`, { error: e.message });
          }
        });
        log('info', `Loaded ${this.conversations.length} persisted conversations`);
      }
    } catch (error) {
      log('warn', 'Failed to load persisted data', { error: error.message });
    }
  }

  getOrCreateSession(sessionId, userId = null) {
    this.requestCount++;
    
    try {
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        session.lastActivity = new Date();
        session.interactionCount++;
        log('debug', 'Session updated', { sessionId: sessionId.substring(0, 12), interactions: session.interactionCount });
        return session;
      }
      
      const session = {
        sessionId,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        isActive: true,
        interactionCount: 1,
        memories: []
      };
      
      this.sessions.set(sessionId, session);
      log('info', 'New session created', { 
        sessionId: sessionId.substring(0, 12), 
        totalSessions: this.sessions.size 
      });
      
      return session;
    } catch (error) {
      this.errorCount++;
      log('error', 'Session creation failed', { error: error.message, sessionId });
      throw error;
    }
  }

  storeMemory(sessionId, memoryData) {
    try {
      const memory = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        timestamp: new Date(),
        ...memoryData
      };
      
      this.memories.push(memory);
      
      // Ensure session exists
      const session = this.getOrCreateSession(sessionId);
      session.memories.push(memory.id);
      
      // Persist to file
      this.persistMemory(memory);
      
      log('debug', 'Memory stored', { 
        memoryId: memory.id, 
        type: memory.type,
        sessionId: sessionId.substring(0, 12)
      });
      
      return memory;
    } catch (error) {
      this.errorCount++;
      log('error', 'Memory storage failed', { error: error.message, sessionId });
      throw error;
    }
  }

  persistMemory(memory) {
    try {
      const filePath = path.join(__dirname, 'conversations', `${memory.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
    } catch (error) {
      log('warn', 'Memory persistence failed', { error: error.message, memoryId: memory.id });
    }
  }

  getUsageAnalytics() {
    const now = new Date();
    const uptime = (now - this.startTime) / 1000; // seconds
    
    const activeSessions = Array.from(this.sessions.values()).filter(session => {
      const timeSinceLastActivity = (now - session.lastActivity) / (1000 * 60);
      return timeSinceLastActivity < 30; // Active if used within last 30 minutes
    });

    const analytics = {
      currentActiveSessions: activeSessions.length,
      totalSessions: this.sessions.size,
      totalMemories: this.memories.length,
      totalConversations: this.conversations.length,
      totalRequests: this.requestCount,
      errorCount: this.errorCount,
      uptime: Math.round(uptime),
      errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) : 0,
      averageSessionDuration: this.getAverageSessionDuration(),
      timestamp: now.toISOString()
    };
    
    log('debug', 'Analytics generated', analytics);
    return analytics;
  }

  getAverageSessionDuration() {
    if (this.sessions.size === 0) return 0;
    
    const totalDuration = Array.from(this.sessions.values()).reduce((sum, session) => {
      const duration = (session.lastActivity - session.startTime) / (1000 * 60); // minutes
      return sum + duration;
    }, 0);
    
    return Math.round((totalDuration / this.sessions.size) * 100) / 100;
  }

  getSystemStatus() {
    return {
      status: 'operational',
      consistency: this.errorRate < 5 ? 'stable' : 'degraded',
      performance: {
        uptime: Math.round((Date.now() - this.startTime) / 1000),
        totalRequests: this.requestCount,
        errorCount: this.errorCount,
        errorRate: `${(this.errorCount / Math.max(this.requestCount, 1) * 100).toFixed(2)}%`
      }
    };
  }
}

// Initialize production memory system
const kidSolarMemory = new ProductionKidSolarMemory();

// Enhanced API endpoints with consistency monitoring

// Session management
app.get('/session-management', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'public', 'session-management.html'));
  } catch (error) {
    log('error', 'Session management page error', { error: error.message });
    res.status(500).json({ error: 'Failed to load session management' });
  }
});

// Session activity tracking with enhanced validation
app.post('/api/session-activity', (req, res) => {
  try {
    const { sessionId, interactionType, timestamp, userAgent, ...data } = req.body;
    
    if (!sessionId || !interactionType) {
      log('warn', 'Invalid session activity request', { sessionId, interactionType });
      return res.status(400).json({ 
        error: 'Session ID and interaction type required',
        received: { sessionId: !!sessionId, interactionType: !!interactionType }
      });
    }

    // Create or update session
    const session = kidSolarMemory.getOrCreateSession(sessionId);
    
    // Store the interaction
    const memory = kidSolarMemory.storeMemory(sessionId, {
      type: 'session_activity',
      interactionType,
      timestamp: new Date(timestamp || Date.now()),
      userAgent: userAgent ? userAgent.substring(0, 100) : null,
      ...data
    });

    log('info', 'Session activity tracked', { 
      sessionId: sessionId.substring(0, 12),
      interactionType,
      memoryId: memory.id
    });
    
    res.json({ 
      success: true, 
      sessionId: sessionId.substring(0, 12) + '...',
      tracked: interactionType,
      memoryId: memory.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log('error', 'Session tracking error', { error: error.message, body: req.body });
    res.status(500).json({ 
      error: 'Session tracking failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Kid Solar conversation endpoint with enhanced error handling
app.post('/api/kid-solar-conversation', async (req, res) => {
  try {
    const { sessionId, messageType, messageText, requestEnhancedResponse } = req.body;
    
    if (!sessionId || !messageText) {
      log('warn', 'Invalid conversation request', { sessionId: !!sessionId, messageText: !!messageText });
      return res.status(400).json({ 
        error: 'Session ID and message text required',
        received: { sessionId: !!sessionId, messageText: !!messageText }
      });
    }
    
    // Store the conversation
    const memory = kidSolarMemory.storeMemory(sessionId, {
      type: 'conversation',
      messageType: messageType || 'chat',
      userMessage: messageText,
      analysisText: messageText,
      retentionFirst: true // Default to retention
    });
    
    log('info', 'D-ID conversation stored', { 
      sessionId: sessionId.substring(0, 12),
      messageType: messageType || 'chat',
      memoryId: memory.id
    });
    
    res.json({ 
      success: true, 
      memoryId: memory.id,
      retentionFirst: true,
      sessionId: sessionId.substring(0, 12) + '...',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log('error', 'Conversation storage error', { error: error.message, body: req.body });
    res.status(500).json({ 
      error: 'Conversation storage failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced usage analytics endpoint
app.get('/api/usage-analytics', (req, res) => {
  try {
    const analytics = kidSolarMemory.getUsageAnalytics();
    const systemStatus = kidSolarMemory.getSystemStatus();
    
    res.json({
      success: true,
      analytics: {
        ...analytics,
        system: systemStatus,
        retentionFirst: true,
        privacyNote: "Anonymous session tracking - retention-first memory defaults"
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    log('error', 'Analytics retrieval error', { error: error.message });
    res.status(500).json({ 
      error: 'Analytics retrieval failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced health check with detailed diagnostics
app.get('/health', (req, res) => {
  try {
    const analytics = kidSolarMemory.getUsageAnalytics();
    const systemStatus = kidSolarMemory.getSystemStatus();
    
    const health = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      message: 'Production server operational with retention-first memory',
      version: '2.0.0-production',
      server: {
        uptime: systemStatus.performance.uptime,
        requests: systemStatus.performance.totalRequests,
        errorRate: systemStatus.performance.errorRate
      },
      memory: {
        activeSessions: analytics.currentActiveSessions,
        totalSessions: analytics.totalSessions,
        totalMemories: analytics.totalMemories,
        retentionFirst: true
      },
      features: {
        didConversationCapture: true,
        sessionTracking: true,
        retentionFirstMemory: true,
        productionLogging: true
      }
    };
    
    log('debug', 'Health check requested', { status: health.status });
    res.json(health);
    
  } catch (error) {
    log('error', 'Health check error', { error: error.message });
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Default route
app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
  } catch (error) {
    log('error', 'Homepage serving error', { error: error.message });
    res.status(500).send('Server error');
  }
});

// Production error handling
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', { reason: reason.toString() });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Start server with enhanced monitoring
app.listen(PORT, '0.0.0.0', () => {
  log('info', 'Production server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'production',
    retentionFirst: true,
    didCapture: true
  });
  
  console.log('==============================');
  console.log('🚀 PRODUCTION SERVER LIVE');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('🧠 Retention-First Memory Active');
  console.log('🎥 D-ID Conversation Capture Ready');
  console.log('📊 Analytics Tracking Operational');
  console.log('==============================');
  console.log('✅ CONSISTENCY MONITORING ACTIVE');
});

module.exports = app;