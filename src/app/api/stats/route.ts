import { NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export interface SiteStats {
  total_trades: number;
  total_callers: number;
  avg_win_rate: number;
  cached_at: string;
}

let cache: { data: SiteStats; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  }

  try {
    const lbData = await fetchLeaderboard("30d", "win_rate", 200);
    const authors = lbData.authors;

    const totalCallers = authors.length;
    const totalTrades = authors.reduce((s, a) => s + (a.stats.trade_count ?? 0), 0);
    const avgWinRate = totalCallers > 0
      ? authors.reduce((s, a) => s + (a.stats.win_rate ?? 0), 0) / totalCallers
      : 0;

    const stats: SiteStats = {
      total_trades: totalTrades,
      total_callers: totalCallers,
      avg_win_rate: Math.round(avgWinRate * 10) / 10,
      cached_at: new Date().toISOString(),
    };

    cache = { data: stats, expiresAt: Date.now() + CACHE_TTL };

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[api/stats]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
