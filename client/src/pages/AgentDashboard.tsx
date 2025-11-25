import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  getPersonalAgentId,
  getWalletAddress,
  getUserName,
  registerPersonalAgent,
  getAgent,
  updateAgentSettings,
  agentAction,
  getSolarBalance,
  ACTION_COSTS,
  RAYS_PER_SOLAR,
  raysToSolar
} from "@/lib/tcs-agent-bootstrap";
import {
  Sun,
  Zap,
  Bot,
  Shield,
  Activity,
  Settings,
  Wallet,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Globe,
  Satellite,
  Search,
  BarChart3
} from "lucide-react";

interface AgentData {
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
}

interface ActionHistoryItem {
  actionType: string;
  raysCost: number;
  solarCost: number;
  timestamp: Date;
  status: 'success' | 'failed';
}

export default function AgentDashboard() {
  const { toast } = useToast();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("TC-S User");
  const [balance, setBalance] = useState<number>(0);
  const [status, setStatus] = useState<"loading" | "not-activated" | "active">("loading");
  const [loading, setLoading] = useState<boolean>(false);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  
  const [autonomyLevel, setAutonomyLevel] = useState<string>("low");
  const [dailyLimit, setDailyLimit] = useState<number>(1);
  const [maxPerAction, setMaxPerAction] = useState<number>(10000);
  const [autoPerformTasks, setAutoPerformTasks] = useState<boolean>(false);

  useEffect(() => {
    loadAgentData();
  }, []);

  async function loadAgentData() {
    const w = getWalletAddress();
    const n = getUserName();
    const id = getPersonalAgentId();

    setWalletAddress(w);
    setDisplayName(n);
    setAgentId(id);

    if (w && id) {
      try {
        const [agentData, balanceData] = await Promise.all([
          getAgent(id),
          getSolarBalance(w)
        ]);

        if (agentData) {
          setAgent(agentData);
          setAutonomyLevel(agentData.autonomyLevel);
          setDailyLimit(agentData.dailyLimitSolar);
          setMaxPerAction(agentData.maxPerActionRays);
        }

        setBalance(balanceData.balanceSolar ?? 0);
        setStatus("active");
      } catch (error) {
        console.error("Failed to load agent:", error);
        setStatus("not-activated");
      }
    } else {
      setStatus("not-activated");
    }
  }

  async function activateAgent() {
    if (!walletAddress) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet first to activate your agent.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const newAgent = await registerPersonalAgent(walletAddress, displayName);
      setAgentId(newAgent.id);
      setAgent(newAgent as AgentData);
      
      const balanceData = await getSolarBalance(walletAddress);
      setBalance(balanceData.balanceSolar);
      
      setStatus("active");
      toast({
        title: "Agent Activated!",
        description: "Your personal TC-S agent is now ready to serve you."
      });
    } catch (error) {
      toast({
        title: "Activation Failed",
        description: error instanceof Error ? error.message : "Failed to activate agent",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!agentId) return;
    
    setLoading(true);
    try {
      const updated = await updateAgentSettings(agentId, {
        autonomyLevel: autonomyLevel as 'low' | 'medium' | 'high',
        dailyLimitSolar: dailyLimit,
        maxPerActionRays: maxPerAction
      });
      
      setAgent(prev => prev ? { ...prev, ...updated } : null);
      toast({
        title: "Settings Saved",
        description: "Your agent settings have been updated."
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function runTestAction(actionType: string) {
    if (!agentId) return;
    
    setLoading(true);
    try {
      const result = await agentAction(actionType, {
        message: `Test ${actionType} from Agent Dashboard`,
        timestamp: new Date().toISOString()
      });

      setBalance(result.result.remainingSolar);
      
      setActionHistory(prev => [{
        actionType: result.result.actionType,
        raysCost: result.result.raysCost,
        solarCost: result.result.solarCost,
        timestamp: new Date(),
        status: 'success'
      }, ...prev].slice(0, 10));

      toast({
        title: "Action Complete",
        description: `${actionType} cost ${result.result.raysCost} Rays (${result.result.solarCost.toFixed(4)} Solar)`
      });
    } catch (error) {
      setActionHistory(prev => [{
        actionType,
        raysCost: ACTION_COSTS[actionType]?.rays || 100,
        solarCost: raysToSolar(ACTION_COSTS[actionType]?.rays || 100),
        timestamp: new Date(),
        status: 'failed'
      }, ...prev].slice(0, 10));

      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : "Action could not be completed",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  const raysRemaining = balance * RAYS_PER_SOLAR;
  const dailyRaysLimit = dailyLimit * RAYS_PER_SOLAR;
  const usagePercent = dailyLimit > 0 ? ((dailyLimit - balance) / dailyLimit) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center text-cyan-400 hover:text-cyan-300 mb-6 transition-colors" data-testid="link-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sun className="w-10 h-10 text-yellow-400" />
              Your TC-S Personal Agent
            </h1>
            <p className="text-gray-400 mt-2">Solar-powered autonomous assistant for the TC-S Network</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadAgentData}
            disabled={loading}
            className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {status === "loading" && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading your agent...</p>
            </div>
          </div>
        )}

        {status === "not-activated" && (
          <Card className="bg-black/60 border-cyan-500/30 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-green-500/20 flex items-center justify-center">
                <Bot className="w-12 h-12 text-cyan-400" />
              </div>
              <CardTitle className="text-3xl text-cyan-400">Meet Your Personal Agent</CardTitle>
              <CardDescription className="text-gray-400 text-lg max-w-2xl mx-auto mt-4">
                Your personal agent is a Solar-powered autonomous assistant that performs tasks 
                on your behalf across the entire TC-S Network.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    What Your Agent Can Do
                  </h3>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-center gap-3">
                      <Search className="w-5 h-5 text-cyan-400" />
                      <span>Identify anything using AI vision</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Satellite className="w-5 h-5 text-cyan-400" />
                      <span>Read satellite data streams</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-cyan-400" />
                      <span>Analyze seismic activity</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <BarChart3 className="w-5 h-5 text-cyan-400" />
                      <span>Help govern compute resources</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-cyan-400" />
                      <span>Interact with the marketplace</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      <span>Create AI artifacts and reports</span>
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Sun className="w-5 h-5 text-yellow-400" />
                    How Solar Metering Works
                  </h3>
                  <div className="bg-black/40 rounded-lg p-4 border border-yellow-500/20">
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-yellow-400">1 Solar</div>
                      <div className="text-gray-400">=</div>
                      <div className="text-2xl font-semibold text-green-400">10,000 Rays</div>
                    </div>
                    <p className="text-gray-400 text-sm text-center">
                      Every person receives 1 Solar per day. Your agent uses this energy 
                      to perform actions across the network.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-black/40 rounded p-2 text-center">
                      <div className="text-cyan-400 font-semibold">100 Rays</div>
                      <div className="text-gray-500">Basic query</div>
                    </div>
                    <div className="bg-black/40 rounded p-2 text-center">
                      <div className="text-cyan-400 font-semibold">500 Rays</div>
                      <div className="text-gray-500">Price artifact</div>
                    </div>
                    <div className="bg-black/40 rounded p-2 text-center">
                      <div className="text-cyan-400 font-semibold">1,000 Rays</div>
                      <div className="text-gray-500">Compute access</div>
                    </div>
                    <div className="bg-black/40 rounded p-2 text-center">
                      <div className="text-cyan-400 font-semibold">10,000 Rays</div>
                      <div className="text-gray-500">Full project</div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-800" />

              <div className="text-center">
                {walletAddress ? (
                  <div className="space-y-4">
                    <p className="text-gray-400">
                      Connected wallet: <span className="text-cyan-400 font-mono">{walletAddress.slice(0, 12)}...{walletAddress.slice(-6)}</span>
                    </p>
                    <Button 
                      size="lg"
                      onClick={activateAgent}
                      disabled={loading}
                      className="bg-gradient-to-r from-cyan-500 to-green-500 hover:from-cyan-600 hover:to-green-600 text-black font-bold px-8 py-6 text-lg"
                      data-testid="button-activate-agent"
                    >
                      {loading ? (
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Zap className="w-5 h-5 mr-2" />
                      )}
                      Activate My Agent
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-400">
                      Connect your wallet to activate your personal agent.
                    </p>
                    <Button 
                      size="lg"
                      variant="outline"
                      className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                      data-testid="button-connect-wallet"
                    >
                      <Wallet className="w-5 h-5 mr-2" />
                      Connect Wallet
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {status === "active" && agent && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-black/60 border-cyan-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-lg font-semibold text-green-400">Active</span>
                      </div>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/60 border-yellow-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Solar Balance</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Sun className="w-5 h-5 text-yellow-400" />
                        <span className="text-2xl font-bold text-yellow-400">{balance.toFixed(4)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Rays</p>
                      <p className="text-sm text-gray-400">{raysRemaining.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/60 border-purple-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Autonomy Level</p>
                      <Badge 
                        variant="outline" 
                        className={`mt-1 ${
                          autonomyLevel === 'high' ? 'border-red-500 text-red-400' :
                          autonomyLevel === 'medium' ? 'border-yellow-500 text-yellow-400' :
                          'border-green-500 text-green-400'
                        }`}
                      >
                        {autonomyLevel.toUpperCase()}
                      </Badge>
                    </div>
                    <Shield className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-black/60 border-cyan-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Daily Solar Usage</span>
                  <span className="text-sm text-gray-400">{(dailyLimit - balance).toFixed(4)} / {dailyLimit} Solar</span>
                </div>
                <Progress value={Math.min(usagePercent, 100)} className="h-2" />
              </CardContent>
            </Card>

            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList className="bg-black/60 border border-gray-800">
                <TabsTrigger value="profile" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400" data-testid="tab-profile">
                  <Bot className="w-4 h-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="actions" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400" data-testid="tab-actions">
                  <Activity className="w-4 h-4 mr-2" />
                  Actions
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400" data-testid="tab-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400" data-testid="tab-history">
                  <Clock className="w-4 h-4 mr-2" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <Card className="bg-black/60 border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Agent Profile</CardTitle>
                    <CardDescription>Your personal agent identity and configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-gray-400">Agent ID</Label>
                        <p className="font-mono text-sm bg-black/40 p-2 rounded border border-gray-800 text-gray-300">{agent.id}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400">Display Name</Label>
                        <p className="text-white">{agent.displayName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400">Wallet Address</Label>
                        <p className="font-mono text-sm bg-black/40 p-2 rounded border border-gray-800 text-gray-300">{agent.walletAddress}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400">Agent Type</Label>
                        <Badge variant="outline" className="border-cyan-500 text-cyan-400">{agent.agentType}</Badge>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400">Created</Label>
                        <p className="text-gray-300">{new Date(agent.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-gray-400">Ethics Profile</Label>
                        <Badge variant="outline" className="border-green-500 text-green-400">UDHR Aligned</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="actions">
                <Card className="bg-black/60 border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Available Actions</CardTitle>
                    <CardDescription>Test your agent with these Solar-metered actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(ACTION_COSTS).slice(0, 6).map(([action, { rays, description }]) => (
                        <Card key={action} className="bg-black/40 border-gray-800 hover:border-cyan-500/50 transition-colors">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-mono text-sm text-cyan-400">{action}</span>
                              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                                {rays} Rays
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-400 mb-3">{description}</p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => runTestAction(action)}
                              disabled={loading || balance < raysToSolar(rays)}
                              className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                              data-testid={`button-action-${action}`}
                            >
                              <Zap className="w-4 h-4 mr-2" />
                              Execute
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                <Card className="bg-black/60 border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Agent Settings</CardTitle>
                    <CardDescription>Configure how your agent operates</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-gray-300">Autonomy Level</Label>
                      <Select value={autonomyLevel} onValueChange={setAutonomyLevel}>
                        <SelectTrigger className="bg-black/40 border-gray-700 text-white" data-testid="select-autonomy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          <SelectItem value="low" className="text-white">Low - Requires approval for all actions</SelectItem>
                          <SelectItem value="medium" className="text-white">Medium - Auto-approve small actions</SelectItem>
                          <SelectItem value="high" className="text-white">High - Full autonomy within limits</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-300">Daily Solar Limit</Label>
                        <span className="text-cyan-400 font-semibold">{dailyLimit} Solar</span>
                      </div>
                      <Slider
                        value={[dailyLimit]}
                        onValueChange={([v]) => setDailyLimit(v)}
                        min={0.1}
                        max={10}
                        step={0.1}
                        className="py-4"
                        data-testid="slider-daily-limit"
                      />
                      <p className="text-sm text-gray-500">Maximum Solar your agent can spend per day</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-300">Max Rays Per Action</Label>
                        <span className="text-cyan-400 font-semibold">{maxPerAction.toLocaleString()} Rays</span>
                      </div>
                      <Slider
                        value={[maxPerAction]}
                        onValueChange={([v]) => setMaxPerAction(v)}
                        min={100}
                        max={100000}
                        step={100}
                        className="py-4"
                        data-testid="slider-max-rays"
                      />
                      <p className="text-sm text-gray-500">Maximum Rays allowed for a single action</p>
                    </div>

                    <Separator className="bg-gray-800" />

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-gray-300">Auto-perform Tasks</Label>
                        <p className="text-sm text-gray-500">Allow agent to automatically execute approved task types</p>
                      </div>
                      <Switch 
                        checked={autoPerformTasks} 
                        onCheckedChange={setAutoPerformTasks}
                        data-testid="switch-auto-tasks"
                      />
                    </div>

                    <Button 
                      onClick={handleSaveSettings}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-cyan-500 to-green-500 hover:from-cyan-600 hover:to-green-600 text-black font-semibold"
                      data-testid="button-save-settings"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Save Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card className="bg-black/60 border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-cyan-400">Action History</CardTitle>
                    <CardDescription>Recent actions performed by your agent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {actionHistory.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No actions yet. Try executing an action from the Actions tab!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {actionHistory.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-gray-800">
                            <div className="flex items-center gap-3">
                              {item.status === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-400" />
                              )}
                              <div>
                                <p className="font-mono text-sm text-white">{item.actionType}</p>
                                <p className="text-xs text-gray-500">{item.timestamp.toLocaleTimeString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-yellow-400">{item.raysCost} Rays</p>
                              <p className="text-xs text-gray-500">{item.solarCost.toFixed(4)} Solar</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <Card className="mt-8 bg-black/40 border-gray-800">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              What is a TC-S Agent?
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Every person receives <span className="text-yellow-400 font-semibold">1 Solar per day</span>. 
              Your agent uses this energy standard to help you interact with AI, data streams, 
              governance systems, and digital markets — automatically and transparently. 
              You control your agent's autonomy, spending limits, and permissions from this dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
