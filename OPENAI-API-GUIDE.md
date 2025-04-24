# OpenAI API Integration Guide

This guide explains how to set up and troubleshoot the OpenAI API integration for The Current-See website.

## OpenAI API Key Format

The Current-See supports both traditional and project-scoped OpenAI API keys:

- Traditional format: `sk-...` (starts with "sk-" followed by characters)
- Project-scoped format: `sk-proj-...` (starts with "sk-proj-" followed by characters)

## Getting a Valid API Key

1. **Sign up for OpenAI API access:**
   - Go to https://platform.openai.com/signup
   - Create an account or log in if you already have one

2. **Create an API key:**
   - Navigate to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Give your key a name (optional)
   - Copy the key immediately (you won't be able to see it again)

3. **Set up billing (required for API access):**
   - Go to https://platform.openai.com/account/billing/overview
   - Set up a payment method
   - Add credits to your account

## Adding the API Key to The Current-See

1. Create a file named `.env.openai` in the project root directory
2. Add your API key in this format: `OPENAI_API_KEY=your_key_here`
3. Save the file

## Testing the Integration

Run the following command to test your API key:

```
node test-openai-integration.js
```

If everything is working, you should see a successful connection message.

## Troubleshooting

### Authentication Errors

If you see a 401 error message like:
```
401 Incorrect API key provided
```

This means:
- Your API key may be invalid
- Your API key may have usage restrictions
- Your API key format may be incorrect

**Solutions:**
1. Generate a new API key at https://platform.openai.com/api-keys
2. Ensure you've set up billing properly
3. Check that you've copied the key correctly without any extra characters

### Rate Limit Errors

If you see a 429 error message:
```
429 Rate limit exceeded
```

This means you've hit your API usage limits. You can:
1. Wait for your rate limits to reset
2. Increase your usage tier at https://platform.openai.com/account/billing/limits

### Graceful Degradation

The Current-See has a built-in fallback system for when the OpenAI API is unavailable. If API authentication fails:
1. Users will see a message that the AI assistant is in setup mode
2. The site will continue to function normally in all other aspects
3. No error messages will be shown to users

## Key Security

- Never share your OpenAI API key publicly
- Do not commit the `.env.openai` file to version control
- You can use API key restrictions to limit its usage

## Models Used

The Current-See is configured to use the GPT-4o model for AI interactions. This model provides high-quality responses for energy-related questions and product analysis.

---

For additional help, contact The Current-See administrator or visit the [OpenAI Help Center](https://help.openai.com).