#!/bin/bash

# Direct Deployment Script for The Current-See
# This script prepares the current instance for deployment without creating a new Replit

set -e

echo "Preparing the current project for direct deployment..."

# Create a deployment marker file
echo "type=commonjs" > .deployment-type

# Copy the server.cjs file to the project root
cp server.cjs server.js
cp server.cjs index.js

# Make sure health check files are in place
cp health.cjs health.js
cp health.cjs healthz.js
cp health.cjs health-check.js
cp final-health-check.cjs final-health-check.js

# Create entry point shell scripts
echo "#!/bin/sh\nnode server.js" > start.sh
chmod +x start.sh

# Print completion message
echo "Project is ready for direct deployment."
echo "Click the Deploy button in the top-right corner of the Replit interface."