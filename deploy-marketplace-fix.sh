#!/bin/bash

# Force Fresh Cloud Run Deployment - No Cache
# This ensures marketplace.html with AI dropdowns is deployed

echo "🚀 Deploying TC-S Network with Marketplace Dropdowns..."
echo ""

# Verify dropdowns exist locally before deploying
echo "📋 Pre-deployment verification:"
if grep -q "toggleAIPlatformDropdown" public/marketplace.html; then
    echo "✅ Dropdowns found in public/marketplace.html"
    DROPDOWN_COUNT=$(grep -c "toggleAIPlatformDropdown" public/marketplace.html)
    echo "   → $DROPDOWN_COUNT dropdown functions confirmed"
else
    echo "❌ ERROR: Dropdowns not found in marketplace.html!"
    echo "   Aborting deployment..."
    exit 1
fi

echo ""
echo "📦 Deploying to Cloud Run (this may take 3-5 minutes)..."
echo ""

# Deploy with explicit parameters to avoid cache
gcloud run deploy tc-s-network \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --platform managed \
  --timeout 300 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --min-instances 0 \
  --port 8080

# Check deployment status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "🔍 Post-deployment steps:"
    echo "1. Go to: https://thecurrentsee.org/marketplace.html"
    echo "2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
    echo "3. Click 'Upload' tab"
    echo "4. Look for purple box: '✨ Create AI Content'"
    echo "5. You should see 3 green dropdown buttons:"
    echo "   - 🎵 Music Creators"
    echo "   - 🎬 Video Creators"
    echo "   - 💻 Code Creators"
    echo ""
    echo "If you still don't see them, try:"
    echo "- Clear browser cache completely"
    echo "- Open in incognito/private window"
    echo "- Try different browser"
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above"
    exit 1
fi
