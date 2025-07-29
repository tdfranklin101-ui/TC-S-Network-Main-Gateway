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

// Serve D-ID text capture script
app.get('/did-text-capture.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'did-text-capture.js'));
});

// Serve test capture script
app.get('/test-did-capture.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-did-capture.js'));
});

// Memory status page
app.get('/memory-status', (req, res) => {
  res.sendFile(path.join(__dirname, 'memory-status-display.html'));
});

// FORCE REAL DATA MEMORY API - NO DEMO DATA ALLOWED
app.get('/api/kid-solar-memory/all', (req, res) => {
  console.log('🔍 FORCE REAL DATA: Memory API called - scanning conversations...');
  
  try {
    const conversations = [];
    const conversationsDir = path.join(__dirname, 'conversations');
    
    console.log('📂 Checking conversations directory:', conversationsDir);
    
    if (fs.existsSync(conversationsDir)) {
      const files = fs.readdirSync(conversationsDir)
        .filter(file => file.endsWith('.json') && !file.startsWith('hist_'))
        .sort((a, b) => fs.statSync(path.join(conversationsDir, b)).mtime - fs.statSync(path.join(conversationsDir, a)).mtime);
      
      console.log('📊 FORCE REAL DATA: Found', files.length, 'conversation files');
      
      files.forEach(file => {
        try {
          const filePath = path.join(conversationsDir, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          console.log('📄 Processing file:', file, 'Type:', content.messageType);
          
          const conversation = {
            id: content.id || file.replace('.json', ''),
            sessionId: content.sessionId || 'session-unknown',
            timestamp: content.timestamp || new Date(fs.statSync(filePath).mtime).toISOString(),
            conversationType: content.messageType === 'identify_anything_analysis' ? 'Photo Analysis via Cut & Paste' :
                            content.messageType === 'photo_analysis' ? 'Visual Recognition Testing' :
                            content.messageType === 'did_conversation' ? 'D-ID Voice Chat' :
                            content.messageType === 'did_agent_response' ? 'Console Solar Response' :
                            content.messageType === 'user_input' ? 'User Message' :
                            content.captureSource === 'inline_test_demonstration' ? 'Test Demonstration' :
                            'Console Solar Session',
            messageType: content.messageType || 'conversation',
            preview: (content.messageText || 'Conversation content').substring(0, 100) + '...',
            fullConversation: content.messageText || 'No content available',
            messageText: content.messageText || 'No content available',
            retentionFirst: true,
            hasImages: content.messageType?.includes('photo') || content.messageType?.includes('identify'),
            agentId: content.agentId || 'v2_agt_vhYf_e_C',
            agentDescription: 'Console Solar - Kid Solar',
            highlight: content.captureSource === 'inline_test_demonstration' ? 'Test D-ID Capture - Both Sides Captured' : 'Real Console Solar Session',
            educational: content.messageType?.includes('identify') ? 'Image recognition and polymathic analysis' :
                        content.messageType?.includes('did') || content.messageType?.includes('agent') ? 'Voice and animation interaction' :
                        content.messageType?.includes('user') ? 'User interaction capture' :
                        'Educational conversation with Kid Solar',
            messages: 1,
            isDemoData: false,
            isRealConversation: true,
            captureProof: content.captureSource || 'live_session'
          };
          
          conversations.push(conversation);
          console.log('✅ FORCE REAL DATA: Added', conversation.conversationType, '-', conversation.preview.substring(0, 30));
          
        } catch (e) {
          console.error('❌ Error reading file', file, ':', e.message);
        }
      });
    } else {
      console.log('📂 Conversations directory does not exist');
    }
    
    // ONLY add status message if absolutely no files found
    if (conversations.length === 0) {
      console.log('⚠️ No conversation files found - adding status message');
      conversations.push({
        id: 'status-waiting',
        sessionId: 'system-ready',
        timestamp: new Date().toISOString(),
        conversationType: 'System Status - Awaiting Conversations',
        messageType: 'system_status',
        preview: 'Click Test D-ID Capture button to create sample conversations',
        fullConversation: 'Memory system is ready. Click the "Test D-ID Capture" button on homepage to demonstrate both user and agent message capture.',
        messageText: 'Memory system is ready. Click the "Test D-ID Capture" button on homepage to demonstrate both user and agent message capture.',
        retentionFirst: true,
        hasImages: false,
        agentId: 'v2_agt_vhYf_e_C',
        highlight: 'Ready for D-ID Capture Test',
        educational: 'System monitoring for conversations',
        messages: 1,
        isDemoData: false,
        isRealConversation: false,
        captureProof: 'system_ready'
      });
    }
    
    const response = {
      conversations: conversations,
      totalConversations: conversations.length,
      realConversations: conversations.filter(c => c.isRealConversation).length,
      testConversations: conversations.filter(c => c.captureProof === 'inline_test_demonstration').length,
      timestamp: new Date().toISOString(),
      status: 'FORCE_REAL_DATA_ACTIVE',
      agentVersion: 'v2_agt_vhYf_e_C',
      memorySystem: 'REAL_DATA_ONLY',
      forceRealData: true
    };
    
    console.log('📤 FORCE REAL DATA: Sending', conversations.length, 'real conversations');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(response);
    
  } catch (error) {
    console.error('❌ FORCE REAL DATA: Memory API error:', error);
    res.status(500).json({ 
      error: 'Memory system error',
      details: error.message,
      timestamp: new Date().toISOString(),
      status: 'ERROR_READING_REAL_DATA'
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