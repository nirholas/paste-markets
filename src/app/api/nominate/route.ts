import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SubmissionRow {
  id: number;
  caller_handle: string;
  submitted_by: string | null;
  reason: string | null;
  example_tweet_url: string | null;
  upvotes: number;
  status: string;
  created_at: string;
}

const stmts = {
  getByHandle: db.prepare<[string], SubmissionRow>(
    "SELECT * FROM submissions WHERE caller_handle = ? LIMIT 1",
  ),
  incrementUpvotes: db.prepare(
    "UPDATE submissions SET upvotes = upvotes + 1 WHERE caller_handle = ?",
  ),
  insert: db.prepare(`
    INSERT INTO submissions (caller_handle, submitted_by, reason, example_tweet_url)
    VALUES (@caller_handle, @submitted_by, @reason, @example_tweet_url)
  `),
  listByUpvotes: db.prepare<[number, number], SubmissionRow>(`
    SELECT * FROM submissions
    ORDER BY
      CASE status
        WHEN 'tracked' THEN 3
        WHEN 'approved' THEN 2
        WHEN 'pending' THEN 1
        ELSE 0
      END DESC,
      upvotes DESC
    LIMIT ? OFFSET ?
  `),
  listByStatus: db.prepare<[string, number, number], SubmissionRow>(`
    SELECT * FROM submissions
    WHERE status = ?
    ORDER BY upvotes DESC
    LIMIT ? OFFSET ?
  `),
  listByRecent: db.prepare<[number, number], SubmissionRow>(`
    SELECT * FROM submissions
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `),
  getCount: db.prepare<[], { count: number }>(
    "SELECT COUNT(*) as count FROM submissions",
  ),
  getCountByStatus: db.prepare<[string], { count: number }>(
    "SELECT COUNT(*) as count FROM submissions WHERE status = ?",
  ),
};

function sanitizeHandle(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.handle !== "string" || !body.handle.trim()) {
      return NextResponse.json(
        { ok: false, error: "Please provide a caller handle" },
        { status: 400 },
      );
    }

    const handle = sanitizeHandle(body.handle);
    if (!handle || handle.length > 50) {
      return NextResponse.json(
        { ok: false, error: "Invalid handle" },
        { status: 400 },
      );
    }

    const submittedBy = body.submitted_by
      ? sanitizeHandle(body.submitted_by)
      : null;
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;
    const exampleUrl =
      typeof body.example_tweet_url === "string" &&
      body.example_tweet_url.trim()
        ? body.example_tweet_url.trim()
        : null;

    // Deduplicate: if handle already submitted, increment upvotes
    const existing = stmts.getByHandle.get(handle);
    if (existing) {
      stmts.incrementUpvotes.run(handle);
      const updated = stmts.getByHandle.get(handle)!;
      return NextResponse.json({
        ok: true,
        submission: updated,
        deduplicated: true,
      });
    }

    stmts.insert.run({
      caller_handle: handle,
      submitted_by: submittedBy,
      reason,
      example_tweet_url: exampleUrl,
    });

    const created = stmts.getByHandle.get(handle)!;
    return NextResponse.json({
      ok: true,
      submission: created,
      deduplicated: false,
    });
  } catch (err) {
    console.error("[api/nominate] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const sort = searchParams.get("sort") ?? "upvotes";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    let submissions: SubmissionRow[];
    let total: number;

    if (status) {
      submissions = stmts.listByStatus.all(status, limit, offset);
      total = (stmts.getCountByStatus.get(status) as { count: number }).count;
    } else if (sort === "recent") {
      submissions = stmts.listByRecent.all(limit, offset);
      total = (stmts.getCount.get() as { count: number }).count;
    } else {
      submissions = stmts.listByUpvotes.all(limit, offset);
      total = (stmts.getCount.get() as { count: number }).count;
    }

    return NextResponse.json({ ok: true, submissions, total });
  } catch (err) {
    console.error("[api/nominate] GET Error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
