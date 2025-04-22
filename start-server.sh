#!/bin/bash

# Start with current-see server with database support
echo "Starting Current-See server with database support..."

# Install required dependencies if not already installed
echo "Checking for required packages..."
if ! npm list | grep -q "pg"; then
  echo "Installing PostgreSQL dependencies..."
  npm install pg
fi

# Check if database environment variables are set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set."
  echo "Please make sure you have a PostgreSQL database configured."
  exit 1
fi

# Run the database setup script
echo "Setting up database tables and migrating members..."
node setup-database.js

# Start the server with database support
echo "Starting server with database support..."
node server-db.js