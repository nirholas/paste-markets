import { NextRequest, NextResponse } from "next/server";
import { searchAuthors } from "@/lib/data";
import { searchPasteTrade } from "@/lib/paste-trade";
import { fetchLeaderboard } from "@/lib/upstream";
import { computeAlphaScore } from "@/lib/alpha";

export const dynamic = "force-dynamic";

function cleanQuery(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  // Simple fuzzy: check if all chars of query appear in order in target
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawQuery = searchParams.get("q");

    if (!rawQuery || !rawQuery.trim()) {
      return NextResponse.json(
        { error: "Missing search query", details: "Provide a 'q' parameter" },
        { status: 400 },
      );
    }

    const query = cleanQuery(rawQuery);
    const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = isNaN(limitRaw) ? 10 : Math.min(Math.max(1, limitRaw), 50);

    // Fetch leaderboard data for rich caller results
    const leaderboard = await fetchLeaderboard("30d", "win_rate", 100);

    // --- Callers ---
    const callers: Array<{
      handle: string;
      win_rate: number;
      avg_pnl: number;
      trades: number;
      alpha_score: number;
      tier: string;
      avatar_url: string | null;
    }> = [];

    for (const a of leaderboard.authors) {
      if (fuzzyMatch(query, a.author.handle)) {
        const alpha = computeAlphaScore(
          a.stats.win_rate,
          a.stats.avg_pnl,
          a.stats.trade_count,
        );
        callers.push({
          handle: a.author.handle,
          win_rate: a.stats.win_rate,
          avg_pnl: a.stats.avg_pnl,
          trades: a.stats.trade_count,
          alpha_score: alpha,
          tier: alpha >= 70 ? "S" : alpha >= 50 ? "A" : alpha >= 30 ? "B" : "C",
          avatar_url: a.author.avatar_url || null,
        });
      }
    }

    // If no callers found in leaderboard, try local DB + paste.trade
    if (callers.length === 0) {
      const localResults = await searchAuthors(query, limit);
      for (const r of localResults) {
        callers.push({
          handle: r.handle,
          win_rate: r.winRate,
          avg_pnl: 0,
          trades: r.totalTrades,
          alpha_score: 0,
          tier: "C",
          avatar_url: null,
        });
      }

      if (callers.length === 0) {
        try {
          const apiResults = await searchPasteTrade({ author: query, limit: 10 });
          if (apiResults.length > 0) {
            callers.push({
              handle: query,
              win_rate: 0,
              avg_pnl: 0,
              trades: apiResults.length,
              alpha_score: 0,
              tier: "C",
              avatar_url: null,
            });
          }
        } catch {
          // silently continue
        }
      }
    }

    // --- Tickers ---
    const tickerMap = new Map<string, number>();
    for (const a of leaderboard.authors) {
      if (a.stats.best_ticker) {
        const t = a.stats.best_ticker.toUpperCase();
        if (t.includes(query.toUpperCase())) {
          tickerMap.set(t, (tickerMap.get(t) ?? 0) + 1);
        }
      }
    }

    // Also search paste.trade for ticker matches
    if (tickerMap.size === 0 && query.length >= 2) {
      try {
        const tickerResults = await searchPasteTrade({ ticker: query, limit: 20 });
        for (const t of tickerResults) {
          if (t.ticker) {
            const sym = t.ticker.toUpperCase();
            tickerMap.set(sym, (tickerMap.get(sym) ?? 0) + 1);
          }
        }
      } catch {
        // silently continue
      }
    }

    const tickers = Array.from(tickerMap.entries())
      .map(([ticker, calls]) => ({ ticker, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, limit);

    // --- Trades ---
    const trades: Array<{
      handle: string;
      ticker: string;
      direction: string;
      pnl_pct: number | null;
      content_preview: string;
    }> = [];

    // Search for trades matching the query as a ticker or handle
    try {
      const tradeResults = await searchPasteTrade({
        author: callers.length > 0 ? callers[0].handle : undefined,
        ticker: tickers.length > 0 ? tickers[0].ticker : query,
        limit: 10,
      });

      for (const t of tradeResults) {
        trades.push({
          handle: t.author_handle ?? "unknown",
          ticker: t.ticker,
          direction: t.direction,
          pnl_pct: t.pnlPct ?? null,
          content_preview: `${t.direction.toUpperCase()} $${t.ticker}${t.pnlPct != null ? ` → ${t.pnlPct > 0 ? "+" : ""}${t.pnlPct.toFixed(1)}%` : ""}`,
        });
      }
    } catch {
      // silently continue
    }

    return NextResponse.json({
      callers: callers.slice(0, limit),
      tickers: tickers.slice(0, limit),
      trades: trades.slice(0, limit),
    });
  } catch (err) {
    console.error("[api/search] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
