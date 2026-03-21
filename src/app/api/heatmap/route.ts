import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/data";
import { searchPasteTrade } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export interface HeatmapTicker {
  ticker: string;
  calls: number;
  longs: number;
  shorts: number;
  avgPnl: number | null;
  sentiment: "strong-bullish" | "lean-bullish" | "neutral" | "lean-bearish" | "strong-bearish";
  topCaller: string;
}

export interface HeatmapResponse {
  tickers: HeatmapTicker[];
  timeframe: "7d" | "30d" | "90d";
}

// Per-timeframe cache: 5 minutes
const cache = new Map<string, { data: HeatmapResponse; expiresAt: number }>();

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]!();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

function getSentiment(
  longs: number,
  shorts: number,
): HeatmapTicker["sentiment"] {
  const total = longs + shorts;
  if (total === 0) return "neutral";
  const longPct = longs / total;
  if (longPct > 0.7) return "strong-bullish";
  if (longPct >= 0.5) return "lean-bullish";
  if (longPct >= 0.3) return "lean-bearish";
  return "strong-bearish";
}

async function buildHeatmap(
  timeframe: "7d" | "30d" | "90d",
): Promise<HeatmapResponse> {
  const cached = cache.get(timeframe);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const leaderboard = await getLeaderboard("30d", 50, 0);
  if (leaderboard.length === 0) {
    const empty: HeatmapResponse = { tickers: [], timeframe };
    cache.set(timeframe, { data: empty, expiresAt: Date.now() + 5 * 60 * 1000 });
    return empty;
  }

  // Fetch trades for all callers
  const tasks = leaderboard.map(
    (entry) => async (): Promise<{ handle: string; trades: Awaited<ReturnType<typeof searchPasteTrade>> }> => {
      try {
        const trades = await searchPasteTrade({
          author: entry.handle,
          top: timeframe,
          limit: 100,
        });
        return { handle: entry.handle, trades };
      } catch {
        return { handle: entry.handle, trades: [] };
      }
    },
  );

  const results = await runWithConcurrency(tasks, 10);

  // Aggregate by ticker
  const tickerMap = new Map<
    string,
    {
      calls: number;
      longs: number;
      shorts: number;
      pnlSum: number;
      pnlCount: number;
      callerCounts: Map<string, number>;
    }
  >();

  for (const { handle, trades } of results) {
    for (const trade of trades) {
      const ticker = trade.ticker.toUpperCase();
      if (!ticker) continue;

      let entry = tickerMap.get(ticker);
      if (!entry) {
        entry = {
          calls: 0,
          longs: 0,
          shorts: 0,
          pnlSum: 0,
          pnlCount: 0,
          callerCounts: new Map(),
        };
        tickerMap.set(ticker, entry);
      }

      entry.calls += 1;
      const dir = trade.direction;
      if (dir === "long" || dir === "yes") {
        entry.longs += 1;
      } else {
        entry.shorts += 1;
      }
      if (trade.pnlPct != null) {
        entry.pnlSum += trade.pnlPct;
        entry.pnlCount += 1;
      }

      entry.callerCounts.set(handle, (entry.callerCounts.get(handle) ?? 0) + 1);
    }
  }

  // Build output — minimum 2 calls
  const tickers: HeatmapTicker[] = [];
  for (const [ticker, data] of tickerMap.entries()) {
    if (data.calls < 2) continue;

    // Find top caller
    let topCaller = "";
    let topCount = 0;
    for (const [handle, count] of data.callerCounts.entries()) {
      if (count > topCount) {
        topCount = count;
        topCaller = handle;
      }
    }

    tickers.push({
      ticker,
      calls: data.calls,
      longs: data.longs,
      shorts: data.shorts,
      avgPnl: data.pnlCount > 0 ? data.pnlSum / data.pnlCount : null,
      sentiment: getSentiment(data.longs, data.shorts),
      topCaller,
    });
  }

  // Sort by call count descending
  tickers.sort((a, b) => b.calls - a.calls);

  const result: HeatmapResponse = { tickers, timeframe };
  cache.set(timeframe, { data: result, expiresAt: Date.now() + 5 * 60 * 1000 });
  return result;
}

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get("timeframe") ?? "7d";
  const timeframe: "7d" | "30d" | "90d" =
    tf === "30d" ? "30d" : tf === "90d" ? "90d" : "7d";

  try {
    const data = await buildHeatmap(timeframe);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/heatmap] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
