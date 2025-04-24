/**
 * The Current-See OpenAI Integration Test
 * 
 * This script tests the OpenAI integration and API endpoints.
 * It will check both direct service calls and API endpoints.
 */

require('dotenv').config();
const http = require('http');
const openaiService = require('./openai-service');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Make HTTP request to API endpoints
async function makeRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data.length > 0 ? JSON.parse(data) : null
          });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}, data: ${data}`));
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Test OpenAI integration directly
async function testDirectService() {
  console.log('== Testing OpenAI Service Directly ==');
  console.log('This tests the service functions without going through API endpoints\n');
  
  // 1. Test basic AI assistant
  console.log('Testing AI assistant...');
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

// Test OpenAI integration through API endpoints
async function testApiEndpoints() {
  console.log('\n== Testing OpenAI API Endpoints ==');
  console.log('This tests the API endpoints that connect to the OpenAI service\n');
  
  // First check if server is running
  try {
    console.log('Checking server health...');
    const healthResponse = await makeRequest('/health', 'GET');
    
    if (healthResponse.statusCode !== 200) {
      console.log('❌ Server returned non-200 status code:', healthResponse.statusCode);
      return false;
    }
    
    console.log('✓ Server is running');
    console.log('✓ OpenAI status:', healthResponse.body.openai);
    
    if (healthResponse.body.openai !== 'available') {
      console.log('❌ OpenAI service is not available according to health check');
      return false;
    }
    
    // 1. Test AI assistant endpoint
    console.log('\nTesting AI assistant endpoint...');
    const query = 'How much is 1 SOLAR worth?';
    console.log(`Query: "${query}"`);
    
    const aiResponse = await makeRequest('/api/ai/assistant', 'POST', { query });
    
    if (aiResponse.statusCode !== 200) {
      console.log('❌ Endpoint returned non-200 status code:', aiResponse.statusCode);
      console.log('Response:', JSON.stringify(aiResponse.body, null, 2));
    } else {
      console.log('✓ Endpoint returned status 200');
      console.log('Response:', aiResponse.body.response);
    }
    
    // 2. Test product analysis endpoint
    console.log('\nTesting product analysis endpoint...');
    const productInfo = {
      name: 'Smartphone',
      type: 'Electronics',
      materials: 'Glass, aluminum, lithium battery',
      location: 'China',
      weight: '0.2 kg',
      additionalInfo: 'Average lifespan 3 years'
    };
    console.log('Product:', productInfo.name);
    
    const productResponse = await makeRequest('/api/ai/analyze-product', 'POST', { productInfo });
    
    if (productResponse.statusCode !== 200) {
      console.log('❌ Endpoint returned non-200 status code:', productResponse.statusCode);
      console.log('Response:', JSON.stringify(productResponse.body, null, 2));
    } else {
      console.log('✓ Endpoint returned status 200');
      console.log('Analysis results:', JSON.stringify(productResponse.body.analysis, null, 2));
    }
    
    // 3. Test energy tips endpoint
    console.log('\nTesting energy tips endpoint...');
    const userProfile = {
      location: 'New York',
      homeType: 'House',
      residents: 4,
      energyUsage: 'High',
      interests: ['Environment', 'Technology', 'Home Improvement'],
      budget: 'High'
    };
    console.log('User location:', userProfile.location);
    
    const tipsResponse = await makeRequest('/api/ai/energy-tips', 'POST', { userProfile });
    
    if (tipsResponse.statusCode !== 200) {
      console.log('❌ Endpoint returned non-200 status code:', tipsResponse.statusCode);
      console.log('Response:', JSON.stringify(tipsResponse.body, null, 2));
    } else {
      console.log('✓ Endpoint returned status 200');
      console.log('Tips:', JSON.stringify(tipsResponse.body.tips, null, 2));
    }
    
    return true;
  } catch (err) {
    console.log('❌ Error testing API endpoints:', err.message);
    return false;
  }
}

// Check if OpenAI key is valid
function checkApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY is not set in environment');
    return false;
  }
  
  console.log('API key information:');
  console.log(`- Length: ${apiKey.length} characters`);
  console.log(`- Starts with: ${apiKey.substring(0, 5)}...`);
  console.log(`- Correct prefix (sk-): ${apiKey.startsWith('sk-')}`);
  
  return apiKey.startsWith('sk-');
}

// Run all tests
async function runTests() {
  console.log('======== The Current-See OpenAI Integration Tester ========');
  console.log('Current time:', new Date().toISOString());
  
  // First check if OpenAI API key is valid
  console.log('\n== Checking OpenAI API Key ==');
  const keyValid = checkApiKey();
  
  if (!keyValid) {
    console.log('❌ OpenAI API key is invalid or not properly formatted');
    console.log('❌ You need a valid API key starting with "sk-" for OpenAI integration to work');
    console.log('❌ Tests will likely fail, but will continue anyway for diagnostic purposes');
  } else {
    console.log('✓ OpenAI API key has correct format');
  }
  
  // Run direct service tests
  try {
    await testDirectService();
  } catch (err) {
    console.error('❌ Direct service test failed:', err.message);
  }
  
  // Run API endpoint tests if server is running
  try {
    await testApiEndpoints();
  } catch (err) {
    console.error('❌ API endpoint test failed:', err.message);
    console.error('   This may be because the server is not running.');
    console.error('   Start the server with: node pure-deployment.js');
  }
  
  console.log('\n======== Test Completed ========');
}

// Run all tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});