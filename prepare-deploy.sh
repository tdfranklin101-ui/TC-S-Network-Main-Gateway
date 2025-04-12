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

# Copy our dedicated health check file
echo "Configuring health check files for Replit deployment..."
cp server/deploy-health.js dist/deploy-health.js
chmod +x dist/deploy-health.js

# Add a .replit file if it doesn't exist (specifies the run command)
echo "Adding .replit configuration file..."
cat > dist/.replit <<EOF
run = "NODE_ENV=production node index.js"
healthCheck = "node deploy-health.js"
EOF

# Create a Replit nix configuration file to ensure Node.js is available
echo "Ensuring Node.js is available for health checks..."
cat > dist/replit.nix <<EOF
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
  ];
}
EOF

# Create a special root path health check handler
echo "Creating root health check endpoint..."
cat > dist/root-health.js <<EOF
// Root path health check handler
const http = require('http');
const PORT = 5000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
});
server.listen(PORT, '0.0.0.0');
console.log('Root health check server running on port ' + PORT);
EOF

# Print success message
echo "Deployment preparation complete. Ready to deploy!"