/**
 * The Current-See OpenAI Integration Test
 * 
 * This script tests the OpenAI integration with the server.
 */

const http = require('http');

// Configuration
const PORT = 3000;
const HOST = 'localhost';

// Test parameters
const testQueries = [
  "What is The Current-See?",
  "How much is 1 SOLAR worth?",
  "How much energy has The Current-See generated since April 7, 2025?"
];

const testProduct = {
  name: "Smartphone",
  type: "Electronics",
  materials: "Glass, aluminum, lithium battery",
  location: "China",
  weight: "0.2 kg",
  additionalInfo: "Average lifespan 3 years"
};

const testUserProfile = {
  location: "California",
  homeType: "House",
  residents: 3,
  energyUsage: "High",
  interests: ["Technology", "Gardening", "Sustainability"],
  budget: "Moderate"
};

// Logger function
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ ERROR' : '✓ INFO';
  console.log(`[${timestamp}] ${prefix}: ${message}`);
}

// Make HTTP request
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

// Test health endpoint
async function testHealth() {
  log('Testing health endpoint...');
  try {
    const response = await makeRequest('/health', 'GET');
    
    if (response.statusCode !== 200) {
      log(`Unexpected status code: ${response.statusCode}`, true);
      return false;
    }
    
    log(`Health status: ${response.body.status}`);
    log(`OpenAI status: ${response.body.openai}`);
    log(`API features: ${JSON.stringify(response.body.apiFeatures)}`);
    
    return response.body.openai === 'available';
  } catch (err) {
    log(`Health endpoint error: ${err.message}`, true);
    return false;
  }
}

// Test assistant endpoint
async function testAssistant() {
  log('Testing AI assistant endpoint...');
  
  try {
    for (const query of testQueries) {
      log(`Sending query: "${query}"`);
      
      const response = await makeRequest('/api/ai/assistant', 'POST', { query });
      
      if (response.statusCode !== 200) {
        log(`Unexpected status code: ${response.statusCode}`, true);
        log(`Response: ${JSON.stringify(response.body)}`, true);
        continue;
      }
      
      log(`AI response: "${response.body.response.substring(0, 100)}..."`);
    }
    
    log('Assistant endpoint test completed successfully');
    return true;
  } catch (err) {
    log(`Assistant endpoint error: ${err.message}`, true);
    return false;
  }
}

// Test product analysis endpoint
async function testProductAnalysis() {
  log('Testing product analysis endpoint...');
  
  try {
    log(`Analyzing product: "${testProduct.name}"`);
    
    const response = await makeRequest('/api/ai/analyze-product', 'POST', { 
      productInfo: testProduct 
    });
    
    if (response.statusCode !== 200) {
      log(`Unexpected status code: ${response.statusCode}`, true);
      log(`Response: ${JSON.stringify(response.body)}`, true);
      return false;
    }
    
    log('Analysis results:');
    log(`- Energy estimate: ${response.body.analysis.energyEstimate} kWh`);
    log(`- Carbon footprint: ${response.body.analysis.carbonFootprint} kg CO2e`);
    log(`- Solar equivalent: ${response.body.analysis.solarEquivalent} SOLAR`);
    
    log('Product analysis endpoint test completed successfully');
    return true;
  } catch (err) {
    log(`Product analysis endpoint error: ${err.message}`, true);
    return false;
  }
}

// Test energy tips endpoint
async function testEnergyTips() {
  log('Testing energy tips endpoint...');
  
  try {
    log(`Getting tips for user profile in ${testUserProfile.location}`);
    
    const response = await makeRequest('/api/ai/energy-tips', 'POST', { 
      userProfile: testUserProfile 
    });
    
    if (response.statusCode !== 200) {
      log(`Unexpected status code: ${response.statusCode}`, true);
      log(`Response: ${JSON.stringify(response.body)}`, true);
      return false;
    }
    
    log('Energy tips:');
    log(`- Daily tips: ${response.body.tips.dailyTips.length} tips provided`);
    log(`- Weekly tips: ${response.body.tips.weeklyTips.length} tips provided`);
    log(`- Monthly tips: ${response.body.tips.monthlyTips.length} tips provided`);
    log(`- Potential savings: ${response.body.tips.potentialSavings} kWh per month`);
    
    log('Energy tips endpoint test completed successfully');
    return true;
  } catch (err) {
    log(`Energy tips endpoint error: ${err.message}`, true);
    return false;
  }
}

// Run all tests
async function runTests() {
  log('=== The Current-See OpenAI Integration Test ===');
  
  const healthOk = await testHealth();
  
  if (!healthOk) {
    log('Health check failed, skipping other tests', true);
    process.exit(1);
  }
  
  const assistantOk = await testAssistant();
  const productOk = await testProductAnalysis();
  const tipsOk = await testEnergyTips();
  
  if (assistantOk && productOk && tipsOk) {
    log('✅ ALL TESTS PASSED');
    log('The OpenAI integration is working correctly!');
  } else {
    log('❌ SOME TESTS FAILED', true);
    log('Please check the logs for details.', true);
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  log(`Unhandled error: ${err.message}`, true);
  process.exit(1);
});