/**
 * TC-S Network – Universal Agent Bootstrap
 * Drop this file into ANY TC-S front-end repo.
 * It automatically:
 *  - identifies the app by repo name
 *  - registers domain agent
 *  - initializes personal agent
 *  - exposes agentAction, getSolarBalance, registerPersonalAgent, etc.
 */

const API = import.meta.env.VITE_API_BASE_URL || '';

export const RAYS_PER_SOLAR = 10000;

export const ACTION_COSTS: Record<string, { rays: number; description: string }> = {
  'create.artifact': { rays: 200, description: 'Create AI artifact or content' },
  'price.artifact': { rays: 500, description: 'Price an artifact for marketplace' },
  'analyze.risk': { rays: 800, description: 'Analyze risk or seismic data' },
  'access.compute': { rays: 1000, description: 'Access compute resources' },
  'commission.project': { rays: 10000, description: 'Commission a full project' },
  'diagnose.status': { rays: 100, description: 'Run diagnostic check' },
  'identify.object': { rays: 100, description: 'Identify an object or entity' },
  'query.satellite': { rays: 200, description: 'Query satellite data' },
  'query.seismic': { rays: 200, description: 'Query seismic data' },
  'observe.telemetry': { rays: 150, description: 'Observe telemetry stream' },
  'transact.market': { rays: 300, description: 'Execute market transaction' }
};

export function raysToSolar(rays: number): number {
  return rays / RAYS_PER_SOLAR;
}

export function solarToRays(solar: number): number {
  return solar * RAYS_PER_SOLAR;
}

/* ---------------------------
   PERSONAL AGENT FUNCTIONS
---------------------------- */

export function getPersonalAgentId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tcs_agent_id");
}

export function setPersonalAgentId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("tcs_agent_id", id);
}

export function getWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tcs_wallet_address");
}

export function getUserName(): string {
  if (typeof window === "undefined") return "TC-S User";
  return localStorage.getItem("tcs_user_name") ?? "TC-S User";
}

export async function registerPersonalAgent(
  walletAddress: string,
  displayName: string
): Promise<{
  id: string;
  agentType: string;
  walletAddress: string;
  displayName: string;
  autonomyLevel: string;
  dailyLimitSolar: number;
  maxPerActionRays: number;
}> {
  const res = await fetch(`${API}/api/agents/register-personal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, displayName })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to register agent');
  }

  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("tcs_agent_id", data.agent.id);
  }
  return data.agent;
}

export async function getAgent(agentId: string): Promise<{
  id: string;
  agentType: string;
  walletAddress: string;
  displayName: string;
  autonomyLevel: string;
  dailyLimitSolar: number;
  maxPerActionRays: number;
  ethicsProfile: object;
  metadata: object;
  createdAt: string;
} | null> {
  const res = await fetch(`${API}/api/agents/${agentId}`);
  
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch agent');
  }

  const data = await res.json();
  return data.agent;
}

export async function updateAgentSettings(
  agentId: string,
  settings: {
    autonomyLevel?: 'low' | 'medium' | 'high';
    dailyLimitSolar?: number;
    maxPerActionRays?: number;
  }
): Promise<{
  id: string;
  autonomyLevel: string;
  dailyLimitSolar: number;
  maxPerActionRays: number;
}> {
  const res = await fetch(`${API}/api/agents/${agentId}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings)
  });

  if (!res.ok) {
    throw new Error('Failed to update agent settings');
  }

  const data = await res.json();
  return data.agent;
}

export async function getSolarBalance(walletAddress: string): Promise<{ balanceSolar: number }> {
  const res = await fetch(`${API}/api/wallets/${encodeURIComponent(walletAddress)}/balance`);
  
  if (!res.ok) {
    return { balanceSolar: 0 };
  }

  return res.json();
}

/* ---------------------------
   UNIVERSAL DOMAIN AGENT MAP
   (Auto-detects based on repo)
---------------------------- */

const DOMAIN_AGENT_MAP: Record<
  string,
  { serviceId: string; displayName: string; capabilities: string[] }
