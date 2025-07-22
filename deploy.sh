#!/bin/bash

# The Current-See Deployment Script
# Optimized for Replit Cloud Run deployment

echo "🚀 Starting The Current-See deployment preparation..."

# Kill any existing processes
pkill -f "main.js" 2>/dev/null || true
sleep 2

# Clean up old logs
rm -f deployment.log deployment.pid server.log 2>/dev/null || true

# Start the deployment server
echo "📡 Starting deployment server..."
node main.js > deployment.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > deployment.pid

# Wait for server to start
echo "⏳ Waiting for server startup..."
sleep 5

# Verify server health
echo "🔍 Checking server health..."
if curl -s "http://localhost:3000/health" > /dev/null; then
    echo "✅ Server health check passed"
    echo "📊 Server running on PID: $SERVER_PID"
    echo "🌐 Website ready at: http://localhost:3000"
    echo "🎯 Kid Solar ready at: http://localhost:3000/wallet.html"
    echo ""
    echo "🚀 DEPLOYMENT READY!"
    echo "📋 Next steps:"
    echo "   1. Click 'Deploy' in Replit"
    echo "   2. Configure custom domain: www.thecurrentsee.org"
    echo "   3. Monitor health at: /health endpoint"
else
    echo "❌ Server health check failed"
    echo "📋 Check logs: cat deployment.log"
    exit 1
fi