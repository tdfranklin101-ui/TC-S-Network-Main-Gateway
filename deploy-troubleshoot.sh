#!/bin/bash

echo "🔧 DEPLOYMENT TROUBLESHOOTING"
echo "=============================="

echo ""
echo "📋 CHECKING DEPLOYMENT REQUIREMENTS:"
echo "------------------------------------"

# Check main.js
if [ -f "main.js" ]; then
    echo "   ✅ main.js: EXISTS"
    if node -c main.js 2>/dev/null; then
        echo "   ✅ main.js syntax: VALID"
    else
        echo "   ❌ main.js syntax: INVALID"
        node -c main.js
    fi
else
    echo "   ❌ main.js: MISSING"
fi

# Check package.json
if [ -f "package.json" ]; then
    echo "   ✅ package.json: EXISTS"
    if jq . package.json >/dev/null 2>&1; then
        echo "   ✅ package.json format: VALID"
    else
        echo "   ❌ package.json format: INVALID"
    fi
else
    echo "   ❌ package.json: MISSING"
fi

# Check .replit
if [ -f ".replit" ]; then
    echo "   ✅ .replit: EXISTS"
    if grep -q "run.*main.js" .replit; then
        echo "   ✅ .replit run command: CORRECT"
    else
        echo "   ⚠️  .replit run command: CHECK NEEDED"
    fi
else
    echo "   ❌ .replit: MISSING"
fi

# Check public directory
if [ -d "public" ]; then
    FILE_COUNT=$(find public -type f | wc -l)
    echo "   ✅ public directory: EXISTS ($FILE_COUNT files)"
    
    if [ -f "public/index.html" ]; then
        SIZE=$(wc -c < public/index.html)
        echo "   ✅ public/index.html: EXISTS ($SIZE bytes)"
    else
        echo "   ⚠️  public/index.html: MISSING"
    fi
else
    echo "   ❌ public directory: MISSING"
fi

echo ""
echo "🚀 TESTING SERVER STARTUP:"
echo "--------------------------"

# Test server startup
echo "Starting server test..."
timeout 10s node main.js &
SERVER_PID=$!
sleep 3

# Test if server responds
if curl -s http://localhost:3000/health >/dev/null 2>&1; then
    echo "   ✅ Server startup: SUCCESS"
    echo "   ✅ Health endpoint: RESPONDING"
else
    echo "   ❌ Server startup: FAILED"
    echo "   ❌ Health endpoint: NOT RESPONDING"
fi

# Kill test server
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "🌐 CHECKING NETWORK CONFIGURATION:"
echo "----------------------------------"

# Check port availability
if lsof -i :3000 2>/dev/null | grep -q LISTEN; then
    echo "   ⚠️  Port 3000: IN USE"
else
    echo "   ✅ Port 3000: AVAILABLE"
fi

echo ""
echo "📦 CHECKING DEPENDENCIES:"
echo "-------------------------"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo "   ✅ node_modules: EXISTS ($MODULE_COUNT packages)"
else
    echo "   ⚠️  node_modules: MISSING - Run npm install"
fi

echo ""
echo "🔍 COMMON DEPLOYMENT ISSUES:"
echo "----------------------------"

echo "1. Port binding issues:"
echo "   - Ensure server binds to 0.0.0.0 not localhost"
echo "   - Use process.env.PORT || 3000"

echo ""
echo "2. File path issues:"
echo "   - Use __dirname for relative paths"
echo "   - Check file permissions"

echo ""
echo "3. Dependency issues:"
echo "   - Ensure all imports are available"
echo "   - Check for CommonJS vs ES modules"

echo ""
echo "🛠️  DEPLOYMENT CHECKLIST:"
echo "-------------------------"
echo "[ ] Server starts without errors"
echo "[ ] Health endpoint responds"
echo "[ ] Static files serve correctly"
echo "[ ] All required files present"
echo "[ ] Dependencies installed"
echo "[ ] Port configuration correct"

echo ""
echo "✅ TROUBLESHOOTING COMPLETE"
echo "============================"