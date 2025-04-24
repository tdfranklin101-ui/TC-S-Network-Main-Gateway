/**
 * Simple test script for OpenAI integration
 */

require('dotenv').config();
const openaiService = require('./openai-service');

async function testAI() {
  console.log('== Testing OpenAI integration ==');
  
  // 1. Test basic AI assistant
  console.log('\nTesting AI assistant...');
  const query = 'What is The Current-See?';
  console.log(`Query: "${query}"`);
  const response = await openaiService.getEnergyAssistantResponse(query);
  console.log('Response:', typeof response === 'string' ? response : JSON.stringify(response, null, 2));
  
  // 2. Test product analysis
  console.log('\nTesting product analysis...');
  const productInfo = {
    name: 'LED Light Bulb',
    type: 'Lighting',
    materials: 'Glass, aluminum, LED components',
    location: 'China',
    weight: '0.1 kg',
    additionalInfo: 'Energy Star certified'
  };
  console.log('Product:', productInfo.name);
  const analysis = await openaiService.analyzeProductEnergy(productInfo);
  console.log('Analysis:', JSON.stringify(analysis, null, 2));
  
  // 3. Test energy tips
  console.log('\nTesting energy tips...');
  const userProfile = {
    location: 'California',
    homeType: 'Apartment',
    residents: 2,
    energyUsage: 'Medium',
    interests: ['Technology', 'Gardening', 'Sustainability'],
    budget: 'Moderate'
  };
  console.log('User location:', userProfile.location);
  const tips = await openaiService.getPersonalizedEnergyTips(userProfile);
  console.log('Tips:', JSON.stringify(tips, null, 2));
}

// Run the test
testAI().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});