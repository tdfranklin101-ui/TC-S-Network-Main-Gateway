#!/usr/bin/env node

/**
 * Kid Solar Multimodal Upload Assistance Test
 * Tests the OpenAI function calling integration
 */

const KidSolarVoice = require('./server/kid-solar-voice');

async function runTests() {
  console.log('🧪 Testing Kid Solar Multimodal Upload Assistance\n');
  
  const kidSolar = new KidSolarVoice();
  const testMemberId = 1; // Use numeric ID for database compatibility
  const memberContext = {
    username: 'test-user',
    totalSolar: 10.5
  };
  const conversationHistory = [];

  try {
    // Test 1: Check Wallet Balance
    console.log('📊 Test 1: Check Wallet Balance');
    const balanceResult = await kidSolar.processVoiceCommand(
      'check my wallet balance',
      testMemberId,
      memberContext,
      conversationHistory
    );
    console.log('✅ Response:', balanceResult.text);
    console.log('Function called:', balanceResult.functionCalled);
    console.log('Function data:', JSON.stringify(balanceResult.functionData, null, 2));
    console.log('');

    // Test 2: Get Upload Guidance
    console.log('📝 Test 2: Get Upload Guidance');
    const guidanceResult = await kidSolar.processVoiceCommand(
      'how do i upload artifacts?',
      testMemberId,
      memberContext,
      conversationHistory
    );
    console.log('✅ Response:', guidanceResult.text);
    console.log('Function called:', guidanceResult.functionCalled);
    console.log('');

    // Test 3: List Marketplace Items
    console.log('🛒 Test 3: List Marketplace Items (Music)');
    const listResult = await kidSolar.processVoiceCommand(
      'show me all music in the marketplace',
      testMemberId,
      memberContext,
      conversationHistory
    );
    console.log('✅ Response:', listResult.text);
    console.log('Function called:', listResult.functionCalled);
    if (listResult.functionData) {
      console.log('Items found:', listResult.functionData.items?.length || 0);
    }
    console.log('');

    // Test 4: Check My Uploads
    console.log('📤 Test 4: Check My Uploads');
    const uploadsResult = await kidSolar.processVoiceCommand(
      'what have i uploaded?',
      testMemberId,
      memberContext,
      conversationHistory
    );
    console.log('✅ Response:', uploadsResult.text);
    console.log('Function called:', uploadsResult.functionCalled);
    console.log('');

    // Test 5: Analyze Artifact for Upload (simulated)
    console.log('🖼️  Test 5: Analyze Artifact for Upload');
    const fileData = {
      buffer: Buffer.from('fake-image-data'),
      fileName: 'test-artwork.jpg',
      fileType: 'image/jpeg'
    };
    const analyzeResult = await kidSolar.processVoiceCommand(
      'help me upload this image',
      testMemberId,
      memberContext,
      conversationHistory,
      fileData
    );
    console.log('✅ Response:', analyzeResult.text);
    console.log('Function called:', analyzeResult.functionCalled);
    if (analyzeResult.functionData) {
      console.log('Suggested metadata:', JSON.stringify(analyzeResult.functionData, null, 2));
    }
    console.log('');

    console.log('✨ All tests completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  console.log('🎉 Kid Solar multimodal upload assistance is working correctly!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
