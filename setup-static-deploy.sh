#!/bin/bash

# Setup for static deployment using pure CommonJS server
# This script configures the current project for static deployment

set -e

echo "Setting up project for static deployment..."

# Backup original package.json if not already done
if [ ! -f package.json.original ]; then
  cp package.json package.json.original
  echo "Backed up original package.json"
fi

# Create a minimal package.json for deployment
cat > package.json << EOL
{
  "name": "the-current-see-static",
  "version": "1.0.0",
  "main": "deploy-server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node deploy-server.js"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOL

# Copy the deploy server to index.js for deployment
cp deploy-server.js index.js

echo "Created static deployment setup"
echo ""
echo "Your project is now ready for deployment!"
echo "Click the Deploy button in the Replit interface to deploy it."
echo ""
echo "After successful deployment, run ./restore-dev.sh to restore development files."