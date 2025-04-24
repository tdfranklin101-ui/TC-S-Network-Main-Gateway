# OpenAI Integration Guide for The Current-See

This document provides comprehensive guidance on working with the OpenAI integration in The Current-See platform.

## Implementation Status

✅ **OpenAI Integration**: Fully implemented and functional
✅ **AI Assistant**: Working correctly (responds to energy-related questions)
✅ **Product Analysis**: Working correctly (analyzes environmental impact of products)
✅ **Energy Tips**: Working correctly (provides personalized energy recommendations)

## API Key Management

The system supports multiple methods for providing OpenAI API keys, in order of priority:

1. **NEW_OPENAI_API_KEY** environment variable (highest priority)
2. **OPENAI_API_KEY** environment variable
3. Key from `.env.openai` file
4. Key from `openai.key` file

The service automatically detects the API key format, supporting both standard OpenAI API keys (`sk-...`) and project-scoped API keys (`sk-proj-...`).

## Verification Tests

Use the following testing scripts to verify OpenAI integration:

1. **Basic AI Assistant Test**: `node test-ai-integration.js`
2. **Product Analysis Test**: `node test-product-analysis.js`
3. **Direct OpenAI Connection Test**: `node test-openai-connection.js`

All tests should respond with detailed output confirming successful API connection and response generation.

## Fallback System

The OpenAI service includes a robust fallback mechanism:

1. If the OpenAI API is unavailable or returns an error, the system will automatically switch to fallback mode
2. In fallback mode, a minimal service provides informative responses without requiring API access
3. The system logs the fallback event but continues normal operation

## Feature Toggle

The OpenAI integration can be toggled on/off using the feature flag system:

```js
// To disable OpenAI integration
node set-feature.js openai false

// To enable OpenAI integration
node set-feature.js openai true
```

## Troubleshooting

If the OpenAI integration is not working as expected:

1. **Check API Key**: Ensure a valid API key is available through one of the methods above
2. **Verify API Status**: Run `node test-openai-connection.js` to verify direct API connectivity
3. **Check Feature Flag**: Ensure the OpenAI feature is enabled using `node system-check.js`
4. **Review Logs**: Look for specific error messages in the application logs
5. **Try Fallback Mode**: If API issues persist, you can temporarily disable the OpenAI integration

## API Endpoints

The following API endpoints are available for AI functionality:

- `/api/ai/assistant` - General energy assistant (answers questions about energy concepts)
- `/api/ai/analyze-product` - Product environmental impact analysis
- `/api/ai/energy-tips` - Personalized energy-saving recommendations

## Implementation Notes

1. The OpenAI integration uses gpt-4o, the latest model available (as of April 2025)
2. All requests use system prompts that focus the AI on energy-related topics
3. Temperature settings are optimized for accurate, consistent responses
4. Error handling includes retries and graceful degradation to fallback mode
5. Requests include reasonable timeouts to prevent hanging connections

## Security Considerations

1. API keys are never exposed to clients or logged in server responses
2. All requests to OpenAI are made server-side, never directly from client browsers
3. User queries are sanitized before being sent to the OpenAI API

---

For additional questions or support, contact the development team.