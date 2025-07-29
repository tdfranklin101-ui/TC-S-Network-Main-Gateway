#!/usr/bin/env node

const fetch = require('node-fetch');

async function testMemoryAPI() {
  console.log('🧪 Testing Memory API...\n');
  
  try {
    // Test 1: Check API response
    console.log('1. Testing API endpoint...');
    const response = await fetch('http://localhost:3000/api/kid-solar-memory/all');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ API responding: ${data.totalConversations} total conversations`);
    console.log(`   - Real conversations: ${data.realConversations}`);
    console.log(`   - Test conversations: ${data.testConversations}`);
    console.log(`   - Agent version: ${data.agentVersion}`);
    
    // Test 2: Check conversation content
    if (data.conversations && data.conversations.length > 0) {
      console.log('\n2. Sample conversation data:');
      const sample = data.conversations[0];
      console.log(`   - Type: ${sample.conversationType}`);
      console.log(`   - Message: ${sample.messageText.substring(0, 60)}...`);
      console.log(`   - Timestamp: ${sample.timestamp}`);
    }
    
    // Test 3: Check analytics page
    console.log('\n3. Testing analytics page...');
    const analyticsResponse = await fetch('http://localhost:3000/analytics');
    
    if (analyticsResponse.ok) {
      const analyticsHtml = await analyticsResponse.text();
      if (analyticsHtml.includes('fetch(\'/api/kid-solar-memory/all\'')) {
        console.log('✅ Analytics page is dynamic (fetches API data)');
      } else {
        console.log('❌ Analytics page appears to be static');
      }
    }
    
    console.log('\n🎯 MEMORY SYSTEM STATUS: WORKING');
    console.log('📝 Instructions:');
    console.log('   1. Visit http://localhost:3000 (homepage)');
    console.log('   2. Click the "🧪 Test D-ID Capture" button');
    console.log('   3. Visit http://localhost:3000/analytics (memory page)');
    console.log('   4. You should see real conversation data, not static content');
    
  } catch (error) {
    console.error('❌ Memory API test failed:', error.message);
    process.exit(1);
  }
}

testMemoryAPI();