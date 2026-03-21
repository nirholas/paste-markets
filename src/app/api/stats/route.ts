import { NextResponse } from "next/server";
import { fetchPasteTradeStats } from "@/lib/paste-trade";
import { fetchLeaderboard } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export interface SiteStats {
  total_trades: number;
  total_callers: number;
  avg_win_rate: number;
  profitable_trades: number | null;
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
    // Primary: upstream paste.trade /api/stats (authoritative platform-wide stats)
    const upstream = await fetchPasteTradeStats();
    if (upstream) {
      const stats: SiteStats = {
        total_trades: upstream.total_trades,
        total_callers: upstream.users,
        avg_win_rate: upstream.total_trades > 0
          ? Math.round((upstream.profitable_trades / upstream.total_trades) * 1000) / 10
          : 0,
        profitable_trades: upstream.profitable_trades,
        cached_at: new Date().toISOString(),
      };

      cache = { data: stats, expiresAt: Date.now() + CACHE_TTL };

      return NextResponse.json(stats, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
      });
    }

    // Fallback: compute from leaderboard
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
      profitable_trades: null,
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
