#!/bin/bash

echo "🚀 THE CURRENT-SEE DEPLOYMENT VERIFICATION"
echo "=============================================="

# Kill any existing servers
pkill -f "node" 2>/dev/null || true
sleep 2

echo ""
echo "📋 STARTING PRODUCTION SERVER TEST..."
echo "--------------------------------------"

# Start production server in background
node deployment-ready.js &
SERVER_PID=$!

# Wait for server to start
sleep 5

echo ""
echo "🔍 HEALTH CHECKS:"
echo "------------------"

# Test health endpoint
HEALTH_TEST=$(curl -s http://localhost:3000/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Health endpoint: OPERATIONAL"
    echo "   📊 Version: $(echo "$HEALTH_TEST" | jq -r '.version // "unknown"' 2>/dev/null)"
    echo "   🌐 Environment: $(echo "$HEALTH_TEST" | jq -r '.environment // "unknown"' 2>/dev/null)"
else
    echo "   ❌ Health endpoint: FAILED"
fi

# Test member API
MEMBER_COUNT=$(curl -s http://localhost:3000/api/members 2>/dev/null | jq '.totalMembers' 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Member API: OPERATIONAL"
    echo "   👤 Total Members: $MEMBER_COUNT"
else
    echo "   ❌ Member API: FAILED"
fi

# Test analytics API
ANALYTICS_TEST=$(curl -s http://localhost:3000/api/analytics/sessions 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Analytics API: OPERATIONAL"
    echo "   📈 Sessions: $(echo "$ANALYTICS_TEST" | jq -r '.totalSessions // "unknown"' 2>/dev/null)"
else
    echo "   ❌ Analytics API: FAILED"
fi

# Test memory API
MEMORY_TEST=$(curl -s http://localhost:3000/api/kid-solar-memory/all 2>/dev/null)
if [ $? -eq 0 ]; then
    CONV_COUNT=$(echo "$MEMORY_TEST" | jq '.conversations | length' 2>/dev/null)
    echo "   ✅ Memory API: OPERATIONAL"
    echo "   💭 Conversations: $CONV_COUNT"
else
    echo "   ❌ Memory API: FAILED"
fi

# Test homepage
HOME_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
if [ "$HOME_TEST" = "200" ]; then
    echo "   ✅ Homepage: OPERATIONAL"
else
    echo "   ❌ Homepage: FAILED (HTTP $HOME_TEST)"
fi

echo ""
echo "🔒 SECURITY CHECKS:"
echo "--------------------"

# Test security headers
SECURITY_HEADERS=$(curl -s -I http://localhost:3000/health 2>/dev/null)
if echo "$SECURITY_HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "   ✅ Security headers: ACTIVE"
else
    echo "   ⚠️  Security headers: MISSING"
fi

echo ""
echo "📁 FILE SYSTEM CHECKS:"
echo "-----------------------"

# Check essential files
if [ -f "public/index.html" ]; then
    echo "   ✅ Homepage file: EXISTS"
else
    echo "   ❌ Homepage file: MISSING"
fi

if [ -f "api/members.json" ]; then
    echo "   ✅ Member data: EXISTS"
else
    echo "   ❌ Member data: MISSING"
fi

if [ -d "conversations" ]; then
    CONV_FILES=$(ls conversations/*.json 2>/dev/null | wc -l)
    echo "   ✅ Conversations directory: EXISTS ($CONV_FILES files)"
else
    echo "   ❌ Conversations directory: MISSING"
fi

echo ""
echo "🧹 CLEANUP STATUS:"
echo "-------------------"

# Check for problematic capture files
CAPTURE_FILES=$(find . -name "*capture*.js" -not -path "./node_modules/*" | wc -l)
if [ "$CAPTURE_FILES" -eq 0 ]; then
    echo "   ✅ Capture files: CLEANED (0 remaining)"
else
    echo "   ⚠️  Capture files: $CAPTURE_FILES remaining"
fi

# Check HTML for capture references
CAPTURE_REFS=$(grep -c "capture\.js\|streaming-capture" public/index.html 2>/dev/null || echo "0")
if [ "$CAPTURE_REFS" -eq 0 ]; then
    echo "   ✅ HTML capture refs: CLEANED"
else
    echo "   ⚠️  HTML capture refs: $CAPTURE_REFS remaining"
fi

echo ""
echo "🎯 DEPLOYMENT READINESS:"
echo "-------------------------"

# Calculate readiness score
CHECKS_PASSED=0
TOTAL_CHECKS=8

if [ "$HEALTH_TEST" != "" ]; then ((CHECKS_PASSED++)); fi
if [ "$MEMBER_COUNT" != "" ] && [ "$MEMBER_COUNT" != "null" ]; then ((CHECKS_PASSED++)); fi
if [ "$ANALYTICS_TEST" != "" ]; then ((CHECKS_PASSED++)); fi
if [ "$MEMORY_TEST" != "" ]; then ((CHECKS_PASSED++)); fi
if [ "$HOME_TEST" = "200" ]; then ((CHECKS_PASSED++)); fi
if echo "$SECURITY_HEADERS" | grep -q "X-Content-Type-Options"; then ((CHECKS_PASSED++)); fi
if [ -f "public/index.html" ]; then ((CHECKS_PASSED++)); fi
if [ "$CAPTURE_FILES" -eq 0 ]; then ((CHECKS_PASSED++)); fi

READINESS_PERCENT=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

echo "   📊 Readiness Score: $CHECKS_PASSED/$TOTAL_CHECKS ($READINESS_PERCENT%)"

if [ "$READINESS_PERCENT" -ge 90 ]; then
    echo "   🟢 STATUS: READY FOR DEPLOYMENT"
    echo ""
    echo "🚀 DEPLOYMENT INSTRUCTIONS:"
    echo "----------------------------"
    echo "1. Use 'deployment-ready.js' as main server"
    echo "2. Target domain: www.thecurrentsee.org"
    echo "3. Configure SSL/TLS certificates"
    echo "4. Set up health monitoring on /health"
    echo "5. Monitor logs for any issues"
elif [ "$READINESS_PERCENT" -ge 70 ]; then
    echo "   🟡 STATUS: MOSTLY READY - Minor issues to resolve"
else
    echo "   🔴 STATUS: NOT READY - Critical issues found"
fi

# Clean up
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ VERIFICATION COMPLETE"
echo "========================="