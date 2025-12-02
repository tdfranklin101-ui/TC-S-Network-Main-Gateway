#!/bin/bash

echo "🔄 Rollback to WPC v1.0.0 (working version)"
echo "============================================="
echo ""

GITHUB_USER="tdfranklin101-ui"
MAIN_GATEWAY_DIR=$(pwd)
ORIGINAL_WPC="$MAIN_GATEWAY_DIR/shared/components/WPCPanel.tsx"

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

WORK_DIR="/tmp/tcs-rollback"
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
    
    # Restore original WPCPanel without telemetry
    if [ -d "components/tcs" ]; then
      cp "$ORIGINAL_WPC" components/tcs/WPCPanel.tsx
      echo "✅ Restored WPCPanel.tsx"
      
      # Fix page.tsx - remove appName prop and ensure proper formatting
      if [ -f "app/page.tsx" ]; then
        # Get app name for display
        APP_NAME=$(echo "$repo" | sed 's/TC-S-Network-//' | tr '-' ' ')
        
        # Create clean page.tsx
        cat > app/page.tsx << EOF
import WPCPanel from '@/components/tcs/WPCPanel';

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 p-10 space-y-6">
      <h1 className="text-4xl font-bold text-yellow-300">TC-S: ${APP_NAME}</h1>
      <p className="text-gray-300">Next.js App Router is active.</p>
      <WPCPanel />
    </main>
  );
}
EOF
        echo "✅ Fixed page.tsx"
      fi
      
      # Remove telemetry route if it exists
      rm -rf app/api/telemetry
      
      git add .
      git commit -m "fix: Rollback to WPC v1.0.0 (stable)"
      
      if git push origin main 2>&1; then
        echo "✅ Pushed"
        ((SUCCESS++))
      else
        echo "❌ Push failed"
        ((FAILED++))
      fi
    else
      echo "⚠️ No components/tcs folder"
      ((FAILED++))
    fi
    
    cd "$WORK_DIR"
  else
    echo "❌ Clone failed"
    ((FAILED++))
  fi
done

echo ""
echo "═══════════════════════════════════════"
echo "🔄 ROLLBACK COMPLETE"
echo "═══════════════════════════════════════"
echo ""
echo "✅ Rolled back: $SUCCESS repos"
echo "❌ Failed: $FAILED repos"
echo ""
echo "⏳ Vercel will auto-deploy in 1-2 minutes"

cd "$MAIN_GATEWAY_DIR"
