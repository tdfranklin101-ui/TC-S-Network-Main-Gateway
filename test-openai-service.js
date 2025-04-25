const openaiService = require('./openai-service');

async function testService() {
  console.log('Testing OpenAI service...');
  
  try {
    const response = await openaiService.getEnergyAssistantResponse('What is The Current-See?');
    console.log('Response type:', typeof response);
    console.log('Response:', response);
  } catch (error) {
    console.error('Error testing OpenAI service:', error);
  }
}

testService();
