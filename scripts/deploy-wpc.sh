#!/bin/bash

echo "🚀 TC-S COMPUTRONIUM DEPLOYER v1.1"
echo "=================================="
echo "Safe deployment with PR-ready patches"
echo ""

GITHUB_USER="tdfranklin101-ui"
WORK_DIR="/tmp/tcs-deployer"
MAIN_GATEWAY_DIR=$(pwd)
PATCHES_DIR="$MAIN_GATEWAY_DIR/wpc-patches"
WPC_VERSION="1.0.0"
WPC_BUILD="2024-12-02"

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

WPC_PANEL_SOURCE="$MAIN_GATEWAY_DIR/shared/components/WPCPanel.tsx"

detect_framework() {
  local repo_path=$1
  
  if [ -f "$repo_path/app/page.tsx" ]; then
    echo "nextjs-app"
  elif [ -f "$repo_path/pages/index.tsx" ] || [ -f "$repo_path/pages/index.js" ]; then
    echo "nextjs-pages"
  elif [ -d "$repo_path/client/src" ]; then
    echo "vite-react"
  elif [ -d "$repo_path/src" ]; then
    echo "react-src"
  else
    echo "unknown"
  fi
}

generate_patch_instructions() {
  local repo_name=$1
  local framework=$2
  local repo_path="$WORK_DIR/$repo_name"
  local patch_dir="$PATCHES_DIR/$repo_name"
  
  mkdir -p "$patch_dir/components/tcs"
  
  cp "$WPC_PANEL_SOURCE" "$patch_dir/components/tcs/WPCPanel.tsx"
  
  local readme="$patch_dir/INTEGRATION_README.md"
  cat > "$readme" << EOF
# WPC Integration for $repo_name

**WPC Version:** $WPC_VERSION
**Build Date:** $WPC_BUILD
**Framework Detected:** $framework

## Files to Add

1. Copy \`components/tcs/WPCPanel.tsx\` to your project's components folder

## Integration Steps

EOF

  case $framework in
    "nextjs-app")
      cat >> "$readme" << 'EOF'
### Next.js App Router Integration

1. Copy the WPCPanel component:
   ```bash
   cp components/tcs/WPCPanel.tsx your-project/components/tcs/
   ```

2. Import and use in `app/page.tsx`:
   ```tsx
   import WPCPanel from '@/components/tcs/WPCPanel';
   
   export default function Page() {
     return (
       <main>
         {/* Your existing content */}
         <WPCPanel />
       </main>
     );
   }
   ```

3. Ensure your `tsconfig.json` has the path alias:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```
EOF
      ;;
    "nextjs-pages")
      cat >> "$readme" << 'EOF'
### Next.js Pages Router Integration

1. Copy the WPCPanel component:
   ```bash
   cp components/tcs/WPCPanel.tsx your-project/components/tcs/
   ```

2. Import and use in `pages/index.tsx`:
   ```tsx
   import WPCPanel from '../components/tcs/WPCPanel';
   
   export default function Home() {
     return (
       <div>
         {/* Your existing content */}
         <WPCPanel />
       </div>
     );
   }
   ```
EOF
      ;;
    "vite-react")
      cat >> "$readme" << 'EOF'
### Vite + React Integration

1. Copy the WPCPanel component:
   ```bash
   cp components/tcs/WPCPanel.tsx your-project/client/src/components/tcs/
   ```

2. Import and use in your Home page:
   ```tsx
   import WPCPanel from '../components/tcs/WPCPanel';
   
   export default function Home() {
     return (
       <div>
         {/* Your existing content */}
         <WPCPanel />
       </div>
     );
   }
   ```

Note: Remove the 'use client' directive if not using Next.js.
EOF
      ;;
    *)
      cat >> "$readme" << 'EOF'
### Manual Integration

1. Identify your main page/component file
2. Copy the WPCPanel component to an appropriate location
3. Import and add <WPCPanel /> where you want it to appear
4. Adjust import paths as needed for your project structure
EOF
      ;;
  esac
  
  cat >> "$readme" << EOF

## Verification

After integration, you should see:
- A dark panel with "WPC Compute Intelligence" header
- Model type selector (LLM, Vision, Diffusion)
- Input controls for tokens/resolution, power, and time
- Real-time calculation of FLOPs, Energy, WPC, Solar, and Rays
- Efficiency grade badge (A+ to D)
- Version footer showing "TC-S Computronium Standard v$WPC_VERSION"

## Need Help?

Contact: TC-S Network Foundation
Repository: https://github.com/$GITHUB_USER/TC-S-Network-Main-Gateway
EOF

  echo "$patch_dir"
}

if [ ! -f "$WPC_PANEL_SOURCE" ]; then
  echo "❌ ERROR: WPCPanel.tsx not found at $WPC_PANEL_SOURCE"
  echo "   Run this script from the Main Gateway root directory"
  exit 1
fi

echo "✅ WPCPanel source found: $WPC_PANEL_SOURCE"
echo "✅ WPC Version: $WPC_VERSION"
echo ""

rm -rf "$WORK_DIR" "$PATCHES_DIR"
mkdir -p "$WORK_DIR" "$PATCHES_DIR"
cd "$WORK_DIR"

echo "📥 Analyzing repos and generating patches..."
echo ""

PROCESSED=0

for repo in "${REPOS[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════"
  echo "📦 Processing: $repo"
  echo "════════════════════════════════════════════════"

  if gh repo clone "$GITHUB_USER/$repo" 2>/dev/null; then
    echo "✅ Cloned successfully"
    
    framework=$(detect_framework "$WORK_DIR/$repo")
    echo " → Framework: $framework"
    
    patch_dir=$(generate_patch_instructions "$repo" "$framework")
    echo " → Patch generated: $patch_dir"
    
    ((PROCESSED++))
  else
    echo "❌ Failed to clone $repo"
  fi
done

echo ""
echo "════════════════════════════════════════════════"
echo "🎉 TC-S COMPUTRONIUM DEPLOYER — COMPLETE"
echo "════════════════════════════════════════════════"
echo ""
echo "📁 Patches generated: $PATCHES_DIR"
echo "✅ Repos processed: $PROCESSED"
echo ""
echo "📋 Next Steps:"
echo "1. Review generated patches in $PATCHES_DIR"
echo "2. For each repo, follow the INTEGRATION_README.md"
echo "3. Create a PR or commit the changes manually"
echo ""
echo "🌞 Safe deployment - no automatic pushes performed"

cd "$MAIN_GATEWAY_DIR"
echo ""
echo "Listing generated patches:"
ls -la "$PATCHES_DIR"
