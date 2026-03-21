import { NextRequest, NextResponse } from "next/server";
import { classifyCategory, type CallCategory } from "@/lib/category";
import { computeAlphaScore, callerTier, type CallerTier } from "@/lib/alpha";
import { fetchLeaderboard, fetchTrades, fetchFeed as fetchUpstreamFeed } from "@/lib/upstream";

export const dynamic = "force-dynamic";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  ticker: string;
  direction: string;
  author_handle: string;
  author_avatar_url: string | null;
  headline_quote: string | null;
  thesis: string | null;
  platform: string | null;
  instrument: string | null;
  source_id: string | null;
  source_url: string | null;
  created_at: string;
  logo_url: string | null;
  // Extended fields from paste.trade when available
  entry_price: number | null;
  current_price: number | null;
  pnl_pct: number | null;
  win_rate: number | null;
  market_question: string | null;
  // Derived / enriched
  category: CallCategory;
  integrity: string | null;
  author_alpha_score: number | null;
  author_tier: CallerTier | null;
  hotness_score: number;
  // Wager fields (may be populated from wager API)
  wager_count: number;
  wager_total: number;
}

// Legacy alias — consumed by components that imported the old FeedTrade type
export type FeedTrade = FeedItem;

export interface FeedResponse {
  items: FeedItem[];
  /** Backward-compat alias for items */
  trades: FeedItem[];
  next_cursor: string | null;
  total: number;
}

// ─── In-process caches ──────────────────────────────────────────────────────

interface CallerScore {
  win_rate: number;
  avg_pnl: number;
  trade_count: number;
  alpha_score: number;
  tier: CallerTier;
}

let callerCache: { data: Map<string, CallerScore>; expiresAt: number } | null = null;
const CALLER_CACHE_TTL = 10 * 60 * 1000;

type HotCacheEntry = { data: FeedItem[]; expiresAt: number };
let hotCache: HotCacheEntry | null = null;
const HOT_CACHE_TTL = 15 * 60 * 1000;

let topCache: HotCacheEntry | null = null;
const TOP_CACHE_TTL = 5 * 60 * 1000;

// ─── Caller score fetching ─────────────────────────────────────────────────

async function fetchCallerScores(_apiKey: string): Promise<Map<string, CallerScore>> {
  if (callerCache && Date.now() < callerCache.expiresAt) return callerCache.data;

  const scores = new Map<string, CallerScore>();
  try {
    const lbData = await fetchLeaderboard("30d", "win_rate", 200);
    for (const item of lbData.authors) {
      const alpha = computeAlphaScore(
        item.stats.win_rate,
        item.stats.avg_pnl,
        item.stats.trade_count,
      );
      scores.set(item.author.handle.toLowerCase(), {
        win_rate: item.stats.win_rate,
        avg_pnl: item.stats.avg_pnl,
        trade_count: item.stats.trade_count,
        alpha_score: alpha,
        tier: callerTier(alpha),
      });
    }
  } catch {
    // Fall through with empty map
  }

  callerCache = { data: scores, expiresAt: Date.now() + CALLER_CACHE_TTL };
  return scores;
}

// ─── Hotness algorithm ─────────────────────────────────────────────────────

function computeHotness(
  createdAt: string,
  pnlPct: number | null,
  integrity: string | null,
  callerAlpha: number | null,
): number {
  const hoursSince = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  const recencyWeight = 1 / Math.pow(Math.max(0, hoursSince) + 2, 1.5);
  const pnlBoost = 1 + Math.abs(pnlPct ?? 0) / 100;
  const integrityBonus = integrity === "live" ? 1.2 : 1.0;
  const callerMult = 0.8 + (callerAlpha ?? 0) / 500;
  return recencyWeight * pnlBoost * integrityBonus * callerMult;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fixAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return `https://paste.trade${url}`;
  return url;
}

