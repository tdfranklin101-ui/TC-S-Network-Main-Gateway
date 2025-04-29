# The Current-See Deployment Guide

This guide provides instructions for deploying The Current-See website on Replit with stability and proper functionality.

## Deployment Steps

1. **Set Run Command**
   - Go to your Replit project settings
   - Set the "Run" command to: `node run-deployment.js`
   - This will use our enhanced deployment system with auto-restart capability

2. **Configure Environment Variables**
   - Ensure the following environment variables are set:
     - `PORT`: 3001
     - `HOST`: 0.0.0.0
   - These settings ensure proper binding for external access

3. **Configure Domain**
   - In Replit, go to "Deployment" tab
   - Connect your custom domain `www.thecurrentsee.org` 
   - Follow Replit's instructions to update DNS settings at Namecheap

4. **Deploy the Application**
   - Click the "Deploy" button in Replit
   - Wait for the build process to complete
   - Once deployed, you'll get a deployment URL

5. **Verify Functionality**
   - Check that all pages load correctly
   - Verify the hamburger menu works on mobile
   - Confirm all 18 members display properly
   - Test the Solar Generator counter

## Troubleshooting

If you encounter issues after deployment:

1. **Server Crashes**
   - The `run-deployment.js` script includes automatic restart
   - Check `deploy-server.log` for error details

2. **Members Not Appearing**
   - Verify `embedded-members.json` is present in the public directory
   - Check network requests in the browser developer tools

3. **Navigation Issues**
   - Clear browser cache or try in incognito mode
   - Verify that load-includes.js is working correctly

4. **Solar Counter Problems**
   - Check that real_time_solar_counter.js is being loaded
   - Verify calculations in deploy-server.js

## Important Files

- `run-deployment.js` - Main entry point for deployment
- `server-restart.js` - Ensures server restarts if it crashes
- `deploy-server.js` - Primary server implementation
- `public/embedded-members.json` - Static member data as fallback

## Maintenance

- To update member data, edit `members_export.csv` file
- To modify site content, edit the appropriate HTML files in the public directory
- Server logs are available in `deploy-server.log`

For additional assistance, contact The Current-See development team.