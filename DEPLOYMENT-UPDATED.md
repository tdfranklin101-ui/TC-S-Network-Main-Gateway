# The Current-See Deployment Guide

This guide provides instructions for deploying The Current-See website correctly using Replit's deployment functionality.

## Deployment Process

1. **Preparation**:
   - Ensure all files from the April 18th backup have been restored to the proper locations
   - Verify the deploy-server.js file is up-to-date with all routes
   - Check that the database connection is properly configured

2. **Configure the Run Command**:
   When setting up the deployment in Replit, use the following run command:
   ```
   node deploy-server.js
   ```

3. **Environment Variables**:
   Ensure the following environment variables are set:
   - `NODE_ENV=production`
   - `CURRENTSEE_DB_URL` - The database URL for The Current-See database
   - `OPENAI_API_KEY` - For AI functionality (if used)
   - `PORT=3000` - The port the server should listen on (Replit will handle this automatically)

4. **Deployment Steps**:
   1. Click the "Deploy" button in the Replit interface
   2. Select "Deploy from this Repl"
   3. Set the run command to `node deploy-server.js`
   4. Click "Deploy"

5. **Verify Deployment**:
   - The deployment should respond with a 200 OK status on the root path (/)
   - The Solar Generator counter should be updating in real-time
   - The Members List page should display the current members

6. **Domain Configuration**:
   - Once deployed, configure the custom domain (www.thecurrentsee.org) in the Replit deployment settings

## Troubleshooting

If you encounter issues with the deployment:

1. **Check the Logs**:
   - Review the deployment logs for any error messages

2. **Verify Database Connection**:
   - Ensure the CURRENTSEE_DB_URL environment variable is set correctly
   - Test the database connection with the check-currentsee-db.js script

3. **Port Configuration**:
   - Verify the server is listening on the correct port (0.0.0.0:3000)

4. **File Access**:
   - Make sure all static files are properly accessible in the public directory

5. **API Endpoints**:
   - Test critical API endpoints like /api/solar-clock and /api/members

## Maintenance

To update the deployed website:

1. Make changes to the necessary files
2. Test locally using `node deploy-server.js`
3. Redeploy via the Replit interface

---

Last Updated: April 28, 2025