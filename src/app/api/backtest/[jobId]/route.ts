import { NextRequest, NextResponse } from "next/server";
import { getBacktestJob } from "@/lib/backtest-db";
import type { BacktestReport } from "@/lib/backtest-processor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const job = await getBacktestJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Backtest job not found" }, { status: 404 });
  }

  let result: BacktestReport | null = null;
  if (job.result_json) {
    try {
      result = JSON.parse(job.result_json) as BacktestReport;
    } catch {
      // corrupted result
    }
  }

  return NextResponse.json({
    jobId: job.id,
    handle: job.handle,
    status: job.status,
    progress: {
      phase: job.phase,
      tweetsScanned: job.tweets_scanned,
      totalTweets: job.total_tweets,
      callsFound: job.calls_found,
    },
    result,
    error: job.error ?? null,
    createdAt: job.created_at,
  });
}
