import { NextRequest, NextResponse } from "next/server";
import { getCachedBacktestReport } from "@/lib/backtest-db";
import type { BacktestReport } from "@/lib/backtest-processor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const normalized = handle.toLowerCase().replace(/^@/, "");

  const job = await getCachedBacktestReport(normalized);
  if (!job || !job.result_json) {
    return NextResponse.json(
      { error: "No cached backtest report found", handle: normalized },
      { status: 404 },
    );
  }

  let result: BacktestReport | null = null;
  try {
    result = JSON.parse(job.result_json) as BacktestReport;
  } catch {
    return NextResponse.json(
      { error: "Corrupted report data" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    handle: normalized,
    cachedAt: job.completed_at,
    result,
  });
}
