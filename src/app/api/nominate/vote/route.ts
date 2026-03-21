import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SubmissionRow {
  id: number;
  caller_handle: string;
  upvotes: number;
  status: string;
}

const stmts = {
  getById: db.prepare<[number], SubmissionRow>(
    "SELECT id, caller_handle, upvotes, status FROM submissions WHERE id = ?",
  ),
  incrementUpvotes: db.prepare(
    "UPDATE submissions SET upvotes = upvotes + 1 WHERE id = ?",
  ),
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.submission_id !== "number") {
      return NextResponse.json(
        { ok: false, error: "Please provide a valid submission_id" },
        { status: 400 },
      );
    }

    const submission = stmts.getById.get(body.submission_id);
    if (!submission) {
      return NextResponse.json(
        { ok: false, error: "Submission not found" },
        { status: 404 },
      );
    }

    stmts.incrementUpvotes.run(body.submission_id);
    const updated = stmts.getById.get(body.submission_id)!;

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
