# The Current-See Deployment Guide

This document contains instructions for deploying The Current-See website to www.thecurrentsee.org.

## Deployment Files

The following files are ready for deployment:

1. `unified-deploy.js` - Main deployment server that handles both health checks and the application
2. `server.js` - The Current-See application server
3. `health-check.js` - Standalone health check file (fallback)
4. `deploy-ready.js` - Simplified deployment server (alternative option)
5. `deploy-config.js` - Deployment configuration

## Deployment Steps

### 1. Prepare for Deployment

Ensure all files are properly committed to version control.

### 2. Set Environment Variables

Make sure the following environment variables are set in the Replit deployment environment:

- `PORT`: 3000 (default)
- `DATABASE_URL`: URL to the PostgreSQL database
- `ADMIN_API_TOKEN`: Token for admin API access
- `SESSION_SECRET`: Secret for session management

### 3. Deploy with Replit

1. Open the Replit project
2. Click the "Deploy" button in the Replit interface
3. Choose "Deploy from Git" option
4. Set the configuration:
   - Entry point: `unified-deploy.js`
   - Environment: Node.js

### 4. Configure Custom Domain

1. In the Replit deployment settings, add the custom domain: www.thecurrentsee.org
2. Follow the DNS configuration instructions provided by Replit
3. Update your domain's DNS settings at Namecheap with the CNAME record provided by Replit

### 5. Verify Deployment

1. Check that the health check endpoint is responding: https://www.thecurrentsee.org/
2. Verify that all pages are loading correctly:
   - Home page: https://www.thecurrentsee.org/
   - Declaration page: https://www.thecurrentsee.org/declaration.html
   - Wallet features: https://www.thecurrentsee.org/wallet-ai-features.html
   - Whitepapers: https://www.thecurrentsee.org/whitepapers.html
   - Founder note: https://www.thecurrentsee.org/founder_note.html
   - My Solar: https://www.thecurrentsee.org/my-solar.html
   - Solar Generator: https://www.thecurrentsee.org/solar-generator.html

### 6. Troubleshooting

If deployment fails, consider these steps:

1. Check the Replit logs for error messages
2. Verify that the health check is responding correctly
3. Try deploying with the alternative `deploy-ready.js` file
4. Check DNS configuration if the custom domain is not working

## Visual Enhancements

The deployed website includes the following visual enhancements:

1. **Sun Ray Watermarks**: Each page has a unique sun ray watermark pattern that matches its purpose:
   - Home page: Varying section-specific patterns
   - Declaration page: Golden rays
   - Wallet features page: Green-tinted rays
   - Founder note page: Alternating subtle green/gold rays
   - Whitepapers page: Blue and gold academic-themed rays
   - Demo features page: Feature-oriented ray pattern
   - Solar generator page: Bright yellow rays
   - My Solar page: Blue and gold distribution-themed rays

2. **Animation Effects**: Subtle animations that reinforce the solar energy concept.

3. **Standardized Gradients**: Consistent color gradients defined as CSS variables for easy management.

## Post-Deployment

After successful deployment, verify the following:

1. All pages load correctly with proper styling
2. Watermark backgrounds appear on each page
3. Animations work as expected
4. Solar Generator counter is calculating correctly
5. API endpoints are responding appropriately

## Contact

For assistance with deployment, contact:
- Email: hello@thecurrentsee.org