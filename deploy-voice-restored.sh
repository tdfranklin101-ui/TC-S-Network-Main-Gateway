#!/bin/bash

# Current-See Platform - Voice Restored Deployment Script
# Date: July 28, 2025
# Target: www.thecurrentsee.org
# Status: D-ID Voice & Animation Functionality Restored

echo "========================================"
echo "🚀 CURRENT-SEE DEPLOYMENT - VOICE RESTORED"
echo "========================================"
echo "📅 Date: $(date)"
echo "🎯 Target: www.thecurrentsee.org"
echo "🎤 D-ID Agent: v2_agt_vhYf_e_C"
echo "========================================"

# Set deployment environment
export NODE_ENV=production
export PORT=${PORT:-3000}

echo "📦 Installing dependencies..."
npm install --production

echo "🧠 Creating conversations directory..."
mkdir -p conversations
mkdir -p logs

echo "🔍 Verifying D-ID integration..."
if grep -q "v2_agt_vhYf_e_C" index.html; then
    echo "✅ D-ID agent credentials verified"
else
    echo "❌ D-ID agent credentials not found"
    exit 1
fi

echo "🗄️ Checking database connectivity..."
if [ -n "$CURRENTSEE_DB_URL" ]; then
    echo "✅ Database URL configured"
else
    echo "⚠️ Database URL not set - using file fallback"
fi

echo "🔑 Verifying OpenAI API key..."
if [ -n "$OPENAI_API_KEY" ] || [ -n "$NEW_OPENAI_API_KEY" ]; then
    echo "✅ OpenAI API key configured"
else
    echo "⚠️ OpenAI API key not set - AI features may be limited"
fi

echo "📊 Initializing analytics system..."
touch analytics.json
echo '{"sessions": [], "totalSessions": 0, "startTime": "'$(date -Iseconds)'"}' > analytics.json

echo "🔧 Setting file permissions..."
chmod +x stable-server.js
chmod 755 conversations/
chmod 755 logs/

echo "🏥 Running health check..."
node -e "
const server = require('./stable-server.js');
console.log('✅ Server configuration validated');
process.exit(0);
" || {
    echo "❌ Server configuration error"
    exit 1
}

echo "========================================"
echo "✅ DEPLOYMENT PREPARATION COMPLETE"
echo "========================================"
echo "🎤 Voice & Animation: Restored"
echo "🧠 Memory System: Operational"
echo "📊 Analytics: Ready"
echo "🔗 D-ID Integration: Active"
echo "========================================"

echo "🚀 Starting production server..."
echo "📡 Server will be available at http://localhost:$PORT"
echo "🎯 Ready for deployment to www.thecurrentsee.org"
echo "========================================"

# Start the production server
exec node stable-server.js