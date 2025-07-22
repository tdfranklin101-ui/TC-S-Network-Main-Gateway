/**
 * Test OpenAI Fallback Mechanism
 * 
 * This script tests if the minimal OpenAI service fallback works when the API is disabled.
 */

const minimalService = require('./openai-service-minimal');

async function testFallback() {
  console.log('======== OpenAI Fallback Test ========\n');
  
  // Check if API is marked as working
  const apiWorking = minimalService.isApiWorking();
  console.log(`OpenAI API status: ${apiWorking ? 'ENABLED' : 'DISABLED'}`);
  
  // Test energy assistant response
  console.log('\nTesting Energy Assistant Response:');
  const energyResponse = await minimalService.getEnergyAssistantResponse('Tell me about solar energy');
  console.log(JSON.stringify(energyResponse, null, 2));
  
  // Test product analysis
  console.log('\nTesting Product Analysis:');
  const productResponse = await minimalService.analyzeProductEnergy('electric kettle', 'California');
  console.log(JSON.stringify(productResponse, null, 2));
  
  // Test personalized tips
  console.log('\nTesting Personalized Energy Tips:');
  const tipsResponse = await minimalService.getPersonalizedEnergyTips('I live in a small apartment and want to reduce my energy bill');
  console.log(JSON.stringify(tipsResponse, null, 2));
  
  console.log('\n======== Test Complete ========');
}

// Run the test
testFallback();