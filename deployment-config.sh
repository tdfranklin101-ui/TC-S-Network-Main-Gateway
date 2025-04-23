#!/bin/bash

# The Current-See Deployment Configuration Script
# 
# This script prepares the environment for deployment by:
# 1. Creating a deployment package with all necessary files
# 2. Ensuring environment variables are properly set
# 3. Testing database connectivity before deployment

# Exit on any error
set -e

# Log function with timestamps
log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
}

log "=== The Current-See Deployment Configuration ==="

# Check if required environment variables are set
log "Checking environment variables..."

# List of variables to check
REQUIRED_VARS=(
  "DATABASE_URL"
  "PGHOST"
  "PGUSER"
  "PGPASSWORD"
  "PGDATABASE"
  "PGPORT"
)

# Count missing variables
MISSING_COUNT=0

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    log "❌ ERROR: $VAR is not set"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  else
    log "✅ $VAR is set"
  fi
done

# If any variables are missing, provide instructions
if [ $MISSING_COUNT -gt 0 ]; then
  log "❌ Missing $MISSING_COUNT required environment variables."
  log "Please set them before deploying."
  
  # Print instructions for setting variables
  log "For Replit Deployment:"
  log "1. Go to your Replit project"
  log "2. Click on the 'Secrets' tool (lock icon)"
  log "3. Add each missing variable as a secret"
  exit 1
fi

# Test database connection using Node.js script
log "Testing database connection..."
node test-db-connection.js

# Check the exit code
if [ $? -ne 0 ]; then
  log "❌ Database connection test failed."
  exit 1
fi

# Create deployment package
log "Creating deployment package..."

# Create a list of files to include
DEPLOY_FILES=(
  "public"
  "deploy-with-db-fallback.js"
  "deployment-helper.js"
  "deployment-database-check.js"
  "test-db-connection.js"
  "server/mobile-api.js"
  "package.json"
  "package-lock.json"
)

# Check if each file exists
for FILE in "${DEPLOY_FILES[@]}"; do
  if [ ! -e "$FILE" ]; then
    log "❌ WARNING: $FILE does not exist"
  fi
done

# Create backup of members data if database connection fails during deployment
log "Creating backup of members data..."
if [ -f "members.json" ]; then
  log "✅ members.json already exists"
else
  # Use node to create the backup
  node -e "
    const fs = require('fs');
    const { Pool } = require('pg');
    
    // Create a database pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    async function createBackup() {
      try {
        const result = await pool.query('SELECT * FROM members ORDER BY id ASC');
        fs.writeFileSync('members.json', JSON.stringify(result.rows, null, 2));
        console.log('✅ Created members.json backup with ' + result.rows.length + ' members');
        pool.end();
      } catch (err) {
        console.error('❌ Error creating backup:', err.message);
        pool.end();
        process.exit(1);
      }
    }
    
    createBackup();
  "
fi

# Ensure environment variables are available during deployment
log "Setting up environment for deployment..."
log "Environment variables will be passed to the deployment environment."

# Create a .env file for reference (don't include in deployment)
# This doesn't contain actual secrets, just a list of what's required
cat > .env.template << EOL
# The Current-See Environment Variables
# This is a template file. DO NOT add actual secrets here.

# Database Configuration
DATABASE_URL=
PGHOST=
PGUSER=
PGPASSWORD=
PGDATABASE=
PGPORT=

# API Keys
MOBILE_APP_API_KEY=

# Environment Settings
NODE_ENV=production
PORT=3000
EOL

log "Created .env.template for reference"

# Final check
log "Deployment configuration completed successfully."
log "You can now deploy your application."
log "Make sure to set the environment variables in your deployment environment."