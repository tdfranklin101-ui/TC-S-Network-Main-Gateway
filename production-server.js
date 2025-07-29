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

// Enhanced memory API that forces real data display
app.get('/api/kid-solar-memory/all', (req, res) => {
  console.log('🔍 Memory API called - checking for real conversations...');
  
  try {
    const conversations = [];
    const conversationsDir = path.join(__dirname, 'conversations');
    
    if (fs.existsSync(conversationsDir)) {
      const files = fs.readdirSync(conversationsDir)
        .filter(file => file.endsWith('.json') && !file.startsWith('hist_'))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first
      
      console.log(`📊 Found ${files.length} conversation files`);
      
      files.forEach(file => {
        try {
          const filePath = path.join(conversationsDir, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          const conversation = {
            id: content.id || file.replace('.json', ''),
            sessionId: content.sessionId || 'unknown-session',
            timestamp: content.timestamp || new Date().toISOString(),
            conversationType: content.messageType === 'identify_anything_analysis' ? 'Photo Analysis via Cut & Paste' :
                            content.messageType === 'photo_analysis' ? 'Visual Recognition Testing' :
                            content.messageType === 'did_conversation' ? 'D-ID Voice Chat' :
                            'Console Solar Conversation',
            messageType: content.messageType || 'general',
            preview: content.messageText || 'Conversation content',
            fullConversation: content.messageText || 'No content available',
            messageText: content.messageText || 'No content available',
            retentionFirst: true,
            hasImages: content.messageType?.includes('photo') || content.messageType?.includes('identify') || false,
            agentId: 'v2_agt_vhYf_e_C',
            agentDescription: 'Console Solar - Kid Solar',
            highlight: 'Live Console Solar Session - Real Memory Storage',
            educational: content.messageType?.includes('identify') ? 'Image recognition and polymathic analysis' :
                        content.messageType?.includes('did') ? 'Voice and animation interaction' :
                        'Educational conversation with Kid Solar',
            messages: 1,
            isDemoData: false,
            isRealConversation: true
          };
          
          conversations.push(conversation);
          console.log(`✅ Added conversation: ${conversation.conversationType}`);
          
        } catch (e) {
          console.error(`❌ Error reading ${file}:`, e.message);
        }
      });
    }
    
    // Add system status if no conversations
    if (conversations.length === 0) {
      conversations.push({
        id: 'system-status-1',
        sessionId: 'memory-system-active',
        timestamp: new Date().toISOString(),
        conversationType: 'Memory System Status',
        messageType: 'system_status',
        preview: 'Memory system is monitoring for Console Solar conversations',
        fullConversation: 'Memory capture system is active and ready to store new D-ID conversations with Console Solar agent (v2_agt_vhYf_e_C).',
        messageText: 'Memory capture system is active and ready to store new D-ID conversations with Console Solar agent (v2_agt_vhYf_e_C).',
        retentionFirst: true,
        hasImages: false,
        agentId: 'v2_agt_vhYf_e_C',
        highlight: 'Memory System Active',
        educational: 'System ready for conversation capture',
        messages: 1,
        isDemoData: false,
        isRealConversation: false
      });
    }
    
    const response = {
      conversations,
      totalConversations: conversations.length,
      realConversations: conversations.filter(c => c.isRealConversation).length,
      systemConversations: conversations.filter(c => !c.isRealConversation).length,
      timestamp: new Date().toISOString(),
      status: 'WORKING',
      agentVersion: 'v2_agt_vhYf_e_C',
      memorySystem: 'ACTIVE'
    };
    
    console.log('📤 Sending response with', conversations.length, 'conversations');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Memory API error:', error);
    res.status(500).json({ 
      error: 'Memory system error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
app.get('/api/kid-solar-memory/all', (req, res) => {
  try {
    const conversations = [];
    
    // Add real conversation files
    if (fs.existsSync('conversations/')) {
      const files = fs.readdirSync('conversations/')
        .filter(file => file.endsWith('.json') && !file.startsWith('hist_'))
        .map(file => {
          try {
            const content = JSON.parse(fs.readFileSync(path.join('conversations', file), 'utf8'));
            return {
              sessionId: content.sessionId,
              conversationId: content.id || file.replace('.json', ''),
              timestamp: content.timestamp,
              messageType: content.messageType,
              messageText: content.messageText,
              retentionFirst: true,
              agentId: 'v2_agt_vhYf_e_C',
              isNewAgent: true,
              hasImages: content.messageType?.includes('photo') || content.messageType?.includes('identify'),
              conversationType: content.messageType === 'identify_anything_analysis' ? 'Photo Analysis via Cut & Paste' : 
                              content.messageType === 'photo_analysis' ? 'Visual Recognition Testing' : 
                              content.messageType === 'did_conversation' ? 'D-ID Voice Chat' :
                              'Console Solar Conversation',
              highlight: 'Live Console Solar Session - Real Memory Storage',
              educational: content.messageType?.includes('identify') ? 'Image recognition and polymathic analysis' : 
                          content.messageType?.includes('did') ? 'Voice and animation interaction' : 'Educational conversation',
              isDemoData: false
            };
          } catch (e) {
            return null;
          }
        })
        .filter(conv => conv !== null);
      
      conversations.push(...files);
    }
    
    // If no real conversations, create status indicators
    if (conversations.length === 0) {
      conversations.push({
        sessionId: 'system-status',
        conversationId: 'memory-system-active',
        timestamp: new Date().toISOString(),
        messageType: 'system_status',
        messageText: 'Memory system is active and monitoring for new D-ID conversations with Console Solar agent (v2_agt_vhYf_e_C). Real conversations will appear here as they occur.',
        retentionFirst: true,
        agentId: 'v2_agt_vhYf_e_C',
        isNewAgent: true,
        hasImages: false,
        conversationType: 'System Status',
        highlight: 'Memory System Active - Ready for New Conversations',
        educational: 'System monitoring and conversation capture',
        isDemoData: false
      });
    }
    
    // Sort by timestamp, newest first
    conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      conversations,
      totalConversations: conversations.length,
      realConversations: conversations.filter(c => c.messageType !== 'system_status').length,
      timestamp: new Date().toISOString(),
      status: 'MEMORY_WORKING',
      agentVersion: 'v2_agt_vhYf_e_C'
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