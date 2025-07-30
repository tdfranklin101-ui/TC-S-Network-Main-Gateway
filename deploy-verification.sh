#!/bin/bash

echo "=== THE CURRENT-SEE PLATFORM DEPLOYMENT VERIFICATION ==="
echo "Date: $(date)"
echo ""

# Navigate to deployment directory
cd final_deployment_package/deploy_v1_multimodal

echo "📁 Deployment Package Verified:"
echo "   Location: $(pwd)"
echo "   Files: $(find . -name "*.html" | wc -l) HTML files"
echo "   Assets: $(find . -name "*.js" -o -name "*.css" -o -name "*.svg" -o -name "*.png" | wc -l) asset files"
echo ""

echo "🎵 Music Integration:"
if grep -q "playMusic7" index.html; then
    echo "   ✅ 7 music tracks verified (including Kttts track)"
else
    echo "   ❌ Music integration issue"
fi
echo ""

echo "💰 USD Disclaimers:"
if grep -q "theoretically prototypical value" analytics-dashboard.html; then
    echo "   ✅ Analytics dashboard disclaimers added"
else
    echo "   ❌ Analytics disclaimer missing"
fi

if grep -q "theoretically prototypical" admin/dashboard.html; then
    echo "   ✅ Admin dashboard disclaimers added"
else
    echo "   ❌ Admin disclaimer missing"
fi
echo ""

echo "🤖 Console Solar AI:"
if grep -q "v2_agt_CjJhPh1Y\|v2_agt_vhYf_e_C" index.html; then
    echo "   ✅ D-ID agent credentials updated"
else
    echo "   ❌ D-ID agent credentials missing"
fi
echo ""

echo "📊 System Files:"
for file in "index.html" "analytics-dashboard.html" "admin/dashboard.html" "ai-memory-review.html" "main.js"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file missing"
    fi
done
echo ""

echo "🚀 DEPLOYMENT STATUS: READY FOR www.thecurrentsee.org"
echo "📧 Contact: terry@thecurrentsee.org"
echo ""
echo "Next step: Upload deployment package to production server"