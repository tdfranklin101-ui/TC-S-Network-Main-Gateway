#!/bin/bash

# The Current-See Deployment Script
# This script simplifies the deployment process

echo "==================================================="
echo "   The Current-See Deployment Process"
echo "==================================================="
echo

# Check for node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed."
    exit 1
fi

# Make sure deploy-server.js exists
if [ ! -f deploy-server.js ]; then
    echo "Error: deploy-server.js not found."
    exit 1
fi

# Make script executable
chmod +x server-restart.js
chmod +x run-deployment.js

# Environment variables
export PORT=3001
export NODE_ENV=production

# Run the deployment
echo "Starting deployment with run-deployment.js..."
node run-deployment.js

# Exit with the same code as the deployment script
exit $?