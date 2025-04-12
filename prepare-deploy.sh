#!/bin/bash

echo "Preparing for deployment..."

# Build the application
npm run build

# Make sure the public directory exists in dist and js subdirectory
mkdir -p dist/public/js

# Copy all static files from public to dist/public
echo "Copying public files to dist/public..."
cp -r public/* dist/public/

# Make sure js files are copied
echo "Ensuring JS files are copied..."
cp -r public/js/* dist/public/js/

# Make sure solar_counter.js is at the root
echo "Ensuring solar_counter.js is available at the root..."
cp public/solar_counter.js dist/public/

# Copy our dedicated health check files
echo "Setting up health check files for Replit deployment..."
cp health.cjs dist/health.cjs
cp cloud-run-health.js dist/cloud-run-health.js
cp replit-health-check.js dist/replit-health-check.js
cp replit-health-handler.js dist/replit-health-handler.js
cp final-health-check.js dist/final-health-check.js
cp final-health-check.cjs dist/final-health-check.cjs
cp replit-deploy.js dist/replit-deploy.js
cp cloud-run-deploy.js dist/cloud-run-deploy.js
cp deploy-index.cjs dist/deploy-index.cjs
cp start.sh dist/start.sh
chmod +x dist/health.cjs dist/cloud-run-health.js dist/replit-health-check.js \
         dist/replit-health-handler.js dist/final-health-check.js dist/final-health-check.cjs \
         dist/replit-deploy.js dist/cloud-run-deploy.js dist/deploy-index.cjs dist/start.sh

# Create key files at the root of the dist directory for deployment
cp server.js dist/server.js       # Main server for Replit deployment (ES Modules)
cp server.cjs dist/server.cjs     # CommonJS version of server
cp server.js dist/index.js        # Alternative entry point
cp server.cjs dist/main.cjs       # Alternative CommonJS entry point
cp deploy-index.cjs dist/index.cjs
cp final-health-check.js dist/final-health-check.js
cp final-health-check.cjs dist/final-health-check.cjs
cp replit-health-handler.js dist/index-health.js
cp cloud-run-deploy.js dist/main.js
cp final-health-check.js dist/health.js
cp server.cjs dist/healthz.cjs

# Ensure health check is available at multiple locations
cp health.cjs dist/public/health.cjs
cp cloud-run-health.js dist/public/cloud-run-health.js
cp replit-health-check.js dist/public/replit-health-check.js
cp replit-health-handler.js dist/public/replit-health-handler.js

# Create special health files that can be executed directly at the root
cat > dist/health <<EOF
#!/bin/bash
node replit-health-handler.js
EOF
chmod +x dist/health

# Copy special health check files that Replit might look for
cp healthz dist/healthz
cp health-check dist/health-check
chmod +x dist/healthz dist/health-check

# Create a symlink as an alternative option
ln -sf dist/server.js dist/healthz.js

# Create a main entry point for Replit
echo "Creating main entry point for Replit deployment..."
cat > dist/index.cjs <<EOF
/**
 * Replit Deployment Entry Point
 * This is a CommonJS file that will be used as the entry point for Replit deployment
 */
console.log('Starting The Current-See application...');

// Check if we're running as a health check
if (process.argv.includes('--health-check')) {
  require('./health.cjs');
} else {
  // Start the health check server in a separate process
  const { fork } = require('child_process');
  
  try {
    // Fork the health check as a separate process
    const healthProcess = fork('./health.cjs', [], {
      detached: true,
      stdio: 'inherit'
    });
    
    // Don't wait for the health check to exit
    healthProcess.unref();
    
    console.log('Health check server started');
  } catch (e) {
    console.error('Failed to start health check server:', e);
  }
  
  // Import and run the main application
  console.log('Starting main application...');
  import('./index.js').catch(err => {
    console.error('Failed to start main application:', err);
    
    // If the main app fails, run the fallback server
    console.log('Starting fallback server...');
    require('./server.js');
  });
}
EOF

# Make the entry point executable
chmod +x dist/index.cjs

# Create a special "start" script for Replit deployment
echo "Creating start script..."
cat > dist/start.sh <<EOF
#!/bin/bash
# Start both the health check server and main application
NODE_ENV=production

# First try the replit-deploy.js approach (most reliable)
if [ -f "replit-deploy.js" ]; then
  echo "Starting with replit-deploy.js..."
  node replit-deploy.js
elif [ -f "health-check.js" ]; then
  # Start health check in background
  echo "Starting health-check.js in background..."
  node health-check.js &
  
  # Wait a moment for health check to start
  sleep 2
  
  # Start main application
  echo "Starting main application..."
  node index.js
else
  # Fallback to older approach
  echo "Falling back to index.cjs..."
  node index.cjs
fi
EOF

chmod +x dist/start.sh

# Also create a package.json in the dist directory for deployment
echo "Creating package.json for deployment..."
cat > dist/package.json <<EOF
{
  "name": "thecurrentsee-app",
  "version": "1.0.0",
  "type": "module",
  "description": "The Current-See Application",
  "main": "index.js",
  "scripts": {
    "start": "./start.sh",
    "health": "node replit-health-handler.js",
    "health:cloud": "node cloud-run-health.js",
    "health:replit": "node replit-health-check.js",
    "health:minimal": "node health.cjs",
    "deploy": "node cloud-run-deploy.js",
    "handler": "node replit-health-handler.js"
  },
  "engines": {
    "node": ">=18"
  }
}
EOF

# We now use a dedicated server.js file instead of generating it inline
echo "Using dedicated server.js file..."

# Print success message
echo "Deployment preparation complete. Ready to deploy!"