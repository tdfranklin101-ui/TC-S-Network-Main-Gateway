#!/bin/bash

echo "🚀 TC-S COMPUTRONIUM DEPLOYER — CORRECTED VERSION"
echo "=================================================="

# ----------------------------------------
# VARIABLES
# ----------------------------------------
GITHUB_USER="tdfranklin101-ui"
WORK_DIR="/tmp/tcs-deployer"
MAIN_GATEWAY_DIR=$(pwd)

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

# WPC Panel component source (from Main Gateway shared folder)
WPC_PANEL_SOURCE="$MAIN_GATEWAY_DIR/shared/components/WPCPanel.tsx"

# ----------------------------------------
# FUNCTION: Detect framework and inject WPC
# ----------------------------------------
inject_wpc() {
  local repo_path=$1
  local repo_name=$(basename $repo_path)

  echo ""
  echo "🔧 Patching $repo_name ..."

  # ----------------------------------------
  # NEXT.JS APP ROUTER (app/page.tsx)
  # ----------------------------------------
  if [ -f "$repo_path/app/page.tsx" ]; then
    echo " → Next.js App Router detected"
    
    # Create components directory if needed
    mkdir -p "$repo_path/components/tcs"
    
    # Copy WPC Panel component
    cp "$WPC_PANEL_SOURCE" "$repo_path/components/tcs/WPCPanel.tsx"
    echo " → Copied WPCPanel.tsx to components/tcs/"

    # Check if WPC is already imported
    if grep -q "WPCPanel" "$repo_path/app/page.tsx"; then
      echo " → WPCPanel already integrated, skipping injection"
    else
      # Inject import at top of file (after 'use client' if present)
      if grep -q "'use client'" "$repo_path/app/page.tsx"; then
        sed -i "s/'use client';/'use client';\nimport WPCPanel from '@\/components\/tcs\/WPCPanel';/" "$repo_path/app/page.tsx"
      else
        sed -i "1i import WPCPanel from '@/components/tcs/WPCPanel';" "$repo_path/app/page.tsx"
      fi
      
      # Find the closing </main> or </div> and insert WPCPanel before it
      if grep -q "</main>" "$repo_path/app/page.tsx"; then
        sed -i 's/<\/main>/<WPCPanel \/>\n      <\/main>/' "$repo_path/app/page.tsx"
      elif grep -q "</div>" "$repo_path/app/page.tsx"; then
        # Only replace the last </div>
        sed -i ':a;N;$!ba;s/\(.*\)<\/div>/\1<WPCPanel \/>\n      <\/div>/' "$repo_path/app/page.tsx"
      fi
      echo " → Injected WPCPanel into app/page.tsx"
    fi
    return 0

  # ----------------------------------------
  # NEXT.JS PAGES ROUTER (pages/index.tsx)
  # ----------------------------------------
  elif [ -f "$repo_path/pages/index.tsx" ] || [ -f "$repo_path/pages/index.js" ]; then
    echo " → Next.js Pages Router detected"
    
    mkdir -p "$repo_path/components/tcs"
    cp "$WPC_PANEL_SOURCE" "$repo_path/components/tcs/WPCPanel.tsx"
    echo " → Copied WPCPanel.tsx to components/tcs/"

    local index_file="$repo_path/pages/index.tsx"
    [ ! -f "$index_file" ] && index_file="$repo_path/pages/index.js"

    if grep -q "WPCPanel" "$index_file"; then
      echo " → WPCPanel already integrated, skipping injection"
    else
      sed -i "1i import WPCPanel from '../components/tcs/WPCPanel';" "$index_file"
      if grep -q "</main>" "$index_file"; then
        sed -i 's/<\/main>/<WPCPanel \/>\n      <\/main>/' "$index_file"
      elif grep -q "</div>" "$index_file"; then
        sed -i ':a;N;$!ba;s/\(.*\)<\/div>/\1<WPCPanel \/>\n      <\/div>/' "$index_file"
      fi
      echo " → Injected WPCPanel into pages/index"
    fi
    return 0

  # ----------------------------------------
  # VITE + REACT (client/src/pages/Home.tsx)
  # ----------------------------------------
  elif [ -d "$repo_path/client/src" ]; then
    echo " → Vite + React app detected"
    
    mkdir -p "$repo_path/client/src/components/tcs"
    cp "$WPC_PANEL_SOURCE" "$repo_path/client/src/components/tcs/WPCPanel.tsx"
    echo " → Copied WPCPanel.tsx to client/src/components/tcs/"

    local home_file="$repo_path/client/src/pages/Home.tsx"
    if [ -f "$home_file" ]; then
      if grep -q "WPCPanel" "$home_file"; then
        echo " → WPCPanel already integrated, skipping injection"
      else
        sed -i "1i import WPCPanel from '../components/tcs/WPCPanel';" "$home_file"
        if grep -q "</main>" "$home_file"; then
          sed -i 's/<\/main>/<WPCPanel \/>\n      <\/main>/' "$home_file"
        elif grep -q "</div>" "$home_file"; then
          sed -i ':a;N;$!ba;s/\(.*\)<\/div>/\1<WPCPanel \/>\n      <\/div>/' "$home_file"
        fi
        echo " → Injected WPCPanel into client/src/pages/Home.tsx"
      fi
    else
      echo " ⚠ Home.tsx not found at expected location"
    fi
    return 0

  # ----------------------------------------
  # SRC FOLDER STRUCTURE (src/index.tsx or src/App.tsx)
  # ----------------------------------------
  elif [ -d "$repo_path/src" ]; then
    echo " → src/ folder structure detected"
    
    mkdir -p "$repo_path/src/components/tcs"
    cp "$WPC_PANEL_SOURCE" "$repo_path/src/components/tcs/WPCPanel.tsx"
    echo " → Copied WPCPanel.tsx to src/components/tcs/"

    # Try App.tsx first, then index.tsx
    local main_file=""
    if [ -f "$repo_path/src/App.tsx" ]; then
      main_file="$repo_path/src/App.tsx"
    elif [ -f "$repo_path/src/index.tsx" ]; then
      main_file="$repo_path/src/index.tsx"
    fi

    if [ -n "$main_file" ]; then
      if grep -q "WPCPanel" "$main_file"; then
        echo " → WPCPanel already integrated, skipping injection"
      else
        sed -i "1i import WPCPanel from './components/tcs/WPCPanel';" "$main_file"
        echo " → Added WPCPanel import to $(basename $main_file)"
      fi
    fi
    return 0

  else
    echo " ⚠ Unknown structure. Listing top-level contents:"
    ls -la "$repo_path" | head -15
    return 1
  fi
}

