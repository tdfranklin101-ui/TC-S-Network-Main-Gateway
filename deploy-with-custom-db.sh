#!/bin/bash

# The Current-See Deployment Script with Custom Database URL
# This script tests the CURRENTSEE_DB_URL and deploys the application

# Exit on any error
set -e

# Log function with timestamps
log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
}

log "=== The Current-See Deployment with Custom Database URL ==="

# Check if CURRENTSEE_DB_URL is set
if [ -z "$CURRENTSEE_DB_URL" ]; then
  log "❌ ERROR: CURRENTSEE_DB_URL is not set in the environment"
  log "Please make sure the CURRENTSEE_DB_URL secret is correctly set"
  exit 1
fi

# Check the connection using the custom DB checker
log "Testing database connection with CURRENTSEE_DB_URL..."
node check-currentsee-db.js

# Check if the test was successful
if [ $? -ne 0 ]; then
  log "❌ ERROR: Database connection test failed"
  log "Please check the error messages above and fix the CURRENTSEE_DB_URL"
  exit 1
fi

# Create a backup of the members data
log "Creating backup of members data..."
node -e "
  const { Pool } = require('pg');
  const fs = require('fs');
  
  async function backup() {
    const pool = new Pool({
      connectionString: process.env.CURRENTSEE_DB_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT * FROM members ORDER BY id ASC');
      fs.writeFileSync('members.json', JSON.stringify(result.rows, null, 2));
      console.log(\`✅ Created backup with \${result.rows.length} members\`);
      client.release();
      await pool.end();
    } catch (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  
  backup();
"

# Start the deployment server with the custom DB URL
log "Starting the deployment server..."
node deploy-currentsee-db.js