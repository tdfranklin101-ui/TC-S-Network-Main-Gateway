const { OpenAI } = require('openai');

async function testNewKey() {
  try {
    console.log('Testing connection with NEW_OPENAI_API_KEY...');
    const apiKey = process.env.NEW_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('NEW_OPENAI_API_KEY is not set');
    }
    
    console.log(`API key starts with: ${apiKey.substring(0, 7)}...`);
    
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello!" }],
      max_tokens: 5
    });
    
    console.log('✓ OpenAI API test successful!');
    console.log(`Response: ${response.choices[0].message.content}`);
    return true;
  } catch (error) {
    console.error('❌ OpenAI API test failed');
    console.error(`Error: ${error.message}`);
    return false;
  }
}

testNewKey();
