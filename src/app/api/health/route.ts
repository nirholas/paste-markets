import { NextResponse } from "next/server";
import { fetchHealth } from "@/lib/paste-trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = await fetchHealth();

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    upstream: upstream ? { ok: upstream.ok, ts: upstream.ts } : { ok: false, error: "unreachable" },
  });
}
