import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// In-memory rate limiter: max 10 votes per IP per 15-minute window
const WINDOW_MS = 15 * 60 * 1000;
const MAX_VOTES = 10;
const voteLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (voteLog.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_VOTES) return true;
  timestamps.push(now);
  voteLog.set(ip, timestamps);
  // Periodic cleanup: cap map size to prevent memory leak
  if (voteLog.size > 10000) {
    for (const [key, ts] of voteLog) {
      if (ts.every((t) => now - t >= WINDOW_MS)) voteLog.delete(key);
    }
  }
  return false;
}

interface SubmissionRow {
  id: number;
  caller_handle: string;
  upvotes: number;
  status: string;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many votes. Try again later." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.submission_id !== "number") {
      return NextResponse.json(
        { ok: false, error: "Please provide a valid submission_id" },
        { status: 400 },
      );
    }

    const rows = await sql`SELECT id, caller_handle, upvotes, status FROM submissions WHERE id = ${body.submission_id}`;
    const submission = rows[0] as SubmissionRow | undefined;
    if (!submission) {
      return NextResponse.json(
        { ok: false, error: "Submission not found" },
        { status: 404 },
      );
    }

    await sql`UPDATE submissions SET upvotes = upvotes + 1 WHERE id = ${body.submission_id}`;
    const updatedRows = await sql`SELECT id, caller_handle, upvotes, status FROM submissions WHERE id = ${body.submission_id}`;
    const updated = updatedRows[0] as SubmissionRow;

    return NextResponse.json({
      ok: true,
      submission_id: updated.id,
      upvotes: updated.upvotes,
    });
  } catch (err) {
    console.error("[api/nominate/vote] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
