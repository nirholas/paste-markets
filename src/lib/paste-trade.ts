/**
 * paste.trade API client.
 * Comprehensive wrapper for all paste.trade endpoints.
 */

const BASE_URL = "https://paste.trade";

function getApiKey(): string | undefined {
  return process.env["PASTE_TRADE_KEY"];
}

function authHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, Accept: "application/json" };
}

// ── Core types ──────────────────────────────────────────────────────────────

export interface PasteTradeTrade {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform?: string;
  pnlPct?: number;
  entryPrice?: number;
  currentPrice?: number;
  author_date?: string;
  posted_at: string;
  source_url?: string;
  author_handle?: string;
}

export interface SearchParams {
  author?: string;
  ticker?: string;
  q?: string;
  top?: "24h" | "7d" | "30d" | "90d" | "all";
  direction?: "long" | "short";
  platform?: "hyperliquid" | "robinhood" | "polymarket";
  limit?: number;
  cursor?: string;
}

export interface SearchResult {
  trades: PasteTradeFullTrade[];
  total: number;
  next_cursor: string | null;
}

// ── Feed types ──────────────────────────────────────────────────────────────

export interface FeedParams {
  sort: "new" | "top";
  limit?: number;
  window?: "24h" | "7d" | "30d" | "all";
  lens?: "author" | "ticker" | "source";
  author?: string;
  platform?: "polymarket" | "hyperliquid" | "robinhood";
  direction?: "long" | "short";
  cursor?: string;
}

export interface FeedItemRaw {
  source: Record<string, unknown>;
  author: Record<string, unknown>;
  trades: Record<string, unknown>[];
  tradeCount: number;
  submitter: Record<string, unknown> | null;
}

export interface FeedResult {
  items: FeedItemRaw[];
  next_cursor: string | null;
  total: number;
  prices?: Record<string, { price: number; timestamp: number }>;
  pnls?: Record<string, number>;
}

// ── Leaderboard types ───────────────────────────────────────────────────────

export interface LeaderboardAuthor {
  rank: number;
  author: {
    id?: string;
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

export interface LeaderboardResult {
  authors: LeaderboardAuthor[];
  window: string;
  sort: string;
  computed_at: string;
}

// ── Stats types ─────────────────────────────────────────────────────────────

export interface PlatformStats {
  users: number;
  total_trades: number;
  profitable_trades: number;
}

// ── Prices types ────────────────────────────────────────────────────────────

export interface PriceData {
  price: number;
  timestamp: number;
}

// ── Source types ─────────────────────────────────────────────────────────────

export interface SourceResult {
  source_id: string;
  source_url: string;
  status: string;
  trades: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface CreateSourceParams {
  url: string;
  platform: string;
  author_handle?: string;
  author_avatar_url?: string;
  source_date?: string;
  source_images?: string[];
  body_text?: string;
}

export interface CreateSourceResult {
  source_id: string;
  source_url: string;
  status: string;
  run_id?: string;
}

// ── Trade submission types ──────────────────────────────────────────────────

export interface SubmitTradeParams {
  ticker: string;
  direction: "long" | "short";
  platform: string;
  instrument?: string;
  thesis?: string;
  source_url?: string;
  author_handle?: string;
  headline_quote?: string;
  chain_steps?: string[];
  explanation?: string;
  source_id?: string;
  author_avatar_url?: string;
  author_date?: string;
  horizon?: string;
  // Polymarket-specific
  outcome?: "yes" | "no";
  pm_side?: string;
  pm_yes_no_price?: number;
  condition_id?: string;
  market_slug?: string;
  market_question?: string;
  end_date?: string;
}

export interface SubmitTradeResult {
  id: string;
  trade_id: string;
  url: string;
  [key: string]: unknown;
}

// ── Skill types ─────────────────────────────────────────────────────────────

export interface SkillRouteParams {
  ticker: string;
  direction: "long" | "short";
  platform?: string;
}

export interface SkillRouteResult {
  [key: string]: unknown;
}

export interface SkillDiscoverParams {
  query: string;
  platforms?: string[];
}

export interface SkillDiscoverResult {
  [key: string]: unknown;
}

const KNOWN_FIELDS = new Set([
  "trade_id",
  "thesis",
  "ticker",
  "direction",
  "platform",
  "instrument",
  "pnlPct",
  "pnl_pct",
  "pnl",
  "entryPrice",
  "entry_price",
  "author_price",
  "posted_price",
  "currentPrice",
  "current_price",
  "author_date",
  "posted_at",
  "created_at",
  "source_url",
  "sourceUrl",
  "source_title",
  "source_platform",
  "author_handle",
  "author_avatar_url",
  "headline_quote",
  "ticker_context",
  "chain_steps",
  "explanation",
  "market_question",
]);

function normalizeTrade(raw: Record<string, unknown>): PasteTradeTrade {
  // Log unexpected fields for debugging
  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key)) {
      console.warn(`[paste-trade] Unknown field in response: "${key}" =`, raw[key]);
    }
  }

