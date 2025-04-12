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

# Print success message
echo "Deployment preparation complete. Ready to deploy!"