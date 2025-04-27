#!/bin/bash
# The Current-See Deployment Check Script
# 
# Use this script to verify that the deployment environment is properly set up.

echo "=== The Current-See Deployment Check ==="

# Check if deployable-server.js exists
if [ -f deployable-server.js ]; then
  echo "✓ deployable-server.js found"
else
  echo "✗ deployable-server.js not found"
  exit 1
fi

# Check if database URL is configured
if [ -n "$CURRENTSEE_DB_URL" ] || [ -n "$DATABASE_URL" ]; then
  echo "✓ Database URL configured"
else
  echo "! No database URL found. Will use memory storage."
fi

# Check if OpenAI API key is configured
if [ -n "$OPENAI_API_KEY" ] || [ -n "$NEW_OPENAI_API_KEY" ]; then
  echo "✓ OpenAI API key configured"
else
  echo "! No OpenAI API key found. Will use fallback mode."
fi

# Check if main.js is pointing to deployable-server.js
if grep -q "deployable-server" main.js; then
  echo "✓ main.js is correctly configured"
else
  echo "✗ main.js is not properly configured"
  exit 1
fi

# Check if health check endpoint is set up
if [ -f health.js ]; then
  echo "✓ Health check found"
else
  echo "✗ Health check not found"
  exit 1
fi

# Check if healthz executable is present
if [ -f healthz ] && [ -x healthz ]; then
  echo "✓ healthz executable found"
else
  echo "✗ healthz executable not found or not executable"
  exit 1
fi

# Check if deployment status file exists
if [ -f deployment-status.json ]; then
  echo "✓ Deployment status file found"
else
  echo "✗ Deployment status file not found"
  exit 1
fi

echo "Deployment check completed successfully!"
echo "Environment is ready for deployment to Replit."