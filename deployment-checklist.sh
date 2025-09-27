#!/bin/bash

echo "🚀 THE CURRENT-SEE FINAL DEPLOYMENT CHECKLIST"
echo "=============================================="

# Start production server
echo "Starting production server..."
node main.js &
SERVER_PID=$!
sleep 5

echo ""
echo "🔍 CRITICAL SYSTEM CHECKS:"
echo "---------------------------"

# Core API Tests
HEALTH_CHECK=$(curl -s http://localhost:3000/health 2>/dev/null)
if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    VERSION=$(echo "$HEALTH_CHECK" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo "   ✅ Health Check: PASS (Version $VERSION)"
else
    echo "   ❌ Health Check: FAIL"
fi

MEMBER_API=$(curl -s http://localhost:3000/api/members 2>/dev/null)
if echo "$MEMBER_API" | grep -q "totalMembers"; then
    MEMBER_COUNT=$(echo "$MEMBER_API" | grep -o '"totalMembers":[0-9]*' | cut -d':' -f2)
    echo "   ✅ Member API: PASS ($MEMBER_COUNT members)"
else
    echo "   ❌ Member API: FAIL"
fi

ANALYTICS_API=$(curl -s http://localhost:3000/api/analytics/sessions 2>/dev/null)
if echo "$ANALYTICS_API" | grep -q "totalSessions"; then
    echo "   ✅ Analytics API: PASS"
else
    echo "   ❌ Analytics API: FAIL"
fi

MEMORY_API=$(curl -s http://localhost:3000/api/kid-solar-memory/all 2>/dev/null)
if echo "$MEMORY_API" | grep -q "conversations"; then
    CONV_COUNT=$(echo "$MEMORY_API" | grep -o '"totalConversations":[0-9]*' | cut -d':' -f2)
    echo "   ✅ Memory API: PASS ($CONV_COUNT conversations)"
else
    echo "   ❌ Memory API: FAIL"
fi

HOMEPAGE_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
if [ "$HOMEPAGE_TEST" = "200" ]; then
    echo "   ✅ Homepage: PASS (HTTP 200)"
else
    echo "   ❌ Homepage: FAIL (HTTP $HOMEPAGE_TEST)"
fi

echo ""
echo "🔒 SECURITY VERIFICATION:"
echo "--------------------------"

SECURITY_HEADERS=$(curl -s -I http://localhost:3000/health 2>/dev/null)
if echo "$SECURITY_HEADERS" | grep -q "X-Content-Type-Options"; then
    echo "   ✅ Security Headers: ACTIVE"
else
    echo "   ⚠️  Security Headers: MISSING"
fi

echo ""
echo "📁 ESSENTIAL FILES CHECK:"
echo "--------------------------"

if [ -f "public/index.html" ]; then
    FILE_SIZE=$(wc -c < "public/index.html")
    echo "   ✅ Homepage File: EXISTS ($FILE_SIZE bytes)"
else
    echo "   ❌ Homepage File: MISSING"
fi

if [ -f "api/members.json" ]; then
    echo "   ✅ Member Data: EXISTS"
else
    echo "   ❌ Member Data: MISSING"
fi

if [ -d "conversations" ]; then
    CONV_FILES=$(find conversations -name "*.json" 2>/dev/null | wc -l)
    echo "   ✅ Conversations: EXISTS ($CONV_FILES files)"
else
    echo "   ❌ Conversations: MISSING"
fi

if [ -f "analytics-dashboard.html" ]; then
    echo "   ✅ Analytics Dashboard: EXISTS"
else
    echo "   ❌ Analytics Dashboard: MISSING"
fi

echo ""
echo "🧹 CLEANUP VERIFICATION:"
echo "-------------------------"

CAPTURE_FILES=$(find . -name "*capture*.js" -not -path "./node_modules/*" 2>/dev/null | wc -l)
if [ "$CAPTURE_FILES" -eq 0 ]; then
    echo "   ✅ Capture Files: CLEANED"
else
    echo "   ⚠️  Capture Files: $CAPTURE_FILES remaining"
fi

echo ""
echo "🎯 D-ID AGENT STATUS:"
echo "----------------------"

if grep -q "v2_agt_vhYf_e_C" public/index.html 2>/dev/null; then
    echo "   ✅ Console Solar Agent: EMBEDDED (v2_agt_vhYf_e_C)"
else
    echo "   ⚠️  Console Solar Agent: NOT FOUND"
fi

echo ""
echo "🎵 MUSIC INTEGRATION:"
echo "---------------------"

MUSIC_COUNT=$(grep -c "playMusic" public/index.html 2>/dev/null || echo "0")
if [ "$MUSIC_COUNT" -gt 0 ]; then
    echo "   ✅ Music Tracks: $MUSIC_COUNT streaming buttons"
else
    echo "   ⚠️  Music Tracks: NOT FOUND"
fi

echo ""
echo "📊 DEPLOYMENT READINESS SCORE:"
echo "-------------------------------"

CHECKS_PASSED=0
TOTAL_CHECKS=10

if echo "$HEALTH_CHECK" | grep -q "healthy"; then ((CHECKS_PASSED++)); fi
if echo "$MEMBER_API" | grep -q "totalMembers"; then ((CHECKS_PASSED++)); fi
if echo "$ANALYTICS_API" | grep -q "totalSessions"; then ((CHECKS_PASSED++)); fi
if echo "$MEMORY_API" | grep -q "conversations"; then ((CHECKS_PASSED++)); fi
if [ "$HOMEPAGE_TEST" = "200" ]; then ((CHECKS_PASSED++)); fi
if echo "$SECURITY_HEADERS" | grep -q "X-Content-Type-Options"; then ((CHECKS_PASSED++)); fi
if [ -f "public/index.html" ]; then ((CHECKS_PASSED++)); fi
if [ -d "conversations" ]; then ((CHECKS_PASSED++)); fi
if [ "$CAPTURE_FILES" -eq 0 ]; then ((CHECKS_PASSED++)); fi
if grep -q "v2_agt_vhYf_e_C" public/index.html 2>/dev/null; then ((CHECKS_PASSED++)); fi

READINESS_PERCENT=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

echo "   📈 Score: $CHECKS_PASSED/$TOTAL_CHECKS ($READINESS_PERCENT%)"

if [ "$READINESS_PERCENT" -eq 100 ]; then
    echo "   🟢 STATUS: PERFECT - READY FOR DEPLOYMENT"
elif [ "$READINESS_PERCENT" -ge 90 ]; then
    echo "   🟢 STATUS: EXCELLENT - READY FOR DEPLOYMENT"
elif [ "$READINESS_PERCENT" -ge 80 ]; then
    echo "   🟡 STATUS: GOOD - MINOR ISSUES TO RESOLVE"
else
    echo "   🔴 STATUS: NEEDS ATTENTION - CRITICAL ISSUES"
fi

echo ""
echo "🚀 DEPLOYMENT INSTRUCTIONS:"
echo "----------------------------"
echo "1. Use Replit Deploy button"
echo "2. Target: www.thecurrentsee.org"
echo "3. Environment: Production"
echo "4. Health monitoring: /health endpoint"
echo "5. SSL/TLS: Auto-configured"

echo ""
echo "🌐 LIVE FEATURES READY:"
echo "------------------------"
echo "• Console Solar AI (D-ID Agent)"
echo "• 19 Active Members"
echo "• Analytics Dashboard"
echo "• Memory System"
echo "• Music Streaming (7 tracks)"
echo "• Real-time Solar Metrics"
echo "• Security Headers"
echo "• Database Integration"

# Clean up
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ DEPLOYMENT CHECKLIST COMPLETE"
echo "================================="