> = {
  "TC-S-Network-Z-Private": {
    serviceId: "z-private",
    displayName: "Z Private Network",
    capabilities: ["commission.project"]
  },
  "TC-S-Network-Standards": {
    serviceId: "standards",
    displayName: "TC-S Standards",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Compute-Governance": {
    serviceId: "compute-governance",
    displayName: "Compute Governance",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Ethics-Engine": {
    serviceId: "ethics-engine",
    displayName: "Ethics Engine",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Solar-Reserve": {
    serviceId: "solar-reserve",
    displayName: "Solar Reserve Tracker",
    capabilities: ["observe.telemetry"]
  },
  "TC-S-Network-UIM-Protocol": {
    serviceId: "uim-protocol",
    displayName: "UIM Protocol",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Wallet": {
    serviceId: "wallet",
    displayName: "TC-S Wallet",
    capabilities: ["transact.market"]
  },
  "TC-S-Network-GBI-Onboarding": {
    serviceId: "gbi-onboarding",
    displayName: "GBI Onboarding",
    capabilities: ["access.compute"]
  },
  "TC-S-Network-Seismic-ID-Anywhere": {
    serviceId: "seismic-id-anywhere",
    displayName: "Seismic ID Anywhere",
    capabilities: ["analyze.risk"]
  },
  "TC-S-Network-Satellite-ID-Anywhere": {
    serviceId: "satellite-id-anywhere",
    displayName: "Satellite ID Anywhere",
    capabilities: ["observe.telemetry"]
  },
  "TC-S-Network-Identify-Anything": {
    serviceId: "identify-anything",
    displayName: "Identify Anything",
    capabilities: ["price.artifact"]
  },
  "TC-S-Network-Market-Grid": {
    serviceId: "market-grid",
    displayName: "TC-S Market Grid",
    capabilities: ["transact.market"]
  },
  "TC-S-Network-Solar-Dashboard": {
    serviceId: "solar-dashboard",
    displayName: "Solar Dashboard",
    capabilities: ["access.compute"]
  }
};

/* ---------------------------
   REGISTER DOMAIN AGENT
---------------------------- */

export async function registerDomainAgentAuto(): Promise<void> {
  const repoName = import.meta.env.VITE_REPO_NAME || 
    (typeof window !== "undefined" ? window.location.hostname : "unknown");

  const config = DOMAIN_AGENT_MAP[repoName];
  if (!config) {
    console.warn("[TC-S] No domain agent config for repo:", repoName);
    return;
  }

  try {
    const res = await fetch(`${API}/api/agents/register-domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });

    if (!res.ok) {
      console.error("[TC-S] Domain agent registration failed:", res.status);
      return;
    }

    const data = await res.json();
    console.log("[TC-S] Domain Agent Ready:", data.agent);
  } catch (error) {
    console.error("[TC-S] Domain agent registration error:", error);
  }
}

/* ---------------------------
   SOLAR-METERED ACTIONS
---------------------------- */

export async function agentAction(
  actionType: string,
  payload?: object,
  targetAgentId?: string
): Promise<{
  ok: boolean;
  result: {
    actionType: string;
    raysCost: number;
    solarCost: number;
    remainingSolar: number;
  };
  payload: object;
}> {
  const personalAgentId = getPersonalAgentId();
  if (!personalAgentId) throw new Error("No personal agent registered yet.");

  const res = await fetch(`${API}/api/agents/${personalAgentId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actionType,
      payload: payload ?? {},
      targetAgentId: targetAgentId ?? null
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Action failed');
  }

  return res.json();
}

/* ---------------------------
   AUTO-BOOTSTRAP
---------------------------- */

export function bootstrapTCSAgents(): void {
  if (typeof window === "undefined") return;

  const wallet = localStorage.getItem("tcs_wallet_address");
  const name = localStorage.getItem("tcs_user_name") ?? "TC-S User";

  if (wallet && !getPersonalAgentId()) {
    registerPersonalAgent(wallet, name);
  }

  registerDomainAgentAuto();
}