function parseOptNum(val: unknown, alt?: unknown): number | null {
  const v = val ?? alt;
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function mapRawItem(
  raw: Record<string, unknown>,
  scores: Map<string, CallerScore>,
): FeedItem {
  const platform = raw["platform"] != null ? String(raw["platform"]) : null;
  const ticker = String(raw["ticker"] ?? "");
  const thesis = raw["thesis"] != null ? String(raw["thesis"]) : null;
  const marketQuestion = raw["market_question"] != null ? String(raw["market_question"]) : null;
  const instrument = raw["instrument"] != null ? String(raw["instrument"]) : null;
  const createdAt = String(raw["created_at"] ?? raw["posted_at"] ?? new Date().toISOString());
  const pnlPct = parseOptNum(raw["pnl_pct"], raw["pnlPct"]);
  const integrity = raw["integrity"] != null ? String(raw["integrity"]) : null;

  const handle = String(raw["author_handle"] ?? "");
  const score = scores.get(handle.toLowerCase()) ?? null;

  const category = classifyCategory({ platform, ticker, thesis, market_question: marketQuestion, instrument });

  return {
    id: String(raw["id"] ?? raw["trade_id"] ?? ""),
    ticker,
    direction: String(raw["direction"] ?? ""),
    author_handle: handle,
    author_avatar_url: fixAvatarUrl(raw["author_avatar_url"] as string | null),
    headline_quote: raw["headline_quote"] != null ? String(raw["headline_quote"]) : null,
    thesis,
    platform,
    instrument,
    source_id: raw["source_id"] != null ? String(raw["source_id"]) : null,
    source_url: raw["source_url"] != null ? String(raw["source_url"]) : null,
    created_at: createdAt,
    logo_url: raw["logo_url"] != null ? String(raw["logo_url"]) : null,
    entry_price: parseOptNum(raw["entry_price"], raw["entryPrice"]),
    current_price: parseOptNum(raw["current_price"], raw["currentPrice"]),
    pnl_pct: pnlPct,
    win_rate: parseOptNum(raw["win_rate"], raw["winRate"]) ?? score?.win_rate ?? null,
    market_question: marketQuestion,
    category,
    integrity,
    author_alpha_score: score?.alpha_score ?? null,
    author_tier: score?.tier ?? null,
    hotness_score: computeHotness(createdAt, pnlPct, integrity, score?.alpha_score ?? null),
    wager_count: parseOptNum(raw["wager_count"]) ?? 0,
    wager_total: parseOptNum(raw["wager_total"]) ?? 0,
  };
}

/**
 * Flatten a paste.trade /api/feed item (nested source/author/trades shape)
 * into the flat Record shape that mapRawItem expects.
 */
function flattenFeedItem(raw: Record<string, unknown>): Record<string, unknown> {
  const author = (raw["author"] ?? {}) as Record<string, unknown>;
  const source = (raw["source"] ?? {}) as Record<string, unknown>;
  const trades = Array.isArray(raw["trades"]) ? (raw["trades"] as Record<string, unknown>[]) : [];
  const firstTrade = trades[0] ?? {};

  return {
    id: firstTrade["id"] ?? firstTrade["trade_id"] ?? source["id"] ?? raw["id"],
    trade_id: firstTrade["trade_id"] ?? firstTrade["id"],
    ticker: firstTrade["ticker"] ?? raw["ticker"],
    direction: firstTrade["direction"] ?? raw["direction"],
    platform: firstTrade["platform"] ?? raw["platform"],
    instrument: firstTrade["instrument"] ?? raw["instrument"],
    author_handle: author["handle"] ?? raw["author_handle"],
    author_avatar_url: author["avatar_url"] ?? raw["author_avatar_url"],
    headline_quote: source["headline_quote"] ?? firstTrade["headline_quote"] ?? raw["headline_quote"],
    thesis: firstTrade["thesis"] ?? raw["thesis"],
    source_id: source["id"] ?? raw["source_id"],
    source_url: source["url"] ?? raw["source_url"],
    created_at: source["created_at"] ?? firstTrade["created_at"] ?? raw["created_at"],
    posted_at: firstTrade["posted_at"] ?? source["posted_at"] ?? raw["posted_at"],
    entry_price: firstTrade["entry_price"] ?? firstTrade["entryPrice"] ?? raw["entry_price"],
    current_price: firstTrade["current_price"] ?? firstTrade["currentPrice"] ?? raw["current_price"],
    pnl_pct: firstTrade["pnl_pct"] ?? firstTrade["pnlPct"] ?? raw["pnl_pct"],
    win_rate: author["win_rate"] ?? raw["win_rate"],
    market_question: firstTrade["market_question"] ?? raw["market_question"],
    logo_url: firstTrade["logo_url"] ?? raw["logo_url"],
    integrity: firstTrade["integrity"] ?? raw["integrity"],
    wager_count: raw["wager_count"] ?? 0,
    wager_total: raw["wager_total"] ?? 0,
  };
}

async function fetchUpstream(
  _apiKey: string,
  limit: number,
  cursor?: string,
  ticker?: string,
  platform?: string,
): Promise<{ items: Record<string, unknown>[]; next_cursor: string | null; total: number }> {
  // Primary: use paste.trade's public /api/feed (no auth required, richer data)
  try {
    const feedResult = await fetchUpstreamFeed(
      "new",
      limit,
      undefined,    // window
      cursor,
      platform as "polymarket" | "hyperliquid" | "robinhood" | undefined,
    );
    if (feedResult.items.length > 0) {
      // Feed items have nested structure — flatten to our expected shape
      const items = feedResult.items.map((item) =>
        flattenFeedItem(item as unknown as Record<string, unknown>),
      );
      // Apply ticker filter client-side (feed endpoint doesn't support ticker param)
      const filtered = ticker
        ? items.filter((t) => String(t["ticker"] ?? "").toUpperCase() === ticker.toUpperCase())
        : items;
      return {
        items: filtered,
        next_cursor: feedResult.next_cursor,
        total: feedResult.total,
      };
    }
  } catch {
    // fall through to /api/trades
  }

  // Fallback: auth-required /api/trades → /api/search
  const data = await fetchTrades(limit, cursor, platform, ticker);
  return {
    items: data.items as Record<string, unknown>[],
    next_cursor: data.next_cursor,
    total: data.total,
  };
}

// ─── Filter helpers ─────────────────────────────────────────────────────────

function applyTimeframeFilter(items: FeedItem[], timeframe: string): FeedItem[] {
  if (timeframe === "today") {
    const cutoff = Date.now() - 24 * 3_600_000;
    return items.filter((t) => new Date(t.created_at).getTime() > cutoff);
  }
  if (timeframe === "week") {
    const cutoff = Date.now() - 7 * 24 * 3_600_000;
    return items.filter((t) => new Date(t.created_at).getTime() > cutoff);
  }
  return items;
}

const VALID_PLATFORMS = new Set(["hyperliquid", "polymarket", "robinhood"]);
const VALID_CATEGORIES = new Set([
  "crypto_perp", "crypto_spot", "stock",
  "sports", "politics", "macro_event", "entertainment", "prediction",
]);

// ─── GET /api/feed ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // API key used for fallback paths only; public feed endpoints work without auth
  const apiKey = process.env["PASTE_TRADE_KEY"] ?? "";

  const { searchParams } = request.nextUrl;

  // Tab
  const tab = (["hot", "new", "top"].includes(searchParams.get("tab") ?? ""))
    ? (searchParams.get("tab") as "hot" | "new" | "top")
    : "hot";

  // Filters
  const platformFilter = (searchParams.get("platform") ?? "").toLowerCase();
  const categoryFilter = searchParams.get("category") ?? "";
  const directionFilter = (searchParams.get("direction") ?? "").toLowerCase();
  const tickerFilter = (searchParams.get("ticker") ?? "").toUpperCase();
  const assetFilter = (searchParams.get("asset") ?? "").toUpperCase() || tickerFilter;
  const minScore = parseFloat(searchParams.get("minScore") ?? "0") || 0;
  const liveOnly = searchParams.get("liveOnly") === "true";
  const timeframe = searchParams.get("timeframe") ?? "all"; // for top tab: today | week | all

  // Pagination
  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const pageLimit = isNaN(rawLimit) ? 20 : Math.min(Math.max(1, rawLimit), 50);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const scores = await fetchCallerScores(apiKey);

    let enriched: FeedItem[];
    let upstreamCursor: string | null = null;
    let total = 0;

    // ── Fetch and rank by tab ───────────────────────────────────────
    if (tab === "hot") {
      if (hotCache && Date.now() < hotCache.expiresAt) {
        enriched = hotCache.data;
      } else {
        // Try paste.trade's public /api/feed first (richer data, no auth)
        let raw: { items: Record<string, unknown>[]; next_cursor: string | null; total: number };
        try {
          const feedResult = await fetchUpstreamFeed("new", 100);
          if (feedResult.items.length > 0) {
            raw = {
              items: feedResult.items.map((item) =>
                flattenFeedItem(item as unknown as Record<string, unknown>),
              ),
              next_cursor: feedResult.next_cursor,
              total: feedResult.total,
            };
          } else {
            raw = await fetchUpstream(apiKey, 100);
          }
        } catch {
          raw = await fetchUpstream(apiKey, 100);
        }
        enriched = raw.items.map((r) => mapRawItem(r as Record<string, unknown>, scores));
        enriched.sort((a, b) => b.hotness_score - a.hotness_score);
        hotCache = { data: enriched, expiresAt: Date.now() + HOT_CACHE_TTL };
      }
      total = enriched.length;

    } else if (tab === "new") {
      // Pass cursor upstream for real pagination
      const upstream = VALID_PLATFORMS.has(platformFilter)
        ? platformFilter : undefined;
      const raw = await fetchUpstream(
        apiKey, pageLimit, cursor,
        assetFilter || undefined,
        upstream,
      );
      enriched = raw.items.map((r) => mapRawItem(r as Record<string, unknown>, scores));
      upstreamCursor = raw.next_cursor;
      total = raw.total;

    } else {
      // top — sort by pnl_pct desc
      if (topCache && Date.now() < topCache.expiresAt) {
        enriched = topCache.data;
      } else {
        // Try paste.trade's /api/feed?sort=top (already sorted by P&L)
        let raw: { items: Record<string, unknown>[]; next_cursor: string | null; total: number };
        try {
          const window = timeframe === "today" ? "24h" : timeframe === "week" ? "7d" : "30d";
          const feedResult = await fetchUpstreamFeed("top", 100, window);
          if (feedResult.items.length > 0) {
            raw = {
              items: feedResult.items.map((item) =>
                flattenFeedItem(item as unknown as Record<string, unknown>),
              ),
              next_cursor: feedResult.next_cursor,
              total: feedResult.total,
            };
          } else {
            raw = await fetchUpstream(apiKey, 100);
          }
        } catch {
          raw = await fetchUpstream(apiKey, 100);
        }
        enriched = raw.items.map((r) => mapRawItem(r as Record<string, unknown>, scores));
        topCache = { data: enriched, expiresAt: Date.now() + TOP_CACHE_TTL };
      }
      enriched = applyTimeframeFilter(enriched, timeframe);
      enriched = enriched
        .filter((t) => t.pnl_pct != null)
        .sort((a, b) => (b.pnl_pct ?? 0) - (a.pnl_pct ?? 0));
      total = enriched.length;
    }

    // ── Apply filters ───────────────────────────────────────────────
    if (platformFilter && VALID_PLATFORMS.has(platformFilter)) {
      enriched = enriched.filter((t) => t.platform?.toLowerCase() === platformFilter);
    }
    if (categoryFilter && VALID_CATEGORIES.has(categoryFilter)) {
      enriched = enriched.filter((t) => t.category === categoryFilter);
    }
    if (directionFilter && directionFilter !== "all") {
      enriched = enriched.filter((t) => t.direction.toLowerCase() === directionFilter);
    }
    if (assetFilter) {
      enriched = enriched.filter((t) => t.ticker.toUpperCase() === assetFilter);
    }
    if (minScore > 0) {
      enriched = enriched.filter((t) => (t.author_alpha_score ?? 0) >= minScore);
    }
    if (liveOnly) {
      enriched = enriched.filter((t) => t.integrity === "live");
    }

    // ── Paginate ────────────────────────────────────────────────────
    let page_items: FeedItem[];
    let next_cursor: string | null;

    if (tab === "new") {
      page_items = enriched;
      next_cursor = upstreamCursor;
    } else {
      const offset = cursor ? parseInt(cursor, 10) : 0;
      page_items = enriched.slice(offset, offset + pageLimit);
      const nextOffset = offset + page_items.length;
      next_cursor = nextOffset < enriched.length ? String(nextOffset) : null;
    }

    const response: FeedResponse = {
      items: page_items,
      trades: page_items, // backward-compat
      next_cursor,
      total,
    };

    const cacheControl = tab === "hot"
      ? "s-maxage=900, stale-while-revalidate=60"
      : tab === "top"
        ? "s-maxage=300, stale-while-revalidate=60"
        : "s-maxage=30, stale-while-revalidate=15";

    return NextResponse.json(response, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (err) {
    console.error("[api/feed] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
