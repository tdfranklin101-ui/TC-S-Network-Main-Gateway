#!/bin/bash

# The Current-See Deployment Launch Script
# This script helps avoid the "Channel already opened" error during deployment

echo "Starting The Current-See deployment process..."
echo "Current date: $(date)"

# Set environment variables
export NODE_ENV=production

# Kill any existing Node.js processes to avoid conflicts
pkill -f node || echo "No existing Node.js processes found"

echo "Waiting for channels to clear..."
sleep 2

# Start the server with the fixed deployment file
echo "Starting server with deploy-fixed.js..."
node deploy-fixed.js