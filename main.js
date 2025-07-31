const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Current-See Production Server',
      version: '1.0.0',
      deployment: 'PRODUCTION',
      uptime: process.uptime(),
      port: PORT
    }));
    return;
  }

  // Homepage route
  if (pathname === '/') {
    const indexPath = path.join(__dirname, 'index.html');
    serveFile(res, indexPath, 'text/html');
    return;
  }

  // Analytics dashboard route
  if (pathname === '/analytics-dashboard') {
    const analyticsPath = path.join(__dirname, 'analytics-dashboard.html');
    serveFile(res, analyticsPath, 'text/html');
    return;
  }

  // Memory review route  
  if (pathname === '/analytics') {
    const memoryPath = path.join(__dirname, 'ai-memory-review.html');
    serveFile(res, memoryPath, 'text/html');
    return;
  }

  // API endpoints
  if (pathname.startsWith('/api/')) {
    
    if (pathname === '/api/members') {
      try {
        const membersDataPath = path.join(__dirname, 'api', 'members.json');
        const membersData = JSON.parse(fs.readFileSync(membersDataPath, 'utf8'));
        
        // Format response to match expected structure
        const response = {
          members: membersData,
          totalMembers: membersData.length,
          lastUpdated: new Date().toISOString()
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        return;
      } catch (error) {
        console.error('Error loading members:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unable to load member data', details: error.message }));
        return;
      }
    }
    
    if (pathname === '/api/solar-clock') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        solarGeneration: Math.floor(Math.random() * 1000000),
        dailyDistribution: 1.0
      }));
      return;
    }

    // D-ID Streaming Conversation Capture Endpoint
    if (pathname === '/api/conversation-stream' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const conversationData = JSON.parse(body);
          
          // Save to conversations directory with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `console_solar_stream_${timestamp}.json`;
          const conversationsDir = path.join(__dirname, 'conversations');
          
          // Create conversations directory if it doesn't exist
          if (!fs.existsSync(conversationsDir)) {
            fs.mkdirSync(conversationsDir, { recursive: true });
          }
          
          const filepath = path.join(conversationsDir, filename);
          fs.writeFileSync(filepath, JSON.stringify(conversationData, null, 2));
          
          console.log(`📡 Streaming conversation saved: ${filename}`);
          console.log(`💬 Content: ${conversationData.content ? conversationData.content.substring(0, 100) : 'No content'}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            success: true, 
            filename: filename,
            timestamp: conversationData.timestamp 
          }));
        } catch (error) {
          console.error('Error saving streaming conversation:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to save conversation data' }));
        }
      });
      return;
    }

    // Kid Solar Memory API - Load streaming conversations for memory page
    if (pathname === '/api/kid-solar-memory/all') {
      try {
        const conversationsDir = path.join(__dirname, 'conversations');
        let conversations = [];
        let totalMessages = 0;
        let uniqueSessions = new Set();

        // Check if conversations directory exists and load streaming conversations
        if (fs.existsSync(conversationsDir)) {
          const files = fs.readdirSync(conversationsDir)
            .filter(f => f.endsWith('.json'))
            .sort((a, b) => {
              // Sort by timestamp in filename (newest first)
              const timeA = a.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
              const timeB = b.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
              if (timeA && timeB) {
                return timeB[1].localeCompare(timeA[1]);
              }
              return b.localeCompare(a);
            });

          // Load conversation files and format for memory page
          files.forEach(filename => {
            try {
              const filepath = path.join(conversationsDir, filename);
              const conversationData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
              
              // Format conversation for memory page display
              const memoryEntry = {
                sessionId: conversationData.id || filename.replace('.json', ''),
                timestamp: conversationData.timestamp || new Date().toISOString(),
                conversationType: getConversationType(conversationData),
                content: conversationData.content || 'Streaming conversation captured',
                source: conversationData.source || 'did_streaming',
                agent_id: conversationData.agent_id || conversationData.metadata?.agent_id || 'console_solar',
                messages: 1,
                filename: filename
              };
              
              conversations.push(memoryEntry);
              totalMessages += memoryEntry.messages;
              uniqueSessions.add(memoryEntry.sessionId);
              
            } catch (fileError) {
              console.log(`Error loading conversation file ${filename}:`, fileError);
            }
          });
        }

        const memoryResponse = {
          totalConversations: conversations.length,
          totalMessages: totalMessages,
          uniqueSessions: uniqueSessions.size,
          conversations: conversations,
          lastUpdated: new Date().toISOString(),
          status: conversations.length > 0 ? 'active' : 'waiting_for_conversations',
          source: 'streaming_capture'
        };

        console.log(`📋 Memory API serving ${conversations.length} streaming conversations`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(memoryResponse));
        return;
        
      } catch (error) {
        console.error('Error loading memory data:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Failed to load memory data',
          totalConversations: 0,
          conversations: [],
          status: 'error'
        }));
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
    return;
  }

  // Static files
  const filePath = path.join(__dirname, pathname);
  
  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    serveFile(res, filePath, contentType);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<h1>404 - Page Not Found</h1>');
});

function serveFile(res, filePath, contentType) {
  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>500 - Internal Server Error</h1>');
  }
}

// Helper function for conversation type detection
function getConversationType(conversationData) {
  if (!conversationData) return 'general';
  
  const content = (conversationData.content || '').toLowerCase();
  const source = (conversationData.source || '').toLowerCase();
  
  if (source.includes('streaming') || source.includes('did')) return 'console_solar_chat';
  if (content.includes('image') || content.includes('photo')) return 'photo_analysis';
  if (content.includes('identify')) return 'identify_anything';
  return 'general_conversation';
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ CURRENT-SEE PRODUCTION SERVER WITH D-ID STREAMING CAPTURE');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log('🎬 D-ID Streaming Features Active:');
  console.log('   📡 /api/conversation-stream - Real-time D-ID capture');
  console.log('   📋 /api/kid-solar-memory/all - Memory page integration');
  console.log('   🗂️  Conversations stored in /conversations/ directory');
  console.log('   🔗 Memory page automatically shows streaming conversations');
  console.log('==============================');
  console.log('🚀 READY FOR WWW.THECURRENTSEE.ORG DEPLOYMENT!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});