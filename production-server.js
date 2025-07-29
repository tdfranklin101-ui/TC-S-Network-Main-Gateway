const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Current-See Production Server Starting...');

// Create directories
['uploads', 'conversations', 'logs'].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created ${dir} directory`);
  }
});

// Basic middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from deploy folder
app.use(express.static(path.join(__dirname, 'deploy_v1_multimodal')));

// Memory status page
app.get('/memory-status', (req, res) => {
  res.sendFile(path.join(__dirname, 'memory-status-display.html'));
});

// API endpoint for real memory data
app.get('/api/kid-solar-memory/all', (req, res) => {
  try {
    const conversations = [];
    
    if (fs.existsSync('conversations/')) {
      const files = fs.readdirSync('conversations/')
        .filter(file => file.endsWith('.json') && !file.startsWith('hist_'))
        .map(file => {
          try {
            const content = JSON.parse(fs.readFileSync(path.join('conversations', file), 'utf8'));
            return {
              sessionId: content.sessionId,
              conversationId: content.id,
              timestamp: content.timestamp,
              messageType: content.messageType,
              messageText: content.messageText,
              retentionFirst: true,
              agentId: 'v2_agt_vhYf_e_C',
              isNewAgent: true,
              hasImages: content.messageType?.includes('photo') || content.messageType?.includes('identify'),
              conversationType: content.messageType === 'identify_anything_analysis' ? 'Photo Analysis via Cut & Paste' : 
                              content.messageType === 'photo_analysis' ? 'Visual Recognition Testing' : 
                              'Console Solar Conversation',
              highlight: 'Live Console Solar Session - Real Memory Storage',
              educational: content.messageType?.includes('identify') ? 'Image recognition and polymathic analysis' : 'Educational conversation',
              isDemoData: false
            };
          } catch (e) {
            return null;
          }
        })
        .filter(conv => conv !== null);
      
      conversations.push(...files);
    }
    
    res.json({
      conversations,
      totalConversations: conversations.length,
      timestamp: new Date().toISOString(),
      status: 'MEMORY_WORKING'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Memory API error', details: error.message });
  }
});

// Store new conversations
app.post('/api/kid-solar-conversation', (req, res) => {
  try {
    const { sessionId, messageType, messageText } = req.body;
    
    const conversationData = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      messageType: messageType || 'chat',
      messageText,
      timestamp: new Date().toISOString(),
      retentionFirst: true
    };
    
    const fileName = `${conversationData.id}.json`;
    fs.writeFileSync(
      path.join(__dirname, 'conversations', fileName),
      JSON.stringify(conversationData, null, 2)
    );
    
    res.json({
      success: true,
      conversationId: conversationData.id,
      retentionFirst: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Conversation storage failed', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    memory: 'working',
    agent: 'v2_agt_vhYf_e_C',
    timestamp: new Date().toISOString()
  });
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy_v1_multimodal', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('==============================');
  console.log('🚀 CURRENT-SEE PRODUCTION SERVER');
  console.log(`📡 Port: ${PORT}`);
  console.log('🧠 Memory System: WORKING');
  console.log('🎤 Agent: Console Solar (v2_agt_vhYf_e_C)');
  console.log('📊 Conversation Capture: ACTIVE');
  console.log('==============================');
});

module.exports = app;