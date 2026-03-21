import { NextRequest, NextResponse } from "next/server";
import {
  syncAuthor,
  isStale,
  getOrCreateAuthor,
  getAuthorMetrics,
  recordView,
} from "@/lib/data";
import type { AuthorMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES = new Set(["7d", "30d", "90d", "all"]);

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

function determineWinner(
  aVal: number,
  bVal: number,
): "a" | "b" | "tie" {
  if (aVal > bVal) return "a";
  if (bVal > aVal) return "b";
  return "tie";
}

interface AuthorProfile {
  handle: string;
  metrics: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    winCount: number;
    lossCount: number;
    bestTrade: AuthorMetrics["bestTrade"];
    worstTrade: AuthorMetrics["worstTrade"];
    streak: number;
  };
}

async function loadAuthor(handle: string): Promise<AuthorProfile | null> {
  const author = await getOrCreateAuthor(handle);

  if (isStale(author.last_fetched)) {
    try {
      await syncAuthor(handle);
    } catch (err) {
      console.error(`[api/vs] Failed to sync ${handle}:`, err);
    }
  }

  const metrics = await getAuthorMetrics(handle);
  if (!metrics) return null;

  return {
    handle,
    metrics: {
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      avgPnl: metrics.avgPnl,
      winCount: metrics.winCount,
      lossCount: metrics.lossCount,
      bestTrade: metrics.bestTrade,
      worstTrade: metrics.worstTrade,
      streak: metrics.streak,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Support multi-caller mode: ?callers=frank,alex,trader99
    const callersParam = searchParams.get("callers");

    if (callersParam) {
      return handleMultiCompare(callersParam, searchParams);
    }

    // Legacy two-caller mode: ?a=alice&b=bob
    const rawA = searchParams.get("a");
    const rawB = searchParams.get("b");

    if (!rawA || !rawB) {
      return NextResponse.json(
        { error: "Missing required parameters", details: "Both 'a' and 'b' handles are required, or use 'callers' param" },
        { status: 400 },
      );
    }

    const handleA = cleanHandle(rawA);
    const handleB = cleanHandle(rawB);

    if (handleA === handleB) {
      return NextResponse.json(
        { error: "Invalid comparison", details: "Cannot compare an author with themselves" },
        { status: 400 },
      );
    }

    const timeframe = searchParams.get("timeframe") ?? "30d";
    if (!VALID_TIMEFRAMES.has(timeframe)) {
      return NextResponse.json(
        { error: "Invalid timeframe", details: `Must be one of: ${[...VALID_TIMEFRAMES].join(", ")}` },
        { status: 400 },
      );
    }

    // Load both authors in parallel
    const [profileA, profileB] = await Promise.all([
      loadAuthor(handleA),
      loadAuthor(handleB),
    ]);

    if (!profileA) {
      return NextResponse.json(
        { error: "Author not found", details: `No data for @${handleA}` },
        { status: 404 },
      );
    }
    if (!profileB) {
      return NextResponse.json(
        { error: "Author not found", details: `No data for @${handleB}` },
        { status: 404 },
      );
    }

    // Record views for trending
    await recordView(handleA, "h2h");
    await recordView(handleB, "h2h");

    // Compare across dimensions
    const winRateWinner = determineWinner(profileA.metrics.winRate, profileB.metrics.winRate);
    const avgPnlWinner = determineWinner(profileA.metrics.avgPnl, profileB.metrics.avgPnl);
    const totalTradesWinner = determineWinner(
      profileA.metrics.totalTrades,
      profileB.metrics.totalTrades,
    );

    const bestTradeA = profileA.metrics.bestTrade?.pnl ?? 0;
    const bestTradeB = profileB.metrics.bestTrade?.pnl ?? 0;
    const bestTradeWinner = determineWinner(bestTradeA, bestTradeB);

    // Overall winner: most dimensions won
    const dimensions = [winRateWinner, avgPnlWinner, totalTradesWinner, bestTradeWinner];
    const aWins = dimensions.filter((d) => d === "a").length;
    const bWins = dimensions.filter((d) => d === "b").length;
    const overallWinner: "a" | "b" | "tie" =
      aWins > bWins ? "a" : bWins > aWins ? "b" : "tie";

    // Find shared tickers
    const metricsA = await getAuthorMetrics(handleA);
    const metricsB = await getAuthorMetrics(handleB);

    const sharedTickers: Array<{ ticker: string; a_pnl: number; b_pnl: number }> = [];

    if (metricsA && metricsB) {
      // Build ticker -> avg P&L maps from recent trades
      const tickerPnlA = new Map<string, number[]>();
      for (const t of metricsA.recentTrades) {
        const arr = tickerPnlA.get(t.ticker) ?? [];
        arr.push(t.pnl_pct);
        tickerPnlA.set(t.ticker, arr);
      }

      const tickerPnlB = new Map<string, number[]>();
      for (const t of metricsB.recentTrades) {
        const arr = tickerPnlB.get(t.ticker) ?? [];
        arr.push(t.pnl_pct);
        tickerPnlB.set(t.ticker, arr);
      }

      for (const [ticker, aPnls] of tickerPnlA) {
        const bPnls = tickerPnlB.get(ticker);
        if (bPnls) {
          const avgA = aPnls.reduce((s, v) => s + v, 0) / aPnls.length;
          const avgB = bPnls.reduce((s, v) => s + v, 0) / bPnls.length;
          sharedTickers.push({
            ticker,
            a_pnl: Math.round(avgA * 10) / 10,
            b_pnl: Math.round(avgB * 10) / 10,
          });
        }
      }

      // Sort by combined volume (most traded shared tickers first)
      sharedTickers.sort(
        (x, y) => Math.abs(y.a_pnl) + Math.abs(y.b_pnl) - (Math.abs(x.a_pnl) + Math.abs(x.b_pnl)),
      );
    }

    return NextResponse.json({
      a: profileA,
      b: profileB,
      comparison: {
        winRateWinner,
        avgPnlWinner,
        totalTradesWinner,
        bestTradeWinner,
        overallWinner,
        sharedTickers,
      },
      timeframe,
    });
  } catch (err) {
    console.error("[api/vs] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------- Multi-caller comparison (2-4 callers) ----------

interface CallerProfile {
  handle: string;
  metrics: {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    winCount: number;
    lossCount: number;
    bestTrade: AuthorMetrics["bestTrade"];
    worstTrade: AuthorMetrics["worstTrade"];
    streak: number;
    recentTrades: AuthorMetrics["recentTrades"];
    pnlHistory: AuthorMetrics["pnlHistory"];
  };
  radar: {
    winRate: number;
    volume: number;
    consistency: number;
    bestTrade: number;
    risk: number;
  };
}

function computeRadar(metrics: AuthorMetrics): CallerProfile["radar"] {
  // Normalize each axis to 0-100 scale
  const winRate = Math.min(metrics.winRate, 100);

  // Volume: log-scale, 1 trade = 0, 100+ trades = 100
  const volume = Math.min((Math.log2(Math.max(metrics.totalTrades, 1)) / Math.log2(100)) * 100, 100);

  // Consistency: inverse of std deviation of P&L across trades
  const pnls = metrics.recentTrades.map((t) => t.pnl_pct);
  let consistency = 50;
  if (pnls.length >= 2) {
    const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
    const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / pnls.length;
    const stdDev = Math.sqrt(variance);
    // Lower std dev = more consistent. Map 0-50 std dev to 100-0
    consistency = Math.max(0, Math.min(100, 100 - stdDev * 2));
  }

  // Best trade: map 0-100% P&L to 0-100 score
  const bestPnl = metrics.bestTrade?.pnl ?? 0;
  const bestTrade = Math.min(Math.max(bestPnl, 0), 100);

  // Risk: inverse of max drawdown (worst trade). Less negative = less risky = higher score
  const worstPnl = metrics.worstTrade?.pnl ?? 0;
  // Map -100% to 0, 0% to 100
  const risk = Math.min(Math.max(100 + worstPnl, 0), 100);

  return {
    winRate: Math.round(winRate),
    volume: Math.round(volume),
    consistency: Math.round(consistency),
    bestTrade: Math.round(bestTrade),
    risk: Math.round(risk),
  };
}

async function handleMultiCompare(
  callersParam: string,
  searchParams: URLSearchParams,
): Promise<NextResponse> {
  const handles = callersParam
    .split(",")
    .map(cleanHandle)
    .filter((h) => h.length > 0);

  // Deduplicate
  const unique = [...new Set(handles)];

  if (unique.length < 2) {
    return NextResponse.json(
      { error: "Too few callers", details: "Need at least 2 different callers to compare" },
      { status: 400 },
    );
  }
  if (unique.length > 4) {
    return NextResponse.json(
      { error: "Too many callers", details: "Maximum 4 callers for comparison" },
      { status: 400 },
    );
  }

  const timeframe = searchParams.get("timeframe") ?? "30d";
  if (!VALID_TIMEFRAMES.has(timeframe)) {
    return NextResponse.json(
      { error: "Invalid timeframe", details: `Must be one of: ${[...VALID_TIMEFRAMES].join(", ")}` },
      { status: 400 },
    );
  }

  // Load all callers in parallel
  const results = await Promise.all(
    unique.map(async (handle) => {
      const author = await getOrCreateAuthor(handle);
      if (isStale(author.last_fetched)) {
        try {
          await syncAuthor(handle);
        } catch (err) {
          console.error(`[api/vs] Failed to sync ${handle}:`, err);
        }
      }
      const metrics = await getAuthorMetrics(handle);
      return { handle, metrics };
    }),
  );

  const notFound = results.filter((r) => !r.metrics);
  if (notFound.length > 0) {
    return NextResponse.json(
      {
        error: "Author(s) not found",
        details: `No data for: ${notFound.map((r) => `@${r.handle}`).join(", ")}`,
      },
      { status: 404 },
    );
  }

  // Record views
  for (const r of results) {
    await recordView(r.handle, "compare");
  }

  // Build caller profiles with radar scores
  const callers: CallerProfile[] = results.map((r) => {
    const m = r.metrics!;
    return {
      handle: r.handle,
      metrics: {
        totalTrades: m.totalTrades,
        winRate: m.winRate,
        avgPnl: m.avgPnl,
        totalPnl: m.totalPnl,
        winCount: m.winCount,
        lossCount: m.lossCount,
        bestTrade: m.bestTrade,
        worstTrade: m.worstTrade,
        streak: m.streak,
        recentTrades: m.recentTrades,
        pnlHistory: m.pnlHistory,
      },
      radar: computeRadar(m),
    };
  });

  // Determine winner per stat dimension
  const statWinners: Record<string, string> = {};
  const stats = ["winRate", "avgPnl", "totalTrades", "bestTrade", "streak"] as const;

  for (const stat of stats) {
    let bestHandle = callers[0].handle;
    let bestVal = -Infinity;

    for (const c of callers) {
      let val: number;
      if (stat === "bestTrade") {
        val = c.metrics.bestTrade?.pnl ?? 0;
      } else {
        val = c.metrics[stat];
      }
      if (val > bestVal) {
        bestVal = val;
        bestHandle = c.handle;
      }
    }

    // Check for ties
    const tiedCount = callers.filter((c) => {
      const v = stat === "bestTrade" ? (c.metrics.bestTrade?.pnl ?? 0) : c.metrics[stat];
      return v === bestVal;
    }).length;

    statWinners[stat] = tiedCount > 1 ? "tie" : bestHandle;
  }

  // Worst trade winner (less negative = better)
  {
    let bestHandle = callers[0].handle;
    let bestVal = -Infinity;
    for (const c of callers) {
      const val = c.metrics.worstTrade?.pnl ?? 0;
      if (val > bestVal) {
        bestVal = val;
        bestHandle = c.handle;
      }
    }
    const tiedCount = callers.filter(
      (c) => (c.metrics.worstTrade?.pnl ?? 0) === bestVal,
    ).length;
    statWinners["worstTrade"] = tiedCount > 1 ? "tie" : bestHandle;
  }

  // Shared tickers: find tickers called by 2+ callers
  const tickersByCallerMap = new Map<string, Map<string, number[]>>();
  for (const c of callers) {
    for (const t of c.metrics.recentTrades) {
      if (!tickersByCallerMap.has(t.ticker)) {
        tickersByCallerMap.set(t.ticker, new Map());
      }
      const callerMap = tickersByCallerMap.get(t.ticker)!;
      const pnls = callerMap.get(c.handle) ?? [];
      pnls.push(t.pnl_pct);
      callerMap.set(c.handle, pnls);
    }
  }

  const sharedTickers: Array<{
    ticker: string;
    callers: Array<{ handle: string; avgPnl: number }>;
  }> = [];

  for (const [ticker, callerMap] of tickersByCallerMap) {
    if (callerMap.size >= 2) {
      const callerPnls: Array<{ handle: string; avgPnl: number }> = [];
      for (const [handle, pnls] of callerMap) {
        const avg = pnls.reduce((s, v) => s + v, 0) / pnls.length;
        callerPnls.push({ handle, avgPnl: Math.round(avg * 10) / 10 });
      }
      sharedTickers.push({ ticker, callers: callerPnls });
    }
  }

  // Sort shared tickers by number of callers involved (desc), then by total volume
  sharedTickers.sort((a, b) => {
    if (b.callers.length !== a.callers.length) return b.callers.length - a.callers.length;
    const volA = a.callers.reduce((s, c) => s + Math.abs(c.avgPnl), 0);
    const volB = b.callers.reduce((s, c) => s + Math.abs(c.avgPnl), 0);
    return volB - volA;
  });

  return NextResponse.json({
    callers,
    statWinners,
    sharedTickers,
    timeframe,
  });
}
