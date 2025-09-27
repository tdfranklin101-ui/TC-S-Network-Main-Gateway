/**
 * Check the format of the OpenAI API key
 */

require('dotenv').config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.log('❌ API key is not set in environment variables');
  process.exit(1);
}

console.log(`API key length: ${apiKey.length} characters`);
console.log(`API key prefix: ${apiKey.substring(0, 5)}...`);
console.log(`API key starts with "sk-": ${apiKey.startsWith('sk-')}`);
console.log(`API key format correct: ${apiKey.startsWith('sk-') && apiKey.length > 20}`);