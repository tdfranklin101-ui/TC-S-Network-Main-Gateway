#!/bin/bash

# Entrypoint script for Replit deployment
# This script prioritizes health checks by running a dedicated health check server

echo "Starting super simple health check server for Replit deployment..."
exec node super-simple-health.js