  const ticker = String(raw["ticker"] ?? "");
  const rawDirection = String(raw["direction"] ?? "long");
  const direction = (["long", "short", "yes", "no"].includes(rawDirection)
    ? rawDirection
    : "long") as PasteTradeTrade["direction"];

  // Handle snake_case and camelCase variants
  const pnlPct =
    raw["pnlPct"] != null
      ? Number(raw["pnlPct"])
      : raw["pnl_pct"] != null
        ? Number(raw["pnl_pct"])
        : raw["pnl"] != null
          ? Number(raw["pnl"])
          : undefined;

  const entryPrice =
    raw["entryPrice"] != null
      ? Number(raw["entryPrice"])
      : raw["entry_price"] != null
        ? Number(raw["entry_price"])
        : undefined;

  const currentPrice =
    raw["currentPrice"] != null
      ? Number(raw["currentPrice"])
      : raw["current_price"] != null
        ? Number(raw["current_price"])
        : undefined;

  const sourceUrl =
    raw["source_url"] != null
      ? String(raw["source_url"])
      : raw["sourceUrl"] != null
        ? String(raw["sourceUrl"])
        : undefined;

  return {
    ticker,
    direction,
    platform: raw["platform"] != null ? String(raw["platform"]) : undefined,
    pnlPct: pnlPct != null && !isNaN(pnlPct) ? pnlPct : undefined,
    entryPrice: entryPrice != null && !isNaN(entryPrice) ? entryPrice : undefined,
    currentPrice: currentPrice != null && !isNaN(currentPrice) ? currentPrice : undefined,
    author_date: raw["author_date"] != null ? String(raw["author_date"]) : undefined,
    posted_at: String(raw["posted_at"] ?? new Date().toISOString()),
    source_url: sourceUrl,
    author_handle: raw["author_handle"] != null ? String(raw["author_handle"]) : undefined,
  };
}

export async function searchPasteTrade(params: SearchParams): Promise<PasteTradeTrade[]> {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    console.error("[paste-trade] PASTE_TRADE_KEY not set");
    return [];
  }

  const url = new URL("/api/search", BASE_URL);
  if (params.author) url.searchParams.set("author", params.author);
  if (params.ticker) url.searchParams.set("ticker", params.ticker);
  if (params.top) url.searchParams.set("top", params.top);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[paste-trade] API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const body: unknown = await res.json();

    // Handle array, { data: [...] }, or { trades: [...] } response shapes
    let items: unknown[];
    if (Array.isArray(body)) {
      items = body;
    } else if (body != null && typeof body === "object") {
      const obj = body as Record<string, unknown>;
      if (Array.isArray(obj["trades"])) {
        items = obj["trades"] as unknown[];
      } else if (Array.isArray(obj["data"])) {
        items = obj["data"] as unknown[];
      } else {
        console.warn("[paste-trade] Unexpected response shape:", Object.keys(obj));
        return [];
      }
    } else {
      console.warn("[paste-trade] Unexpected response type:", typeof body);
      return [];
    }

    return items.map((item) => normalizeTrade(item as Record<string, unknown>));
  } catch (err) {
    console.error("[paste-trade] Fetch failed:", err);
    return [];
  }
}

