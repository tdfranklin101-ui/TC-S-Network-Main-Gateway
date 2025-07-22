/**
 * Extract a valid OpenAI key from a longer string
 */

require('dotenv').config();

const apiKey = process.env.OPENAI_API_KEY;

console.log(`Original API key length: ${apiKey.length} characters`);
console.log(`Original API key prefix: ${apiKey.substring(0, 10)}...`);

// Try to extract a standard OpenAI key (typically in format sk-xxxx with ~51 chars total)
const standardKeyMatch = apiKey.match(/sk-[a-zA-Z0-9]{48}/);
if (standardKeyMatch) {
  console.log(`Found standard key: ${standardKeyMatch[0].substring(0, 10)}...`);
  console.log(`Standard key length: ${standardKeyMatch[0].length} characters`);
} else {
  console.log('No standard OpenAI key pattern found in the string');
}

// Alternative: Try to extract the first part of the key that looks like a standard format
if (apiKey.startsWith('sk-')) {
  // Extract just the first 51 characters (common length for OpenAI keys)
  const extractedKey = apiKey.substring(0, 51);
  console.log(`Extracted key prefix: ${extractedKey.substring(0, 10)}...`);
  console.log(`Extracted key length: ${extractedKey.length} characters`);
}