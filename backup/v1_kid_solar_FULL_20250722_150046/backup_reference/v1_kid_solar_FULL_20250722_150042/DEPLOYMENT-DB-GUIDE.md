# The Current-See Database Deployment Guide

This guide provides instructions for ensuring proper database functionality when deploying The Current-See website.

## Prerequisites

Before deployment, ensure you have:

1. A PostgreSQL database (provided by Replit)
2. The database connection details:
   - `DATABASE_URL` - Complete connection string
   - `PGHOST` - Database hostname
   - `PGUSER` - Database username
   - `PGPASSWORD` - Database password
   - `PGDATABASE` - Database name
   - `PGPORT` - Database port (usually 5432)
3. The mobile app API key:
   - `MOBILE_APP_API_KEY` - API key for mobile app authentication

## Deployment Steps

1. **Run the Deployment Configuration Script**:
   ```bash
   bash deployment-config.sh
   ```
   This script will:
   - Check if all required environment variables are set
   - Test the database connection
   - Create a backup of member data
   - Set up the environment for deployment

2. **Deploy the Application**:
   - Click the "Deploy" button in Replit
   - Ensure all environment variables are transferred to the deployment environment

3. **Verify Deployment**:
   - Check the deployment logs for any database connection errors
   - Visit the `/health` endpoint to verify the application status
   - Visit the `/api/database/status` endpoint to verify database connectivity

## Troubleshooting Database Connection Issues

If you experience database connection issues during deployment, follow these steps:

1. **Check Environment Variables**:
   - Ensure all database-related environment variables are set in the deployment environment
   - Verify that the values are correct (no typos)

2. **Run the Database Connection Test**:
   ```bash
   node test-db-connection.js
   ```
   This will provide detailed diagnostics about the database connection.

3. **Use the Deployment Helper**:
   ```bash
   node deployment-helper.js
   ```
   This script will check environment variables, set up fallbacks, and test the database connection.

4. **Check Database Firewall Rules**:
   - Ensure the database server allows connections from the deployment IP address
   - For Neon PostgreSQL, check if your IP range is allowed in the dashboard

5. **SSL Connection Issues**:
   - If you see SSL-related errors, try setting `sslmode=require` in your DATABASE_URL
   - For Replit deployments, you may need to disable SSL verification:
     ```javascript
     ssl: { rejectUnauthorized: false }
     ```

6. **Use the Fallback Deployment Server**:
   ```bash
   node deploy-with-db-fallback.js
   ```
   This server includes enhanced error handling and fallback mechanisms for database connection issues.

## Database Diagnostics

The following endpoints can be used to diagnose database issues:

- `/health` - Basic health check that includes database status
- `/api/database/status` - Detailed database status information
- `/mobile/status` - Mobile API status, including database connectivity
- `/check-db` - (In deployment-database-check.js) Full database connection diagnostics

## Recovering From Database Failures

If the database is completely inaccessible during deployment:

1. The application will automatically fall back to using the `members.json` file
2. The deployment helper will log detailed error information
3. The fallback deployment server will continue to function with limited capabilities

To fix the database issues:

1. Check the database connection parameters in the Replit Secrets
2. Verify the database is running and accessible
3. Redeploy the application with the correct environment variables

## Environment Variables Transfer

When deploying on Replit, ensure the environment variables are correctly transferred to the deployment environment:

1. Go to your Replit project
2. Click on the "Secrets" tool (lock icon in the left sidebar)
3. Add each required environment variable as a secret

## Database Backup and Restore

To create a manual backup of the database:

```bash
node -e "
  const fs = require('fs');
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  async function createBackup() {
    try {
      const result = await pool.query('SELECT * FROM members ORDER BY id ASC');
      fs.writeFileSync('members_backup.json', JSON.stringify(result.rows, null, 2));
      console.log('Created backup with ' + result.rows.length + ' members');
      pool.end();
    } catch (err) {
      console.error('Error:', err.message);
      pool.end();
    }
  }
  
  createBackup();
"
```

To restore from a backup file:

```bash
node -e "
  const fs = require('fs');
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  async function restoreBackup() {
    try {
      const members = JSON.parse(fs.readFileSync('members_backup.json', 'utf8'));
      console.log('Restoring ' + members.length + ' members...');
      
      for (const member of members) {
        await pool.query(
          'INSERT INTO members (id, name, username, email, joined_date, total_solar, last_distribution_date, is_anonymous) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name = $2, username = $3, email = $4, joined_date = $5, total_solar = $6, last_distribution_date = $7, is_anonymous = $8',
          [member.id, member.name, member.username, member.email, member.joined_date, member.total_solar, member.last_distribution_date, member.is_anonymous]
        );
      }
      
      console.log('Restore completed successfully');
      pool.end();
    } catch (err) {
      console.error('Error:', err.message);
      pool.end();
    }
  }
  
  restoreBackup();
"
```