# The Current-See Deployment Guide

This guide provides instructions for deploying The Current-See website to Replit.

## Deployment Steps

1. **Prepare for deployment**:
   - Make sure all your files are saved
   - We've created a specialized deployment server in `deploy-server.js`

2. **Set the deployment file**:
   When setting up the deployment in Replit:
   - Click on "Edit commands and secrets" 
   - For the "Run" command enter: `node deploy-server.js`
   - This will use our optimized deployment server

3. **Deploy the website**:
   - Click the "Deploy" button in Replit
   - Wait for the deployment to complete

4. **Verify the deployment**:
   - Visit the deployment URL to make sure the website is working
   - Check that the solar counter is working
   - Verify that all links and navigation work correctly

## Troubleshooting

If deployment fails:

1. **Check for server errors**:
   - View the logs in the Replit deployment dashboard
   - Look for any error messages in the console

2. **Health check issues**:
   - Make sure the server responds to the root path (/)
   - The `deploy-server.js` file is configured to respond to health checks

3. **Missing includes or resources**:
   - Ensure all required files are in the correct locations
   - Headers and footers should be in the `public/includes` directory

## Custom Domain Setup

To use your custom domain (www.thecurrentsee.org):

1. In Replit's deployment settings, add your custom domain
2. Update your domain's DNS settings at Namecheap:
   - Add a CNAME record pointing www to your Replit deployment URL
   - Wait for DNS propagation (may take up to 48 hours)

## Environmental Variables

Make sure these environment variables are set in the Replit deployment:

- `PORT`: Automatically set by Replit (usually 3000)
- `DATABASE_URL`: For PostgreSQL database connection
- `CURRENTSEE_DB_URL`: For your custom database connection
- `OPENAI_API_KEY`: For AI functionality