/**
 * Watchlist monitoring stats.
 *
 * GET /api/watchlist/stats
 */

import { NextResponse } from "next/server";
import { getWatchlistStats } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

export async function GET() {
  const stats = getWatchlistStats();
  return NextResponse.json(stats);
}
