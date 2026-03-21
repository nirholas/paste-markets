import { NextRequest, NextResponse } from "next/server";
import { aggregateConsensus, type ConsensusPlay } from "@/lib/consensus";
import { fetchLeaderboard } from "@/lib/upstream";
import { searchPasteTrade } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export interface ConsensusResponse {
  plays: ConsensusPlay[];
  timeframe: string;
  minCallers: number;
  updatedAt: string;
}

// ---------- Cache ----------

interface CacheEntry {
  data: ConsensusResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const VALID_TIMEFRAMES = new Set(["7d", "30d", "90d", "all"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const timeframe = VALID_TIMEFRAMES.has(searchParams.get("timeframe") ?? "")
    ? (searchParams.get("timeframe") as string)
    : "30d";

  const minCallersRaw = parseInt(searchParams.get("min_callers") ?? "3", 10);
  const minCallers = isNaN(minCallersRaw)
    ? 3
    : Math.max(2, Math.min(minCallersRaw, 20));

  // Accept "venue" as an alias for "platform"
  const VENUE_TO_PLATFORM: Record<string, string> = {
    stocks: "robinhood",
    perps: "hyperliquid",
    prediction: "polymarket",
  };
  const venueRaw = searchParams.get("venue")?.toLowerCase();
  const platformFilter = venueRaw
    ? (VENUE_TO_PLATFORM[venueRaw] ?? venueRaw)
    : (searchParams.get("platform") ?? "").toLowerCase();

  const cacheKey = `${timeframe}:${minCallers}:${platformFilter}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = await buildConsensus(timeframe, minCallers, platformFilter);
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    const response = NextResponse.json(data);
    response.headers.set(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=30",
    );
    return response;
  } catch (err) {
    console.error("[api/consensus] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function buildConsensus(
  timeframe: string,
  minCallers: number,
  platformFilter: string,
): Promise<ConsensusResponse> {
  // Fetch leaderboard (for caller stats) and trades in parallel
  const [lbData, trades] = await Promise.all([
    fetchLeaderboard(timeframe === "all" ? "30d" : timeframe, "win_rate", 100),
    searchPasteTrade({
      top: timeframe as "7d" | "30d" | "90d" | "all",
      limit: 200,
    }),
  ]);

  // Build caller stats map from leaderboard
  const callerStatsMap = new Map<string, { winRate: number; avgPnl: number }>();
  for (const author of lbData.authors) {
    callerStatsMap.set(author.author.handle, {
      winRate: author.stats.win_rate,
      avgPnl: author.stats.avg_pnl,
    });
  }

  // Transform trades for aggregation
  const tradeInputs = trades
    .filter((t) => t.ticker && t.direction && t.author_handle)
    .filter(
      (t) =>
        !platformFilter ||
        platformFilter === "all" ||
        t.platform?.toLowerCase() === platformFilter,
    )
    .map((t) => ({
      ticker: t.ticker,
      direction: t.direction,
      handle: t.author_handle!,
      pnl: t.pnlPct ?? null,
      platform: t.platform ?? null,
    }));

  const plays = aggregateConsensus(tradeInputs, callerStatsMap, minCallers);

  return {
    plays,
    timeframe,
    minCallers,
    updatedAt: new Date().toISOString(),
  };
}
