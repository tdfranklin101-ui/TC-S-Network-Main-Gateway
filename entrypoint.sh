#!/bin/bash
# The Current-See Cloud Deployment Entrypoint
# This script is the primary entrypoint for Replit deployments

# Log startup information
echo "Starting The Current-See deployment at $(date)"
echo "Environment: $NODE_ENV"
echo "PORT: $PORT"

# Start the health check server (for Replit health checks)
node health.js > health.log 2>&1 &
HEALTH_PID=$!
echo "Health check server started with PID $HEALTH_PID"

# Start the main application server
PORT=8080 node server.js

# This is a fallback - the app should never reach this point
echo "ERROR: Main application exited unexpectedly at $(date)"
echo "Logs from health check server:"
cat health.log
exit 1