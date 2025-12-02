#!/bin/bash

echo "🚀 TC-S WPC DEPLOYER - PUSH MODE"
echo "================================="
echo ""

GITHUB_USER="tdfranklin101-ui"
WORK_DIR="/tmp/tcs-deployer-push"
MAIN_GATEWAY_DIR=$(pwd)
WPC_PANEL_SOURCE="$MAIN_GATEWAY_DIR/shared/components/WPCPanel.tsx"

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

if [ ! -f "$WPC_PANEL_SOURCE" ]; then
  echo "❌ ERROR: WPCPanel.tsx not found"
  exit 1
fi

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

SUCCESS=0
FAILED=0

for repo in "${REPOS[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════"
  echo "📦 $repo"
  echo "════════════════════════════════════════════════"

  if gh repo clone "$GITHUB_USER/$repo" 2>/dev/null; then
    cd "$WORK_DIR/$repo"
    
    # Create components/tcs directory
    mkdir -p components/tcs
    
    # Copy WPCPanel
    cp "$WPC_PANEL_SOURCE" components/tcs/WPCPanel.tsx
    echo "✅ Copied WPCPanel.tsx"
    
    # Update page.tsx if exists
    if [ -f "app/page.tsx" ]; then
      # Check if already integrated
      if ! grep -q "WPCPanel" app/page.tsx; then
        # Add import at top
        sed -i "1i import WPCPanel from '@/components/tcs/WPCPanel';" app/page.tsx
        # Add component before closing main tag
        sed -i 's/<\/main>/<WPCPanel \/>\n      <\/main>/' app/page.tsx
        echo "✅ Injected into app/page.tsx"
      else
        echo "⏭️  Already integrated"
      fi
    fi
    
    # Commit and push
    git add .
    if ! git diff --cached --quiet; then
      git commit -m "feat: Add WPC Computronium Panel v1.0.0 - TC-S Energy Intelligence"
      if git push origin main 2>/dev/null || git push origin master 2>/dev/null; then
        echo "✅ Pushed to GitHub"
        ((SUCCESS++))
      else
        echo "❌ Push failed"
        ((FAILED++))
      fi
    else
      echo "⏭️  No changes"
    fi
    
    cd "$WORK_DIR"
  else
    echo "❌ Clone failed"
    ((FAILED++))
  fi
done

echo ""
echo "════════════════════════════════════════════════"
echo "🎉 DEPLOYMENT COMPLETE"
echo "════════════════════════════════════════════════"
echo "✅ Success: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""
echo "🌐 Vercel will auto-deploy all updated repos"

cd "$MAIN_GATEWAY_DIR"