export async function getAuthorTrades(
  handle: string,
  timeframe: "7d" | "30d" | "90d" | "all" = "30d",
): Promise<PasteTradeTrade[]> {
  return searchPasteTrade({
    author: handle,
    top: timeframe,
    limit: 100,
  });
}

// ---------------------------------------------------------------------------
// Full trade (includes rich fields: thesis, chain_steps, explanation, etc.)
// ---------------------------------------------------------------------------

export interface PasteTradeFullTrade extends PasteTradeTrade {
  trade_id?: string;
  thesis?: string;
  chain_steps?: string[];
  explanation?: string;
  headline_quote?: string;
  ticker_context?: string;
  market_question?: string;
  author_handle?: string;
  author_avatar_url?: string;
}

function normalizeFullTrade(raw: Record<string, unknown>): PasteTradeFullTrade {
  const base = normalizeTrade(raw);

  let chain_steps: string[] | undefined;
  if (Array.isArray(raw["chain_steps"])) {
    chain_steps = (raw["chain_steps"] as unknown[]).map((s) =>
      typeof s === "string" ? s : JSON.stringify(s),
    );
  }

  return {
    ...base,
    trade_id: raw["trade_id"] != null ? String(raw["trade_id"]) : undefined,
    thesis: raw["thesis"] != null ? String(raw["thesis"]) : undefined,
    chain_steps,
    explanation: raw["explanation"] != null ? String(raw["explanation"]) : undefined,
    headline_quote: raw["headline_quote"] != null ? String(raw["headline_quote"]) : undefined,
    ticker_context: raw["ticker_context"] != null ? String(raw["ticker_context"]) : undefined,
    market_question: raw["market_question"] != null ? String(raw["market_question"]) : undefined,
    author_handle: raw["author_handle"] != null ? String(raw["author_handle"]) : undefined,
    author_avatar_url:
      raw["author_avatar_url"] != null ? String(raw["author_avatar_url"]) : undefined,
  };
}

async function fetchRawItems(
  url: URL,
  apiKey: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) return [];

  const body: unknown = await res.json();
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body != null && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj["trades"])) return obj["trades"] as Record<string, unknown>[];
    if (Array.isArray(obj["data"])) return obj["data"] as Record<string, unknown>[];
    // Single trade object returned directly
    if (obj["trade_id"] != null || obj["ticker"] != null) return [obj];
  }
  return [];
}

export async function searchFullTrades(params: SearchParams): Promise<PasteTradeFullTrade[]> {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) return [];

  const url = new URL("/api/search", BASE_URL);
  if (params.author) url.searchParams.set("author", params.author);
  if (params.ticker) url.searchParams.set("ticker", params.ticker);
  if (params.top) url.searchParams.set("top", params.top);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  try {
    const items = await fetchRawItems(url, apiKey);
    return items.map(normalizeFullTrade);
  } catch {
    return [];
  }
}

export async function getTradeById(
  tradeId: string,
  authorHint?: string,
): Promise<PasteTradeFullTrade | null> {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) return null;

  // Fast path: if we have an author hint, search that author's trades
  if (authorHint) {
    try {
      const trades = await searchFullTrades({ author: authorHint, top: "all", limit: 100 });
      const found = trades.find((t) => t.trade_id === tradeId);
      if (found) return found;
    } catch {
      // fall through to direct lookup
    }
  }

  // Try direct lookup via trade_id query param (may or may not be supported by the API)
  try {
    const url = new URL("/api/search", BASE_URL);
    url.searchParams.set("trade_id", tradeId);
    const items = await fetchRawItems(url, apiKey);
    const found = items.map(normalizeFullTrade).find((t) => t.trade_id === tradeId);
    if (found) return found;
  } catch {
    // ignore
  }

  return null;
}
