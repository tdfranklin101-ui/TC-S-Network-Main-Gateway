#!/bin/bash

# FORCE FRESH DEPLOYMENT - Bypass all caches
# This script ensures marketplace dropdowns are deployed

echo "🔥 FORCE FRESH DEPLOYMENT - NO CACHE"
echo "===================================="
echo ""

# Step 1: Verify dropdowns exist
echo "1️⃣ Verifying dropdowns in local file..."
if grep -q "Create AI Content" public/marketplace.html; then
    LINES=$(wc -l < public/marketplace.html)
    FUNCTIONS=$(grep -c "toggleAIPlatformDropdown" public/marketplace.html)
    echo "   ✅ Marketplace file: $LINES lines"
    echo "   ✅ Dropdown functions: $FUNCTIONS"
else
    echo "   ❌ ERROR: Dropdowns not found!"
    exit 1
fi

echo ""

# Step 2: Clear any local caches
echo "2️⃣ Clearing local caches..."
rm -rf .gcloud_build_cache 2>/dev/null
rm -rf .deploy_cache 2>/dev/null
echo "   ✅ Local cache cleared"

echo ""

# Step 3: Deploy with unique tag to force rebuild
TIMESTAMP=$(date +%s)
echo "3️⃣ Deploying with timestamp tag: $TIMESTAMP"
echo "   (This forces Cloud Run to rebuild from scratch)"
echo ""

gcloud run deploy tc-s-network \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --no-cache \
  --tag "deploy-$TIMESTAMP"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    echo "🔍 IMPORTANT: Clear browser cache to see changes"
    echo ""
    echo "Option 1: Hard Refresh (RECOMMENDED)"
    echo "  • Mac: Cmd + Shift + R"
    echo "  • Windows: Ctrl + Shift + R"
    echo ""
    echo "Option 2: Clear Browser Cache"
    echo "  1. Open browser settings"
    echo "  2. Clear browsing data"
    echo "  3. Select 'Cached images and files'"
    echo "  4. Clear last 24 hours"
    echo ""
    echo "Option 3: Incognito/Private Window"
    echo "  • This bypasses all cache"
    echo "  • Go to: https://thecurrentsee.org/marketplace.html"
    echo ""
    echo "📍 What you should see in Upload tab:"
    echo "  • Purple box: '✨ Create AI Content'"
    echo "  • 3 green buttons: Music, Video, Code"
    echo ""
    echo "If STILL not visible, the browser cache is very aggressive."
    echo "Try: Safari (if using Chrome) or Chrome (if using Safari)"
    echo ""
else
    echo "❌ DEPLOYMENT FAILED"
    echo "Check errors above"
    exit 1
fi
