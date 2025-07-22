# D-ID Agent Setup Instructions

## Issue Identified
The current D-ID agent embed code appears to be using an outdated method or the agent has been removed/disabled from the D-ID platform. We need to create a fresh agent and get new embed code.

## Required Actions on D-ID Platform

### Step 1: Access D-ID Studio
1. Go to **https://studio.d-id.com**
2. Log in to your D-ID account (or create one if needed)

### Step 2: Create a New Agent
1. Click **"Create Agent"** or **"New Agent"**
2. **Agent Configuration:**
   - **Name**: "The Current-See Assistant"
   - **Description**: "Solar energy and sustainability AI assistant"
   - **Avatar**: Choose appropriate professional appearance
   - **Voice**: Select voice that matches your brand
   - **Language**: English (primary)

### Step 3: Upload Knowledge Base
Upload relevant documents about The Current-See:
- Solar energy information
- Company mission and values  
- FAQ about the platform
- Any other relevant business documents

### Step 4: Configure Settings
- **Personality**: Professional, knowledgeable about solar energy
- **Response Style**: Helpful and informative
- **Domain Allowlist**: Add these domains:
  - `http://localhost:3000`
  - `https://thecurrentsee.org`
  - `https://www.thecurrentsee.org`
  - Any other domains you'll use

### Step 5: Get Embed Code
1. After creating the agent, go to the **Agents Gallery**
2. Find your agent and hover over it
3. Click the **[...]** menu button
4. Select **"Embed Code"** or **"Integration"**
5. Copy the complete embed code snippet

### Step 6: What We Need From You
Please provide the following from the D-ID platform:

1. **Agent ID**: Should look like `agt_xxxxxxxxx`
2. **Client Key**: The authentication key for your agent
3. **Complete Embed Code**: The full HTML/JavaScript snippet

## Modern Implementation Options

### Option A: Script Tag Embed (Simplest)
If D-ID provides a script tag embed code, it will look like:
```html
<script type="module" src="https://agent.d-id.com/v2/index.js"
        data-agent-id="your_new_agent_id"
        data-client-key="your_new_client_key"
        data-mode="fabio"
        data-orientation="horizontal"
        data-position="right">
</script>
```

### Option B: SDK Implementation (More Control)
If using the JavaScript SDK:
```javascript
import * as sdk from '@d-id/client-sdk';

const agentManager = await sdk.createAgentManager('your_agent_id', {
    auth: {
        type: 'key',
        clientKey: 'your_client_key'
    },
    callbacks: {
        onSrcObjectReady(srcObject) {
            // Connect to video element
        }
    }
});
```

## Current Website Integration Points
The agent will be embedded in:
- **Homepage**: `public/index.html` (main integration)
- **Position**: Right side of screen
- **Orientation**: Horizontal layout
- **Functionality**: Voice and text interaction

## Next Steps
1. Complete the D-ID Studio setup above
2. Provide the new agent credentials
3. I'll integrate the fresh embed code into the website
4. Test the integration before deployment

## Troubleshooting
If you encounter issues:
- Ensure domain is in the allowlist
- Verify agent is published/active
- Check that client key has proper permissions
- Confirm agent ID format is correct

Please complete the D-ID Studio setup and provide the new agent credentials so I can properly integrate the AI assistant into The Current-See platform.