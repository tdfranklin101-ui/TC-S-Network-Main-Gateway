#!/bin/bash

# Update Deploy Script
# This script updates the deployed application with the latest fixes for the solar counter

echo "Starting deployment update..."

# Step 1: Copy the updated real_time_solar_counter.js to the deployment directory
echo "Updating real_time_solar_counter.js..."
cp public/js/real_time_solar_counter.js /deployment/public/js/real_time_solar_counter.js 2>/dev/null || 
  cp public/js/real_time_solar_counter.js public/js/real_time_solar_counter.js 2>/dev/null

# Step 2: Update the server JavaScript files
echo "Updating server files..."
cp main.js /deployment/main.js 2>/dev/null || cp main.js main.js 2>/dev/null
cp deploy-simple.js /deployment/deploy-simple.js 2>/dev/null || cp deploy-simple.js deploy-simple.js 2>/dev/null

# Step 3: Restart the server if possible
echo "Attempting to restart the server..."
if command -v pm2 &> /dev/null; then
    pm2 restart main || echo "Failed to restart with PM2, manual restart required"
elif command -v systemctl &> /dev/null; then
    systemctl restart currentsee || echo "Failed to restart with systemctl, manual restart required"
else
    echo "No restart mechanism found, manual restart required"
fi

echo "Deployment update completed!"
echo "Note: You may need to manually restart the server for changes to take effect"