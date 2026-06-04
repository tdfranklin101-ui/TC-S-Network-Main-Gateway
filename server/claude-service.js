/**
 * TC-S Network Claude Service
 * Anthropic Claude API wrapper for agent inference migration
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL_MAP = {
  'gpt-4o-mini': 'claude-sonnet-4-6',
  'gpt-4o': 'claude-opus-4-8'
};

function getClaudeModel(openaiModel) {
  return MODEL_MAP[openaiModel] || 'claude-sonnet-4-6';
}

/**
 * Generic chat completion with Anthropic Claude
 * @param {Object} options - { model, system, messages, temperature, max_tokens }
 * @returns {Promise<string>} - The response text
 */
async function chatCompletion(options) {
  const model = getClaudeModel(options.model);
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.max_tokens ?? 4000;

  // Extract system prompt (top-level param for Anthropic, not in messages)
  const systemPrompt = options.system ||
    (options.messages && options.messages.find(m => m.role === 'system')?.content);

  // Filter out system messages from the messages array
  const userMessages = (options.messages || []).filter(m => m.role !== 'system');

  if (userMessages.length === 0) {
    throw new Error('No user messages provided');
  }

  const response = await anthropic.messages.create({
    model,
    system: systemPrompt,
    messages: userMessages,
    temperature,
    max_tokens: maxTokens
  });

  return response.content[0]?.text || '';
}

/**
 * Check if Anthropic API key is available
 * @returns {boolean}
 */
function hasValidApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key.startsWith('sk-');
}

/**
 * Get a response from Claude for energy-related questions
 * (drop-in replacement for openaiService.getEnergyAssistantResponse)
 * @param {string} query - The user's query
 * @returns {Promise<string|Object>} - The AI response text, or error object
 */
async function getEnergyAssistantResponse(query) {
  try {
    if (!hasValidApiKey()) {
      console.error('Missing or invalid Anthropic API key');
      return {
        error: true,
        message: "The AI assistant service is temporarily unavailable. Please contact support to enable AI features."
      };
    }

    const systemPrompt = `You are the Current-See Solar Energy Assistant, an expert in solar energy and The Current-See's solar-backed economic system.

Key facts about The Current-See:
- The Current-See started on April 7, 2025
- Each SOLAR token represents 4,913 kWh of solar energy
- The value of 1 SOLAR is $136,000
- The system distributes 1 SOLAR per day to each member
- TC-S Solar Reserve has 10 billion SOLAR allocation

Speak in a helpful, informative, and professional tone. Focus your answers on solar energy, economic systems, and sustainability.
If asked about topics unrelated to these areas, politely redirect the conversation.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.content[0].text;
  } catch (apiError) {
    if (apiError.message.includes('401') || apiError.message.includes('auth')) {
      return {
        error: true,
        message: "The AI assistant is currently in setup mode. Our team is configuring the Anthropic integration.",
        details: "API key authentication issue"
      };
    }
    return {
      error: true,
      message: `I apologize, but I'm currently unable to provide a response. Please try again later.`,
      details: apiError.message
    };
  }
}

module.exports = {
  chatCompletion,
  hasValidApiKey,
  getClaudeModel,
  getEnergyAssistantResponse
};
