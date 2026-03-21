import { NextResponse } from "next/server";
import { getPopularTickers, getAssets } from "@/lib/data";
import { fetchLeaderboard } from "@/lib/upstream";

export const dynamic = "force-dynamic";

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  }

  try {
    // Primary: get popular tickers from local DB (fast, sorted by call count)
    const popular = await getPopularTickers(30);

    if (popular.length > 0) {
      // Enrich with asset stats (avg P&L, bull/bear ratio)
      const assets = await getAssets();
      const assetMap = new Map(assets.map((a) => [a.ticker, a]));

      const tickers = popular.map((ticker) => {
        const a = assetMap.get(ticker);
        return {
          ticker,
          callCount: a?.callCount ?? 0,
          avgPnl: a?.avgPnl ?? null,
          bullRatio: a && a.callCount > 0
            ? Math.round(((a.bullCount ?? 0) / a.callCount) * 100)
            : null,
        };
      });

      const result = { tickers };
      cache = { data: result, expiresAt: Date.now() + CACHE_TTL };
      return NextResponse.json(result, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
      });
    }

    // Fallback: extract tickers from upstream leaderboard best_ticker fields
    const lbData = await fetchLeaderboard("30d", "win_rate", 100);
    const tickerCounts = new Map<string, number>();
    for (const a of lbData.authors) {
      const t = a.stats.best_ticker;
      if (t) tickerCounts.set(t, (tickerCounts.get(t) ?? 0) + 1);
    }

    const tickers = Array.from(tickerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([ticker, callCount]) => ({ ticker, callCount, avgPnl: null, bullRatio: null }));

    const result = { tickers };
    cache = { data: result, expiresAt: Date.now() + CACHE_TTL };
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[api/ticker] Error:", err);
    return NextResponse.json({ tickers: [] });
  }
}
