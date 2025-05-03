# The Current-See Deployment Guide

## Introduction
This guide provides step-by-step instructions for deploying The Current-See website on Replit with custom domain www.thecurrentsee.org.

## Prerequisites
1. A Replit account
2. Access to the www.thecurrentsee.org domain on Namecheap
3. The Current-See codebase in a Replit project
4. Required environment variables:
   - `CURRENTSEE_DB_URL` - The PostgreSQL database URL for Current-See data
   - `OPENAI_API_KEY` or `NEW_OPENAI_API_KEY` - API key for OpenAI integration

## Deployment Steps

### 1. Prepare the Codebase
Make sure you have the latest version of the codebase with all these files:
- `index.js` - The main entry point for the application
- `Procfile` - For Replit deployment
- `run` - Executable script for running the application
- `.replit.deployment.config` - Replit deployment configuration
- `.replit` - Replit configuration file

### 2. Set Up Environment Variables
1. In your Replit project, navigate to the "Secrets" tab
2. Add the following secrets:
   - `CURRENTSEE_DB_URL` - Your PostgreSQL database URL
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `NODE_ENV` - Set to "production"

### 3. Deploy to Replit
1. From your Replit project, click on the "Deploy" button
2. Select "Web Service" when prompted
3. Add custom domains:
   - Add www.thecurrentsee.org as the primary domain
   - Optionally add thecurrentsee.org as a secondary domain
4. Follow the instructions to update DNS settings on Namecheap
5. Wait for DNS propagation (can take up to 24-48 hours)

### 4. Configure DNS on Namecheap
1. Log in to your Namecheap account
2. Go to the Domain List and select thecurrentsee.org
3. Click on "Manage" and navigate to the "Advanced DNS" tab
4. Update the following records:
   - Add a CNAME record with host "www" pointed to your Replit deployment URL
   - Add appropriate A records and AAAA records as instructed by Replit

### 5. Verify the Deployment
1. After DNS propagation is complete, visit www.thecurrentsee.org to check if the site is working
2. Run the verification script:
   ```
   node verify-deployment.js https://www.thecurrentsee.org
   ```
3. Check all critical functionality:
   - Solar counter is updating in real-time
   - Member data is displaying correctly
   - OpenAI integration is working
   - All pages load correctly

## Troubleshooting
If you encounter issues with your deployment, try these steps:

1. Check the Replit logs for any errors
2. Verify that all environment variables are set correctly
3. Make sure the health check endpoint is working
4. Test the local server first before deploying
5. Use the verification script to identify specific issues

For database connection issues, check if the `CURRENTSEE_DB_URL` is correct and that the database is accessible from the Replit environment.

## Maintenance

### Updating the Website
1. Make changes to the codebase
2. Test locally
3. Deploy again using the same steps

### Monitoring
- Regularly check the logs for any errors
- Use the verification script to ensure all components are working
- Monitor the database and OpenAI integration

## Contact Support
If you need assistance with deployment, contact technical support at support@thecurrentsee.org.