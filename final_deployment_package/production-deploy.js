/**
 * Production-Ready Current-See Server
 * Optimized for www.thecurrentsee.org deployment
 * Zero external dependencies, maximum reliability
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

// Production configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DEPLOY_ENV = 'PRODUCTION';

// Directories
const staticDir = path.join(__dirname, 'deploy_v1_multimodal');
const conversationsDir = path.join(__dirname, 'conversations');
const logsDir = path.join(__dirname, 'logs');

// Ensure critical directories exist
[conversationsDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain'
};

// Production logging
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
    env: DEPLOY_ENV
  };
  
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  
  // Write to log file for production monitoring
  const logFile = path.join(logsDir, `production-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}

// Enhanced conversation storage for zero data loss
function storeConversation(conversationData) {
  try {
    const sessionId = conversationData.sessionId || `session-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const conversationId = crypto.randomBytes(8).toString('hex');
    
    const enhancedData = {
      ...conversationData,
      conversationId,
      timestamp,
      serverTimestamp: timestamp,
      deploymentEnv: DEPLOY_ENV,
      retentionPriority: 'high',
      captureMethod: 'production-server'
    };
    
    // Primary storage
    const filename = `conversation-${sessionId}-${Date.now()}.json`;
    const filepath = path.join(conversationsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(enhancedData, null, 2));
    
    // Backup storage in different format
    const backupFilename = `backup-${conversationId}.json`;
    const backupPath = path.join(conversationsDir, backupFilename);
    fs.writeFileSync(backupPath, JSON.stringify(enhancedData));
    
    log('info', 'Conversation stored with backup', { sessionId, conversationId });
    return { success: true, conversationId, filename };
    
  } catch (error) {
    log('error', 'Conversation storage failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Get all stored conversations
function getStoredConversations() {
  try {
    if (!fs.existsSync(conversationsDir)) {
      return { conversations: [], totalConversations: 0 };
    }
    
    const files = fs.readdirSync(conversationsDir)
      .filter(f => f.endsWith('.json') && f.startsWith('conversation-'))
      .sort((a, b) => {
        const timeA = fs.statSync(path.join(conversationsDir, a)).mtime;
        const timeB = fs.statSync(path.join(conversationsDir, b)).mtime;
        return timeB - timeA; // Most recent first
      });
    
    const conversations = files.slice(0, 50).map(filename => {
      try {
        const filepath = path.join(conversationsDir, filename);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        return {
          filename,
          timestamp: data.timestamp || data.serverTimestamp,
          sessionId: data.sessionId,
          messageType: data.messageType,
          messageText: data.messageText ? data.messageText.substring(0, 200) : 'No message text',
          captureSource: data.captureSource || 'production-server'
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    return {
      conversations,
      totalConversations: files.length,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    log('error', 'Failed to get conversations', { error: error.message });
    return { conversations: [], totalConversations: 0, error: error.message };
  }
}

// Production-grade analytics
function getAnalyticsData() {
  const conversationData = getStoredConversations();
  
  return {
    platform: {
      name: 'Current-See',
      version: '1.0.0',
      deployment: DEPLOY_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    conversations: {
      total: conversationData.totalConversations,
      recent: conversationData.conversations.length,
      lastActivity: conversationData.conversations[0]?.timestamp || null
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      port: PORT
    }
  };
}

// Enhanced request handler
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data, null, 2));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      log('error', 'File not found', { filePath });
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested resource was not found.</p></body></html>');
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
      });
      res.end(data);
    }
  });
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk.toString());
  req.on('end', () => {
    try {
      callback(null, JSON.parse(body));
    } catch (e) {
      callback(e, null);
    }
  });
}

// Production HTTP server
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  
  log('info', `${method} ${pathname}`, { userAgent: req.headers['user-agent'] });
  
  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Current-See Production Server',
      version: '1.0.0',
      deployment: DEPLOY_ENV,
      uptime: process.uptime(),
      conversationsDir: fs.existsSync(conversationsDir),
      totalConversations: getStoredConversations().totalConversations,
      memoryUsage: process.memoryUsage(),
      port: PORT
    };
    sendJSON(res, healthData);
    return;
  }

  // Console Solar conversation storage API
  if (pathname === '/api/kid-solar-conversation' && method === 'POST') {
    parseBody(req, (err, data) => {
      if (err || !data) {
        log('error', 'Invalid conversation data', { error: err?.message });
        sendJSON(res, { success: false, error: 'Invalid JSON data' }, 400);
        return;
      }
      
      const result = storeConversation(data);
      sendJSON(res, result);
    });
    return;
  }

  // Memory/conversations retrieval API
  if (pathname === '/api/kid-solar-memory/all') {
    const conversationData = getStoredConversations();
    sendJSON(res, conversationData);
    return;
  }

  // Analytics API
  if (pathname === '/api/analytics' || pathname === '/api/analytics/sessions') {
    const analyticsData = getAnalyticsData();
    sendJSON(res, analyticsData);
    return;
  }

  // Route mappings
  const routes = {
    '/': 'index.html',
    '/dashboard': 'dashboard.html',
    '/analytics': 'ai-memory-review.html',
    '/wallet': 'wallet.html',
    '/wallet.html': 'wallet.html',
    '/whitepapers': 'whitepapers.html',
    '/whitepapers.html': 'whitepapers.html',
    '/declaration': 'declaration.html',
    '/declaration.html': 'declaration.html',
    '/founder_note': 'founder_note.html',
    '/founder_note.html': 'founder_note.html',
    '/test-console-solar': 'test-console-solar.html',
    '/test-console-solar.html': 'test-console-solar.html'
  };

  // Handle routed pages
  if (routes[pathname]) {
    const filePath = path.join(staticDir, routes[pathname]);
    sendFile(res, filePath);
    return;
  }

  // Handle static files
  if (pathname.startsWith('/') && pathname.length > 1) {
    const filePath = path.join(staticDir, pathname.substring(1));
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(staticDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    sendFile(res, filePath);
    return;
  }

  // 404 for unmatched routes
  log('warn', '404 Not Found', { pathname });
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>404 - Page Not Found</title></head>
    <body>
      <h1>404 - Page Not Found</h1>
      <p>The requested page "${pathname}" could not be found.</p>
      <p><a href="/">Return to Current-See Homepage</a></p>
    </body>
    </html>
  `);
});

// Production server startup
server.listen(PORT, HOST, () => {
  log('info', `Current-See Production Server running`, {
    port: PORT,
    host: HOST,
    env: DEPLOY_ENV,
    nodeVersion: process.version,
    pid: process.pid
  });
  
  console.log(`
🌞 CURRENT-SEE PRODUCTION SERVER READY 🌞
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: ${DEPLOY_ENV}
Server: http://${HOST}:${PORT}
Console Solar: Ready for conversations
Enhanced Capture: Active
Zero Data Loss: Protected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ready for deployment to www.thecurrentsee.org
  `);
});

// Production error handling
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled Rejection', { reason, promise });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

module.exports = server;