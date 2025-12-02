import { NextResponse } from "next/server";

interface TelemetryPayload {
  app: string;
  kWh: number;
  solar: number;
  rays: number;
  flops: number;
  wpc: number;
  grade: string;
  ts: number;
  version: string;
}

const telemetryLog: TelemetryPayload[] = [];

export async function POST(req: Request) {
  try {
    const data: TelemetryPayload = await req.json();

    console.log("📥 TC-S Telemetry received:", {
      app: data.app,
      solar: data.solar,
      grade: data.grade,
      ts: new Date(data.ts).toISOString()
    });

    telemetryLog.push(data);
    
    if (telemetryLog.length > 1000) {
      telemetryLog.shift();
    }

    return NextResponse.json({ 
      ok: true, 
      received: data.app,
      totalEvents: telemetryLog.length
    });
  } catch (error) {
    console.error("Telemetry error:", error);
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  const summary = {
    totalEvents: telemetryLog.length,
    apps: [...new Set(telemetryLog.map(t => t.app))],
    totalSolar: telemetryLog.reduce((sum, t) => sum + t.solar, 0),
    totalKWh: telemetryLog.reduce((sum, t) => sum + t.kWh, 0),
    gradeDistribution: telemetryLog.reduce((acc, t) => {
      acc[t.grade] = (acc[t.grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    recentEvents: telemetryLog.slice(-10).reverse()
  };

  return NextResponse.json(summary);
}
