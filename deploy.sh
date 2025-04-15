#!/bin/bash
# The Current-See Simplified Deployment Script

# Set environment variables
export NODE_ENV=production
export PORT=3000

# Display deployment info
echo "==============================================="
echo "The Current-See - Deployment Script"
echo "==============================================="
echo "Starting deployment at $(date)"
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Deployment port: $PORT"
echo "==============================================="

# Start the CommonJS health check server with auto-restart capability
echo "Starting with reliable CommonJS health check..."
node simple-health-commonjs.js