const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Initialize OpenAI client if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Load the product energy database
let productDatabase = {};
try {
  const dbPath = path.join(process.cwd(), 'server', 'data', 'products_energy.json');
  const data = fs.readFileSync(dbPath, 'utf8');
  productDatabase = JSON.parse(data);
  console.log(`Loaded energy data for ${Object.keys(productDatabase).length} products`);
} catch (error) {
  console.error('Error loading product energy database:', error);
  // Create a basic database if file doesn't exist
  productDatabase = {
    "plastic_bottle": { "kWh": 0.05, "eco_score": 42, "description": "Standard single-use plastic water bottle" },
    "bamboo_brush": { "kWh": 0.01, "eco_score": 85, "description": "Sustainable bamboo toothbrush with plant-based bristles" }
  };
}

/**
 * Get product energy data from the database
 * @param {string} productName - The product identifier
 * @returns {Object|null} The product data or null if not found
 */
function getProductData(productName) {
  // Normalize the product name for lookup
  const normalizedName = productName.toLowerCase().replace(/\s+/g, '_');
  
  // Direct lookup
  if (productDatabase[normalizedName]) {
    return {
      ...productDatabase[normalizedName],
      id: normalizedName
    };
  }
  
  // Fuzzy lookup - find the closest match
  const productNames = Object.keys(productDatabase);
  let bestMatch = null;
  let highestScore = 0;
  
  for (const name of productNames) {
    const score = similarityScore(normalizedName, name);
    if (score > highestScore && score > 0.7) { // 70% similarity threshold
      highestScore = score;
      bestMatch = name;
    }
  }
  
  if (bestMatch) {
    return {
      ...productDatabase[bestMatch],
      id: bestMatch,
      fuzzyMatch: true,
      originalQuery: productName,
      matchConfidence: Math.round(highestScore * 100)
    };
  }
  
  return null;
}

/**
 * Calculate a simple similarity score between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function similarityScore(str1, str2) {
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Recommend alternatives for a given product
 * @param {string} productName - The product to find alternatives for
 * @returns {Array} Array of recommended alternative products
 */
function recommendAlternative(productName) {
  const product = getProductData(productName);
  
  if (!product) {
    return [];
  }
  
  // Find products with better eco scores
  const alternatives = Object.entries(productDatabase)
    .filter(([id, data]) => {
      // Don't recommend the same product
      if (id === product.id) return false;
      
      // Must have a better eco score
      return data.eco_score > product.eco_score;
    })
    .map(([id, data]) => ({
      id,
      ...data,
      energySavings: product.kWh - data.kWh,
      scoreImprovement: data.eco_score - product.eco_score
    }))
    .sort((a, b) => b.scoreImprovement - a.scoreImprovement)
    .slice(0, 3); // Top 3 alternatives
  
  return alternatives;
}

/**
 * Get energy data for a product using OpenAI if not in database
 * @param {string} productName - The product name
 * @param {string} productDescription - Optional product description
 * @returns {Promise<Object>} The product energy data
 */
async function analyzeProduct(productName, productDescription = '') {
  // First check if the product is in our database
  const existingProduct = getProductData(productName);
  
  if (existingProduct) {
    // Add recommendations for existing products
    const alternatives = recommendAlternative(productName);
    return {
      ...existingProduct,
      source: 'database',
      alternatives
    };
  }
  
  // If not in database and OpenAI is available, use AI to estimate
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: 
              "You are a specialized energy consumption analyst. Your task is to estimate the energy required to produce common consumer products based on their name and description. Provide realistic estimates in kWh and an environmental score from 0-100. Respond with JSON in this format: { 'energyKwh': number, 'environmentalScore': number, 'explanation': string }",
          },
          {
            role: "user",
            content: `Product: ${productName}\nDescription: ${productDescription}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Structure the result
      const productData = {
        kWh: result.energyKwh,
        eco_score: result.environmentalScore,
        description: result.explanation,
        source: 'ai_generated',
        id: productName.toLowerCase().replace(/\s+/g, '_'),
        originalQuery: productName
      };
      
      // Save to the database for future use
      saveProductToDatabase(productData.id, {
        kWh: productData.kWh,
        eco_score: productData.eco_score,
        description: productData.description
      });
      
      return productData;
    } catch (error) {
      console.error('Error analyzing product with AI:', error);
      // Fall back to a default estimate if AI fails
      return generateDefaultEstimate(productName, productDescription);
    }
  } else {
    // If OpenAI is not available, use default estimation
    return generateDefaultEstimate(productName, productDescription);
  }
}

/**
 * Generate a default estimate for unknown products
 * @param {string} productName - The product name
 * @param {string} productDescription - Product description
 * @returns {Object} Default product energy data
 */
function generateDefaultEstimate(productName, productDescription) {
  // Use very conservative estimates for unknown products
  return {
    kWh: 5.0, // Default medium value
    eco_score: 50, // Neutral score
    description: `Estimated energy consumption for ${productName}`,
    source: 'default_estimate',
    id: productName.toLowerCase().replace(/\s+/g, '_'),
    originalQuery: productName,
    note: 'This is an approximation. For more accurate data, please scan the product barcode or provide more details.'
  };
}

/**
 * Save a new product to the database
 * @param {string} id - Product ID
 * @param {Object} data - Product energy data
 */
function saveProductToDatabase(id, data) {
  try {
    productDatabase[id] = data;
    
    // Save to file asynchronously
    const dbPath = path.join(process.cwd(), 'server', 'data', 'products_energy.json');
    fs.writeFile(
      dbPath, 
      JSON.stringify(productDatabase, null, 2), 
      'utf8',
      (err) => {
        if (err) {
          console.error('Error saving product to database:', err);
        } else {
          console.log(`Product '${id}' saved to database`);
        }
      }
    );
  } catch (error) {
    console.error('Error saving product to database:', error);
  }
}

module.exports = {
  getProductData,
  recommendAlternative,
  analyzeProduct,
  getAllProducts: () => Object.entries(productDatabase).map(([id, data]) => ({ id, ...data }))
};