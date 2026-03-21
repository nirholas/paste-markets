import { NextRequest, NextResponse } from "next/server";
import { getScanJob } from "@/lib/scan-db";
import type { ScanResult } from "@/lib/scan-processor";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const job = await getScanJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Scan job not found" }, { status: 404 });
  }

  let result: ScanResult | null = null;
  if (job.result_json) {
    try {
      result = JSON.parse(job.result_json) as ScanResult;
    } catch {
      // corrupted result — treat as no result
    }
  }

  return NextResponse.json({
    status: job.status,
    progress: {
      tweetsScanned: job.tweets_scanned,
      callsFound: job.calls_found,
    },
    result,
    error: job.error ?? null,
    createdAt: job.created_at,
  });
}
