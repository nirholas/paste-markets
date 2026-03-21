import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ADMIN_KEY = process.env["ADMIN_KEY"] ?? "";

function isAdmin(request: NextRequest): boolean {
  if (!ADMIN_KEY) return false;
  const auth = request.headers.get("x-admin-key");
  return auth === ADMIN_KEY;
}

const stmts = {
  updateStatus: db.prepare(
    "UPDATE submissions SET status = ? WHERE id = ?",
  ),
  getById: db.prepare<[number], { id: number; caller_handle: string; status: string }>(
    "SELECT id, caller_handle, status FROM submissions WHERE id = ?",
  ),
};

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.id !== "number" ||
      !["approved", "rejected", "tracked", "pending"].includes(body.status)
    ) {
      return NextResponse.json(
        { ok: false, error: "Provide id and valid status" },
        { status: 400 },
      );
    }

    const existing = stmts.getById.get(body.id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Submission not found" },
        { status: 404 },
      );
    }

    stmts.updateStatus.run(body.status, body.id);

    return NextResponse.json({
      ok: true,
      id: body.id,
      caller_handle: existing.caller_handle,
      old_status: existing.status,
      new_status: body.status,
    });
  } catch (err) {
    console.error("[api/nominate/admin] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
