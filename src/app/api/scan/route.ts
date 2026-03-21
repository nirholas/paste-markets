import { NextRequest, NextResponse } from "next/server";
import {
  createScanJob,
  getCachedScanForHandle,
  checkRateLimit,
  recordScanRequest,
} from "@/lib/scan-db";
import { processScanJob } from "@/lib/scan-processor";

export const dynamic = "force-dynamic";

// Max 3 scans per IP per hour
const MAX_SCANS_PER_HOUR = 3;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limit
  const { allowed, count } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        details: `Max ${MAX_SCANS_PER_HOUR} scans per hour. Try again later.`,
        count,
      },
      { status: 429 },
    );
  }

  let body: { handle?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Sanitize handle
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

  // Return cached result if a scan already ran in the last 6 hours
  const cached = getCachedScanForHandle(handle);
  if (cached) {
    return NextResponse.json(
      { jobId: cached.id, status: cached.status, cached: true },
      { status: cached.status === "queued" || cached.status === "running" ? 202 : 200 },
    );
  }

  // Create job and start background processing
  recordScanRequest(ip);
  const jobId = createScanJob(handle);

  // Fire-and-forget in Node.js runtime (response is sent before this completes)
  processScanJob(jobId, handle).catch((err) => {
    console.error(`[api/scan] Unhandled error in job ${jobId}:`, err);
  });

  return NextResponse.json({ jobId, status: "queued" }, { status: 202 });
}
