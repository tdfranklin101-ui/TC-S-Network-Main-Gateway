/**
 * Deployment Patch for OpenAI Connection Issues
 * 
 * This patch ensures proper OpenAI API connection in production deployments.
 */

// Environment variable check and setup
function validateOpenAIEnvironment() {
  const hasNewKey = !!process.env.NEW_OPENAI_API_KEY;
  const hasOldKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasNewKey && !hasOldKey) {
    console.error('❌ No OpenAI API key found in environment variables');
    console.error('Please set NEW_OPENAI_API_KEY or OPENAI_API_KEY');
    return false;
  }
  
  const keyToUse = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  console.log(`✅ Using OpenAI API key: ${hasNewKey ? 'NEW_OPENAI_API_KEY' : 'OPENAI_API_KEY'}`);
  console.log(`Key length: ${keyToUse.length} characters`);
  
  return true;
}

// Apply this patch to your main server file
if (validateOpenAIEnvironment()) {
  console.log('✅ OpenAI environment validation passed');
} else {
  console.log('❌ OpenAI environment validation failed');
}

module.exports = { validateOpenAIEnvironment };
