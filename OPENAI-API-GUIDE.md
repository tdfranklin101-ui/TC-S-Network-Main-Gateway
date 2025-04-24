# OpenAI API Integration Guide for The Current-See Website

This guide explains how to set up and configure the OpenAI API integration for The Current-See website's AI-powered features.

## Features that use OpenAI

The Current-See website uses OpenAI for several energy-related AI features:

1. **Energy Assistant**: Answers user questions about solar energy, The Current-See's economic system, and sustainability.
2. **Product Energy Analysis**: Evaluates products for their energy usage, carbon footprint, and sustainability.
3. **Personalized Energy Tips**: Provides customized recommendations for energy savings based on user profiles.

## Setting up OpenAI API Key

To enable these AI features, you need to configure a standard OpenAI API key:

### Step 1: Create an OpenAI Account

1. Go to https://platform.openai.com/signup
2. Sign up for an account or log in if you already have one

### Step 2: Get API Key

1. Navigate to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Give it a name like "Current-See Website"
4. Copy the generated API key (it will look like "sk-1234abcd..." and be around 51 characters long)

### Step 3: Add the API Key to Environment

Set the API key in the environment:

```
export OPENAI_API_KEY=your-api-key-here
```

Or add it to the `.env` file:

```
OPENAI_API_KEY=your-api-key-here
```

## API Key Format

The OpenAI API key must be in the correct format:

- **Correct Format**: Standard OpenAI API keys start with `sk-` followed by a random string of letters and numbers
- **Length**: Around 51 characters total
- **Example**: `sk-abcdef1234567890ABCDEF1234567890abcdef123456`

## Testing the Integration

You can test if the OpenAI integration is working correctly:

```bash
node simple-ai-test.js
```

This script checks:
1. API key format
2. Basic Energy Assistant functionality
3. Product Analysis
4. Personalized Tips

## Troubleshooting

### Invalid API Key Format

If you see messages like:

```
API key format incorrect: false
```

Check that your API key:
- Starts with "sk-"
- Is approximately 51 characters long
- Hasn't been corrupted or modified

### Authentication Errors

If you see messages like:

```
401 Incorrect API key provided
```

This means OpenAI is rejecting your API key. Possible issues:
- The key has been revoked
- The key has reached its usage limit
- The key is formatted incorrectly

### Usage Limits

Be aware that OpenAI API usage incurs costs based on:
- Number of requests
- Model used (GPT-4o is more expensive than older models)
- Length of inputs and outputs

Monitor your usage at https://platform.openai.com/usage to avoid unexpected charges.

## Support

If you continue experiencing issues with the OpenAI integration, please contact your system administrator.