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
    
    # Configure git remote with token
    gh auth setup-git 2>/dev/null
    
    # Create components/tcs directory
    mkdir -p components/tcs
    
    # Copy WPCPanel
    cp "$WPC_PANEL_SOURCE" components/tcs/WPCPanel.tsx
    echo "✅ Copied WPCPanel.tsx"
    
    # Update page.tsx if exists
    if [ -f "app/page.tsx" ]; then
      if ! grep -q "WPCPanel" app/page.tsx; then
        sed -i "1i import WPCPanel from '@/components/tcs/WPCPanel';" app/page.tsx
        sed -i 's/<\/main>/<WPCPanel \/>\n      <\/main>/' app/page.tsx
        echo "✅ Injected into app/page.tsx"
      else
        echo "⏭️  Already integrated"
      fi
    fi
    
    # Commit and push using gh
    git add .
    if ! git diff --cached --quiet; then
      git commit -m "feat: Add WPC Computronium Panel v1.0.0 - TC-S Energy Intelligence"
      
      # Use gh to sync (handles auth better)
      if gh repo sync --force 2>/dev/null; then
        echo "✅ Pushed via gh sync"
        ((SUCCESS++))
      elif git push origin main 2>&1; then
        echo "✅ Pushed to main"
        ((SUCCESS++))
      elif git push origin master 2>&1; then
        echo "✅ Pushed to master"
        ((SUCCESS++))
      else
        echo "❌ Push failed - trying gh api"
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

cd "$MAIN_GATEWAY_DIR"
