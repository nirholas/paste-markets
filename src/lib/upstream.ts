/**
 * Resilient paste.trade API client with automatic fallbacks.
 *
 * paste.trade exposes multiple endpoint families:
 *   /api/leaderboard  — pre-computed rankings
 *   /api/trades       — live trade list
 *   /api/feed         — curated feed with sort=new|top
 *   /api/prices       — live prices by trade ID
 *   /api/stats        — platform-wide stats
 *   /api/search       — always exists (confirmed, auth required)
 *
 * When the primary endpoints are unavailable we fall back to /api/search
 * and compute the same data in-memory.
 */

import {
  fetchPasteTradeFeed,
  fetchPasteTradeLeaderboard,
  fetchPasteTradeStats,
  fetchPasteTradePrices,
  searchFullTrades,
  type FeedResult,
  type LeaderboardAuthor,
  type PlatformStats,
  type PriceData,
  type PasteTradeFullTrade,
} from "@/lib/paste-trade";
import { computeMetrics, type AuthorMetrics, type TradeSummary } from "@/lib/metrics";

const BASE = "https://paste.trade";

// ── Shared types ─────────────────────────────────────────────────────────────

export interface RawLeaderboardAuthor {
  rank: number;
  author: {
    handle: string;
    name: string | null;
    avatar_url: string;
    platform: string;
  };
  stats: {
    trade_count: number;
    avg_pnl: number;
    win_rate: number;
    best_pnl: number;
    best_ticker: string;
    total_pnl: number;
  };
}

export interface LeaderboardData {
  window: string;
  sort: string;
  computed_at: string;
  authors: RawLeaderboardAuthor[];
}

export interface RawTrade {
  id?: string | null;
  trade_id?: string | null;
  ticker?: string | null;
  direction?: string | null;
  platform?: string | null;
  instrument?: string | null;
  author_handle?: string | null;
  author_avatar_url?: string | null;
  headline_quote?: string | null;
  thesis?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  created_at?: string | null;
  posted_at?: string | null;
  entry_price?: number | null;
  current_price?: number | null;
  pnl_pct?: number | null;
  pnlPct?: number | null;
  win_rate?: number | null;
  market_question?: string | null;
  logo_url?: string | null;
  wager_count?: number | null;
  wager_total?: number | null;
  integrity?: string | null;
}

export interface TradesData {
  items: RawTrade[];
  next_cursor: string | null;
  total: number;
}

// Re-export types from paste-trade for convenience
export type { FeedResult, LeaderboardAuthor, PlatformStats, PriceData };

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, Accept: "application/json" };
}

function extractItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body != null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj["items"])) return obj["items"] as Record<string, unknown>[];
    if (Array.isArray(obj["trades"])) return obj["trades"] as Record<string, unknown>[];
    if (Array.isArray(obj["data"])) return obj["data"] as Record<string, unknown>[];
  }
  return [];
}

// ── Leaderboard (with /api/search fallback) ──────────────────────────────────

/**
 * Build a leaderboard-shaped response from /api/search global results.
 * Groups trades by author_handle and computes win_rate, avg_pnl, etc.
 */
