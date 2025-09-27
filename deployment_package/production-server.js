/*
 * PRODUCTION SERVER - The Current-See Console Solar Platform
 * Optimized for deployment with immediate conversation capture
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure conversations directory exists
const conversationsDir = path.join(__dirname, 'conversations');
if (!fs.existsSync(conversationsDir)) {
  fs.mkdirSync(conversationsDir, { recursive: true });
}

// Static file serving for deployment package
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Console Solar Platform',
    version: 'v1.0.0',
    conversationsDir: fs.existsSync(conversationsDir),
    totalConversations: fs.readdirSync(conversationsDir).filter(f => f.endsWith('.json')).length
  });
});

// IMMEDIATE Console Solar conversation capture
app.post('/api/kid-solar-conversation', (req, res) => {
  const { sessionId, messageType, messageText, userInput, agentResponse, conversationType, captureSource, captureProof, retentionPriority } = req.body;
  
  try {
    const conversationData = {
      id: req.body.id || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: sessionId || 'unknown',
      timestamp: new Date().toISOString(),
      conversationType: conversationType || 'Console Solar Session', 
      messageType: messageType || 'conversation',
      messageText: messageText || userInput || agentResponse || 'No message content',
      userInput: userInput || null,
      agentResponse: agentResponse || null,
      captureSource: captureSource || 'conversation_api',
      captureProof: captureProof || 'real_session',
      retentionPriority: retentionPriority || 'standard',
      immediateCapture: true,
      sessionProtected: true
    };
    
    const filename = `${conversationData.id}.json`;
    const filepath = path.join(conversationsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(conversationData, null, 2));
    
    console.log(`✅ IMMEDIATE Console Solar conversation stored: ${filename}`);
    console.log(`📝 Content preview: ${(conversationData.messageText || '').substring(0, 100)}...`);
    console.log(`🔒 Session protection: ${conversationData.sessionProtected}, Priority: ${conversationData.retentionPriority}`);
    
    res.json({ 
      success: true, 
      conversationId: conversationData.id,
      message: 'Console Solar conversation captured immediately'
    });
    
  } catch (error) {
    console.error('❌ Failed to store Console Solar conversation:', error);
    res.status(500).json({ error: 'Failed to store conversation' });
  }
});

// Emergency batch storage for session end protection
app.post('/api/kid-solar-conversation-batch', (req, res) => {
  const { sessionId, conversations, flushType } = req.body;
  
  try {
    console.log(`🚨 BATCH STORAGE: ${conversations.length} conversations from ${flushType} flush`);
    
    conversations.forEach(conv => {
      const filename = `${conv.id}.json`;
      const filepath = path.join(conversationsDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(conv, null, 2));
    });
    
    console.log(`✅ EMERGENCY BATCH saved ${conversations.length} Console Solar conversations`);
    res.json({ 
      success: true, 
      saved: conversations.length,
      message: 'Emergency batch storage completed'
    });
    
  } catch (error) {
    console.error('❌ EMERGENCY BATCH storage failed:', error);
    res.status(500).json({ error: 'Emergency batch storage failed' });
  }
});

// Memory API for analytics dashboard
app.get('/api/kid-solar-memory/all', (req, res) => {
  try {
    const conversationFiles = fs.readdirSync(conversationsDir)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        const timeA = fs.statSync(path.join(conversationsDir, a)).mtime;
        const timeB = fs.statSync(path.join(conversationsDir, b)).mtime;
        return timeB - timeA;
      });

    const conversations = conversationFiles.map(file => {
      try {
        const content = fs.readFileSync(path.join(conversationsDir, file), 'utf8');
        return JSON.parse(content);
      } catch (e) {
        console.error(`Error reading conversation file ${file}:`, e);
        return null;
      }
    }).filter(conv => conv !== null);

    const groupedConversations = [];
    const sessionGroups = {};

    conversations.forEach(conv => {
      const sessionId = conv.sessionId || 'unknown';
      if (!sessionGroups[sessionId]) {
        sessionGroups[sessionId] = {
          sessionId,
          messages: [],
          startTime: conv.timestamp,
          lastActivity: conv.timestamp
        };
      }
      sessionGroups[sessionId].messages.push(conv);
      if (conv.timestamp > sessionGroups[sessionId].lastActivity) {
        sessionGroups[sessionId].lastActivity = conv.timestamp;
      }
    });

    Object.values(sessionGroups).forEach(session => {
      session.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const userMessages = session.messages.filter(m => m.messageType === 'user_input');
      const agentMessages = session.messages.filter(m => m.messageType === 'agent_response');
      
      if (userMessages.length > 0 || agentMessages.length > 0) {
        const title = userMessages.length > 0 ? 
          userMessages[0].messageText.substring(0, 50) + '...' :
          'Console Solar Session';
          
        groupedConversations.push({
          id: session.sessionId,
          title,
          type: 'Console Solar Conversation',
          timestamp: session.startTime,
          userMessage: userMessages.length > 0 ? userMessages[0].messageText : '',
          response: agentMessages.length > 0 ? agentMessages[0].messageText : '',
          fullConversation: session.messages
        });
      }
    });

    res.json({
      totalConversations: groupedConversations.length,
      conversations: groupedConversations.slice(0, 50)
    });
    
  } catch (error) {
    console.error('❌ Failed to load Console Solar conversations:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// Analytics route
app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'ai-memory-review.html'));
});

// Serve main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 PRODUCTION SERVER READY FOR DEPLOYMENT');
  console.log(`📡 Console Solar Platform running on port ${PORT}`);
  console.log(`🔒 Immediate conversation capture ACTIVE`);
  console.log(`📁 Conversations directory: ${conversationsDir}`);
  console.log(`✅ Zero data loss protection ENABLED`);
  console.log('');
  console.log('🌟 READY FOR www.thecurrentsee.org DEPLOYMENT');
});

module.exports = app;