#!/bin/bash

echo "🔍 VERIFYING MEMBER DATA FIX"
echo "==============================="

# Test 1: Check if server is running
echo "1. Testing server status..."
HEALTH=$(curl -s "http://localhost:3000/health" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Server responding"
    echo "   📡 Service: $(echo $HEALTH | jq -r '.service' 2>/dev/null || echo 'Health check passed')"
else
    echo "   ❌ Server not responding"
    exit 1
fi

# Test 2: Check members API endpoint
echo "2. Testing /api/members endpoint..."
MEMBERS=$(curl -s "http://localhost:3000/api/members" 2>/dev/null)
if [ $? -eq 0 ]; then
    MEMBER_COUNT=$(echo $MEMBERS | jq 'length' 2>/dev/null)
    if [ "$MEMBER_COUNT" = "19" ]; then
        echo "   ✅ Members API working - $MEMBER_COUNT members loaded"
        
        # Show first member as sample
        FIRST_MEMBER=$(echo $MEMBERS | jq -r '.[0].name' 2>/dev/null)
        echo "   📊 Sample member: $FIRST_MEMBER"
    else
        echo "   ❌ Unexpected member count: $MEMBER_COUNT (expected 19)"
        exit 1
    fi
else
    echo "   ❌ Members API not responding"
    exit 1
fi

# Test 3: Verify member data structure
echo "3. Verifying member data structure..."
HAS_SOLAR=$(echo $MEMBERS | jq '.[0] | has("total_solar")' 2>/dev/null)
HAS_NAME=$(echo $MEMBERS | jq '.[0] | has("name")' 2>/dev/null)
if [ "$HAS_SOLAR" = "true" ] && [ "$HAS_NAME" = "true" ]; then
    echo "   ✅ Member data structure correct"
else
    echo "   ❌ Member data structure incomplete"
    exit 1
fi

# Test 4: Check deployment package files
echo "4. Checking deployment package..."
if [ -f "final_deployment_package/deploy_v1_multimodal/api/members.json" ]; then
    echo "   ✅ Member data file exists in deployment package"
else
    echo "   ❌ Member data file missing from deployment package"
    exit 1
fi

echo "==============================="
echo "🎉 ALL TESTS PASSED!"
echo "✅ Member data loading issue FIXED"
echo "🚀 Ready for production deployment to www.thecurrentsee.org"
echo ""
echo "Summary:"
echo "- Server running on port 3000"
echo "- /api/members endpoint serving 19 members"
echo "- Public Members Log will now display correctly"
echo "- Production deployment ready"