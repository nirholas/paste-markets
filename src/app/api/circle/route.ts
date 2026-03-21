import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getLeaderboard, updateRankings } from "@/lib/data";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES = new Set(["7d", "30d", "90d", "all"]);

// Tier sizes: inner → outer
const TIER_SIZES = [5, 8, 12];
const TOTAL = TIER_SIZES.reduce((a, b) => a + b, 0); // 25

export interface CircleCaller {
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  tier: 1 | 2 | 3;
}

export interface CircleResponse {
  callers: CircleCaller[];
  timeframe: string;
  total: number;
  updatedAt: string;
}

export async function GET(request: NextRequest) {
  const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "30d";
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
  }

  try {
    await updateRankings(timeframe);
  } catch (err) {
    console.error("[api/circle] Failed to update rankings:", err);
  }

  const entries = await getLeaderboard(timeframe, TOTAL, 0);

  const callers: CircleCaller[] = entries.map((entry, idx) => {
    let tier: 1 | 2 | 3 = 3;
    if (idx < TIER_SIZES[0]!) tier = 1;
    else if (idx < TIER_SIZES[0]! + TIER_SIZES[1]!) tier = 2;

    return {
      handle: entry.handle,
      winRate: entry.win_rate ?? 0,
      avgPnl: entry.avg_pnl ?? 0,
      totalTrades: entry.total_trades ?? 0,
      tier,
    };
  });

  const response: CircleResponse = {
    callers,
    timeframe,
    total: callers.length,
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
