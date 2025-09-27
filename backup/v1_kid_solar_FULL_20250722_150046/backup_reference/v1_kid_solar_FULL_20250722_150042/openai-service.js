/**
 * The Current-See OpenAI Integration Service
 * 
 * This module provides OpenAI API integration for the Current-See application.
 */

const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Try to load OpenAI API key from separate .env file or environment variables
function loadOpenAIKey() {
  // First check if NEW_OPENAI_API_KEY is available in environment (highest priority)
  if (process.env.NEW_OPENAI_API_KEY) {
    console.log('Using NEW_OPENAI_API_KEY from environment (highest priority)');
    return process.env.NEW_OPENAI_API_KEY;
  }
  
  try {
    // Check if .env.openai exists
    const envPath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(envPath)) {
      console.log('Loading OpenAI API key from .env.openai file');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const keyMatch = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
      if (keyMatch && keyMatch[1] && keyMatch[1].trim()) {
        return keyMatch[1].trim();
      }
    }
  } catch (err) {
    console.error('Error loading OpenAI key from .env.openai:', err.message);
  }

  // Fall back to original environment variable
  return process.env.OPENAI_API_KEY;
}

// Get API key from custom file or environment
const apiKey = loadOpenAIKey();

// Clean up API key if it has special format
function getCleanApiKey(rawKey) {
  if (!rawKey) return null;
  
  // Handle special case where key starts with "-sk-p"
  if (rawKey.startsWith('-sk-p')) {
    console.log('Note: Detected non-standard API key format (-sk-p), attempting to clean');
    
    // Try to find and extract a proper API key if embedded in the longer string
    const standardKeyMatch = rawKey.match(/sk-[a-zA-Z0-9]{48}/);
    if (standardKeyMatch) {
      return standardKeyMatch[0];
    }
    
    // If we can't extract a standard key, just return as is (OpenAI will reject it anyway)
    return rawKey;
  }
  
  // Handle the sk-proj prefix case - this is the new standard for OpenAI project-scoped keys
  if (rawKey.startsWith('sk-proj')) {
    console.log('Note: Detected sk-proj API key format (project-scoped key)');
    // No need to modify the key, return as is
    return rawKey;
  }
  
  return rawKey;
}

// Get cleaned API key
const cleanApiKey = getCleanApiKey(apiKey);

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: cleanApiKey
});

/**
 * Check if the API key appears valid
 * @returns {boolean} - Whether the key appears valid
 */
function hasValidApiKey() {
  const key = cleanApiKey;
  return !!key && (
    key.startsWith('sk-') || 
    key.startsWith('-sk-p') || 
    key.startsWith('sk-proj')
  );
}

// Global flag to track if we've already logged a key error to avoid spam
let keyErrorLogged = false;

// Track API working status
let _apiWorking = null; // null = not tested yet, true = working, false = not working

/**
 * Check if the OpenAI API is working
 * @returns {boolean} - Whether the API is working
 */
function isApiWorking() {
  return _apiWorking;
}

/**
 * Get the source of the OpenAI API key
 * @returns {string} - Description of where the API key came from
 */
function getKeySource() {
  if (process.env.NEW_OPENAI_API_KEY) {
    return 'NEW_OPENAI_API_KEY environment variable';
  } else if (process.env.OPENAI_API_KEY) {
    return 'OPENAI_API_KEY environment variable';
  } else {
    const envPath = path.join(process.cwd(), '.env.openai');
    if (fs.existsSync(envPath)) {
      return '.env.openai configuration file';
    }
    return 'Not found';
  }
}

/**
 * Get a response from OpenAI for energy-related questions
 * @param {string} query - The user's query
 * @returns {Promise<string>} - The AI response
 */
