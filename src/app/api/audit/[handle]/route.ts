import { NextRequest, NextResponse } from "next/server";
import { getLatestAudit, auditCaller } from "@/lib/completeness";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit/[handle] — Return the most recent audit for a handle.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  try {
    const audit = await getLatestAudit(handle);

    if (!audit) {
      return NextResponse.json(
        { error: "No audit found", handle },
        { status: 404 },
      );
    }

    return NextResponse.json({ audit });
  } catch (err) {
    console.error("[api/audit] GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch audit" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/audit/[handle] — Trigger a new audit for a handle.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  try {
    const audit = await auditCaller(handle);
    return NextResponse.json({ audit });
  } catch (err) {
    console.error("[api/audit] POST error:", err);
    return NextResponse.json(
      { error: "Audit failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
