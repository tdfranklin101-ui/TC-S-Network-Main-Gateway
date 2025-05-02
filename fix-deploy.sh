#!/bin/bash

# Fix deployment script for The Current-See
# Completely eliminates ESM/CommonJS issues by ensuring pure CommonJS

set -e

echo "Creating pure CommonJS deployment package..."

# Create a clean deployment directory
rm -rf pure-deploy
mkdir -p pure-deploy/public/js
mkdir -p pure-deploy/public/images
mkdir -p pure-deploy/public/css

# Copy the server.cjs file as the main file
echo "Setting up pure CommonJS server..."
cp server.cjs pure-deploy/server.js
cp server.cjs pure-deploy/index.js
cp server.cjs pure-deploy/main.js

# Create health check files using pure CommonJS
echo "Creating CommonJS health check files..."
cp health.cjs pure-deploy/health.js
cp health.cjs pure-deploy/healthz.js
cp health.cjs pure-deploy/health-check.js
cp final-health-check.cjs pure-deploy/final-health-check.js

# Create simple shell scripts
echo "#!/bin/sh\nnode server.js" > pure-deploy/start.sh
chmod +x pure-deploy/start.sh

# Copy all static files
echo "Copying static files..."
cp -r public/* pure-deploy/public/

# Create a strictly CommonJS package.json
echo "Creating CommonJS package.json..."
cat > pure-deploy/package.json << EOF
{
  "name": "thecurrentsee-deployment",
  "version": "1.0.0",
  "description": "The Current-See Deployment",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "private": true
}
EOF

# Create simple health check shell scripts
echo "#!/bin/sh\nnode health.js" > pure-deploy/health
chmod +x pure-deploy/health
echo "#!/bin/sh\nnode health.js" > pure-deploy/healthz
chmod +x pure-deploy/healthz

# Package everything up
echo "Creating deployment archive..."
cd pure-deploy
zip -r ../pure-deployment.zip . -x "*.git*" "*.DS_Store"
cd ..

echo "Pure CommonJS deployment package created: pure-deployment.zip"
echo "Upload this file for deployment to ensure no ESM/CommonJS conflicts"