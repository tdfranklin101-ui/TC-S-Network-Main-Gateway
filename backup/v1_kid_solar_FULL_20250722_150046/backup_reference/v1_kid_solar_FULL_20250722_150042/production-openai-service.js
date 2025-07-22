/**
 * Production OpenAI Service Configuration
 * 
 * This configuration ensures proper OpenAI API connection in production environments.
 */

const { OpenAI } = require('openai');

class ProductionOpenAIService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.initializeClient();
  }

  initializeClient() {
    try {
      // Prioritize NEW_OPENAI_API_KEY over OPENAI_API_KEY
      const apiKey = process.env.NEW_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('No OpenAI API key found in environment variables');
      }

      this.client = new OpenAI({
        apiKey: apiKey,
        timeout: 30000, // 30 second timeout
        maxRetries: 3
      });

      this.isInitialized = true;
      console.log('OpenAI client initialized successfully in production');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error.message);
      this.isInitialized = false;
    }
  }

  async analyzeEnergyItem(itemDescription) {
    if (!this.isInitialized) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an energy analysis expert. Analyze the energy consumption of items and provide SOLAR values based on 1 SOLAR = 4,913 kWh. Return JSON with energyKwh and solarValue fields."
          },
          {
            role: "user",
            content: `Analyze the energy consumption for: ${itemDescription}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content);
      return {
        success: true,
        energyKwh: result.energyKwh || 0,
        solarValue: result.solarValue || 0,
        analysis: result.analysis || "Energy analysis completed"
      };
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      throw new Error('Energy analysis failed. Please ensure OpenAI service is available.');
    }
  }

  async testConnection() {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Test connection" }],
        max_tokens: 10
      });
      return response && response.choices && response.choices.length > 0;
    } catch (error) {
      console.error('OpenAI connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = new ProductionOpenAIService();
