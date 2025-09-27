// Dashboard Demo Script - Generate test session data and demonstrate analytics
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// Simple in-memory analytics for demo
const analytics = {
  sessions: new Map(),
  interactions: [],
  startTime: new Date()
};

// Generate sample session IDs
function generateSessionId() {
  return 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Simulate realistic usage data
function generateDemoData() {
  const sessionIds = [];
  
  // Create 5 demo sessions with varying activity
  for (let i = 0; i < 5; i++) {
    const sessionId = generateSessionId();
    const startTime = new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000); // Last 2 hours
    
    analytics.sessions.set(sessionId, {
      sessionId,
      startTime,
      lastActivity: new Date(startTime.getTime() + Math.random() * 30 * 60 * 1000),
      interactionCount: Math.floor(Math.random() * 15) + 1,
      isActive: Math.random() > 0.6
    });
    
    sessionIds.push(sessionId);
  }
  
  // Generate interaction history
  sessionIds.forEach(sessionId => {
    const session = analytics.sessions.get(sessionId);
    const interactionTypes = ['page_view', 'kid_solar_engaged', 'file_upload', 'conversation'];
    
    for (let i = 0; i < session.interactionCount; i++) {
      analytics.interactions.push({
        sessionId,
        type: interactionTypes[Math.floor(Math.random() * interactionTypes.length)],
        timestamp: new Date(session.startTime.getTime() + i * 2 * 60 * 1000), // 2 minutes apart
        userAgent: 'Demo Browser'
      });
    }
  });
  
  console.log(`📊 Generated demo data: ${analytics.sessions.size} sessions, ${analytics.interactions.length} interactions`);
}

// Analytics endpoint
app.get('/api/usage-analytics', (req, res) => {
  const now = new Date();
  const sessionsArray = Array.from(analytics.sessions.values());
  
  // Active sessions (within last 30 minutes)
  const activeSessions = sessionsArray.filter(session => {
    const timeSince = (now - session.lastActivity) / (1000 * 60);
    return timeSince < 30;
  });
  
  // Calculate metrics
  const totalInteractions = analytics.interactions.length;
  const averageDuration = sessionsArray.length > 0 ? 
    sessionsArray.reduce((sum, session) => {
      return sum + ((session.lastActivity - session.startTime) / (1000 * 60));
    }, 0) / sessionsArray.length : 0;
  
  const lastActivity = Math.max(...sessionsArray.map(s => s.lastActivity.getTime()));
  
  res.json({
    success: true,
    analytics: {
      currentActiveSessions: activeSessions.length,
      totalSessions: sessionsArray.length,
      totalInteractions,
      averageSessionDuration: Math.round(averageDuration * 100) / 100,
      totalMemories: analytics.interactions.filter(i => i.type === 'conversation').length,
      lastActivity
    },
    timestamp: now.toISOString(),
    privacyNote: "Anonymous session tracking - no personal identification"
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  const sessionsArray = Array.from(analytics.sessions.values());
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    message: '🚀 Current-See Platform LIVE (Demo Mode)',
    version: '1.0.0-demo',
    usage: {
      activeSessions: sessionsArray.filter(s => s.isActive).length,
      totalSessions: sessionsArray.length,
      totalInteractions: analytics.interactions.length,
      averageSessionDuration: sessionsArray.length > 0 ? 
        Math.round(sessionsArray.reduce((sum, s) => sum + ((s.lastActivity - s.startTime) / (1000 * 60)), 0) / sessionsArray.length * 100) / 100 : 0
    }
  });
});

// Session activity endpoint
app.post('/api/session-activity', (req, res) => {
  const { sessionId, interactionType, timestamp } = req.body;
  
  if (!sessionId || !interactionType) {
    return res.status(400).json({ error: 'Session ID and interaction type required' });
  }
  
  // Update or create session
  let session = analytics.sessions.get(sessionId);
  if (!session) {
    session = {
      sessionId,
      startTime: new Date(timestamp || Date.now()),
      lastActivity: new Date(timestamp || Date.now()),
      interactionCount: 1,
      isActive: true
    };
    analytics.sessions.set(sessionId, session);
  } else {
    session.lastActivity = new Date(timestamp || Date.now());
    session.interactionCount++;
  }
  
  // Record interaction
  analytics.interactions.push({
    sessionId,
    type: interactionType,
    timestamp: new Date(timestamp || Date.now()),
    userAgent: req.headers['user-agent'] || 'Unknown'
  });
  
  console.log(`📊 Tracked: ${sessionId.substring(0, 12)}... -> ${interactionType}`);
  
  res.json({
    success: true,
    sessionId: sessionId.substring(0, 12) + '...',
    tracked: interactionType
  });
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'dashboard.html'));
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Current-See Dashboard Demo',
    endpoints: {
      dashboard: '/dashboard',
      analytics: '/api/usage-analytics',
      health: '/health'
    },
    demoData: {
      sessions: analytics.sessions.size,
      interactions: analytics.interactions.length
    }
  });
});

const PORT = process.env.PORT || 3000;

// Generate demo data on startup
generateDemoData();

app.listen(PORT, '0.0.0.0', () => {
  console.log('==============================');
  console.log('📊 Current-See Dashboard Demo');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🎯 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`📈 Analytics: http://localhost:${PORT}/api/usage-analytics`);
  console.log('==============================');
  console.log('✅ Demo Ready!');
});

module.exports = app;