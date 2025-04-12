#!/bin/bash

# Restore development configuration
# This script restores the original development configuration
# after a deployment was set up

set -e

echo "Restoring development configuration..."

# Restore original package.json if it exists
if [ -f package.json.original ]; then
  cp package.json.original package.json
  echo "Restored original package.json"
else
  echo "No package.json.original found, skipping restore"
fi

# Remove deployment index.js if it exists
if [ -f index.js ] && grep -q "replit-deploy-handler" index.js; then
  rm index.js
  echo "Removed deployment index.js"
fi

echo ""
echo "Your project is now back in development mode!"
echo "Run the Start application workflow to continue development."