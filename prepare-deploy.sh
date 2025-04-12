#!/bin/bash

# Enhanced Deployment Preparation Script for The Current-See
# Created: April 12, 2025
# Updated: April 12, 2025 - Port 5000 updates

set -e

echo "Preparing for deployment..."

# Ensure we have a build
npm run build

# Create necessary directories
mkdir -p dist/public/js
mkdir -p dist/public/images
mkdir -p dist/public/css

# Copy server files with port 5000 (already updated)
echo "Copying server files..."
cp server.js dist/
cp server.cjs dist/

# Ensure health check files use port 5000
echo "Setting up health check files for Replit deployment..."
cp health.cjs dist/
cp health.js dist/
cp final-health-check.cjs dist/
cp final-health-check.js dist/
cp cloud-run-health.js dist/ 2>/dev/null || true
cp replit-health-check.js dist/ 2>/dev/null || true
cp replit-health-handler.js dist/ 2>/dev/null || true
cp health-check.js dist/ 2>/dev/null || true

# Create standalone health check scripts
echo "#!/bin/sh\nnode health.cjs" > dist/health
chmod +x dist/health
echo "#!/bin/sh\nnode health.cjs" > dist/health-check
chmod +x dist/health-check
echo "#!/bin/sh\nnode health.cjs" > dist/healthz
chmod +x dist/healthz

# Create healthz.js/healthz.cjs for compatibility
cp server.js dist/healthz.js
cp server.cjs dist/healthz.cjs

# Create main entry point files for various deployment scenarios
echo "Creating main entry point for Replit deployment..."
cp server.js dist/index.js
cp server.cjs dist/index.cjs
cp server.js dist/main.js
cp server.cjs dist/main.cjs

# Create start script
echo "Creating start script..."
echo "#!/bin/sh\nnode server.cjs" > dist/start.sh
chmod +x dist/start.sh

# Copy public assets
echo "Copying public files to dist/public..."
cp -r public/* dist/public/

# Ensure JavaScript files are properly copied
echo "Ensuring JS files are copied..."
cp -r public/js/* dist/public/js/ 2>/dev/null || true

# Ensure solar_counter.js is at the root level too
echo "Ensuring solar_counter.js is available at the root..."
cp public/solar_counter.js dist/public/ 2>/dev/null || true

# Create package.json for deployment with CommonJS as type (important)
echo "Creating package.json for deployment..."
cat > dist/package.json << EOF
{
  "name": "thecurrentsee-deployment",
  "version": "1.0.0",
  "main": "health.cjs",
  "engines": {
    "node": ">=16.0.0"
  },
  "scripts": {
    "start": "node health.cjs"
  },
  "type": "commonjs",
  "private": true
}
EOF

echo "Using dedicated server.js file..."
cp server.js dist/
cp server.cjs dist/

echo "Deployment preparation complete. Ready to deploy!"