async function leaderboardFromSearch(
  key: string,
  window: string,
  sortBy: string,
  limit: number,
): Promise<LeaderboardData> {
  const top = window === "7d" ? "7d" : window === "all" ? "all" : "30d";
  const url = new URL("/api/search", BASE);
  url.searchParams.set("top", top);
  url.searchParams.set("limit", "200");

  const res = await fetch(url.toString(), {
    headers: authHeaders(key),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    return { window, sort: sortBy, computed_at: new Date().toISOString(), authors: [] };
  }

  const body = await res.json();
  const trades = extractItems(body);

  // Group by author
  const byAuthor = new Map<string, {
    handle: string;
    avatar_url: string;
    platform: string;
    trades: Array<{ pnl: number; ticker: string }>;
  }>();

  for (const t of trades) {
    const handle = t["author_handle"];
    if (!handle || typeof handle !== "string") continue;

    const pnlRaw = t["pnl_pct"] ?? t["pnlPct"] ?? t["pnl"];
    const pnl = pnlRaw != null ? Number(pnlRaw) : NaN;
    if (isNaN(pnl)) continue;

    const ticker = String(t["ticker"] ?? "");
    const avatar = String(t["author_avatar_url"] ?? "");
    const platform = String(t["platform"] ?? "");

    const entry = byAuthor.get(handle) ?? { handle, avatar_url: avatar, platform, trades: [] };
    entry.trades.push({ pnl, ticker });
    if (!entry.avatar_url && avatar) entry.avatar_url = avatar;
    byAuthor.set(handle, entry);
  }

  const authors: RawLeaderboardAuthor[] = [];

  for (const [handle, data] of byAuthor) {
    if (data.trades.length < 2) continue;

    const pnls = data.trades.map((t) => t.pnl);
    const wins = pnls.filter((p) => p > 0).length;
    const win_rate = (wins / pnls.length) * 100;
    const avg_pnl = pnls.reduce((s, p) => s + p, 0) / pnls.length;
    const total_pnl = pnls.reduce((s, p) => s + p, 0);
    const best = data.trades.reduce((best, t) => (t.pnl > best.pnl ? t : best), data.trades[0]!);

    authors.push({
      rank: 0,
      author: { handle, name: null, avatar_url: data.avatar_url, platform: data.platform },
      stats: {
        trade_count: data.trades.length,
        avg_pnl: parseFloat(avg_pnl.toFixed(2)),
        win_rate: parseFloat(win_rate.toFixed(1)),
        best_pnl: best!.pnl,
        best_ticker: best!.ticker,
        total_pnl: parseFloat(total_pnl.toFixed(2)),
      },
    });
  }

  // Sort
  if (sortBy === "avg_pnl") {
    authors.sort((a, b) => b.stats.avg_pnl - a.stats.avg_pnl);
  } else if (sortBy === "total_trades") {
    authors.sort((a, b) => b.stats.trade_count - a.stats.trade_count);
  } else {
    authors.sort((a, b) => b.stats.win_rate - a.stats.win_rate);
  }

  authors.forEach((a, i) => { a.rank = i + 1; });

  return {
    window,
    sort: sortBy,
    computed_at: new Date().toISOString(),
    authors: authors.slice(0, limit),
  };
}

/**
 * Fetch leaderboard. Tries paste.trade /api/leaderboard (public) first,
 * then authenticated /api/leaderboard, then falls back to /api/search.
 */
export async function fetchLeaderboard(
  window = "30d",
  sort = "win_rate",
  limit = 100,
): Promise<LeaderboardData> {
  const key = process.env["PASTE_TRADE_KEY"];

  // Primary: use the public paste.trade leaderboard endpoint
  try {
    const result = await fetchPasteTradeLeaderboard(window, sort, limit);
    if (result.authors.length > 0) {
      // Map to our RawLeaderboardAuthor shape (compatible)
      return {
        window: result.window,
        sort: result.sort,
        computed_at: result.computed_at,
        authors: result.authors as unknown as RawLeaderboardAuthor[],
      };
    }
  } catch {
    // fall through
  }

  if (!key) {
    return { window, sort, computed_at: new Date().toISOString(), authors: [] };
  }

  // Fallback: authenticated /api/leaderboard
  try {
    const url = new URL("/api/leaderboard", BASE);
    url.searchParams.set("window", window);
    url.searchParams.set("sort", sort);
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      headers: authHeaders(key),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const body = await res.json() as {
        window?: string;
        sort?: string;
        computed_at?: string;
        authors?: RawLeaderboardAuthor[];
      };
      if (Array.isArray(body.authors) && body.authors.length > 0) {
        return {
          window: body.window ?? window,
          sort: body.sort ?? sort,
          computed_at: body.computed_at ?? new Date().toISOString(),
          authors: body.authors,
        };
      }
    }
  } catch {
    // fall through
  }

  // Last resort: build from /api/search
  console.log("[upstream] /api/leaderboard unavailable — falling back to /api/search");
  return leaderboardFromSearch(key, window, sort, limit);
}

// ── Trades feed (with /api/search fallback) ───────────────────────────────────

/**
 * Fetch live trades. Tries /api/feed?sort=new, then /api/trades, then /api/search.
 */
