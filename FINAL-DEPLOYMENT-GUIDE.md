# The Current-See Final Deployment Guide

This guide provides step-by-step instructions for deploying The Current-See website to www.thecurrentsee.org using Replit with the custom PostgreSQL database.

## Prerequisites

1. The PostgreSQL database connection string (`CURRENTSEE_DB_URL`) must be set as an environment secret
2. The database should have the members table already set up with at least 16 members
3. Terry D. Franklin should be member #3 with a joined date of April 9, 2025

## Deployment Scripts

Three main deployment scripts have been created:

1. **`pure-deployment.js`** - The main deployment server
   - Uses plain Node.js HTTP module to avoid dependencies
   - Connects to PostgreSQL using `CURRENTSEE_DB_URL`
   - Includes full API implementation and static file serving

2. **`check-currentsee-db.js`** - Database connection checker
   - Verifies connectivity to the PostgreSQL database
   - Shows detailed errors if connection fails
   - Displays member counts and basic information

3. **`verify-deployment.js`** - Complete deployment verification
   - Tests database connectivity
   - Verifies API endpoints
   - Ensures Solar Generator calculations are working

## Required Environment Secrets

Before deployment, set the following secrets in your Replit environment:

- **`CURRENTSEE_DB_URL`**: The PostgreSQL connection string
   ```
   postgresql://neondb_owner:<password>@ep-spring-king-a5uj0576.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

## Deployment Steps

### 1. Check Database Connection

Run the database checker to verify connectivity:

```
node check-currentsee-db.js
```

This should show a successful connection to the database with 16 members.

### 2. Start the Deployment Server

Launch the main deployment server:

```
node pure-deployment.js
```

The server will run on port 3000 and automatically connect to the database.

### 3. Verify Deployment

In a separate terminal, run the verification script:

```
node verify-deployment.js
```

This will test all API endpoints and database access to ensure everything is working correctly.

### 4. Deploy on Replit

Once verification passes, deploy the application on Replit:

1. Go to the "Deployments" tab in your Replit project
2. Click "Deploy" to deploy the application
3. Wait for the deployment to complete
4. Access the deployment URL to verify it's working

### 5. Set Up Custom Domain

After successful deployment:

1. Click "Custom domains" in the Deployments section
2. Add www.thecurrentsee.org as your custom domain
3. Update DNS settings at Namecheap as directed by Replit
4. Wait for DNS propagation (may take 24-48 hours)

## API Endpoints

The deployment provides these API endpoints:

- **`/health`** - Server health check
- **`/api/database/status`** - Database connection status
- **`/api/solar-clock`** - Solar Generator calculations
- **`/api/members`** - List of all members
- **`/api/member/:id`** - Single member details
- **`/api/signup`** - New member registration

## Troubleshooting

If you encounter issues:

1. **Database Connection Errors**
   - Verify the `CURRENTSEE_DB_URL` is correctly set
   - Check that the database is accessible from Replit's IP range
   - Ensure SSL settings are correct (rejectUnauthorized: false)

2. **Server Startup Issues**
   - Check for port conflicts
   - Verify all dependencies are installed
   - Look for syntax errors in the deployment scripts

3. **Deployment Failures**
   - Check Replit logs for specific errors
   - Verify the entry point is correctly set to `pure-deployment.js`
   - Make sure the server responds to the health check at `/health`

## Additional Information

- Solar Generator calculations use April 7, 2025 as the start date
- The value of 1 SOLAR is set to $136,000
- Energy conversion is set to 4,913 kWh per SOLAR
- Database fallbacks are included for robustness
- Daily distributions occur at 00:00 GMT (5 PM Pacific Time)

## Database Backup

The deployment automatically creates a backup of member data when initialized, storing it in `members.json`. This provides a fallback if the database connection is temporarily unavailable.

## Next Steps

After deployment:

1. Verify the site is accessible at www.thecurrentsee.org
2. Test signup functionality
3. Verify daily distributions are occurring properly
4. Monitor the Solar Generator calculations