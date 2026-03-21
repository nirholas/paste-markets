import { NextRequest, NextResponse } from "next/server";
import {
  createBacktestJob,
  getCachedBacktestForHandle,
} from "@/lib/backtest-db";
import {
  checkRateLimit,
  recordScanRequest,
} from "@/lib/scan-db";
import { processBacktestJob } from "@/lib/backtest-processor";

export const dynamic = "force-dynamic";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Share rate limit with scan (3/hour per IP)
  const { allowed, count } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        details: `Max 3 scans per hour. Try again later.`,
        count,
      },
      { status: 429 },
    );
  }

  let body: { handle?: unknown; maxTweets?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = typeof body.handle === "string" ? body.handle.trim().replace(/^@/, "") : "";
  if (!raw || !/^[a-zA-Z0-9_]{1,50}$/.test(raw)) {
    return NextResponse.json(
      {
        error: "Invalid handle",
        details: "Provide a valid Twitter/X username (letters, numbers, underscores, max 50 chars)",
      },
      { status: 400 },
    );
  }
  const handle = raw.toLowerCase();

  // Return cached result if a backtest ran in the last 24 hours
  const cached = await getCachedBacktestForHandle(handle);
  if (cached) {
    return NextResponse.json(
      { jobId: cached.id, status: cached.status, cached: true },
      { status: cached.status === "complete" ? 200 : 202 },
    );
  }

  const maxTweets =
    typeof body.maxTweets === "number" && body.maxTweets > 0
      ? Math.min(body.maxTweets, 1000)
      : 800;

  await recordScanRequest(ip);
  const jobId = await createBacktestJob(handle);

  // Fire-and-forget
  processBacktestJob(jobId, handle, maxTweets).catch((err) => {
    console.error(`[api/backtest] Unhandled error in job ${jobId}:`, err);
  });

  return NextResponse.json(
    { jobId, status: "queued", estimatedMinutes: 2 },
    { status: 202 },
  );
}
