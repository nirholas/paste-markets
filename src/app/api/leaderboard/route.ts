import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeAlphaScore, callerTier } from "@/lib/alpha";
import { fetchLeaderboard } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const VALID_WINDOWS = new Set(["24h", "7d", "30d", "all"]);
const VALID_SORTS = new Set(["avg_pnl", "win_rate", "total_trades"]);
const VALID_PLATFORMS = new Set(["all", "hyperliquid", "polymarket", "robinhood"]);
const DEFAULT_WINDOW = "30d";
const DEFAULT_SORT = "win_rate";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function mapEntry(e: {
  handle: string;
  rank: number;
  prev_rank?: number | null;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
  total_pnl?: number | null;
  best_ticker?: string | null;
  avatar_url?: string | null;
  streak?: number;
}, idx: number, platform: string) {
  const alpha = computeAlphaScore(e.win_rate, e.avg_pnl, e.total_trades);
  return {
    rank: idx + 1,
    prevRank: e.prev_rank ?? null,
    handle: e.handle,
    winRate: e.win_rate,
    avgPnl: e.avg_pnl,
    totalTrades: e.total_trades,
    totalPnl: e.total_pnl ?? null,
    bestTicker: e.best_ticker ?? null,
    platform: platform !== "all" ? platform : null,
    avatarUrl: e.avatar_url ?? null,
    alphaScore: alpha,
    tier: callerTier(alpha),
    streak: e.streak ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Accept both "window" and "timeframe" for backwards compatibility
  const windowRaw = searchParams.get("window") ?? searchParams.get("timeframe") ?? DEFAULT_WINDOW;
  const window = VALID_WINDOWS.has(windowRaw) ? windowRaw : DEFAULT_WINDOW;

  const sort = VALID_SORTS.has(searchParams.get("sort") ?? "")
    ? (searchParams.get("sort") as string)
    : DEFAULT_SORT;

  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  // Accept "venue" as an alias for "platform" (maps venue types to platform names)
  const VENUE_TO_PLATFORM: Record<string, string> = {
    stocks: "robinhood",
    perps: "hyperliquid",
    prediction: "polymarket",
  };
  const venueRaw = searchParams.get("venue")?.toLowerCase();
  const platformRaw = (venueRaw ? (VENUE_TO_PLATFORM[venueRaw] ?? venueRaw) : searchParams.get("platform") ?? "all").toLowerCase();
  const platform = VALID_PLATFORMS.has(platformRaw) ? platformRaw : "all";

  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

  const minTradesRaw = parseInt(searchParams.get("min_trades") ?? "0", 10);
  const minTrades = isNaN(minTradesRaw) ? 0 : Math.max(0, minTradesRaw);

  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const ticker = searchParams.get("ticker")?.toUpperCase() ?? null;
  const mode = searchParams.get("mode"); // "streaks" for hot streaks view

  try {
    const data = await import("@/lib/data");

    // Ticker-specific leaderboard (local DB only — upstream doesn't support ticker filter)
    if (ticker) {
      const entries = await data.getTickerLeaderboard(ticker, limit);
      const mapped = entries.map((e, i) => mapEntry(e, i, platform));
      const response = NextResponse.json({
        entries: mapped,
        total: mapped.length,
        window,
        sort,
        platform,
        ticker,
        updatedAt: new Date().toISOString(),
      });
      response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return response;
    }

    // Streak leaderboard (local DB only)
    if (mode === "streaks") {
      const entries = await data.getStreakLeaderboard(limit, 0);
      const mapped = entries.map((e, i) => mapEntry(e, i, platform));
      const response = NextResponse.json({
        entries: mapped,
        total: mapped.length,
        window: "30d",
        sort: "streak",
        platform,
        mode: "streaks",
        updatedAt: new Date().toISOString(),
      });
      response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return response;
    }

    // Primary: upstream paste.trade /api/leaderboard (official rankings)
    const upstreamSort = sort === "total_trades" ? "avg_pnl" : sort;
    const lbData = await fetchLeaderboard(window === "24h" ? "7d" : window, upstreamSort, limit + offset + 200);

    if (lbData.authors.length > 0) {
      let entries = lbData.authors.map((a) => ({
        handle: a.author.handle,
        rank: a.rank,
        prev_rank: null as number | null,
        win_rate: a.stats.win_rate,
        avg_pnl: a.stats.avg_pnl,
        total_trades: a.stats.trade_count,
        total_pnl: a.stats.total_pnl ?? null,
        best_ticker: a.stats.best_ticker ?? null,
        avatar_url: a.author.avatar_url ?? null,
        streak: 0,
      }));

      // Platform filter
      // (upstream doesn't filter by platform, so we keep all for now)

      // Filter by minimum trades
      if (minTrades > 0) {
        entries = entries.filter((e) => e.total_trades >= minTrades);
      }

      // Sort entries per requested sort param
      if (sort === "avg_pnl") {
        entries = [...entries].sort((a, b) => order === "asc" ? a.avg_pnl - b.avg_pnl : b.avg_pnl - a.avg_pnl);
      } else if (sort === "total_trades") {
        entries = [...entries].sort((a, b) => order === "asc" ? a.total_trades - b.total_trades : b.total_trades - a.total_trades);
      } else {
        entries = [...entries].sort((a, b) => order === "asc" ? a.win_rate - b.win_rate : b.win_rate - a.win_rate);
      }

      const total = entries.length;
      entries = entries.slice(offset, offset + limit);

      const mapped = entries.map((e, i) => mapEntry(e, i + offset, platform));

      const response = NextResponse.json({
        entries: mapped,
        total,
        window,
        sort,
        platform,
        source: "upstream",
        updatedAt: lbData.computed_at,
      });
      response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return response;
    }

    // Fallback: local database
    const dbWindow = window === "24h" ? "7d" : window;
    let entries = await data.getLeaderboard(dbWindow, limit + offset + 200, 0, platform);

    // Auto-seed on first visit if leaderboard is empty
    if (entries.length === 0) {
      console.log("[api/leaderboard] Leaderboard empty — triggering seed sync...");
      const { seedFromApi } = await import("@/lib/seed-from-api");
      await seedFromApi();
      entries = await data.getLeaderboard(dbWindow, limit + offset + 200, 0, platform);
    }

    // Filter by minimum trades
    if (minTrades > 0) {
      entries = entries.filter((e) => e.total_trades >= minTrades);
    }

    // Sort entries per requested sort param
    if (sort === "avg_pnl") {
      entries = [...entries].sort((a, b) => order === "asc" ? a.avg_pnl - b.avg_pnl : b.avg_pnl - a.avg_pnl);
    } else if (sort === "total_trades") {
      entries = [...entries].sort((a, b) => order === "asc" ? a.total_trades - b.total_trades : b.total_trades - a.total_trades);
    } else {
      // win_rate
      if (order === "asc") {
        entries = [...entries].sort((a, b) => a.win_rate - b.win_rate);
      }
    }

    const total = entries.length;
    // Apply offset/limit pagination
    entries = entries.slice(offset, offset + limit);

    const mapped = entries.map((e, i) => mapEntry(e, i + offset, platform));

    const response = NextResponse.json({
      entries: mapped,
      total,
      window,
      sort,
      platform,
      source: "local",
      updatedAt: new Date().toISOString(),
    });

    response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return response;
  } catch (err) {
    console.error("[api/leaderboard] Error:", err);
    return NextResponse.json({ entries: [], total: 0, error: "Unavailable" }, { status: 200 });
  }
}
