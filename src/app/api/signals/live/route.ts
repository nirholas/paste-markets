/**
 * Live signals API — returns stored high-confidence detections.
 *
 * GET /api/signals/live?minConfidence=0.75&limit=50&direction=long&platform=hyperliquid
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentSignals, getHighConfidenceSignals } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const minConfidence = parseFloat(searchParams.get("minConfidence") ?? "0.65");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);
  const direction = searchParams.get("direction") ?? "";
  const platform = searchParams.get("platform") ?? "";

  let signals = minConfidence > 0.65
    ? await getHighConfidenceSignals(minConfidence, limit * 2) // over-fetch for filtering
    : await getRecentSignals(limit * 2);

  // Apply filters
  if (direction) {
    signals = signals.filter((s) => s.direction === direction);
  }
  if (platform) {
    signals = signals.filter((s) => s.platform === platform);
  }

  signals = signals.slice(0, limit);

  return NextResponse.json({
    signals,
    total: signals.length,
    minConfidence,
  }, {
    headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=5" },
  });
}
