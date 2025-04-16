# The Current-See Deployment Guide

This document outlines the deployment process for The Current-See website on Replit.

## Deployment Steps

1. **Prepare for Deployment**:
   - Ensure all HTML files have the header and footer placeholders
   - Verify the solar counter is working properly
   - Test language translation functionality
   - Test AI assistant and voice assistant features
   - Test all pages and navigation

2. **Deploy on Replit**:
   - Use the Replit deployment feature
   - The deployment uses `main.js` as the entry point (which is linked to `deploy-simple.js`)
   - The server handles both file serving and health checks

3. **Configure Domain**:
   - Once deployed, configure the custom domain (www.thecurrentsee.org)
   - Follow Replit's custom domain setup instructions
   - Update DNS settings on Namecheap

## Testing Deployment

- Use the health check endpoint: `/health`
- Verify all pages load correctly
- Test header and footer inclusion
- Check the solar counter functionality

## Updates and Fixes

### Solar Counter Fix (April 16, 2025)

The solar counter component was updated to address issues with initialization after header/footer injection:

1. **Modified Files**:
   - `public/js/real_time_solar_counter.js`: Added retry mechanism and improved initialization
   - `main.js` and `deploy-simple.js`: Enhanced HTML processing to ensure scripts run after DOM is ready

2. **How to Update Existing Deployment**:
   - Run the included `update-deploy.sh` script which will:
     - Copy the updated JS files to the deployment directory
     - Attempt to restart the server if PM2 or systemctl are available
   - Alternatively, manually redeploy using the Replit interface

3. **Verifying the Fix**:
   - Check that the solar counter appears and animates on:
     - Homepage (index.html)
     - Solar Generator page (solar-generator.html)
     - My Solar page (my-solar.html)
   - Verify the counter shows proper MkWh values (6 decimal places)
   - Verify monetary values update in real-time

## Troubleshooting

If you encounter issues:

1. **Header/Footer Not Loading**:
   - Verify the placeholders exist in the HTML files
   - Check the includes directory structure

2. **Server Errors**:
   - Check the logs in the Replit console
   - Verify port settings (default: 3000)

3. **Solar Counter Issues**:
   - Verify the solar counter script is included
   - Check the initialization values

4. **Language Translator Not Working**:
   - Verify language-translator.js is loaded
   - Check language-translator-loader.js is included in footer
   - Ensure Google Translate API is accessible
   
5. **AI or Voice Assistant Issues**:
   - Check that wallet-ai-assistant.js is properly loaded
   - Verify voice-assistant.js is included
   - Test speech recognition API browser compatibility

## Maintenance

- Update content through the Replit editor
- Any significant changes might require re-deployment
- Monitor logs regularly for potential issues

## Contact

For deployment assistance, contact: support@thecurrentsee.org