#!/bin/bash

# Setup for deployment
# This script configures the current project for deployment
# by setting up the correct files in the right places

set -e

echo "Setting up project for deployment..."

# Run restore first if there's already a backup
if [ -f package.json.original ]; then
  cp package.json.original package.json
  echo "Restored from previous backup first"
fi

# Backup original package.json
cp package.json package.json.original
echo "Backed up original package.json"

# Copy deployment files to the right places
cp deploy-package.json package.json
cp replit-deploy-handler.js index.js

echo "Created deployment-ready package.json and index.js"
echo ""
echo "Your project is now ready for deployment!"
echo "Click the Deploy button in the Replit interface to deploy it."
echo ""
echo "After successful deployment, run ./restore-dev.sh to restore development files."