#!/bin/bash

# Prepare Final Deployment Script
# This script addresses all deployment issues identified
# - Missing build script
# - Missing build output directory
# - Port mismatch

set -e

echo "Setting up project for proper Replit deployment..."

# Backup original package.json if not already done
if [ ! -f package.json.original ]; then
  cp package.json package.json.original
  echo "Backed up original package.json"
fi

# Create build directory (required by Replit deployment)
mkdir -p dist
echo "Created build directory: dist"

# Copy public files to build directory
cp -r public dist/
echo "Copied public files to dist/"

# Copy our static server to the build directory
cp replit-static-server.js dist/index.js
echo "Copied static server to dist/index.js"

# Create a proper package.json for deployment
cat > package.json << EOL
{
  "name": "the-current-see",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node dist/index.js",
    "build": "mkdir -p dist && cp -r public dist/ && cp replit-static-server.js dist/index.js"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOL

echo "Created deployment-ready package.json"

# Create a .replit file to ensure proper port configuration
cat > .replit << EOL
run = "npm run start"
entrypoint = "dist/index.js"

[nix]
channel = "stable-23_11"

[deployment]
run = ["sh", "-c", "npm run start"]
deploymentTarget = "cloudrun"
ignorePorts = false
EOL

echo "Created proper .replit configuration"

# Run the build process
npm run build

echo ""
echo "Your project is now ready for deployment!"
echo "Click the Deploy button in the Replit interface to deploy it."
echo ""
echo "After successful deployment, run ./restore-dev.sh to restore development files."