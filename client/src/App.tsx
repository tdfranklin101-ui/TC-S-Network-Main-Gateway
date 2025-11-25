import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TimerProgressionDemo from "@/pages/TimerProgressionDemo";
import SolarAuditDashboard from "@/pages/SolarAuditDashboard";
import AgentDashboard from "@/pages/AgentDashboard";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/demo" component={TimerProgressionDemo} />
      <Route path="/solar-audit" component={SolarAuditDashboard} />
      <Route path="/agent" component={AgentDashboard} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Load the solar counter script dynamically
    if (!document.getElementById('solar-counter-script')) {
      const solarCounterScript = document.createElement('script');
      solarCounterScript.id = 'solar-counter-script';
      solarCounterScript.src = '/solar_counter.js';
      solarCounterScript.async = true;
      document.body.appendChild(solarCounterScript);
    }

    return () => {
      // Cleanup script on component unmount
      const scriptElement = document.getElementById('solar-counter-script');
      if (scriptElement) {
        document.body.removeChild(scriptElement);
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <Router />
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;
