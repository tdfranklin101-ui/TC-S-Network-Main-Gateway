#!/bin/bash

# Simple script to start the deployment server for testing

echo "Starting The Current-See deployment server for testing..."
echo "Using deploy-simple.js as the server entry point"

# Link the deployment server to main.js
ln -sf deploy-simple.js main.js

# Start the server
node deploy-simple.js

# This script can be run with: bash start-server.sh