#!/bin/bash

# The Current-See Deployment Entrypoint
# This script ensures proper startup of the application

echo "Starting The Current-See Application..."
echo "Current date: $(date)"

# Check for required environment variables
if [ -n "$CURRENTSEE_DB_URL" ]; then
  echo "Database URL detected - using production database connection"
else
  echo "No custom database URL found - using default database"
fi

# Set NODE_ENV if not already set
export NODE_ENV=${NODE_ENV:-production}

# Check for OpenAI API key
if [ -n "$OPENAI_API_KEY" ] || [ -n "$NEW_OPENAI_API_KEY" ]; then
  echo "OpenAI API key detected - AI features will be available"
else
  echo "WARNING: No OpenAI API key found - AI features will be unavailable"
fi

# Start the application
echo "Starting server..."
exec node entry.js