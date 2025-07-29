const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('deploy_v1_multimodal'));

// API endpoint to get real conversation data
app.get('/api/kid-solar-memory/all', (req, res) => {
  console.log('📡 Memory API called');
  
  try {
    const conversationsDir = path.join(__dirname, 'conversations');
    
    if (!fs.existsSync(conversationsDir)) {
      return res.json({
        conversations: [],
        totalConversations: 0,
        realConversations: 0,
        testConversations: 0,
        agentVersion: 'v2_agt_vhYf_e_C'
      });
    }
    
    const files = fs.readdirSync(conversationsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        try {
          const filePath = path.join(conversationsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const conversation = JSON.parse(content);
          
          return {
            id: conversation.id || file.replace('.json', ''),
            conversationType: conversation.conversationType || 'Console Solar Session',
            messageType: conversation.messageType || 'conversation',
            messageText: conversation.messageText || 'No message text',
            preview: (conversation.messageText || '').substring(0, 150) + '...',
            timestamp: conversation.timestamp || new Date().toISOString(),
            sessionId: conversation.sessionId || 'unknown',
            captureSource: conversation.captureSource || 'conversation',
            captureProof: conversation.captureSource || 'real_session',
            hasImages: false,
            fullConversation: conversation.messageText || ''
          };
        } catch (e) {
          console.error('Error reading conversation file:', file, e.message);
          return null;
        }
      })
      .filter(conv => conv !== null);
    
    const testConversations = files.filter(c => c.captureProof === 'inline_test_demonstration').length;
    const realConversations = files.length - testConversations;
    
    console.log(`✅ Found ${files.length} conversations (${realConversations} real, ${testConversations} test)`);
    
    res.json({
      conversations: files,
      totalConversations: files.length,
      realConversations: realConversations,
      testConversations: testConversations,
      agentVersion: 'v2_agt_vhYf_e_C'
    });
    
  } catch (error) {
    console.error('❌ Memory API error:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// Conversation storage endpoint
app.post('/api/kid-solar-conversation', (req, res) => {
  console.log('💾 Storing conversation...');
  
  try {
    const conversationData = req.body;
    const conversationsDir = path.join(__dirname, 'conversations');
    
    if (!fs.existsSync(conversationsDir)) {
      fs.mkdirSync(conversationsDir, { recursive: true });
    }
    
    const filename = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
    const filepath = path.join(conversationsDir, filename);
    
    const conversation = {
      id: filename.replace('.json', ''),
      ...conversationData,
      storedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(filepath, JSON.stringify(conversation, null, 2));
    
    console.log('✅ Conversation stored:', filename);
    res.json({ 
      success: true, 
      conversationId: conversation.id,
      filename: filename 
    });
    
  } catch (error) {
    console.error('❌ Storage error:', error);
    res.status(500).json({ error: 'Failed to store conversation' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', server: 'simple', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple Server running on port ${PORT}`);
  console.log(`📊 Memory API: http://localhost:${PORT}/api/kid-solar-memory/all`);
  console.log(`🌐 Website: http://localhost:${PORT}`);
});