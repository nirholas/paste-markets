import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

interface RecapData {
  date: string;
  total_trades: number;
  total_callers_active: number;
  most_called_ticker: { ticker: string; count: number } | null;
  biggest_win: { handle: string; ticker: string; pnl: number } | null;
  biggest_loss: { handle: string; ticker: string; pnl: number } | null;
  hot_streak: { handle: string; streak: number } | null;
  new_callers: string[];
  venue_breakdown: Record<string, number>;
  consensus_play: { ticker: string; direction: string; agreement: number } | null;
}

function getDateRange(dateStr: string): { start: string; end: string } {
  // dateStr is YYYY-MM-DD
  return {
    start: `${dateStr} 00:00:00`,
    end: `${dateStr} 23:59:59`,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const today = new Date().toISOString().slice(0, 10);
  const dateParam = searchParams.get("date") ?? today;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const { db } = await import("@/lib/db");
    const { start, end } = getDateRange(dateParam);

    // Get all trades for the date (using entry_date or posted_at)
    const trades = db
      .prepare(
        `SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct, t.platform, t.entry_date, t.posted_at
         FROM trades t
         WHERE (t.entry_date BETWEEN ? AND ? OR t.posted_at BETWEEN ? AND ?)
         ORDER BY t.entry_date DESC`,
      )
      .all(start, end, start, end) as Array<{
      author_handle: string;
      ticker: string;
      direction: string;
      pnl_pct: number | null;
      platform: string | null;
      entry_date: string | null;
      posted_at: string | null;
    }>;

    const totalTrades = trades.length;

    // Unique active callers
    const activeCallers = new Set(trades.map((t) => t.author_handle));
    const totalCallersActive = activeCallers.size;

    // Most called ticker
    const tickerCounts = new Map<string, number>();
    for (const t of trades) {
      const upper = t.ticker.toUpperCase();
      tickerCounts.set(upper, (tickerCounts.get(upper) ?? 0) + 1);
    }
    let mostCalledTicker: RecapData["most_called_ticker"] = null;
    if (tickerCounts.size > 0) {
      const sorted = [...tickerCounts.entries()].sort((a, b) => b[1] - a[1]);
      mostCalledTicker = { ticker: sorted[0][0], count: sorted[0][1] };
    }

    // Biggest win & biggest loss
    let biggestWin: RecapData["biggest_win"] = null;
    let biggestLoss: RecapData["biggest_loss"] = null;
    for (const t of trades) {
      if (t.pnl_pct == null) continue;
      if (biggestWin === null || t.pnl_pct > biggestWin.pnl) {
        biggestWin = { handle: t.author_handle, ticker: t.ticker, pnl: t.pnl_pct };
      }
      if (biggestLoss === null || t.pnl_pct < biggestLoss.pnl) {
        biggestLoss = { handle: t.author_handle, ticker: t.ticker, pnl: t.pnl_pct };
      }
    }

    // Hot streak — find caller with longest current win streak from rankings
    let hotStreak: RecapData["hot_streak"] = null;
    const streakRows = db
      .prepare(
        `SELECT author_handle, streak FROM rankings
         WHERE timeframe = '30d' AND streak > 0
         ORDER BY streak DESC LIMIT 1`,
      )
      .all() as Array<{ author_handle: string; streak: number }>;
    if (streakRows.length > 0) {
      hotStreak = { handle: streakRows[0].author_handle, streak: streakRows[0].streak };
    }

    // New callers — authors whose first trade is on this date
    const newCallerRows = db
      .prepare(
        `SELECT a.handle FROM authors a
         WHERE a.added_at BETWEEN ? AND ?
         ORDER BY a.added_at ASC`,
      )
      .all(start, end) as Array<{ handle: string }>;
    const newCallers = newCallerRows.map((r) => `@${r.handle}`);

    // Venue breakdown
    const venueBreakdown: Record<string, number> = {};
    for (const t of trades) {
      const platform = (t.platform ?? "unknown").toLowerCase();
      // Map platforms to venue categories
      let venue = "other";
      if (["robinhood", "webull", "schwab"].includes(platform)) venue = "stocks";
      else if (["hyperliquid", "bybit", "binance", "dydx"].includes(platform)) venue = "perps";
      else if (["polymarket", "kalshi", "drift"].includes(platform)) venue = "predictions";
      else if (platform !== "unknown") venue = platform;
      else venue = "other";
      venueBreakdown[venue] = (venueBreakdown[venue] ?? 0) + 1;
    }

    // Consensus play — most agreed-upon direction for a ticker
    let consensusPlay: RecapData["consensus_play"] = null;
    const directionGroups = new Map<string, { long: number; short: number; total: number }>();
    for (const t of trades) {
      const upper = t.ticker.toUpperCase();
      const group = directionGroups.get(upper) ?? { long: 0, short: 0, total: 0 };
      group.total++;
      if (t.direction === "long" || t.direction === "yes") group.long++;
      else if (t.direction === "short" || t.direction === "no") group.short++;
      directionGroups.set(upper, group);
    }
    if (directionGroups.size > 0) {
      let bestTicker = "";
      let bestAgreement = 0;
      let bestDirection = "long";
      for (const [ticker, g] of directionGroups.entries()) {
        if (g.total < 2) continue;
        const longPct = Math.round((g.long / g.total) * 100);
        const shortPct = Math.round((g.short / g.total) * 100);
        const maxPct = Math.max(longPct, shortPct);
        if (maxPct > bestAgreement) {
          bestAgreement = maxPct;
          bestTicker = ticker;
          bestDirection = longPct >= shortPct ? "long" : "short";
        }
      }
      if (bestTicker) {
        consensusPlay = { ticker: bestTicker, direction: bestDirection, agreement: bestAgreement };
      }
    }

    const recap: RecapData = {
      date: dateParam,
      total_trades: totalTrades,
      total_callers_active: totalCallersActive,
      most_called_ticker: mostCalledTicker,
      biggest_win: biggestWin,
      biggest_loss: biggestLoss,
      hot_streak: hotStreak,
      new_callers: newCallers,
      venue_breakdown: venueBreakdown,
      consensus_play: consensusPlay,
    };

    const response = NextResponse.json(recap);
    response.headers.set("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    return response;
  } catch (err) {
    console.error("[api/recap] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
