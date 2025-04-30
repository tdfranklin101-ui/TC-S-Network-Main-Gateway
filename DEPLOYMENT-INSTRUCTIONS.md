# The Current-See Deployment Instructions

This document outlines the steps to deploy The Current-See website to your custom domain (www.thecurrentsee.org).

## Deployment Steps

### 1. Pre-Deployment Checklist

Ensure the following items are complete before deployment:

- [x] All HTML files are properly structured and responsive
- [x] JavaScript functions are working correctly for member loading and SOLAR calculations
- [x] API endpoints are correctly set up (/api/members, /api/distribution-ledger, etc.)
- [x] All static assets (images, CSS, JS) are included
- [x] Distribution page displays all members with correct SOLAR values (1 SOLAR per day since join date)

### 2. Deployment Process on Replit

1. **Configure Replit Deployment**
   - From your Replit project, click on the "Deployment" tab in the sidebar
   - Click "Deploy to Replit"
   - Set your deployment name: `thecurrentsee`

2. **Configure Domain**
   - In the Replit deployment settings, select "Custom Domain"
   - Enter your domain: `www.thecurrentsee.org`
   - Follow the instructions to set up DNS records at your Namecheap account
   - Add these records to your Namecheap DNS settings:
     * Type: CNAME
     * Host: www
     * Value: thecurrentsee.repl.co.
     * TTL: Automatic

3. **Environment Configuration**
   - Make sure the following environment variables are set in the deployment:
     * `PORT=3001` (this is the port the server runs on internally)
   - Note that Replit handles port mapping to port 443 (HTTPS) automatically

4. **Deploy the Application**
   - Use the `deploy-server.js` as your entry point
   - Command to run: `node deploy-server.js`
   - Click "Deploy"

### 3. Post-Deployment Verification

After deployment completes, verify the following:

1. **Website Accessibility**
   - Ensure the website is accessible via HTTPS: `https://www.thecurrentsee.org`
   - Verify all pages load correctly

2. **API Functionality**
   - Test the member data API: `https://www.thecurrentsee.org/api/members.json`
   - Test the distribution ledger API: `https://www.thecurrentsee.org/api/distribution-ledger`

3. **Content Verification**
   - Verify the Solar Generator counter is updating correctly
   - Verify the distribution page shows all members with correct SOLAR values
   - Check all other pages for proper formatting and content

### 4. Troubleshooting

If you encounter issues during deployment:

1. **Server Not Starting**
   - Check server logs in the Replit deployment console
   - Verify the port configuration (should be 3001 internally)

2. **Domain Not Resolving**
   - Verify DNS settings at Namecheap are correctly configured
   - DNS propagation can take up to 24-48 hours

3. **API Endpoints Not Working**
   - Check server logs for API-specific errors
   - Verify CORS settings if connecting from external applications

## Maintenance Notes

- The server includes automatic daily distribution calculations at midnight GMT
- Member data is automatically updated with real-time SOLAR totals
- All members receive 1 SOLAR per day since their join date
- SOLAR values are displayed with 4 decimal places
- Dollar values are calculated at $136,000 per SOLAR
- Energy values are calculated at 4,913 kWh per SOLAR