#!/bin/bash
# Start both the health check server and main application
NODE_ENV=production

# First try the replit-deploy.js approach (most reliable)
if [ -f "replit-deploy.js" ]; then
  echo "Starting with replit-deploy.js..."
  node replit-deploy.js
elif [ -f "health-check.js" ]; then
  # Start health check in background
  echo "Starting health-check.js in background..."
  node health-check.js &
  
  # Wait a moment for health check to start
  sleep 2
  
  # Start main application
  echo "Starting main application..."
  node index.js
else
  # Fallback to older approach
  echo "Falling back to index.cjs..."
  node index.cjs
fi
