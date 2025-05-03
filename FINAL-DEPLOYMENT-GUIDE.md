# The Current-See - Final Deployment Guide

This guide provides step-by-step instructions for deploying The Current-See website to Replit with a custom domain.

## Pre-Deployment Checklist

1. Ensure your code is working correctly in the Replit development environment
2. Make sure all required environment variables are set in Replit Secrets:
   - `CURRENTSEE_DB_URL` - PostgreSQL connection string
   - `OPENAI_API_KEY` or `NEW_OPENAI_API_KEY` - API key for OpenAI integration
   - `NODE_ENV` - Set to "production"
3. Verify the Procfile contains: `web: node simple-deploy.js`
4. Confirm all HTML, CSS, and JavaScript files are in the `/public` directory

## Deployment Process

### Step 1: Clean Up the Environment

First, stop any running processes to prevent channel conflicts:

1. Click on the "Shell" tab in Replit
2. Run this command to stop all Node.js processes:
   ```bash
   pkill -f node || echo "No processes to kill"
   ```
3. Wait 5-10 seconds for all channels to properly close

### Step 2: Test the Deployment Server Locally

Before deploying, test that the ultra-minimal server works correctly:

1. In the Shell, run:
   ```bash
   node simple-deploy.js
   ```
2. Wait for the server to start and check the console output for any errors
3. Test the website in the Webview tab to ensure everything loads correctly
4. Press Ctrl+C to stop the server when you're done testing

### Step 3: Deploy to Replit

Now you're ready to deploy your application:

1. Click the "Deploy" button in the sidebar
2. Choose "Web Service" as the deployment type
3. Select "Node.js" as the language
4. Use the default settings for the rest of the options
5. Click "Deploy" to start the deployment process

### Step 4: Set Up Custom Domain

To use your www.thecurrentsee.org domain:

1. In the Replit deployment settings, click "Add Custom Domain"
2. Enter `www.thecurrentsee.org` as your domain
3. Follow the DNS configuration instructions provided by Replit
4. For Namecheap:
   - Log in to your Namecheap account
   - Go to your domain's DNS settings
   - Add the CNAME records exactly as instructed by Replit
   - Wait 15-30 minutes for DNS propagation

### Step 5: Verify the Deployment

After deployment is complete:

1. Visit your Replit deployment URL to ensure everything is working
2. Check that the health endpoints are responding:
   - `https://[your-repl-url]/health`
   - `https://[your-repl-url]/healthz`
3. Test your custom domain once DNS has propagated:
   - `https://www.thecurrentsee.org`

## Troubleshooting

If you encounter deployment issues:

### "Channel already opened" Error

If you see `Channel with name module:nodejs-20/packager:upmNodejs already opened`:

1. Stop your Repl completely (click the stop button)
2. Wait 30 seconds for all processes to fully terminate
3. Clean up the environment using the commands in Step 1
4. Try deploying again using `simple-deploy.js`

### Deployment Fails to Start

If the deployment fails to start:

1. Check the Replit logs for specific error messages
2. Verify your Procfile is correct and points to `simple-deploy.js`
3. Ensure your PostgreSQL database is accessible from Replit
4. Check that all environment variables are properly set

### Website Loads but Features Don't Work

If the basic website loads but some features don't work:

1. Check browser console for JavaScript errors
2. Verify that the API endpoints like `/api/members.json` are working
3. Test the OpenAI integration with a simple query
4. Check database connectivity from the deployment

## Manual Deployment Recovery

If all else fails, you can try this manual recovery process:

1. In the Shell, run:
   ```bash
   cd /home/runner/${REPL_SLUG}
   pkill -f node
   rm -f nohup.out
   sleep 5
   nohup node simple-deploy.js &
   ```
2. This will start the server manually in a way that avoids channel conflicts

Remember to check the logs at `nohup.out` if you use this approach.

## Maintaining Your Deployment

Once deployed successfully:

1. Make updates to your code in the development environment
2. Test thoroughly before redeploying
3. Follow the same deployment process for updates
4. Consider setting up automatic deployments for future updates

For any persistent issues, please check the Replit documentation or reach out to Replit support.