# The Current-See Deployment Checklist

Use this checklist when deploying The Current-See website to ensure all components are properly configured, especially the database connection.

## Pre-Deployment Database Check

- [ ] Run database connection test:
  ```
  node test-db-connection.js
  ```

- [ ] Run deployment helper:
  ```
  node deployment-helper.js
  ```

- [ ] Verify database contains all 16 members:
  ```
  node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); async function checkMembers() { try { const result = await pool.query('SELECT * FROM members ORDER BY id ASC'); console.log(`Found ${result.rows.length} members`); pool.end(); } catch (err) { console.error('Error:', err.message); pool.end(); } } checkMembers();"
  ```

## Environment Variables Check

- [ ] DATABASE_URL is set
- [ ] PGHOST is set
- [ ] PGUSER is set
- [ ] PGPASSWORD is set
- [ ] PGDATABASE is set
- [ ] PGPORT is set
- [ ] MOBILE_APP_API_KEY is set (for mobile app integration)
- [ ] NODE_ENV set to 'production' for deployment

## Create Deployment Backup

- [ ] Create a backup of the members data:
  ```
  node -e "const fs = require('fs'); const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); async function backup() { try { const result = await pool.query('SELECT * FROM members'); fs.writeFileSync('members.json', JSON.stringify(result.rows, null, 2)); console.log(`Backed up ${result.rows.length} members`); pool.end(); } catch (err) { console.error('Error:', err); pool.end(); } } backup();"
  ```

## Start Deployment Server with Database Fallback

- [ ] Run the enhanced deployment server:
  ```
  node deploy-with-db-fallback.js
  ```

## Post-Deployment Verification

- [ ] Run the deployment verification script:
  ```
  node verify-deployment-db.js https://your-deployment-url.replit.app
  ```

- [ ] Verify these specific endpoints:
  - `/health` - Should return status 200 with database status
  - `/api/database/status` - Should show database connection status
  - `/api/members` - Should return the members list
  - `/api/solar-clock` - Should return the solar generator data
  - `/mobile/status` - Should show mobile API status

## Troubleshooting Common Issues

### Database Connection Problems

- [ ] Verify SQL connection strings in the environment variables
- [ ] Check if database server is accessible from deployment environment
- [ ] Try connecting with SSL disabled if SSL issues occur
- [ ] Verify that the database tables exist and are properly populated

### Missing Environment Variables

- [ ] Ensure all environment variables are transferred to the deployment
- [ ] For Replit deployments, add them as Secrets in the project settings

### Error Monitoring

- [ ] Check deployment logs for error messages
- [ ] Look for database connection errors specifically
- [ ] Monitor the deployment-helper.log file for issues

## Fallback Plan

If database connection cannot be established in the deployment environment:

- [ ] Deploy using the fallback server:
  ```
  node deploy-with-db-fallback.js
  ```

- [ ] Verify the application is functioning with file-based data:
  ```
  curl https://your-deployment-url.replit.app/health
  ```

- [ ] After resolving database issues, redeploy the application

## Final Checklist

- [ ] Website is accessible at https://thecurrentsee.org
- [ ] Login functionality works correctly
- [ ] Solar Generator counter displays correct values
- [ ] Members list is properly displayed
- [ ] Mobile API endpoints are accessible and working
- [ ] All static assets (CSS, JS, images) load correctly

For detailed database deployment information, see the [DEPLOYMENT-DB-GUIDE.md](./DEPLOYMENT-DB-GUIDE.md) file.