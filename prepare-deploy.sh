#!/bin/bash

echo "Preparing for deployment..."

# Build the application
npm run build

# Make sure the public directory exists in dist
mkdir -p dist/public

# Copy all static files from public to dist/public
echo "Copying public files to dist/public..."
cp -r public/* dist/public/

echo "Deployment preparation complete."