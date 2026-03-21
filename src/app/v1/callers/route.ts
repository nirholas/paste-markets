/**
 * GET /v1/callers
 *
 * List callers, sorted and filtered.
 *
 * Query params:
 *   sort=win_rate|avg_pnl|total_pnl|most_active  (default: win_rate)
 *   platform=hyperliquid|robinhood|polymarket
 *   asset=BTC                                      filter by best ticker
 *   q=                                             search handle
 *   timeframe=7d|30d|all                           (default: 30d)
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

export const dynamic = "force-dynamic";

const PASTE_TRADE_BASE = "https://paste.trade";
const VALID_SORTS = new Set(["win_rate", "avg_pnl", "total_pnl", "most_active"]);
const VALID_PLATFORMS = new Set(["all", "hyperliquid", "robinhood", "polymarket"]);
const VALID_TIMEFRAMES = new Set(["7d", "30d", "all"]);

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const sp = req.nextUrl.searchParams;
  const sort = VALID_SORTS.has(sp.get("sort") ?? "") ? sp.get("sort")! : "win_rate";
  const platformRaw = (sp.get("platform") ?? "all").toLowerCase();
  const platform = VALID_PLATFORMS.has(platformRaw) ? platformRaw : "all";
  const timeframeRaw = (sp.get("timeframe") ?? "30d").toLowerCase();
  const timeframe = VALID_TIMEFRAMES.has(timeframeRaw) ? timeframeRaw : "30d";
  const limit = parseLimit(sp.get("limit"), 50, 100);
  const offset = parseOffset(sp.get("offset"));
  const query = (sp.get("q") ?? "").toLowerCase().trim();
  const assetFilter = (sp.get("asset") ?? "").toUpperCase().trim();

  const key = process.env["PASTE_TRADE_KEY"];
  if (!key) {
    return errorResponse("SERVER_ERROR", "Server misconfiguration", 500, auth.rateLimitHeaders);
  }

  // Map timeframe to paste.trade window
  const window = timeframe === "7d" ? "7d" : timeframe === "all" ? "all" : "30d";
  const upstreamSort = sort === "most_active" ? "total_trades" : "win_rate";

  const upstream = new URL(`${PASTE_TRADE_BASE}/api/leaderboard`);
  upstream.searchParams.set("window", window);
  upstream.searchParams.set("sort", upstreamSort);
  upstream.searchParams.set("limit", "100");

  type RawAuthor = {
    rank: number;
    author: { handle: string; name: string | null; avatar_url: string; platform: string };
    stats: {
      trade_count: number;
      avg_pnl: number;
      win_rate: number;
      best_pnl: number;
      best_ticker: string;
      total_pnl: number;
    };
  };

  let rawAuthors: RawAuthor[];

  try {
    const res = await fetch(upstream.toString(), {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return errorResponse("UPSTREAM_ERROR", "Upstream service error", 502, auth.rateLimitHeaders);
    }
    const body = await res.json();
    rawAuthors = (body as { authors?: RawAuthor[] }).authors ?? [];
  } catch {
    return errorResponse("UPSTREAM_ERROR", "Upstream service unreachable", 502, auth.rateLimitHeaders);
  }

  let callers = rawAuthors.map((item) => {
    const rawAvatar = item.author.avatar_url;
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
        winRate: item.stats.win_rate,
        avgPnl: item.stats.avg_pnl,
        totalPnl: item.stats.total_pnl,
        totalTrades: item.stats.trade_count,
        bestTicker: item.stats.best_ticker ?? null,
        bestPnl: item.stats.best_pnl ?? null,
      },
      profileUrl: `https://paste.trade/${item.author.handle}`,
    };
  });

  // Platform filter
  if (platform !== "all") {
    callers = callers.filter((c) => c.platform?.toLowerCase() === platform);
  }

  // Handle/name search
  if (query) {
    callers = callers.filter((c) => c.handle.toLowerCase().includes(query));
  }

  // Asset filter (best-effort: match by bestTicker)
  if (assetFilter) {
    callers = callers.filter((c) => c.stats.bestTicker?.toUpperCase() === assetFilter);
  }

  // Re-sort
  if (sort === "total_pnl") {
    callers.sort((a, b) => b.stats.totalPnl - a.stats.totalPnl);
  } else if (sort === "most_active") {
    callers.sort((a, b) => b.stats.totalTrades - a.stats.totalTrades);
  } else if (sort === "avg_pnl") {
    callers.sort((a, b) => b.stats.avgPnl - a.stats.avgPnl);
  }
  // win_rate: already sorted by upstream

  const total = callers.length;
  const page_callers = callers.slice(offset, offset + limit).map((c, i) => ({
    ...c,
    rank: offset + i + 1,
  }));

  return okResponse(
    page_callers,
    { total, limit, offset, page: computePage(offset, limit) },
    auth.rateLimitHeaders,
  );
}
