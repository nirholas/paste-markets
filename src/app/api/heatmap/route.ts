import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/data";
import { searchPasteTrade } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export interface HeatmapCaller {
  handle: string;
  calls: number;
  avgPnl: number | null;
}

export interface HeatmapTicker {
  ticker: string;
  call_count: number;
  avg_pnl: number | null;
  total_volume: number;
  direction_split: number; // % long (0-100)
  longs: number;
  shorts: number;
  platform: string | null;
  topCaller: string;
  callers: HeatmapCaller[];
}

export interface HeatmapResponse {
  tickers: HeatmapTicker[];
  timeframe: "24h" | "7d" | "30d";
}

// Per-timeframe+platform cache: 5 minutes
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

const PLATFORM_MAP: Record<string, string[]> = {
  stocks: ["robinhood"],
  perps: ["hyperliquid"],
  "prediction-markets": ["polymarket"],
};

async function buildHeatmap(
  timeframe: "24h" | "7d" | "30d",
  platformFilter: string,
): Promise<HeatmapResponse> {
  const cacheKey = `${timeframe}:${platformFilter}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  // Use 7d for API when timeframe is 24h (paste.trade doesn't support 24h)
  const apiTimeframe = timeframe === "24h" ? "7d" : timeframe;
  const leaderboard = await getLeaderboard(apiTimeframe, 50, 0);
  if (leaderboard.length === 0) {
    const empty: HeatmapResponse = { tickers: [], timeframe };
    cache.set(cacheKey, { data: empty, expiresAt: Date.now() + 5 * 60 * 1000 });
    return empty;
  }

  // Cutoff for 24h filtering
  const now = Date.now();
  const cutoff24h = timeframe === "24h" ? now - 24 * 60 * 60 * 1000 : 0;

  // Fetch trades for all callers
  const tasks = leaderboard.map(
    (entry) => async (): Promise<{ handle: string; trades: Awaited<ReturnType<typeof searchPasteTrade>> }> => {
      try {
        const trades = await searchPasteTrade({
          author: entry.handle,
          top: apiTimeframe,
          limit: 100,
        });
        return { handle: entry.handle, trades };
      } catch {
        return { handle: entry.handle, trades: [] };
      }
    },
  );

  const results = await runWithConcurrency(tasks, 10);

  // Platforms to include based on filter
  const allowedPlatforms = platformFilter !== "all" ? PLATFORM_MAP[platformFilter] ?? [] : null;

  // Aggregate by ticker
  const tickerMap = new Map<
    string,
    {
      calls: number;
      longs: number;
      shorts: number;
      pnlSum: number;
      pnlCount: number;
      detectedPlatform: string | null;
      callerData: Map<string, { calls: number; pnlSum: number; pnlCount: number }>;
    }
  >();

  for (const { handle, trades } of results) {
    for (const trade of trades) {
      // Filter by 24h if needed
      if (timeframe === "24h") {
        const tradeTime = new Date(trade.posted_at || trade.author_date || "").getTime();
        if (isNaN(tradeTime) || tradeTime < cutoff24h) continue;
      }

      // Filter by platform if needed
      const tradePlatform = trade.platform?.toLowerCase() ?? null;
      if (allowedPlatforms !== null) {
        if (!tradePlatform || !allowedPlatforms.includes(tradePlatform)) continue;
      }

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
          detectedPlatform: tradePlatform,
          callerData: new Map(),
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

      let callerEntry = entry.callerData.get(handle);
      if (!callerEntry) {
        callerEntry = { calls: 0, pnlSum: 0, pnlCount: 0 };
        entry.callerData.set(handle, callerEntry);
      }
      callerEntry.calls += 1;
      if (trade.pnlPct != null) {
        callerEntry.pnlSum += trade.pnlPct;
        callerEntry.pnlCount += 1;
      }
    }
  }

  // Build output — minimum 2 calls
  const tickers: HeatmapTicker[] = [];
  for (const [ticker, data] of tickerMap.entries()) {
    if (data.calls < 2) continue;

    // Build caller list sorted by calls
    const callers: HeatmapCaller[] = [];
    let topCaller = "";
    let topCount = 0;
    for (const [handle, cd] of data.callerData.entries()) {
      callers.push({
        handle,
        calls: cd.calls,
        avgPnl: cd.pnlCount > 0 ? cd.pnlSum / cd.pnlCount : null,
      });
      if (cd.calls > topCount) {
        topCount = cd.calls;
        topCaller = handle;
      }
    }
    callers.sort((a, b) => b.calls - a.calls);

    const total = data.longs + data.shorts;
    tickers.push({
      ticker,
      call_count: data.calls,
      avg_pnl: data.pnlCount > 0 ? data.pnlSum / data.pnlCount : null,
      total_volume: data.calls, // volume = number of calls
      direction_split: total > 0 ? Math.round((data.longs / total) * 100) : 50,
      longs: data.longs,
      shorts: data.shorts,
      platform: data.detectedPlatform,
      topCaller,
      callers: callers.slice(0, 10),
    });
  }

  // Sort by call_count descending
  tickers.sort((a, b) => b.call_count - a.call_count);

  const result: HeatmapResponse = { tickers, timeframe };
  cache.set(cacheKey, { data: result, expiresAt: Date.now() + 5 * 60 * 1000 });
  return result;
}

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get("timeframe") ?? "7d";
  const timeframe: "24h" | "7d" | "30d" =
    tf === "24h" ? "24h" : tf === "30d" ? "30d" : "7d";
  const platform = req.nextUrl.searchParams.get("platform") ?? "all";

  try {
    const data = await buildHeatmap(timeframe, platform);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/heatmap] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
