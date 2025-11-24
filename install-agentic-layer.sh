#!/bin/bash
set -e

echo "=============================================="
echo "   TC-S Network – Multi-Repo Agent Installer  "
echo "=============================================="

AGENT_BOOTSTRAP_CONTENT=$(cat << 'EOF'
/* ---- TC-S UNIVERSAL AGENT BOOTSTRAP ---- */
/* (Same block from previous message but minified for install script) */

export const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export function getPersonalAgentId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tcs_agent_id");
}

export async function registerPersonalAgent(walletAddress, displayName) {
  const res = await fetch(\`\${API}/api/agents/register-personal\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, displayName })
  });
  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("tcs_agent_id", data.agent.id);
  }
  return data.agent;
}

export async function agentAction(actionType, payload, targetAgentId) {
  const id = getPersonalAgentId();
  if (!id) throw new Error("No agent");
  const res = await fetch(\`\${API}/api/agents/\${id}/actions\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionType,
      payload,
      targetAgentId: targetAgentId ?? null
    })
  });
  return res.json();
}

export async function getSolarBalance(walletAddress) {
  const res = await fetch(\`\${API}/api/wallets/\${walletAddress}/balance\`);
  return res.json();
}

const MAP = {
  "TC-S-Network-Z-Private": {
    serviceId: "z-private", displayName: "Z Private Network",
    capabilities: ["commission.project"]
  },
  "TC-S-Network-Standards": {
    serviceId: "standards", displayName: "TC-S Standards",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Compute-Governance": {
    serviceId: "compute-governance", displayName: "Compute Governance",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Ethics-Engine": {
    serviceId: "ethics-engine", displayName: "Ethics Engine",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Solar-Reserve": {
    serviceId: "solar-reserve", displayName: "Solar Reserve Tracker",
    capabilities: ["observe.telemetry"]
  },
  "TC-S-Network-UIM-Protocol": {
    serviceId: "uim-protocol", displayName: "UIM Protocol",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Wallet": {
    serviceId: "wallet", displayName: "TC-S Wallet",
    capabilities: ["transact.market"]
  },
  "TC-S-Network-GBI-Onboarding": {
    serviceId: "gbi-onboarding", displayName: "GBI Onboarding",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Seismic-ID-Anywhere": {
    serviceId: "seismic-id-anywhere", displayName: "Seismic ID Anywhere",
    capabilities: ["analyze.risk"]
  },
  "TC-S-Network-Satellite-ID-Anywhere": {
    serviceId: "satellite-id-anywhere", displayName: "Satellite ID Anywhere",
    capabilities: ["observe.telemetry"]
  },
  "TC-S-Network-Identify-Anything": {
    serviceId: "identify-anything", displayName: "Identify Anything",
    capabilities: ["price.artifact"]
  },
  "TC-S-Network-Market-Grid": {
    serviceId: "market-grid", displayName: "TC-S Market Grid",
    capabilities: ["transact.market"]
  },
  "TC-S-Network-Solar-Dashboard": {
    serviceId: "solar-dashboard", displayName: "Solar Dashboard",
    capabilities: ["access.compute"]
  }
};

export async function registerDomainAgentAuto() {
  const repo = process.env.NEXT_PUBLIC_REPO_NAME || "unknown";
  const cfg = MAP[repo];
  if (!cfg) return;

  await fetch(\`\${API}/api/agents/register-domain\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg)
  });
}

export function bootstrapTCSAgents() {
  if (typeof window === "undefined") return;
  const w = localStorage.getItem("tcs_wallet_address");
  const n = localStorage.getItem("tcs_user_name") ?? "TC-S User";
  if (w && !getPersonalAgentId()) registerPersonalAgent(w, n);
  registerDomainAgentAuto();
}
EOF
)

# Loop repos
for repo in TC-S-*; do
  if [ -d "$repo" ]; then
    echo ""
    echo "----------------------------------------------"
    echo "📦 Installing TC-S Agent Layer in: $repo"
    echo "----------------------------------------------"

    mkdir -p "$repo/src"
    echo "$AGENT_BOOTSTRAP_CONTENT" > "$repo/src/tcs-agent-bootstrap.ts"

    # Patch _app.tsx
    APP_FILE="$repo/src/pages/_app.tsx"
    if [ -f "$APP_FILE" ]; then
      echo "Patching $APP_FILE..."

      # Insert import if not present
      if ! grep -q "bootstrapTCSAgents" "$APP_FILE"; then
        sed -i '' '1s|^|import { bootstrapTCSAgents } from "../tcs-agent-bootstrap";\n|' "$APP_FILE"
      fi

      # Insert useEffect call
      if ! grep -q "bootstrapTCSAgents()" "$APP_FILE"; then
        sed -i '' 's|function MyApp|import { useEffect } from "react";\n\nfunction MyApp|' "$APP_FILE"
        sed -i '' 's|return <Component|useEffect(() => { bootstrapTCSAgents(); }, []);\n  return <Component|' "$APP_FILE"
      fi
    else
      echo "⚠️ $APP_FILE not found—skipped"
    fi
  fi
done

echo ""
echo "=============================================="
echo "🔥 TC-S Agent Layer Installed in All Repos! 🔥"
echo "=============================================="
