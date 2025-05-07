#!/bin/bash

# Deploy script for The Current-See
echo "Starting deployment process..."

# Kill any existing node processes
pkill -f "node" || true
sleep 2

# Start the server
echo "Starting deployment server..."
node deploy-ready.js > deploy.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"
echo "Deployment complete! Check deploy.log for details."
