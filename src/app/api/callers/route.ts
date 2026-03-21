import { NextRequest, NextResponse } from "next/server";
import { computeAlphaScore, callerTier } from "@/lib/alpha";
import { estimateReputationScore, type ReputationTier } from "@/lib/reputation";
import { fetchLeaderboard } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const PASTE_TRADE_BASE = "https://paste.trade";
const VALID_SORTS = new Set(["win_rate", "total_pnl", "avg_pnl", "most_active", "newest", "hot", "reputation"]);
const VALID_MARKETS = new Set(["all", "hyperliquid", "polymarket", "robinhood"]);
const VALID_TIERS = new Set(["Oracle", "Alpha", "Reliable", "Developing", "Mixed", "New"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const sort = VALID_SORTS.has(searchParams.get("sort") ?? "")
    ? (searchParams.get("sort") as string)
    : "win_rate";

  const market = VALID_MARKETS.has((searchParams.get("market") ?? "all").toLowerCase())
    ? (searchParams.get("market") ?? "all").toLowerCase()
    : "all";

  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * limit;

  const query = (searchParams.get("q") ?? "").toLowerCase().trim();
  const assetFilter = (searchParams.get("asset") ?? "").toUpperCase().trim();

  const tierFilter = VALID_TIERS.has(searchParams.get("tier") ?? "")
    ? (searchParams.get("tier") as ReputationTier)
    : null;

  const window = sort === "newest" ? "7d" : sort === "hot" ? "7d" : "30d";
  const upstreamSort = sort === "most_active" ? "total_trades" : "win_rate";

  const lbData = await fetchLeaderboard(window, upstreamSort, 100);
  const rawAuthors = lbData.authors;

  // Normalize and compute alpha scores
  let callers = rawAuthors.map((item) => {
    const rawAvatar = item.author.avatar_url ?? "";
    const avatarUrl = rawAvatar?.startsWith("/")
      ? `${PASTE_TRADE_BASE}${rawAvatar}`
      : rawAvatar || null;

    const alpha = computeAlphaScore(
      item.stats.win_rate,
      item.stats.avg_pnl,
      item.stats.trade_count,
    );

    const repEstimate = estimateReputationScore(
      item.stats.win_rate,
      item.stats.avg_pnl,
      item.stats.trade_count,
    );

    return {
      rank: item.rank,
      handle: item.author.handle,
      displayName: item.author.name ?? item.author.handle,
      avatarUrl,
      winRate: item.stats.win_rate,
      avgPnl: item.stats.avg_pnl,
      totalPnl: item.stats.total_pnl,
      totalTrades: item.stats.trade_count,
      bestTicker: item.stats.best_ticker ?? null,
      platform: item.author.platform ?? null,
      alphaScore: alpha,
      tier: callerTier(alpha),
      reputationScore: repEstimate.score,
      reputationTier: repEstimate.tier,
    };
  });

  // Market filter
  if (market !== "all") {
    callers = callers.filter(
      (c) => c.platform?.toLowerCase() === market,
    );
  }

  // Tier filter
  if (tierFilter) {
    callers = callers.filter((c) => c.reputationTier === tierFilter);
  }

  // Handle search — filter by handle prefix/substring
  if (query) {
    callers = callers.filter((c) => c.handle.toLowerCase().includes(query));
  }

  // Asset filter: if assetFilter is set, we'd need per-author trade data (expensive).
  // For now skip asset filtering when not cached — return a note in the response.
  const assetFilterApplied = false;
  if (assetFilter) {
    // Best-effort: filter by bestTicker if it matches
    callers = callers.filter(
      (c) => c.bestTicker?.toUpperCase() === assetFilter,
    );
  }

  // Sort
  if (sort === "total_pnl") {
    callers.sort((a, b) => b.totalPnl - a.totalPnl);
  } else if (sort === "most_active") {
    callers.sort((a, b) => b.totalTrades - a.totalTrades);
  } else if (sort === "avg_pnl") {
    callers.sort((a, b) => b.avgPnl - a.avgPnl);
  } else if (sort === "reputation") {
    callers.sort((a, b) => b.reputationScore - a.reputationScore);
  }
  // win_rate, newest, hot: already sorted by upstream or naturally ordered

  const total = callers.length;
  const page_callers = callers.slice(offset, offset + limit).map((c, i) => ({
    ...c,
    rank: offset + i + 1,
  }));

  const response = NextResponse.json({
    callers: page_callers,
    total,
    page,
    limit,
    sort,
    market,
    tierFilter: tierFilter || null,
    assetFilter: assetFilter || null,
    assetFilterApplied,
  });

  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");

  return response;
}
