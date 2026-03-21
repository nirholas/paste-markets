import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
    const existingRows = await sql`SELECT * FROM submissions WHERE caller_handle = ${handle} LIMIT 1`;
    const existing = existingRows[0] as SubmissionRow | undefined;
    if (existing) {
      await sql`UPDATE submissions SET upvotes = upvotes + 1 WHERE caller_handle = ${handle}`;
      const updatedRows = await sql`SELECT * FROM submissions WHERE caller_handle = ${handle} LIMIT 1`;
      const updated = updatedRows[0] as SubmissionRow;
      return NextResponse.json({
        ok: true,
        submission: updated,
        deduplicated: true,
      });
    }

    await sql`
      INSERT INTO submissions (caller_handle, submitted_by, reason, example_tweet_url)
      VALUES (${handle}, ${submittedBy}, ${reason}, ${exampleUrl})
    `;

    const createdRows = await sql`SELECT * FROM submissions WHERE caller_handle = ${handle} LIMIT 1`;
    const created = createdRows[0] as SubmissionRow;
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
      submissions = await sql`
        SELECT * FROM submissions
        WHERE status = ${status}
        ORDER BY upvotes DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as SubmissionRow[];
      const countRows = await sql`SELECT COUNT(*) as count FROM submissions WHERE status = ${status}`;
      total = (countRows[0] as { count: number }).count;
    } else if (sort === "recent") {
      submissions = await sql`
        SELECT * FROM submissions
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as SubmissionRow[];
      const countRows = await sql`SELECT COUNT(*) as count FROM submissions`;
      total = (countRows[0] as { count: number }).count;
    } else {
      submissions = await sql`
        SELECT * FROM submissions
        ORDER BY
          CASE status
            WHEN 'tracked' THEN 3
            WHEN 'approved' THEN 2
            WHEN 'pending' THEN 1
            ELSE 0
          END DESC,
          upvotes DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as SubmissionRow[];
      const countRows = await sql`SELECT COUNT(*) as count FROM submissions`;
      total = (countRows[0] as { count: number }).count;
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
