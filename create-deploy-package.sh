#!/bin/bash

# Ultimate simple deployment script - creates the simplest possible deployment
# No conflicts, no module system issues, only pure CommonJS

set -e

echo "Creating ultimate simple deployment package..."

# Create the deployment directory
rm -rf simple-deploy
mkdir -p simple-deploy/public

# Copy only what we need - our simple server and public files
echo "Copying server file..."
cp deploy-server.js simple-deploy/index.js
cp deploy-server.js simple-deploy/server.js

# Create health check files
echo "Creating health check files..."
cat > simple-deploy/health.js << EOL
// Simple health check
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
}).listen(PORT);
EOL

# Create simple package.json
echo "Creating package.json..."
cat > simple-deploy/package.json << EOL
{
  "name": "the-current-see",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
EOL

# Copy public files
echo "Copying public files..."
cp -r public/* simple-deploy/public/

# Create a start script
echo "#!/bin/sh\nnode server.js" > simple-deploy/start.sh
chmod +x simple-deploy/start.sh

# Create deployment archive
echo "Creating deployment zip..."
cd simple-deploy
zip -r ../simple-deploy.zip . -x "*.DS_Store" "*.git*"
cd ..

echo "Simple deployment package created: simple-deploy.zip"
echo "Upload this package to a fresh Node.js Replit for deployment"