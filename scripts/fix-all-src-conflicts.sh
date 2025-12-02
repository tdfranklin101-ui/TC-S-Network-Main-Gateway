#!/bin/bash

echo "🔧 Fixing ALL src/ folder conflicts"
echo "===================================="
echo ""

GITHUB_USER="tdfranklin101-ui"
WORK_DIR="/tmp/tcs-fix-all"
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Setup git auth
gh auth setup-git

# Repos that need fixing (have src/api or src/components)
REPOS=(
  "TC-S-Network-Solar-Dashboard"
  "TC-S-Network-Identify-Anything"
  "TC-S-Network-Solar-Reserve"
)

SUCCESS=0
FAILED=0

for repo in "${REPOS[@]}"; do
  echo ""
  echo "────────────────────────────────────────"
  echo "📦 $repo"
  echo "────────────────────────────────────────"

  if gh repo clone "$GITHUB_USER/$repo" "$repo" 2>/dev/null; then
    cd "$repo"
    
    CHANGED=false
    
    # Remove all conflicting src subfolders
    if [ -d "src/api" ]; then
      echo "🗑️ Removing src/api..."
      rm -rf src/api
      CHANGED=true
    fi
    
    if [ -d "src/components" ]; then
      echo "🗑️ Removing src/components..."
      rm -rf src/components
      CHANGED=true
    fi
    
    if [ -d "src/app" ]; then
      echo "🗑️ Removing src/app..."
      rm -rf src/app
      CHANGED=true
    fi
    
    if [ "$CHANGED" = true ]; then
      git add .
      git commit -m "fix: Remove conflicting src/ subfolders for clean Next.js App Router"
      
      if git push origin main 2>&1; then
        echo "✅ Fixed and pushed"
        ((SUCCESS++))
      else
        echo "❌ Push failed"
        ((FAILED++))
      fi
    else
      echo "✅ No conflicts found"
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
echo "🔧 ALL FIXES COMPLETE"
echo "═══════════════════════════════════════"
echo ""
echo "✅ Fixed: $SUCCESS repos"
echo "❌ Failed: $FAILED repos"
echo ""
echo "⏳ Vercel will rebuild in 1-2 minutes"
