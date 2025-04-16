# The Current-See Deployment Guide

This document outlines the deployment process for The Current-See website on Replit.

## Deployment Steps

1. **Prepare for Deployment**:
   - Ensure all HTML files have the header and footer placeholders
   - Verify the solar counter is working properly
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

## Maintenance

- Update content through the Replit editor
- Any significant changes might require re-deployment
- Monitor logs regularly for potential issues

## Contact

For deployment assistance, contact: support@thecurrentsee.org