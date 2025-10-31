import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Download, Zap, Database, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SolarAuditEntry {
  id: string;
  category: string;
  source: string;
  sourceOrganization: string;
  verificationLevel: string;
  sourceType: string;
  day: string;
  kwh: string;
  solarUnits: string;
  rightsAlignment: any;
  dataHash: string;
  notes: string;
  createdAt: string;
}

interface CategorySummary {
  category: string;
  totalKwh: string;
  totalSolar: string;
  recordCount: number;
}

interface SummaryResponse {
  categories: CategorySummary[];
  global: {
    totalKwh: number;
    totalSolar: number;
    totalRecords: number;
  };
}

export default function SolarAuditDashboard() {
  const [view, setView] = useState<"landing" | "consumption">("landing");
  
  const { data: entries, isLoading: entriesLoading } = useQuery<SolarAuditEntry[]>({
    queryKey: ["/api/solar-audit/entries"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryResponse>({
    queryKey: ["/api/solar-audit/summary"],
  });

  const handleDownloadJSON = () => {
    if (!entries) return;

    const dataStr = JSON.stringify(entries, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `solar-audit-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const chartData = () => {
    if (!entries) return null;

    const dailyData = entries.reduce((acc: Record<string, Record<string, number>>, entry: SolarAuditEntry) => {
      const date = entry.day;
      if (!acc[date]) {
        acc[date] = {};
      }
      if (!acc[date][entry.category]) {
        acc[date][entry.category] = 0;
      }
      acc[date][entry.category] += parseFloat(entry.kwh) / 1e6;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    const sortedDates = Object.keys(dailyData).sort();
    const categories = Array.from(new Set(entries.map((e: SolarAuditEntry) => e.category)));

    const categoryColors = [
      "#00ffe0",
      "#0ea5e9",
      "#8b5cf6",
      "#ec4899",
      "#f59e0b",
      "#10b981",
    ];

    return {
      labels: sortedDates,
      datasets: categories.map((category: string, idx: number) => ({
        label: category,
        data: sortedDates.map((date: string) => dailyData[date][category] || 0),
        borderColor: categoryColors[idx % categoryColors.length],
        backgroundColor: categoryColors[idx % categoryColors.length] + "20",
        tension: 0.4,
      })),
    };
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "#e2f7ff",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: "Daily Energy Trends by Category (GWh)",
        color: "#e2f7ff",
        font: {
          size: 16,
          weight: "bold",
        },
      },
    },
    scales: {
      y: {
        ticks: {
          color: "#e2f7ff",
        },
        grid: {
          color: "#e2f7ff20",
        },
      },
      x: {
        ticks: {
          color: "#e2f7ff",
        },
        grid: {
          color: "#e2f7ff20",
        },
      },
    },
  };

  const lastHundredEntries = entries?.slice(0, 100) || [];

  // Landing page view
  if (view === "landing") {
    return (
      <div className="min-h-screen bg-[#0b0e10] text-[#e2f7ff] flex items-center justify-center p-6">
        <div className="max-w-2xl mx-auto text-center space-y-12">
          <div>
            <h1 className="text-5xl font-bold mb-6" data-testid="heading-landing-title">
              Understanding the Impact
            </h1>
            <p className="text-xl text-[#e2f7ff]/80 leading-relaxed">
              Track global renewable energy distribution in real-time. Explore
              regional clean power generation and off-grid capacity across 6 continents,
              visualizing the path toward energy abundance.
            </p>
          </div>

          <div className="space-y-4">
            <a 
              href="https://solar-reserve-tracker-tdfranklin101.replit.app"
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button
                className="w-full bg-transparent border-2 border-[#e2f7ff]/30 text-[#e2f7ff] hover:bg-[#e2f7ff]/10 hover:border-[#00ffe0] py-6 text-lg transition-all"
                data-testid="button-power-supply"
              >
                Global Power Supply
              </Button>
            </a>

            <Button
              onClick={() => setView("consumption")}
              className="w-full bg-transparent border-2 border-[#e2f7ff]/30 text-[#e2f7ff] hover:bg-[#e2f7ff]/10 hover:border-[#00ffe0] py-6 text-lg transition-all"
              data-testid="button-power-consumption"
            >
              Global Power Consumption
            </Button>
          </div>

          <p className="text-sm text-[#e2f7ff]/50 mt-8">
            Scroll down to explore the map ↓
          </p>
        </div>
      </div>
    );
  }

  // Consumption dashboard view
  return (
    <div className="min-h-screen bg-[#0b0e10] text-[#e2f7ff] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setView("landing")}
              variant="ghost"
              className="text-[#00ffe0] hover:bg-[#00ffe0]/10"
              data-testid="button-back-to-landing"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-4xl font-bold mb-2" data-testid="heading-dashboard-title">
                Global Power Consumption
              </h1>
              <p className="text-[#e2f7ff]/70">
                Regulatory-grade energy demand tracking with full lineage
              </p>
            </div>
          </div>
          <Button
            onClick={handleDownloadJSON}
            disabled={!entries || entries.length === 0}
            className="bg-[#00ffe0] text-[#0b0e10] hover:bg-[#00ffe0]/90"
            data-testid="button-download-json"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Full Audit Data (JSON)
          </Button>
        </div>

        {summaryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-black/40 border-[#00ffe0]/20">
                <CardHeader>
                  <Skeleton className="h-6 w-32 bg-[#e2f7ff]/10" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full bg-[#e2f7ff]/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-black/40 border-[#00ffe0]/20" data-testid="card-global-summary">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-[#e2f7ff]/70">
                    Global Total
                  </CardTitle>
                  <Database className="h-4 w-4 text-[#00ffe0]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#00ffe0]" data-testid="text-global-kwh">
                    {summary?.global.totalKwh
                      ? (summary.global.totalKwh / 1e9).toFixed(3)
                      : "0.000"}{" "}
                    GWh
                  </div>
                  <p className="text-xs text-[#e2f7ff]/50 mt-1">
                    {summary?.global.totalSolar
                      ? parseFloat(summary.global.totalSolar.toString()).toFixed(6)
                      : "0.000000"}{" "}
                    Solar Units
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-[#00ffe0]/20" data-testid="card-total-records">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-[#e2f7ff]/70">
                    Total Records
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-[#00ffe0]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#00ffe0]" data-testid="text-total-records">
                    {summary?.global.totalRecords || 0}
                  </div>
                  <p className="text-xs text-[#e2f7ff]/50 mt-1">
                    Audit entries across all categories
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-[#00ffe0]/20" data-testid="card-categories">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-[#e2f7ff]/70">
                    Categories
                  </CardTitle>
                  <Zap className="h-4 w-4 text-[#00ffe0]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#00ffe0]" data-testid="text-category-count">
                    {summary?.categories.length || 0}
                  </div>
                  <p className="text-xs text-[#e2f7ff]/50 mt-1">
                    Energy tracking categories
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {summary?.categories.map((cat: CategorySummary, idx: number) => (
                <Card
                  key={cat.category}
                  className="bg-black/40 border-[#00ffe0]/20"
                  data-testid={`card-category-${idx}`}
                >
                  <CardHeader>
                    <CardTitle className="text-[#00ffe0] text-lg">
                      {cat.category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-xs text-[#e2f7ff]/50">Total kWh</p>
                      <p className="text-lg font-semibold" data-testid={`text-category-kwh-${idx}`}>
                        {(parseFloat(cat.totalKwh) / 1e6).toFixed(3)} GWh
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#e2f7ff]/50">Solar Units</p>
                      <p className="text-lg font-semibold" data-testid={`text-category-solar-${idx}`}>
                        {parseFloat(cat.totalSolar).toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#e2f7ff]/50">Records</p>
                      <p className="text-lg font-semibold" data-testid={`text-category-records-${idx}`}>
                        {cat.recordCount}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {entriesLoading ? (
          <Card className="bg-black/40 border-[#00ffe0]/20">
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full bg-[#e2f7ff]/10" />
            </CardContent>
          </Card>
        ) : (
          chartData() && (
            <Card className="bg-black/40 border-[#00ffe0]/20" data-testid="card-chart">
              <CardContent className="p-6">
                <div className="h-64">
                  <Line data={chartData()!} options={chartOptions} />
                </div>
              </CardContent>
            </Card>
          )
        )}

        <Card className="bg-black/40 border-[#00ffe0]/20" data-testid="card-audit-table">
          <CardHeader>
            <CardTitle className="text-[#00ffe0]">
              Detailed Audit Log (Last 100 Records)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entriesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#e2f7ff]/10" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#00ffe0]/20">
                      <th className="text-left p-3 text-[#00ffe0]">Date</th>
                      <th className="text-left p-3 text-[#00ffe0]">Category</th>
                      <th className="text-left p-3 text-[#00ffe0]">kWh</th>
                      <th className="text-left p-3 text-[#00ffe0]">Solar Units</th>
                      <th className="text-left p-3 text-[#00ffe0]">Source</th>
                      <th className="text-left p-3 text-[#00ffe0]">Verification</th>
                      <th className="text-left p-3 text-[#00ffe0]">Type</th>
                      <th className="text-left p-3 text-[#00ffe0]">Data Hash</th>
                      <th className="text-left p-3 text-[#00ffe0]">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastHundredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-[#e2f7ff]/50">
                          No audit entries found
                        </td>
                      </tr>
                    ) : (
                      lastHundredEntries.map((entry: SolarAuditEntry, idx: number) => (
                        <tr
                          key={entry.id}
                          className="border-b border-[#e2f7ff]/10 hover:bg-[#00ffe0]/5"
                          data-testid={`row-audit-entry-${idx}`}
                        >
                          <td className="p-3">{entry.day}</td>
                          <td className="p-3">{entry.category}</td>
                          <td className="p-3">
                            {(parseFloat(entry.kwh) / 1e6).toFixed(3)} GWh
                          </td>
                          <td className="p-3">
                            {parseFloat(entry.solarUnits).toFixed(6)}
                          </td>
                          <td className="p-3">
                            <div className="max-w-xs">
                              <div className="font-medium">{entry.source}</div>
                              {entry.sourceOrganization && (
                                <div className="text-xs text-[#e2f7ff]/50">
                                  {entry.sourceOrganization}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              entry.verificationLevel === 'THIRD_PARTY' ? 'bg-[#10b981]/10 text-[#10b981]' :
                              entry.verificationLevel === 'METERED' ? 'bg-[#00ffe0]/10 text-[#00ffe0]' :
                              entry.verificationLevel === 'MODELLED' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                              'bg-[#8b5cf6]/10 text-[#8b5cf6]'
                            }`}>
                              {entry.verificationLevel}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              entry.sourceType === 'DIRECT' ? 'bg-[#00ffe0]/10 text-[#00ffe0]' :
                              'bg-[#ec4899]/10 text-[#ec4899]'
                            }`}>
                              {entry.sourceType || 'DIRECT'}
                            </span>
                          </td>
                          <td className="p-3">
                            <code className="text-xs text-[#e2f7ff]/70">
                              {entry.dataHash
                                ? `${entry.dataHash.slice(0, 12)}...`
                                : "N/A"}
                            </code>
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="truncate text-[#e2f7ff]/70">
                              {entry.notes || "—"}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
