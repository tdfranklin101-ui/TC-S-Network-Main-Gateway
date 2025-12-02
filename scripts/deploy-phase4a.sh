#!/bin/bash

echo "🌞 TC-S Phase 4A: Cross-App Compute Telemetry Deployment"
echo "========================================================="
echo ""

GITHUB_USER="tdfranklin101-ui"
WORK_DIR="/tmp/tcs-phase4a"
MAIN_GATEWAY_DIR=$(pwd)
WPC_TELEMETRY_SOURCE="$MAIN_GATEWAY_DIR/shared/components/WPCPanelWithTelemetry.tsx"
TELEMETRY_ROUTE_SOURCE="$MAIN_GATEWAY_DIR/wpc-patches/solar-dashboard-telemetry-route.ts"

# All satellite repos
REPOS=(
  "TC-S-Network-Identify-Anything"
  "TC-S-Network-Market-Grid"
  "TC-S-Network-Satellite-ID-Anywhere"
  "TC-S-Network-Seismic-ID-Anywhere"
  "TC-S-Network-Solar-Dashboard"
  "TC-S-Network-Wallet"
  "TC-S-Network-Solar-Reserve"
  "TC-S-Network-GBI-Onboarding"
  "TC-S-Network-Compute-Governance"
  "TC-S-Network-Ethics-Engine"
  "TC-S-Network-UIM-Protocol"
  "TC-S-Network-Standards"
  "TC-S-Network-Z-Private"
)

# Verify sources exist
if [ ! -f "$WPC_TELEMETRY_SOURCE" ]; then
  echo "❌ ERROR: WPCPanelWithTelemetry.tsx not found"
  exit 1
fi

echo "✅ Source files found"
echo ""

# Setup work directory
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Step 1: Update Solar Dashboard with telemetry endpoint
echo "═══════════════════════════════════════════════════════"
echo "📡 STEP 1: Adding telemetry endpoint to Solar Dashboard"
echo "═══════════════════════════════════════════════════════"

gh repo clone "$GITHUB_USER/TC-S-Network-Solar-Dashboard" solar-dashboard
cd solar-dashboard

# Create telemetry API route
mkdir -p app/api/telemetry
cp "$TELEMETRY_ROUTE_SOURCE" app/api/telemetry/route.ts

git add .
git commit -m "feat: Add telemetry ingest endpoint (Phase 4A)"
git push origin main

echo "✅ Solar Dashboard telemetry endpoint deployed"
cd "$WORK_DIR"

# Step 2: Update all satellite repos with telemetry-enabled WPC
echo ""
echo "═══════════════════════════════════════════════════════"
echo "🌐 STEP 2: Deploying telemetry-enabled WPC to all repos"
echo "═══════════════════════════════════════════════════════"

SUCCESS=0
FAILED=0

for repo in "${REPOS[@]}"; do
  echo ""
  echo "────────────────────────────────────────"
  echo "📦 $repo"
  echo "────────────────────────────────────────"

  if gh repo clone "$GITHUB_USER/$repo" "$repo" 2>/dev/null; then
    cd "$repo"
    
    # Replace WPCPanel with telemetry version
    if [ -f "components/tcs/WPCPanel.tsx" ]; then
      cp "$WPC_TELEMETRY_SOURCE" components/tcs/WPCPanel.tsx
      echo "✅ Updated WPCPanel with telemetry"
      
      # Update page.tsx to pass appName prop
      if [ -f "app/page.tsx" ]; then
        # Extract app name from repo name
        APP_NAME=$(echo "$repo" | sed 's/TC-S-Network-//')
        
        # Update WPCPanel usage to include appName
        sed -i "s/<WPCPanel \/>/<WPCPanel appName=\"$APP_NAME\" \/>/g" app/page.tsx
        sed -i "s/<WPCPanel\/>/<WPCPanel appName=\"$APP_NAME\" \/>/g" app/page.tsx
        echo "✅ Added appName prop: $APP_NAME"
      fi
      
      git add .
      git commit -m "feat: Enable compute telemetry (Phase 4A) - $APP_NAME"
      
      if git push origin main 2>/dev/null; then
        echo "✅ Pushed to GitHub"
        ((SUCCESS++))
      else
        echo "❌ Push failed"
        ((FAILED++))
      fi
    else
      echo "⚠️ No WPCPanel.tsx found, skipping"
      ((FAILED++))
    fi
    
    cd "$WORK_DIR"
  else
    echo "❌ Clone failed"
    ((FAILED++))
  fi
done

# Summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo "🎉 PHASE 4A DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "✅ Successfully updated: $SUCCESS repos"
echo "❌ Failed: $FAILED repos"
echo ""
echo "📡 Telemetry endpoint: https://tc-s-network-solar-dashboard.vercel.app/api/telemetry"
echo "📊 Telemetry status:   https://tc-s-network-solar-dashboard.vercel.app/api/telemetry (GET)"
echo ""
echo "🌐 Vercel will auto-deploy all repos"
echo "⭐ All apps now report compute usage to Solar Dashboard"

cd "$MAIN_GATEWAY_DIR"
