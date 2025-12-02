#!/bin/bash

echo "🔧 Fixing Next.js App Router Conflicts"
echo "======================================="
echo ""
echo "Issue: Both /app and /src/app folders exist"
echo "Solution: Remove /src/app to use root /app only"
echo ""

GITHUB_USER="tdfranklin101-ui"

REPOS=(
  "TC-S-Network-Identify-Anything"
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

WORK_DIR="/tmp/tcs-fix-conflict"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Setup git auth
gh auth setup-git

SUCCESS=0
FAILED=0

for repo in "${REPOS[@]}"; do
  echo ""
  echo "────────────────────────────────────────"
  echo "📦 $repo"
  echo "────────────────────────────────────────"

  if gh repo clone "$GITHUB_USER/$repo" "$repo" 2>/dev/null; then
    cd "$repo"
    
    # Check if src/app exists
    if [ -d "src/app" ]; then
      echo "⚠️ Found src/app folder - removing..."
      rm -rf src/app
      
      git add .
      git commit -m "fix: Remove conflicting src/app folder (Next.js App Router fix)"
      
      if git push origin main 2>&1; then
        echo "✅ Fixed and pushed"
        ((SUCCESS++))
      else
        echo "❌ Push failed"
        ((FAILED++))
      fi
    else
      echo "✅ No conflict - src/app not found"
      ((SUCCESS++))
    fi
    
    cd "$WORK_DIR"
  else
    echo "❌ Clone failed"
    ((FAILED++))
  fi
done

echo ""
echo "═══════════════════════════════════════"
echo "🔧 FIX COMPLETE"
echo "═══════════════════════════════════════"
echo ""
echo "✅ Fixed/OK: $SUCCESS repos"
echo "❌ Failed: $FAILED repos"
echo ""
echo "⏳ Vercel will auto-deploy in 1-2 minutes"
