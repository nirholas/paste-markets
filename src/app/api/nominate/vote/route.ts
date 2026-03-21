import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SubmissionRow {
  id: number;
  caller_handle: string;
  upvotes: number;
  status: string;
}

export async function POST(request: NextRequest) {
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
