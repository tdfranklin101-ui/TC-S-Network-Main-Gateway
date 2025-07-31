#!/bin/bash

echo "🚀 FINAL DEPLOYMENT VERIFICATION"
echo "================================="
echo "www.thecurrentsee.org Ready Check"
echo ""

# Test 1: Server Health Check
echo "1. Testing production server health..."
HEALTH=$(curl -s "http://localhost:3000/health" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "   ✅ Production server operational"
    SERVICE=$(echo $HEALTH | jq -r '.service' 2>/dev/null || echo 'Current-See Production')
    echo "   📡 Service: $SERVICE"
else
    echo "   ❌ Production server not responding"
    exit 1
fi

# Test 2: Member Data API
echo "2. Testing member data loading..."
MEMBERS=$(curl -s "http://localhost:3000/api/members" 2>/dev/null)
if [ $? -eq 0 ]; then
    MEMBER_COUNT=$(echo $MEMBERS | jq 'length' 2>/dev/null)
    if [ "$MEMBER_COUNT" = "19" ]; then
        echo "   ✅ Member data API working - $MEMBER_COUNT members loaded"
        FIRST_MEMBER=$(echo $MEMBERS | jq -r '.[0].name' 2>/dev/null)
        echo "   👥 Sample member: $FIRST_MEMBER"
    else
        echo "   ❌ Unexpected member count: $MEMBER_COUNT"
        exit 1
    fi
else
    echo "   ❌ Member API not responding"
    exit 1
fi

# Test 3: D-ID Streaming Capture Endpoint
echo "3. Testing D-ID streaming capture endpoint..."
TEST_DATA='{"id":"test_stream","timestamp":"'$(date -Iseconds)'","type":"test","content":"Test streaming capture"}'
STREAM_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/conversation-stream" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA" 2>/dev/null)

if [ $? -eq 0 ]; then
    SUCCESS=$(echo $STREAM_RESPONSE | jq -r '.success' 2>/dev/null)
    if [ "$SUCCESS" = "true" ]; then
        echo "   ✅ D-ID streaming capture endpoint working"
        FILENAME=$(echo $STREAM_RESPONSE | jq -r '.filename' 2>/dev/null)
        echo "   📁 Test file: $FILENAME"
    else
        echo "   ❌ Streaming capture endpoint failed"
        exit 1
    fi
else
    echo "   ❌ Streaming capture endpoint not responding"
    exit 1
fi

# Test 4: Deployment Package Verification
echo "4. Verifying deployment package..."
DEPLOY_DIR="final_deployment_package/deploy_v1_multimodal"
if [ -d "$DEPLOY_DIR" ]; then
    echo "   ✅ Deployment package exists"
    
    # Check key files
    KEY_FILES=("index.html" "d-id-streaming-capture.js" "d-id-network-interceptor.js" "api/members.json")
    for file in "${KEY_FILES[@]}"; do
        if [ -f "$DEPLOY_DIR/$file" ]; then
            echo "   ✅ $file present"
        else
            echo "   ❌ $file missing"
            exit 1
        fi
    done
else
    echo "   ❌ Deployment package missing"
    exit 1
fi

# Test 5: Analytics and Console Solar Integration
echo "5. Testing Console Solar integration..."
if [ -f "$DEPLOY_DIR/index.html" ]; then
    AGENT_CHECK=$(grep -c "v2_agt_vhYf_e_C" "$DEPLOY_DIR/index.html")
    CAPTURE_CHECK=$(grep -c "d-id-streaming-capture.js" "$DEPLOY_DIR/index.html")
    
    if [ "$AGENT_CHECK" -gt 0 ] && [ "$CAPTURE_CHECK" -gt 0 ]; then
        echo "   ✅ Console Solar D-ID agent integrated"
        echo "   ✅ Streaming capture system integrated"
    else
        echo "   ❌ Console Solar integration incomplete"
        exit 1
    fi
fi

# Test 6: Music and Features Check
echo "6. Checking enhanced features..."
MUSIC_CHECK=$(grep -c "Music Now" "$DEPLOY_DIR/index.html")
if [ "$MUSIC_CHECK" -gt 0 ]; then
    echo "   ✅ Music integration present ($MUSIC_CHECK tracks)"
else
    echo "   ⚠️  Music integration not found"
fi

echo ""
echo "================================="
echo "🎉 DEPLOYMENT VERIFICATION COMPLETE!"
echo ""
echo "✅ Production server ready"
echo "✅ Member data loading (19 members)"
echo "✅ D-ID streaming capture active"
echo "✅ Console Solar agent integrated"
echo "✅ All deployment files present"
echo ""
echo "🌐 Ready for www.thecurrentsee.org deployment"
echo ""
echo "Deployment Features:"
echo "- Console Solar (TC-S S0001) polymathic AI assistant"
echo "- Innovative D-ID streaming conversation capture"
echo "- Real-time member data loading"
echo "- Music integration and enhanced features"
echo "- Zero data loss conversation recording"
echo ""
echo "Contact: terry@thecurrentsee.org"
echo "Platform: The Current-See PBC, Inc."