# The Current-See Deployment Instructions

## Setup Replit Deployments

1. **Setup Run Command**:
   - In Replit, go to the "Secrets" tab
   - Add the startup command as a secret with the key `RUN` and value `node run-deployment.js`

2. **Required Dependencies**:
   - The following Node.js packages should be installed:
     - express
     - cors
     - body-parser
     - pg
     - express-session
   - Install any missing dependencies with the package manager

3. **Configure Environment Variables**:
   - Set the following environment variables:
     - `PORT`: 3001
     - `HOST`: 0.0.0.0

4. **Deploy Application**:
   - Click the "Deploy" button in Replit
   - Wait for the build process to complete
   - Your application will be deployed to a `.replit.app` domain

## Setup Custom Domain

1. **Connect Domain in Replit**:
   - Go to the "Deployments" tab in your Replit
   - Click "Custom domain"
   - Enter your domain: `www.thecurrentsee.org`
   - Follow the provided instructions to update your DNS settings

2. **Update DNS at Namecheap**:
   - Log in to your Namecheap account
   - Go to the Domain List and select thecurrentsee.org
   - Click "Manage" and navigate to "Advanced DNS"
   - Add CNAME records as instructed by Replit
   - Wait for DNS propagation (may take up to 24-48 hours)

## Troubleshooting

If you experience issues during deployment:

1. **Server Not Starting**:
   - Check `deploy-server.log` for error messages
   - Ensure all required environment variables are set
   - Verify the PORT isn't being used by another service

2. **Members List Not Working**:
   - Verify the existence of `public/embedded-members.json`
   - Check that all API endpoints are functioning correctly in the logs

3. **Navigation or Display Issues**:
   - Clear browser cache or try in incognito mode
   - Check for console errors in the browser developer tools

4. **White Papers Missing**:
   - Ensure all white paper HTML files exist in the public directory
   - Verify links on whitepapers.html are correctly pointing to the files

## Maintenance

For ongoing maintenance of the site:

1. **Update Member Data**:
   - Edit the `members_export.csv` file with new member information
   - Redeploy the application to update the embedded data

2. **Add New Content**:
   - Add new files to the appropriate directories in `/public`
   - Update navigation links in `/public/includes/header.html`

3. **Check Logs**:
   - Monitor `deploy-server.log` for any issues or errors
   - Address any recurring problems as needed

4. **Restart Server**:
   - If needed, restart the server by stopping and starting the Replit
   - The auto-restart functionality should handle most crash scenarios

For additional technical support, contact your development team.