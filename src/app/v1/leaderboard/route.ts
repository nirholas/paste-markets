/**
 * GET /v1/leaderboard
 *
 * Ranked callers with performance stats.
 *
 * Query params:
 *   timeframe=7d|30d|all     (default: 30d)
 *   sort=win_rate|avg_pnl    (default: win_rate)
 *   platform=hyperliquid|robinhood|polymarket
 *   limit (max 100, default 50)
 *   offset
 */

import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api-auth";
import {
  okResponse,
  errorResponse,
  parseLimit,
  parseOffset,
  computePage,
} from "@/lib/v1-response";
import { fetchLeaderboard } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const PASTE_TRADE_BASE = "https://paste.trade";
const VALID_TIMEFRAMES = new Set(["7d", "30d", "all"]);
const VALID_SORTS = new Set(["win_rate", "avg_pnl"]);
const VALID_PLATFORMS = new Set(["all", "hyperliquid", "robinhood", "polymarket"]);

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const sp = req.nextUrl.searchParams;
  const timeframeRaw = (sp.get("timeframe") ?? "30d").toLowerCase();
  const timeframe = VALID_TIMEFRAMES.has(timeframeRaw) ? timeframeRaw : "30d";
  const sortRaw = (sp.get("sort") ?? "win_rate").toLowerCase();
  const sort = VALID_SORTS.has(sortRaw) ? sortRaw : "win_rate";
  const platformRaw = (sp.get("platform") ?? "all").toLowerCase();
  const platform = VALID_PLATFORMS.has(platformRaw) ? platformRaw : "all";
  const limit = parseLimit(sp.get("limit"), 50, 100);
  const offset = parseOffset(sp.get("offset"));

  let upstreamData: Awaited<ReturnType<typeof fetchLeaderboard>>;
  try {
    upstreamData = await fetchLeaderboard(timeframe, sort, 100);
  } catch {
    return errorResponse("UPSTREAM_ERROR", "Upstream service unreachable", 502, auth.rateLimitHeaders);
  }

  let entries = upstreamData.authors.map((item) => {
    const rawAvatar = item.author.avatar_url ?? "";
    const avatarUrl = rawAvatar?.startsWith("/")
      ? `${PASTE_TRADE_BASE}${rawAvatar}`
      : rawAvatar || null;

    return {
      rank: item.rank,
      handle: item.author.handle,
      displayName: item.author.name ?? item.author.handle,
      avatarUrl,
      platform: item.author.platform ?? null,
      stats: {
        winRate: parseFloat(item.stats.win_rate.toFixed(1)),
        avgPnl: parseFloat(item.stats.avg_pnl.toFixed(2)),
        totalPnl: parseFloat(item.stats.total_pnl.toFixed(2)),
        totalTrades: item.stats.trade_count,
        bestTicker: item.stats.best_ticker ?? null,
        bestPnl: item.stats.best_pnl ?? null,
      },
      profileUrl: `https://paste.trade/${item.author.handle}`,
    };
  });

  // Platform filter
  if (platform !== "all") {
    entries = entries.filter((e) => e.platform?.toLowerCase() === platform);
    entries.forEach((e, i) => { e.rank = offset + i + 1; });
  }

  // Re-sort if needed
  if (sort === "avg_pnl") {
    entries.sort((a, b) => b.stats.avgPnl - a.stats.avgPnl);
    entries.forEach((e, i) => { e.rank = i + 1; });
  }

  const total = entries.length;
  const page_entries = entries.slice(offset, offset + limit).map((e, i) => ({
    ...e,
    rank: offset + i + 1,
  }));

  return okResponse(
    page_entries,
    { total, limit, offset, page: computePage(offset, limit) },
    {
      ...auth.rateLimitHeaders,
      "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
    },
  );
}
