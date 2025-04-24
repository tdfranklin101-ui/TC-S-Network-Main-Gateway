/**
 * The Current-See OpenAI Integration Service
 * 
 * This module provides OpenAI API integration for the Current-See application.
 */

const { OpenAI } = require('openai');

// Clean up API key if it has special format
function getCleanApiKey() {
  const rawKey = process.env.OPENAI_API_KEY;
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
  
  // Handle the sk-proj prefix case
  if (rawKey.startsWith('sk-proj')) {
    console.log('Note: Detected sk-proj API key format, using as-is');
    return rawKey;
  }
  
  return rawKey;
}

// Get cleaned API key
const cleanApiKey = getCleanApiKey();

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: cleanApiKey
});

/**
 * Check if the API key appears valid
 * @returns {boolean} - Whether the key appears valid
 */
function hasValidApiKey() {
  const key = cleanApiKey;
  return !!key && (key.startsWith('sk-') || key.startsWith('-sk-p') || key.startsWith('sk-proj'));
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
        message: "The AI service is temporarily unavailable. Please contact support to enable AI features."
      };
    }

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
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    return {
      error: true,
      message: `I apologize, but I'm currently unable to provide a response. Please try again later.`,
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
  } catch (error) {
    console.error('OpenAI product analysis error:', error.message);
    return {
      error: true,
      message: `Unable to analyze product energy impact. Please try again later. (Error: ${error.message})`
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
  } catch (error) {
    console.error('OpenAI personalized tips error:', error.message);
    return {
      error: true,
      message: `Unable to generate personalized energy tips. Please try again later. (Error: ${error.message})`
    };
  }
}

module.exports = {
  getEnergyAssistantResponse,
  analyzeProductEnergy,
  getPersonalizedEnergyTips
};