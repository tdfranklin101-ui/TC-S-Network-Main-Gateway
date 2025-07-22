# The Current-See Deployment Guide with Custom Database URL

This guide explains how to deploy The Current-See website on Replit with a custom database URL.

## Before Deployment

Ensure the following environment secret is set in your Replit project:

- `CURRENTSEE_DB_URL` - The PostgreSQL connection string for your database.

## Deployment Files

The following files are included for deployment:

1. `pure-deployment.js` - The main deployment server script.
2. `check-currentsee-db.js` - A utility to verify database connectivity.
3. `deploy-with-custom-db.sh` - A shell script to test and deploy.

## Database Connection

The deployment server is specifically designed to use the `CURRENTSEE_DB_URL` environment variable instead of the standard `DATABASE_URL`. It automatically falls back to `DATABASE_URL` if the custom URL isn't available.

## Current Database Status

The PostgreSQL database at `ep-spring-king-a5uj0576.us-east-2.aws.neon.tech` contains:

- 16 members in total
- 2 reserve entries (TC-S Solar Reserve, Solar Reserve)
- 14 individual members including Terry D. Franklin as member #3
- Daily distributions that automatically increment member balances

## API Endpoints

The deployment server provides the following API endpoints:

- `/health` - Returns server health status
- `/api/database/status` - Provides database connection status
- `/api/solar-clock` - Calculates and returns Solar Generator data
- `/api/members` - Lists all members
- `/api/member/:id` - Gets a single member by ID
- `/api/signup` - Creates a new member (requires name and email)

## Deployment Steps

1. Verify the database connection:
   ```
   node check-currentsee-db.js
   ```

2. Deploy the application:
   ```
   node pure-deployment.js
   ```

3. For a complete deployment with checks:
   ```
   chmod +x ./deploy-with-custom-db.sh
   ./deploy-with-custom-db.sh
   ```

## Important Notes

- The deployment server runs on port 3000 by default (or PORT from environment)
- Static files are served from the `public` directory
- The server provides SPA support by serving `index.html` for unmatched routes
- All API data is sourced directly from the PostgreSQL database
- The Solar Generator calculations use the April 7, 2025 start date

## Custom Domain Setup

After deploying on Replit, follow these steps to set up your custom domain:

1. In your Replit project, go to the "Deployments" tab
2. Click "Deploy" to deploy your website
3. Once deployed, click on "Custom domains"
4. Add your domain (www.thecurrentsee.org)
5. Update your DNS settings at Namecheap as instructed

## Troubleshooting

If you encounter database connection issues:

1. Verify your `CURRENTSEE_DB_URL` is correctly set
2. Check that the database is accessible from Replit's IP range
3. Ensure SSL settings are configured (rejectUnauthorized: false)
4. Try the check script to see detailed error messages