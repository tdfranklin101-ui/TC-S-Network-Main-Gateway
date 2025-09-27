#!/bin/bash

# Create a truly minimal deployment package with no ESM/CommonJS conflicts
# This script creates the most compatible deployment possible

set -e

echo "Creating minimal deployment package..."

# Create a clean deployment directory
rm -rf minimal-deploy
mkdir -p minimal-deploy/public

# Copy our minimal server.js 
echo "Setting up minimal CommonJS server..."
cp minimal-server.js minimal-deploy/server.js
cp minimal-server.js minimal-deploy/index.js

# Copy our minimal package.json
cp minimal-package.json minimal-deploy/package.json

# Create health check file that's plain CommonJS
echo "Creating minimal health check file..."
cat > minimal-deploy/health.js << EOL
// Super simple health check - pure CommonJS
const http = require('http');
const PORT = process.env.PORT || 5000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});
server.listen(PORT, '0.0.0.0');
console.log('Health check server running on port ' + PORT);
EOL

# Create symbolic links for all health check variants
ln -sf health.js minimal-deploy/healthz.js
ln -sf health.js minimal-deploy/health-check.js

# Copy all static files
echo "Copying static files..."
cp -r public/* minimal-deploy/public/

# Create start script
echo "#!/bin/sh\nnode server.js" > minimal-deploy/start.sh
chmod +x minimal-deploy/start.sh

# Package everything up
echo "Creating deployment archive..."
cd minimal-deploy
zip -r ../minimal-deployment.zip . -x "*.git*" "*.DS_Store"
cd ..

echo "Minimal deployment package created: minimal-deployment.zip"
echo "This is the most compatible deployment package possible with no ESM/CommonJS conflicts"