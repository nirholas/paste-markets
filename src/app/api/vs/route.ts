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

    const rawA = searchParams.get("a");
    const rawB = searchParams.get("b");

    if (!rawA || !rawB) {
      return NextResponse.json(
        { error: "Missing required parameters", details: "Both 'a' and 'b' handles are required" },
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
