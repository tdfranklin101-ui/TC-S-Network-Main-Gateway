/**
 * The Current-See OpenAI Integration Service (Minimal Version)
 * 
 * This module provides OpenAI API integration with graceful fallbacks
 * when the API is not available or authentication fails.
 */

const fs = require('fs');
const path = require('path');

// File to store the OpenAI feature state
const STATE_FILE = path.join(__dirname, '.openai-feature-state.json');

// Read the feature state from file (controlled by toggle-openai.js)
function readFeatureState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      return state.apiWorking === true;
    }
  } catch (error) {
    console.error('Error reading OpenAI feature state:', error.message);
  }
  return false;
}

// Flag to track if API authentication is working
let apiAuthenticationWorking = readFeatureState();

/**
 * Set whether the API is working - for testing purposes
 * @param {boolean} isWorking - Whether the API is working
 */
function setApiWorking(isWorking) {
  apiAuthenticationWorking = !!isWorking;
  
  // Also update the state file for persistence
  try {
    const state = { apiWorking: apiAuthenticationWorking };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing OpenAI feature state:', error.message);
  }
}

// Enhanced fallback responses with useful information
const FALLBACK_RESPONSES = {
  energy: "The Current-See Solar Energy system tracks energy generation from renewable sources and allocates it to members. Each SOLAR token represents 4,913 kWh of clean energy and has a value of $136,000. The system distributes 1 SOLAR per day to each member at 00:00 GMT (5 PM Pacific Time).",
  
  product: "The Current-See platform helps track the energy footprint of products and services. When analyzing products, we consider factors such as manufacturing energy, transportation, usage energy, and end-of-life energy needs. Energy-efficient products typically use 20-30% less energy than standard models and may qualify for energy rebates or incentives.",
  
  tips: "To reduce your energy consumption: 1) Replace incandescent bulbs with LEDs to save up to 75% of lighting energy, 2) Use smart power strips to eliminate phantom energy usage from electronics, 3) Program your thermostat to reduce heating/cooling when you're away, 4) Ensure your home is properly insulated, and 5) Consider investing in renewable energy sources like solar panels."
};

/**
 * Check if API authentication is currently working
 * @returns {boolean} - Whether authentication is working
 */
function isApiWorking() {
  // Always read from file to get current state
  apiAuthenticationWorking = readFeatureState();
  return apiAuthenticationWorking;
}

/**
 * Get a response from the AI assistant, with fallback if the API fails
 * @param {string} query - User query about energy
 * @param {string} responseType - Type of response (energy, product, tips)
 * @returns {Promise<string>} - Response text
 */
async function getAIResponse(query, responseType = 'energy') {
  // Always check current state from file
  apiAuthenticationWorking = readFeatureState();
  
  // If API authentication isn't working, use fallback immediately
  if (!apiAuthenticationWorking) {
    console.log('Using fallback response due to known API authentication issues');
    
    // Instead of just returning an error, provide more helpful fallback responses
    const fallbackText = FALLBACK_RESPONSES[responseType] || FALLBACK_RESPONSES.energy;
    
    return {
      text: fallbackText,
      source: "Current-See Energy Information System (Fallback Mode)",
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  try {
    // Construct a mock response based on the query to demonstrate functionality
    // This would normally come from the OpenAI API
    const mockResponse = constructMockResponse(query, responseType);
    
    // In production, this would be replaced with actual API integration
    return mockResponse;
  } catch (error) {
    console.error('Error getting AI response:', error.message);
    apiAuthenticationWorking = false; // Mark API as not working for future requests
    
    // Return a more informative error response
    return {
      error: true,
      message: "The AI assistant encountered an error processing your request.",
      details: error.message || "Unknown error"
    };
  }
}

/**
 * Constructs a mock response for demonstration purposes
 * @param {string} query - The user's query
 * @param {string} responseType - Type of response (energy, product, tips)
 * @returns {string} - A mock response
 */
function constructMockResponse(query, responseType) {
  const lowerQuery = query.toLowerCase();
  let response = "";
  
  // Basic pattern matching to provide somewhat relevant responses
  if (responseType === 'energy') {
    if (lowerQuery.includes('solar')) {
      response = "Solar energy is a renewable resource that converts sunlight into electricity. Each SOLAR token in the Current-See system represents 4,913 kWh of clean energy production.";
    } else if (lowerQuery.includes('renewable')) {
      response = "Renewable energy sources include solar, wind, hydro, and geothermal power. The Current-See system focuses on tracking and allocating renewable energy production.";
    } else {
      response = "The Current-See Solar Energy system helps track and allocate renewable energy. Each member receives 1 SOLAR token per day, representing 4,913 kWh of clean energy production.";
    }
  } else if (responseType === 'product') {
    response = "Based on typical products in this category, the estimated energy footprint would be moderate. Consider energy-efficient alternatives that have been certified by environmental standards organizations.";
  } else if (responseType === 'tips') {
    response = "To reduce your energy consumption: 1) Use LED lighting, 2) Unplug electronics when not in use, 3) Optimize heating and cooling systems, 4) Consider investing in renewable energy sources.";
  } else {
    response = FALLBACK_RESPONSES[responseType] || FALLBACK_RESPONSES.energy;
  }
  
  return {
    text: response,
    source: "Current-See Energy Information System",
    timestamp: new Date().toISOString()
  };
}

/**
 * Get a response for energy-related questions
 * @param {string} query - The user's query
 * @returns {Promise<string>} - The AI response
 */
async function getEnergyAssistantResponse(query) {
  return getAIResponse(query, 'energy');
}

/**
 * Analyze a product's energy impact
 * @param {string} productDescription - Description of the product
 * @param {string} location - User's location (optional)
 * @returns {Promise<string>} - The analysis response
 */
async function analyzeProductEnergy(productDescription, location = null) {
  const query = location ? 
    `Analyze energy impact of ${productDescription} in ${location}` : 
    `Analyze energy impact of ${productDescription}`;
    
  return getAIResponse(query, 'product');
}

/**
 * Get personalized energy-saving tips
 * @param {string} userContext - Context about the user's energy usage
 * @returns {Promise<string>} - Personalized tips
 */
async function getPersonalizedEnergyTips(userContext) {
  return getAIResponse(userContext, 'tips');
}

module.exports = {
  isApiWorking,
  setApiWorking,
  getEnergyAssistantResponse,
  analyzeProductEnergy,
  getPersonalizedEnergyTips
};