export async function fetchTrades(
  limit = 100,
  cursor?: string,
  platform?: string,
  ticker?: string,
): Promise<TradesData> {
  const key = process.env["PASTE_TRADE_KEY"];

  // Primary: use paste.trade /api/feed?sort=new (public, no auth)
  if (!ticker) {
    try {
      const feedResult = await fetchPasteTradeFeed({
        sort: "new",
        limit,
        platform: platform as "polymarket" | "hyperliquid" | "robinhood" | undefined,
        cursor,
      });
      if (feedResult.items.length > 0) {
        const items: RawTrade[] = feedResult.items.flatMap((feedItem) =>
          feedItem.trades.map((t: Record<string, unknown>) => ({
            id: String(t["id"] ?? t["trade_id"] ?? ""),
            trade_id: t["trade_id"] != null ? String(t["trade_id"]) : null,
            ticker: t["ticker"] != null ? String(t["ticker"]) : null,
            direction: t["direction"] != null ? String(t["direction"]) : null,
            platform: t["platform"] != null ? String(t["platform"]) : null,
            instrument: t["instrument"] != null ? String(t["instrument"]) : null,
            author_handle: feedItem.author?.["handle"] != null ? String(feedItem.author["handle"]) : null,
            author_avatar_url: feedItem.author?.["avatar_url"] != null ? String(feedItem.author["avatar_url"]) : null,
            headline_quote: t["headline_quote"] != null ? String(t["headline_quote"]) : null,
            thesis: t["thesis"] != null ? String(t["thesis"]) : null,
            source_id: feedItem.source?.["id"] != null ? String(feedItem.source["id"]) : null,
            source_url: feedItem.source?.["url"] != null ? String(feedItem.source["url"]) : null,
            created_at: t["created_at"] != null ? String(t["created_at"]) : null,
            posted_at: t["posted_at"] != null ? String(t["posted_at"]) : null,
            entry_price: t["entry_price"] != null ? Number(t["entry_price"]) : null,
            current_price: feedResult.prices?.[String(t["trade_id"] ?? t["id"])]?.price ?? (t["current_price"] != null ? Number(t["current_price"]) : null),
            pnl_pct: feedResult.pnls?.[String(t["trade_id"] ?? t["id"])] ?? (t["pnl_pct"] != null ? Number(t["pnl_pct"]) : null),
            logo_url: t["logo_url"] != null ? String(t["logo_url"]) : null,
            win_rate: null,
            market_question: t["market_question"] != null ? String(t["market_question"]) : null,
            wager_count: 0,
            wager_total: 0,
            integrity: null,
          })),
        );
        return {
          items,
          next_cursor: feedResult.next_cursor,
          total: feedResult.total,
        };
      }
    } catch {
      // fall through
    }
  }

  if (!key) return { items: [], next_cursor: null, total: 0 };

  // Secondary: /api/trades (may need auth)
  try {
    const url = new URL("/api/trades", BASE);
    url.searchParams.set("limit", String(limit));
    if (cursor) url.searchParams.set("cursor", cursor);
    if (platform) url.searchParams.set("platform", platform);
    if (ticker) url.searchParams.set("ticker", ticker);

    const res = await fetch(url.toString(), {
      headers: authHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const body = await res.json() as {
        items?: RawTrade[];
        next_cursor?: string | null;
        total?: number;
      };
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length > 0) {
        return {
          items,
          next_cursor: body.next_cursor ?? null,
          total: typeof body.total === "number" ? body.total : items.length,
        };
      }
    }
  } catch {
    // fall through
  }

  // Last resort: /api/search
  console.log("[upstream] /api/trades unavailable — falling back to /api/search");

  try {
    const url = new URL("/api/search", BASE);
    url.searchParams.set("top", "30d");
    url.searchParams.set("limit", String(Math.min(limit, 200)));
    if (ticker) url.searchParams.set("ticker", ticker);

    const res = await fetch(url.toString(), {
      headers: authHeaders(key),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return { items: [], next_cursor: null, total: 0 };

    const body = await res.json();
    const raw = extractItems(body) as RawTrade[];

    const filtered = platform
      ? raw.filter((t) => t.platform?.toLowerCase() === platform.toLowerCase())
      : raw;

    const items: RawTrade[] = filtered.map((t) => ({
      id: String(t["id"] ?? t["trade_id"] ?? Math.random()),
      ticker: t.ticker ?? null,
      direction: t.direction ?? null,
      platform: t.platform ?? null,
      instrument: null,
      author_handle: t.author_handle ?? null,
      author_avatar_url: t.author_avatar_url ?? null,
      headline_quote: null,
      thesis: null,
      source_url: t.source_url ?? null,
      created_at: t.posted_at ?? t.created_at ?? new Date().toISOString(),
      posted_at: t.posted_at ?? null,
      entry_price: t.entry_price ?? null,
      current_price: t.current_price ?? null,
      pnl_pct: t.pnlPct ?? t.pnl_pct ?? null,
      win_rate: null,
      market_question: null,
      wager_count: 0,
      wager_total: 0,
      integrity: null,
    }));

    return { items, next_cursor: null, total: items.length };
  } catch {
    return { items: [], next_cursor: null, total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Feed — direct access to paste.trade /api/feed (hot/top sorting)
// ---------------------------------------------------------------------------

export async function fetchFeed(
  sort: "new" | "top" = "new",
  limit = 20,
  window?: "24h" | "7d" | "30d" | "all",
  cursor?: string,
  platform?: "polymarket" | "hyperliquid" | "robinhood",
): Promise<FeedResult> {
  return fetchPasteTradeFeed({ sort, limit, window, cursor, platform });
}

// ---------------------------------------------------------------------------
// Stats — direct access to paste.trade /api/stats
// ---------------------------------------------------------------------------

export async function fetchStats(): Promise<PlatformStats | null> {
  return fetchPasteTradeStats();
}

// ---------------------------------------------------------------------------
// Prices — live prices by trade IDs
// ---------------------------------------------------------------------------

export async function fetchPrices(
  tradeIds: string[],
): Promise<Record<string, PriceData>> {
  return fetchPasteTradePrices(tradeIds);
}

// ---------------------------------------------------------------------------
// Author profile — fetch directly from paste.trade, no local DB needed
// ---------------------------------------------------------------------------

function apiTradeToSummary(t: PasteTradeFullTrade): TradeSummary {
  return {
    ticker: t.ticker,
    direction: t.direction,
    pnl_pct: t.pnlPct ?? 0,
    platform: t.platform,
    entry_date: t.author_date,
    posted_at: t.posted_at,
    source_url: t.source_url,
  };
}

export interface UpstreamAuthorProfile {
  handle: string;
  metrics: AuthorMetrics;
  rank: number | null;
  avatarUrl: string | null;
  trades: PasteTradeFullTrade[];
}

/**
 * Fetch an author's profile directly from paste.trade public endpoints.
 * Uses /api/feed (public, no auth) + /api/prices to compute live P&L.
 * Falls back to /api/search (auth required) if feed returns nothing.
 * Returns null if the author has no trades on paste.trade.
 */
export async function fetchAuthorProfile(
  handle: string,
): Promise<UpstreamAuthorProfile | null> {
  // Primary: use public /api/feed?author=X (no auth required)
  // Fetch both new (recent) and top (best P&L, all time) for a complete picture
  let authorTrades: PasteTradeFullTrade[] = [];
  let avatarUrl: string | null = null;

  try {
    const [newFeed, topFeed] = await Promise.all([
      fetchPasteTradeFeed({ sort: "new", limit: 100, author: handle }),
      fetchPasteTradeFeed({ sort: "top", limit: 100, window: "all", author: handle }),
    ]);

    // Merge prices from both feeds and pnls from top feed
    const prices: Record<string, { price: number; timestamp: number }> = {
      ...newFeed.prices,
      ...topFeed.prices,
    };
    const sourcePnls = topFeed.pnls ?? {};

    // Merge items, dedup by trade ID
    const seenIds = new Set<string>();
    const allItems = [...newFeed.items, ...topFeed.items];
    const rawTrades: Array<{ trade: Record<string, unknown>; authorHandle: string; authorAvatar: string; sourceId: string }> = [];

    for (const item of allItems) {
      const itemAuthor = String(item.author?.["handle"] ?? "");
      const itemAvatar = String(item.author?.["avatar_url"] ?? "");
      const sourceId = String(item.source?.["id"] ?? "");

      for (const t of item.trades) {
        const tObj = t as Record<string, unknown>;
        const id = String(tObj["id"] ?? "");
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        rawTrades.push({ trade: tObj, authorHandle: itemAuthor, authorAvatar: itemAvatar, sourceId });
      }
    }

    if (rawTrades.length > 0) {
      for (const { trade: t, authorHandle, authorAvatar, sourceId } of rawTrades) {
        const id = String(t["id"] ?? "");
        const entryPrice = Number(t["author_price"] ?? t["posted_price"] ?? 0);
        const priceEntry = prices[id];
        const currentPrice = priceEntry?.price ?? null;
        const direction = String(t["direction"] ?? "long") as "long" | "short" | "yes" | "no";

        // Use source-level P&L from top feed if available, otherwise compute from prices
        let pnlPct: number | undefined;
        if (sourcePnls[sourceId] != null) {
          // Source-level P&L — use for single-trade sources, compute for multi-trade
          const sourceTradeCount = rawTrades.filter((r) => r.sourceId === sourceId).length;
          if (sourceTradeCount === 1) {
            pnlPct = sourcePnls[sourceId];
          }
        }
        if (pnlPct == null && currentPrice != null && entryPrice > 0) {
          const raw = ((currentPrice - entryPrice) / entryPrice) * 100;
          pnlPct = direction === "short" || direction === "no" ? -raw : raw;
        }

        const avatarRaw = authorAvatar || null;
        if (!avatarUrl && avatarRaw) {
          avatarUrl = avatarRaw.startsWith("/") ? `${BASE}${avatarRaw}` : avatarRaw;
        }

        authorTrades.push({
          ticker: String(t["ticker"] ?? ""),
          direction,
          platform: t["platform"] != null ? String(t["platform"]) : undefined,
          pnlPct: pnlPct != null ? parseFloat(pnlPct.toFixed(2)) : undefined,
          entryPrice: entryPrice > 0 ? entryPrice : undefined,
          currentPrice: currentPrice ?? undefined,
          posted_at: String(t["created_at"] ?? new Date().toISOString()),
          source_url: undefined,
          author_handle: authorHandle || handle,
          trade_id: id || undefined,
          thesis: t["thesis_card"] != null ? String(t["thesis_card"]) : undefined,
          headline_quote: t["headline_quote"] != null ? String(t["headline_quote"]) : undefined,
          ticker_context: t["ticker_context"] != null ? String(t["ticker_context"]) : undefined,
          chain_steps: Array.isArray(t["chain_steps"]) ? (t["chain_steps"] as string[]) : undefined,
          market_question: t["market_question"] != null ? String(t["market_question"]) : undefined,
          author_avatar_url: avatarRaw ?? undefined,
        });
      }
    }
  } catch (err) {
    console.error(`[upstream] Feed fetch failed for ${handle}:`, err);
  }

  console.log(`[upstream] Feed path for @${handle}: ${authorTrades.length} trades from /api/feed`);

  // Fallback: /api/search (auth required) if feed returned nothing
  if (authorTrades.length === 0) {
    try {
      const allTrades = await searchFullTrades({ author: handle, top: "all", limit: 100 });
      console.log(`[upstream] Search fallback for @${handle}: ${allTrades.length} raw, filtering by handle`);
      authorTrades = allTrades.filter(
        (t) => t.author_handle?.toLowerCase() === handle.toLowerCase(),
      );
      console.log(`[upstream] After handle filter: ${authorTrades.length} trades for @${handle}`);


      for (const t of authorTrades) {
        if (t.author_avatar_url && !avatarUrl) {
          const raw = t.author_avatar_url;
          avatarUrl = raw.startsWith("/") ? `${BASE}${raw}` : raw;
          break;
        }
      }
    } catch (err) {
      console.error(`[upstream] search fallback also failed for ${handle}:`, err);
    }
  }

  if (authorTrades.length === 0) {
    console.warn(`[upstream] No trades found for @${handle} from any source`);
    return null;
  }

  const summaries = authorTrades.map(apiTradeToSummary);
  const metrics = computeMetrics(handle, summaries);

  // Try to find rank from leaderboard
  let rank: number | null = null;
  try {
    const lb = await fetchPasteTradeLeaderboard("30d", "avg_pnl", 200);
    const entry = lb.authors.find(
      (a) => a.author.handle.toLowerCase() === handle.toLowerCase(),
    );
    if (entry) rank = entry.rank;
  } catch {
    // rank is optional
  }

  return { handle, metrics, rank, avatarUrl, trades: authorTrades };
}
