import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Load the solar counter script dynamically
    const solarCounterScript = document.createElement('script');
    solarCounterScript.src = '/solar_counter.js';
    solarCounterScript.async = true;
    document.body.appendChild(solarCounterScript);

    return () => {
      // Cleanup script on component unmount
      if (document.body.contains(solarCounterScript)) {
        document.body.removeChild(solarCounterScript);
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
