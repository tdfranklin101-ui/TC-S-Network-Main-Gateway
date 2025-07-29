#!/bin/bash

# Production Deployment Script - Console Solar Platform
# The Current-See PBC, Inc.

echo "🚀 PREPARING CONSOLE SOLAR PLATFORM FOR DEPLOYMENT"
echo "=================================================="

# Create deployment directory
echo "📁 Creating deployment package..."
mkdir -p deployment_package

# Copy essential files for production
echo "📋 Copying production files..."
cp production-server.js deployment_package/
cp package.json deployment_package/
cp -r deploy_v1_multimodal deployment_package/
cp -r conversations deployment_package/ 2>/dev/null || mkdir -p deployment_package/conversations

# Copy environment files
cp .env deployment_package/ 2>/dev/null || echo "# Production environment variables" > deployment_package/.env

# Create production package.json
cat > deployment_package/package.json << 'EOF'
{
  "name": "console-solar-platform",
  "version": "1.0.0",
  "description": "The Current-See Console Solar Platform with immediate conversation capture",
  "main": "production-server.js",
  "scripts": {
    "start": "node production-server.js",
    "production": "node production-server.js"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "keywords": [
    "solar",
    "renewable-energy",
    "ai-assistant",
    "console-solar",
    "current-see"
  ],
  "author": "The Current-See PBC, Inc.",
  "license": "Proprietary"
}
EOF

# Create deployment documentation
cat > deployment_package/DEPLOYMENT_READY.md << 'EOF'
# Console Solar Platform - Production Deployment Ready

## Deployment Status: ✅ READY

### Core Features Deployed:
- ✅ Console Solar D-ID agent integration
- ✅ Immediate conversation capture system
- ✅ Zero data loss protection
- ✅ Emergency batch storage
- ✅ Real-time analytics dashboard
- ✅ Responsive design for all devices

### Conversation Capture System:
- ✅ Real-time Console Solar pattern detection
- ✅ Automatic 5-second save intervals
- ✅ Emergency flush on session end
- ✅ Batch processing for reliability
- ✅ Session protection for all interactions

### API Endpoints:
- `/health` - System health monitoring
- `/api/kid-solar-conversation` - Individual conversation storage
- `/api/kid-solar-conversation-batch` - Emergency batch storage
- `/api/kid-solar-memory/all` - Analytics data retrieval
- `/analytics` - Memory dashboard
- `/` - Main application

### Deployment Instructions:
1. Upload deployment_package to server
2. Run: `npm install --production`
3. Set environment variables if needed
4. Run: `npm start`
5. Access at www.thecurrentsee.org

### Zero Data Loss Features:
- Console Solar conversations captured immediately
- Emergency flush prevents session end data loss
- Multi-layer redundancy ensures conversation preservation
- Analytics dashboard displays authentic user interactions

## Status: READY FOR PRODUCTION LAUNCH
EOF

# Create startup script
cat > deployment_package/start.sh << 'EOF'
#!/bin/bash
echo "🌟 Starting Console Solar Platform..."
echo "🔒 Immediate conversation capture: ACTIVE"
echo "📡 Zero data loss protection: ENABLED"
node production-server.js
EOF

chmod +x deployment_package/start.sh

# Test production server locally
echo ""
echo "🧪 Testing production server..."
cd deployment_package
node production-server.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test endpoints
echo "📊 Testing health endpoint..."
curl -s "http://localhost:3000/health" | head -3

echo ""
echo "🔍 Testing conversation API..."
curl -X POST "http://localhost:3000/api/kid-solar-conversation" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "deployment-test",
    "messageType": "agent_response",
    "messageText": "Hello Human! What'"'"'s up? The SUN! Console Solar deployment test successful!",
    "captureSource": "deployment_test",
    "retentionPriority": "critical"
  }' | jq '.success'

# Clean up test server
kill $SERVER_PID 2>/dev/null

cd ..

echo ""
echo "✅ DEPLOYMENT PACKAGE READY"
echo "📁 Location: deployment_package/"
echo "🌟 Ready for upload to www.thecurrentsee.org"
echo ""
echo "🚀 CONSOLE SOLAR PLATFORM DEPLOYMENT PREPARED"
echo "=================================================="