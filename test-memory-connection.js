// Test script to verify D-ID memory connection
const fetch = require('node-fetch');

async function testMemoryConnection() {
  console.log('🔍 Testing D-ID memory connection...');
  
  try {
    // Test 1: Create a new D-ID conversation
    console.log('\n1. Creating test D-ID conversation...');
    const createResponse = await fetch('http://localhost:3000/api/session/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'did-session-' + Date.now(),
        messageType: 'did_conversation',
        messageText: 'Test message from new D-ID agent v2_agt_vhYf_e_C - testing memory integration',
        retentionFirst: true,
        agentId: 'v2_agt_vhYf_e_C',
        cacheBusted: true
      })
    });
    
    const createResult = await createResponse.json();
    console.log('✅ Conversation created:', createResult);
    
    // Test 2: Check if conversation appears in memory API
    console.log('\n2. Checking memory API...');
    const memoryResponse = await fetch('http://localhost:3000/api/kid-solar-memory/all');
    const memoryData = await memoryResponse.json();
    
    console.log(`📊 Total conversations: ${memoryData.totalConversations}`);
    console.log(`📊 Conversations array length: ${memoryData.conversations.length}`);
    
    // Test 3: Look for our test conversation
    const testConversation = memoryData.conversations.find(c => 
      c.messageText && c.messageText.includes('v2_agt_vhYf_e_C')
    );
    
    if (testConversation) {
      console.log('✅ Test conversation found in memory:', testConversation);
    } else {
      console.log('❌ Test conversation NOT found in memory');
      console.log('Available conversations:', memoryData.conversations.map(c => ({
        id: c.conversationId,
        type: c.messageType,
        text: c.messageText ? c.messageText.substring(0, 50) + '...' : 'No text'
      })));
    }
    
    // Test 4: Check file system
    console.log('\n3. Checking file system...');
    const fs = require('fs');
    const path = require('path');
    
    const conversationsDir = path.join(__dirname, 'conversations');
    if (fs.existsSync(conversationsDir)) {
      const files = fs.readdirSync(conversationsDir);
      console.log(`📁 Found ${files.length} conversation files`);
      
      // Find recent files
      const recentFiles = files
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => fs.statSync(path.join(conversationsDir, b)).mtime - fs.statSync(path.join(conversationsDir, a)).mtime)
        .slice(0, 3);
        
      console.log('📄 Recent files:', recentFiles);
      
      // Check content of most recent file
      if (recentFiles.length > 0) {
        const latestFile = path.join(conversationsDir, recentFiles[0]);
        const content = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
        console.log('📋 Latest file content:', content);
      }
    } else {
      console.log('❌ Conversations directory not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMemoryConnection();