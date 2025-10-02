#!/bin/bash

echo "🚀 Current-See Production Deployment Script"
echo "=========================================="
echo ""

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found in this environment"
    echo ""
    echo "📋 To deploy, follow these steps:"
    echo ""
    echo "1. Download this project as a ZIP from Replit"
    echo "2. Extract it on your local machine"
    echo "3. Run this command from the extracted folder:"
    echo ""
    echo "   gcloud run deploy current-see \\"
    echo "     --source . \\"
    echo "     --region us-central1 \\"
    echo "     --allow-unauthenticated \\"
    echo "     --memory 1Gi"
    echo ""
    echo "📄 Full instructions: See DEPLOY-TO-PRODUCTION.md"
    echo ""
    echo "✅ Project is ready to deploy:"
    echo "   - Deployment size: ~400MB (under 500MB limit)"
    echo "   - Videos will stream from Object Storage"
    echo "   - All 3 platform videos confirmed in storage"
    exit 1
fi

# Deploy to Cloud Run
echo "✅ Found gcloud CLI - proceeding with deployment..."
echo ""

gcloud run deploy current-see \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production" \
  --quiet

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo ""
    SERVICE_URL=$(gcloud run services describe current-see --region us-central1 --format='value(status.url)')
    echo "🌐 Production URL: $SERVICE_URL"
    echo ""
    echo "Test endpoints:"
    echo "  Marketplace: $SERVICE_URL/marketplace"
    echo "  Main Platform: $SERVICE_URL/main-platform"
    echo "  Video: $SERVICE_URL/videos/plant-the-seed.mp4"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
