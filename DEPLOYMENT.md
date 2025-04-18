# The Current-See Deployment Guide

This document provides instructions for deploying The Current-See website to Replit and configuring it with the custom domain www.thecurrentsee.org.

## Deployment Checklist

### Pre-Deployment Steps

1. ✅ Synchronized main.js with deploy-simple.js
2. ✅ Verified health check endpoints are properly configured
3. ✅ Confirmed SOLAR distribution system is functioning
4. ✅ Checked all API endpoints are working correctly
5. ✅ Updated header and footer navigation

### Deployment Steps

1. **Deploy to Replit**
   - Click the "Deploy" button in the Replit interface
   - Replit will handle building and deploying the application
   - The deployment process uses the configuration in main.js

2. **Verify Replit Deployment**
   - Once deployed, Replit will provide a URL (*.replit.app)
   - Visit this URL and make sure the site loads correctly
   - You can run the verification script:
     ```
     node deployment-verification.js yourdomain.replit.app
     ```

3. **Configure Custom Domain**
   - In the Replit dashboard, go to your project
   - Click on the "Deployments" tab
   - Select "Custom domains"
   - Add your domain www.thecurrentsee.org
   - Follow the DNS instructions to point the domain to Replit

4. **DNS Configuration (at Namecheap)**
   - Log in to your Namecheap account
   - Go to the Domain List and select thecurrentsee.org
   - Click "Manage"
   - Select the "Advanced DNS" tab
   - Add a CNAME record:
     - Type: CNAME
     - Host: www
     - Value: (your-replit-app-url without https://)
     - TTL: Automatic
   - Add URL Redirect record for apex domain:
     - Type: URL Redirect
     - Host: @
     - Value: http://www.thecurrentsee.org/
     - TTL: Automatic

5. **Verify Custom Domain**
   - Wait for DNS propagation (can take up to 48 hours)
   - Visit www.thecurrentsee.org to verify it loads correctly
   - Test key functionality:
     - Sign up process
     - SOLAR counter
     - Member display
     - Navigation
   - You can run the verification script:
     ```
     node deployment-verification.js thecurrentsee.org
     ```

## Server Health Monitoring

The Current-See server includes built-in health monitoring:

- `/health` endpoint for direct health checks
- Root path (`/`) handles deployment health checks
- Daily SOLAR distribution runs at midnight UTC
- Member data is automatically updated

## Regular Maintenance

- The system will automatically handle SOLAR distributions
- New members will receive their initial SOLAR allocation
- Member data is persisted across server restarts
- No manual intervention is needed for daily operations

## Troubleshooting

If you encounter issues with the deployment:

1. Check the server logs in Replit
2. Verify the health endpoint is responding
3. Make sure the correct port is being used (PORT environment variable or default 3000)
4. Check DNS configuration if the custom domain is not working
5. Restart the server if necessary

## Contact

For technical support with the deployment:
- Email: hello@thecurrentsee.org