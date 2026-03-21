import { NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/upstream";
import { fetchTrades } from "@/lib/upstream";
import { computeAlphaScore, callerTier } from "@/lib/alpha";

export const dynamic = "force-dynamic";

interface DiscoverCaller {
  handle: string;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
  trades: number;
  best_ticker: string | null;
  alpha_score: number;
  tier: string;
  avatar_url: string | null;
  platform: string | null;
}

function toDiscoverCaller(a: {
  author: { handle: string; avatar_url: string; platform: string };
  stats: {
    trade_count: number;
    avg_pnl: number;
    win_rate: number;
    best_ticker: string;
    total_pnl: number;
  };
}): DiscoverCaller {
  const alpha = computeAlphaScore(
    a.stats.win_rate,
    a.stats.avg_pnl,
    a.stats.trade_count,
  );
  return {
    handle: a.author.handle,
    win_rate: a.stats.win_rate,
    avg_pnl: a.stats.avg_pnl,
    total_pnl: a.stats.total_pnl,
    trades: a.stats.trade_count,
    best_ticker: a.stats.best_ticker || null,
    alpha_score: alpha,
    tier: callerTier(alpha),
    avatar_url: a.author.avatar_url || null,
    platform: a.author.platform || null,
  };
}

export async function GET() {
  try {
    // Fetch data for multiple time windows
    const [weekData, allData, recentTrades] = await Promise.all([
      fetchLeaderboard("7d", "win_rate", 100),
      fetchLeaderboard("all", "win_rate", 100),
      fetchTrades(100),
    ]);

    // --- Trending Callers: most active this week ---
    const trendingCallers = [...weekData.authors]
      .sort((a, b) => b.stats.trade_count - a.stats.trade_count)
      .slice(0, 10)
      .map(toDiscoverCaller);

    // --- Trending Tickers: most called this week ---
    const tickerCounts = new Map<string, number>();
    for (const a of weekData.authors) {
      if (a.stats.best_ticker) {
        const t = a.stats.best_ticker.toUpperCase();
        tickerCounts.set(t, (tickerCounts.get(t) ?? 0) + a.stats.trade_count);
      }
    }
    // Also count from recent trades
    for (const t of recentTrades.items) {
      if (t.ticker) {
        const sym = t.ticker.toUpperCase();
        tickerCounts.set(sym, (tickerCounts.get(sym) ?? 0) + 1);
      }
    }
    const trendingTickers = Array.from(tickerCounts.entries())
      .map(([ticker, count]) => ({ ticker, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Rising Stars: best recent win rate with min 5 trades ---
    const risingStars = [...weekData.authors]
      .filter((a) => a.stats.trade_count >= 5)
      .sort((a, b) => {
        const alphaA = computeAlphaScore(a.stats.win_rate, a.stats.avg_pnl, a.stats.trade_count);
        const alphaB = computeAlphaScore(b.stats.win_rate, b.stats.avg_pnl, b.stats.trade_count);
        return alphaB - alphaA;
      })
      .slice(0, 10)
      .map(toDiscoverCaller);

    // --- Hot Takes: highest P&L variance (controversial calls) ---
    const hotTakes: Array<{
      handle: string;
      ticker: string;
      direction: string;
      pnl_pct: number;
      posted_at: string;
    }> = [];
    for (const t of recentTrades.items) {
      const pnl = t.pnl_pct ?? t.pnlPct;
      if (pnl != null && Math.abs(pnl) > 15) {
        hotTakes.push({
          handle: t.author_handle ?? "unknown",
          ticker: t.ticker ?? "???",
          direction: t.direction ?? "long",
          pnl_pct: pnl,
          posted_at: t.posted_at ?? t.created_at ?? new Date().toISOString(),
        });
      }
    }
    hotTakes.sort((a, b) => Math.abs(b.pnl_pct) - Math.abs(a.pnl_pct));

    // --- New to paste.markets: callers with fewest trades (recently started) ---
    const newCallers = [...allData.authors]
      .filter((a) => a.stats.trade_count >= 2 && a.stats.trade_count <= 15)
      .sort((a, b) => a.stats.trade_count - b.stats.trade_count)
      .slice(0, 10)
      .map(toDiscoverCaller);

    return NextResponse.json({
      trending_callers: trendingCallers,
      trending_tickers: trendingTickers,
      rising_stars: risingStars,
      hot_takes: hotTakes.slice(0, 10),
      new_callers: newCallers,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/discover] Error:", err);
    return NextResponse.json(
      { error: "Failed to load discovery data" },
      { status: 500 },
    );
  }
}
