# The Current-See Deployment Guide

## Deployment Overview

This guide provides instructions for deploying The Current-See website to www.thecurrentsee.org using Replit.

## Deployment Steps

1. **Verify Environment Variables**
   - Ensure `CURRENTSEE_DB_URL` is set to connect to the production database
   - Ensure `OPENAI_API_KEY` or `NEW_OPENAI_API_KEY` is set for AI functionality

2. **Deploy Using Replit**
   - Click the "Deploy" button in your Replit project
   - Select "Deploy from current state"
   - Set custom domain to www.thecurrentsee.org
   - Enable HTTPS

3. **Verify Deployment**
   - Check the following endpoints to ensure they're working:
     - https://www.thecurrentsee.org/ (Main site)
     - https://www.thecurrentsee.org/health (Health check)
     - https://www.thecurrentsee.org/api/system/status (API status)

## Post-Deployment Verification

1. **Data Verification**
   - Ensure the Solar Generator counter is working
   - Verify member data is displaying correctly
   - Check that daily SOLAR distribution is functioning

2. **Feature Verification**
   - Test AI functionality with the voice assistant
   - Verify multilingual support is working
   - Confirm all navigation links are working correctly

## Troubleshooting

If you encounter any issues:

1. Check server logs for error messages
2. Verify database connection is working
3. Ensure all environment variables are set correctly
4. Check that the OpenAI API key is valid
5. If necessary, redeploy the application

## Maintenance

- The solar distribution occurs automatically at 00:00 GMT (5PM Pacific Time)
- The website automatically updates after distributions
- Member data is stored in the PostgreSQL database specified by `CURRENTSEE_DB_URL`