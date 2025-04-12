#!/bin/bash

# Enhanced Deployment Preparation Script for The Current-See
# Created: April 12, 2025

set -e

echo "Preparing deployment package for The Current-See..."

# Create deployment directory if it doesn't exist
mkdir -p full-deployment/public/js
mkdir -p full-deployment/public/images
mkdir -p full-deployment/public/css

# Copy server files
echo "Copying server files..."
cp full-deployment/server.cjs full-deployment/server.js

# Copy public assets
echo "Copying static assets..."
cp -r public/* full-deployment/public/

# Copy image assets
echo "Copying image assets..."
cp attached_assets/solar_background.png.png full-deployment/public/images/solar_background.png 2>/dev/null || true
cp attached_assets/solar_coin.png.png full-deployment/public/images/solar_coin.png 2>/dev/null || true
cp attached_assets/solar_spinner.png.png full-deployment/public/images/solar_spinner.png 2>/dev/null || true
cp attached_assets/branding_logo.png.png full-deployment/public/images/branding_logo.png 2>/dev/null || true

# Create deployment archive
echo "Creating deployment archive..."
cd full-deployment
zip -r ../current-see-deployment.zip . -x "*.git*" "*.DS_Store" "node_modules/*"
cd ..

echo "Deployment package created successfully!"
echo "File: current-see-deployment.zip"
echo "Use this package to deploy on Replit by uploading it as a new Repl."