# ----------------------------------------
# MAIN EXECUTION
# ----------------------------------------

# Verify WPC Panel source exists
if [ ! -f "$WPC_PANEL_SOURCE" ]; then
  echo "❌ ERROR: WPCPanel.tsx not found at $WPC_PANEL_SOURCE"
  echo "   Run this script from the Main Gateway root directory"
  exit 1
fi

echo "✅ WPCPanel source found: $WPC_PANEL_SOURCE"

# Create work directory
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo ""
echo "📥 Cloning repos and injecting WPC Panel..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for repo in "${REPOS[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════"
  echo "📦 Processing: $repo"
  echo "════════════════════════════════════════════════"

  # Clone the repo
  if gh repo clone "$GITHUB_USER/$repo" 2>/dev/null; then
    echo "✅ Cloned successfully"
    
    # Inject WPC
    if inject_wpc "$WORK_DIR/$repo"; then
      echo ""
      echo "💾 Committing and pushing..."
      cd "$WORK_DIR/$repo"
      
      git add .
      if git diff --cached --quiet; then
        echo " → No changes to commit"
      else
        git commit -m "Add WPC Computronium Panel - TC-S Energy Intelligence"
        if git push origin main 2>/dev/null || git push origin master 2>/dev/null; then
          echo "✅ Pushed to GitHub"
          ((SUCCESS_COUNT++))
        else
          echo "⚠ Push failed - check permissions"
          ((FAIL_COUNT++))
        fi
      fi
      cd "$WORK_DIR"
    else
      echo "⚠ Injection skipped"
      ((FAIL_COUNT++))
    fi
  else
    echo "❌ Failed to clone $repo"
    ((FAIL_COUNT++))
  fi
done

# ----------------------------------------
# SUMMARY
# ----------------------------------------
echo ""
echo "════════════════════════════════════════════════"
echo "🎉 TC-S COMPUTRONIUM DEPLOYER — COMPLETE"
echo "════════════════════════════════════════════════"
echo ""
echo "✅ Successfully patched: $SUCCESS_COUNT repos"
echo "⚠  Skipped/Failed: $FAIL_COUNT repos"
echo ""
echo "🌞 Vercel will auto-deploy all changed repos"
echo "🔗 TC-S Computronium Network is now live!"
echo ""

# Cleanup
cd "$MAIN_GATEWAY_DIR"
echo "📁 Work directory: $WORK_DIR (preserved for debugging)"
