/**
 * The Current-See AI Assistant API
 * 
 * This module provides the AI Assistant API endpoint for the Current-See platform.
 */

const openaiService = require('../openai-service');

/**
 * Register the AI Assistant API routes
 * @param {Express} app - Express application
 */
function registerAIAssistantRoutes(app) {
  // AI Assistant endpoint for the demo page
  app.post('/api/ai/assistant', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          error: 'Missing query parameter',
          message: 'Query text is required'
        });
      }
      
      console.log(`[AI Assistant] Processing query: "${query}"`);
      
      // Use OpenAI service to get a response
      const response = await openaiService.getEnergyAssistantResponse(query);
      
      console.log(`[AI Assistant] Response received (${typeof response})`);
      
      res.json({
        response: response,
        source: 'openai',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing AI assistant query:', error);
      res.status(500).json({
        error: 'Failed to process AI assistant query',
        message: error.message
      });
    }
  });

  // Update the voice-assistant endpoint to use the OpenAI service
  app.post('/api/ai/voice', async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          error: 'Missing query parameter',
          message: 'Query text is required'
        });
      }
      
      // Use OpenAI service to get a response
      const response = await openaiService.getEnergyAssistantResponse(query);
      
      res.json({
        reply: response,
        source: 'openai',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error processing voice assistant query:', error);
      res.status(500).json({
        error: 'Failed to process voice assistant query',
        message: error.message
      });
    }
  });

  console.log('AI Assistant API routes registered');
}

module.exports = { registerAIAssistantRoutes };