async function getEnergyAssistantResponse(query) {
  try {
    // Check if API key is available
    if (!hasValidApiKey()) {
      console.error('Missing or invalid OpenAI API key');
      return {
        error: true,
        message: "The AI assistant service is temporarily unavailable. Please contact support to enable AI features."
      };
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `You are the Current-See Solar Energy Assistant, an expert in solar energy and The Current-See's solar-backed economic system.
            
Key facts about The Current-See:
- The Current-See started on April 7, 2025
- Each SOLAR token represents 4,913 kWh of solar energy
- The value of 1 SOLAR is $136,000
- The system distributes 1 SOLAR per day to each member
- TC-S Solar Reserve has 10 billion SOLAR allocation

Speak in a helpful, informative, and professional tone. Focus your answers on solar energy, economic systems, and sustainability. 
If asked about topics unrelated to these areas, politely redirect the conversation.`
          },
          {
            role: "user",
            content: query
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (apiError) {
      // If this is an auth error and we haven't logged it yet, log it just once
      if (apiError.message.includes('401') && !keyErrorLogged) {
        console.error('OpenAI API authentication error:', apiError.message);
        keyErrorLogged = true;
      }
      
      // For authentication errors, provide a more specific message about API setup
      if (apiError.message.includes('401')) {
        return {
          error: true,
          message: "The AI assistant is currently in setup mode. Our team is configuring the OpenAI integration.",
          details: "API key authentication issue"
        };
      }
      
      // For other errors, provide a general error message
      return {
        error: true,
        message: `I apologize, but I'm currently unable to provide a response. Please try again later.`,
        details: apiError.message
      };
    }
  } catch (error) {
    console.error('OpenAI service error:', error.message);
    return {
      error: true,
      message: `I apologize, but I'm currently unable to process your request. Please try again later.`,
      details: error.message
    };
  }
}

/**
 * Analyze a product's energy impact
 * @param {Object} productInfo - Information about the product
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeProductEnergy(productInfo) {
  try {
    // Check if API key is available
    if (!hasValidApiKey()) {
      console.error('Missing or invalid OpenAI API key');
      return {
        error: true,
        message: "The product analysis service is temporarily unavailable. Please contact support to enable AI features."
      };
    }
    
    // Format the product information
    const productDescription = `
      Product Name: ${productInfo.name || 'Unknown'}
      Product Type: ${productInfo.type || 'Unknown'}
      Materials: ${productInfo.materials || 'Unknown'}
      Manufacturing Location: ${productInfo.location || 'Unknown'}
      Weight: ${productInfo.weight || 'Unknown'}
      Additional Info: ${productInfo.additionalInfo || 'None'}
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `You are an expert in product energy analysis and carbon footprints. Analyze the given product information and provide:
            
1. Estimated energy used in production (in kWh)
2. Estimated carbon footprint (in kg CO2e)
3. Solar energy equivalent (in SOLAR tokens, where 1 SOLAR = 4,913 kWh)
4. Key sustainability insights
5. Recommendations for more sustainable alternatives

Format your response as a structured JSON object with the following keys:
- energyEstimate: number (in kWh)
- carbonFootprint: number (in kg CO2e)
- solarEquivalent: number (in SOLAR tokens)
- insights: array of strings
- recommendations: array of strings

Be detailed but realistic in your estimates. If information is missing, make reasonable assumptions based on industry averages but note these assumptions.`
          },
          {
            role: "user",
            content: productDescription
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 1000
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (apiError) {
      // If this is an auth error and we haven't logged it yet, log it just once
      if (apiError.message.includes('401') && !keyErrorLogged) {
        console.error('OpenAI API authentication error:', apiError.message);
        keyErrorLogged = true;
      }
      
      // For authentication errors, provide a more specific message about API setup
      if (apiError.message.includes('401')) {
        return {
          error: true,
          message: "The product analysis service is currently in setup mode. Our team is configuring the OpenAI integration.",
          details: "API key authentication issue"
        };
      }
      
      // For other errors, provide a general error message
      return {
        error: true,
        message: `Unable to analyze product energy impact. Please try again later.`,
        details: apiError.message
      };
    }
  } catch (error) {
    console.error('OpenAI service error:', error.message);
    return {
      error: true,
      message: `Unable to process your product analysis request. Please try again later.`,
      details: error.message
    };
  }
}

/**
 * Get personalized energy saving tips
 * @param {Object} userProfile - User profile information
 * @returns {Promise<Object>} - Personalized energy tips
 */
async function getPersonalizedEnergyTips(userProfile) {
  try {
    // Check if API key is available
    if (!hasValidApiKey()) {
      console.error('Missing or invalid OpenAI API key');
      return {
        error: true,
        message: "The energy tips service is temporarily unavailable. Please contact support to enable AI features."
      };
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `You are a personalized energy efficiency advisor. Based on the user's profile, provide tailored energy-saving tips.
            
Format your response as a JSON object with the following keys:
- dailyTips: Array of 3 specific daily actions the user can take
- weeklyTips: Array of 2 weekly habits to develop
- monthlyTips: Array of 1 monthly investment or project
- potentialSavings: Estimated kWh savings per month
- solarTokens: Equivalent SOLAR tokens (where 1 SOLAR = 4,913 kWh)

Ensure that all tips are practical, specific, and tailored to the user's location, lifestyle, and preferences.`
          },
          {
            role: "user",
            content: JSON.stringify(userProfile)
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (apiError) {
      // If this is an auth error and we haven't logged it yet, log it just once
      if (apiError.message.includes('401') && !keyErrorLogged) {
        console.error('OpenAI API authentication error:', apiError.message);
        keyErrorLogged = true;
      }
      
      // For authentication errors, provide a more specific message about API setup
      if (apiError.message.includes('401')) {
        return {
          error: true,
          message: "The energy tips service is currently in setup mode. Our team is configuring the OpenAI integration.",
          details: "API key authentication issue"
        };
      }
      
      // For other errors, provide a general error message
      return {
        error: true,
        message: `Unable to generate personalized energy tips. Please try again later.`,
        details: apiError.message
      };
    }
  } catch (error) {
    console.error('OpenAI service error:', error.message);
    return {
      error: true,
      message: `Unable to process your energy tips request. Please try again later.`,
      details: error.message
    };
  }
}

// Initialize API working status flag
console.log('Testing OpenAI connection...');
try {
  // Simple test call to check if API is working
  const testPrompt = 'Hello';
  openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: testPrompt }],
    max_tokens: 5
  }).then(() => {
    _apiWorking = true;
    console.log('✓ OpenAI API connection successful');
  }).catch((err) => {
    _apiWorking = false;
    console.error('✗ OpenAI API connection failed:', err.message);
  });
} catch (err) {
  _apiWorking = false;
  console.error('✗ OpenAI API initialization error:', err.message);
}

module.exports = {
  getEnergyAssistantResponse,
  analyzeProductEnergy,
  getPersonalizedEnergyTips,
  isApiWorking,
  getKeySource
};