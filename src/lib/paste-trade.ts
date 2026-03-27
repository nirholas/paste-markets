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

// ── Error class for auth-required operations ────────────────────────────────

export class PasteTradeError extends Error {
  public readonly code: "no_api_key" | "unauthorized" | "api_error" | "network_error";
  public readonly status?: number;
  public readonly detail?: string;

  constructor(
    code: PasteTradeError["code"],
    message: string,
    opts?: { status?: number; detail?: string },
  ) {
    super(message);
    this.name = "PasteTradeError";
    this.code = code;
    this.status = opts?.status;
    this.detail = opts?.detail;
  }
}

function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    throw new PasteTradeError(
      "no_api_key",
      "PASTE_TRADE_KEY is not set. Run: curl -s -X POST https://paste.trade/api/keys",
    );
  }
  return key;
}

async function parseApiError(res: Response, endpoint: string): Promise<PasteTradeError> {
  let detail: string | undefined;
  try {
    const body = await res.json() as { error?: { code?: string; message?: string }; message?: string };
    detail = body?.error?.message ?? body?.message;
  } catch { /* non-JSON body */ }
  const code = res.status === 401 || res.status === 403 ? "unauthorized" : "api_error";
  return new PasteTradeError(
    code,
    `${endpoint} failed (${res.status}): ${detail ?? res.statusText}`,
    { status: res.status, detail },
  );
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

export interface SourceThesis {
  thesis_id: string;
  thesis: string;
  route_status: string;
  who: Array<{ ticker: string; direction: string }>;
}

export interface SourceDetail {
  id: string;
  url: string;
  title: string;
  platform: string;
  author_id: string;
  published_at: string;
  user_id: string;
  created_at: string;
  summary: string;
  source_summary: string;
  status: string;
  source_theses?: SourceThesis[];
  source_images: string[] | null;
  thumbnail_url: string | null;
  engagement_views: number | null;
  engagement_likes: number | null;
  engagement_retweets: number | null;
}

export interface SourceAuthor {
  id: string;
  handle: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  platform: string;
  created_at: string;
}

export interface SourceResult {
  source: SourceDetail;
  author: SourceAuthor;
  trades: Record<string, unknown>[];
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
  tickers: string[];
  direction: "long" | "short";
  capital?: number;
}

export interface SkillRoutePnlScenario {
  move_pct: number;
  price: number;
  pnl_dollars: number;
  return_pct: number;
  note?: string;
}

export interface SkillRouteInstrument {
  form: string;
  platform: string;
  available: boolean;
  hl_status?: string;
  dex?: string;
  author_price: number;
  selection_reason: string;
  funding_direction: string;
  max_leverage: number;
  volume_24h: number;
  liquidity: string;
  asset_class: string;
  theme_tags: string[];
  instrument_description: string;
  funding_income_30d_dollars?: Record<string, number>;
  liquidation_price?: Record<string, number>;
  liquidation_move_pct?: Record<string, number>;
  from_here?: Record<string, SkillRoutePnlScenario[]>;
}

export interface SkillRouteTickerResult {
  ticker: string;
  direction: string;
  capital: number;
  current_price: number;
  sector: string | null;
  instruments: Record<string, SkillRouteInstrument>;
}

export interface SkillRouteResult {
  contract_version: string;
  results: SkillRouteTickerResult[];
}

export interface SkillDiscoverParams {
  query: string;
  platforms?: string[];
}

export interface DiscoverInstrument {
  symbol: string;
  asset_class: string;
  description: string;
  theme_tags: string[];
  reference_symbols: string[];
  search_aliases: string[];
  max_leverage: number;
  liquidity: string;
  score: number;
  match_kind: string;
}

export interface SkillDiscoverResult {
  contract_version: string;
  hyperliquid?: {
    search_results: DiscoverInstrument[];
    query: string;
    total_instruments: number;
  };
  polymarket?: {
    search_results: Record<string, unknown>[];
    query: string;
  };
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
  if (!res.ok) {
    console.warn(`[paste-trade] fetchRawItems ${url.pathname} returned ${res.status}`);
    return [];
  }

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
  if (!apiKey) {
    console.warn("[paste-trade] searchFullTrades: PASTE_TRADE_KEY not set");
    return [];
  }

  const url = new URL("/api/search", BASE_URL);
  if (params.author) url.searchParams.set("author", params.author);
  if (params.ticker) url.searchParams.set("ticker", params.ticker);
  if (params.top) url.searchParams.set("top", params.top);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  try {
    const items = await fetchRawItems(url, apiKey);
    console.log(`[paste-trade] searchFullTrades(${params.author ?? "*"}) returned ${items.length} items`);
    return items.map(normalizeFullTrade);
  } catch (err) {
    console.error(`[paste-trade] searchFullTrades failed:`, err);
    return [];
  }
}

export async function getTradeById(
  tradeId: string,
  authorHint?: string,
): Promise<PasteTradeFullTrade | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  // Fast path: direct trade lookup via /api/trades/{id}
  try {
    const res = await fetch(`${BASE_URL}/api/trades/${encodeURIComponent(tradeId)}`, {
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const raw = await res.json() as Record<string, unknown>;
      if (raw["trade_id"] || raw["ticker"]) {
        return normalizeFullTrade(raw);
      }
    }
  } catch {
    // fall through
  }

  // Fallback: search by author hint
  if (authorHint) {
    try {
      const trades = await searchFullTrades({ author: authorHint, top: "all", limit: 100 });
      const found = trades.find((t) => t.trade_id === tradeId);
      if (found) return found;
    } catch {
      // fall through
    }
  }

  // Last resort: search by trade_id param
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

// ---------------------------------------------------------------------------
// Feed — public endpoint with hot/new/top sorting
// ---------------------------------------------------------------------------

export async function fetchPasteTradeFeed(params: FeedParams): Promise<FeedResult> {
  const url = new URL("/api/feed", BASE_URL);
  url.searchParams.set("sort", params.sort);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.window) url.searchParams.set("window", params.window);
  if (params.lens) url.searchParams.set("lens", params.lens);
  if (params.author) url.searchParams.set("author", params.author);
  if (params.platform) url.searchParams.set("platform", params.platform);
  if (params.direction) url.searchParams.set("direction", params.direction);
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[paste-trade] feed ${url.search} returned ${res.status}`);
      return { items: [], next_cursor: null, total: 0 };
    }
    const result = await res.json() as FeedResult;
    console.log(`[paste-trade] feed(${params.author ?? params.sort}) returned ${result.items?.length ?? 0} items`);
    return result;
  } catch (err) {
    console.error(`[paste-trade] feed fetch failed:`, err);
    return { items: [], next_cursor: null, total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Leaderboard — public endpoint with rankings
// ---------------------------------------------------------------------------

export async function fetchPasteTradeLeaderboard(
  window = "7d",
  sort = "avg_pnl",
  limit = 20,
): Promise<LeaderboardResult> {
  const url = new URL("/api/leaderboard", BASE_URL);
  url.searchParams.set("window", window);
  url.searchParams.set("sort", sort);
  url.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { authors: [], window, sort, computed_at: new Date().toISOString() };
    }
    return await res.json() as LeaderboardResult;
  } catch {
    return { authors: [], window, sort, computed_at: new Date().toISOString() };
  }
}

// ---------------------------------------------------------------------------
// Stats — platform-wide stats (public, no auth)
// ---------------------------------------------------------------------------

export async function fetchPasteTradeStats(): Promise<PlatformStats | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/stats`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json() as PlatformStats;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prices — live prices for trade IDs (public, no auth)
// ---------------------------------------------------------------------------

export async function fetchPasteTradePrices(
  tradeIds: string[],
): Promise<Record<string, PriceData>> {
  if (tradeIds.length === 0) return {};

  const url = new URL("/api/prices", BASE_URL);
  url.searchParams.set("ids", tradeIds.join(","));

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return {};
    return await res.json() as Record<string, PriceData>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Sources — get source detail or create a source (auth required)
// ---------------------------------------------------------------------------

export async function fetchSource(sourceId: string): Promise<SourceResult | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/sources/${encodeURIComponent(sourceId)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    return await res.json() as SourceResult;
  } catch {
    return null;
  }
}

export async function createSource(params: CreateSourceParams): Promise<CreateSourceResult> {
  const apiKey = requireApiKey();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/sources`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new PasteTradeError(
      "network_error",
      `POST /api/sources failed: ${err instanceof Error ? err.message : "network error"}`,
    );
  }
  if (!res.ok) throw await parseApiError(res, "POST /api/sources");
  return await res.json() as CreateSourceResult;
}

// ---------------------------------------------------------------------------
// Trade submission (auth required)
// ---------------------------------------------------------------------------

export async function submitTrade(params: SubmitTradeParams): Promise<SubmitTradeResult> {
  const apiKey = requireApiKey();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/trades`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new PasteTradeError(
      "network_error",
      `POST /api/trades failed: ${err instanceof Error ? err.message : "network error"}`,
    );
  }
  if (!res.ok) throw await parseApiError(res, "POST /api/trades");
  return await res.json() as SubmitTradeResult;
}

// ---------------------------------------------------------------------------
// Trades list (public, no auth)
// ---------------------------------------------------------------------------

export interface TradesListParams {
  limit?: number;
  platform?: string;
  cursor?: string;
}

export interface TradesListResult {
  items: Record<string, unknown>[];
  next_cursor: string | null;
  total: number;
}

export async function fetchTradesList(params: TradesListParams = {}): Promise<TradesListResult> {
  const url = new URL("/api/trades", BASE_URL);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.platform) url.searchParams.set("platform", params.platform);
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { items: [], next_cursor: null, total: 0 };
    return await res.json() as TradesListResult;
  } catch {
    return { items: [], next_cursor: null, total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Skill: Route — validate instrument and get pricing across venues
// ---------------------------------------------------------------------------

export async function skillRoute(params: SkillRouteParams): Promise<SkillRouteResult> {
  const apiKey = requireApiKey();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/skill/route`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tickers: params.tickers,
        direction: params.direction,
        ...(params.capital != null && { capital: params.capital }),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throw new PasteTradeError(
      "network_error",
      `POST /api/skill/route failed: ${err instanceof Error ? err.message : "network error"}`,
    );
  }
  if (!res.ok) throw await parseApiError(res, "POST /api/skill/route");
  return await res.json() as SkillRouteResult;
}

// ---------------------------------------------------------------------------
// Skill: Discover — instrument discovery across venues
// ---------------------------------------------------------------------------

export async function skillDiscover(params: SkillDiscoverParams): Promise<SkillDiscoverResult> {
  const apiKey = requireApiKey();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/skill/discover`, {
      method: "POST",
      headers: {
        ...authHeaders(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throw new PasteTradeError(
      "network_error",
      `POST /api/skill/discover failed: ${err instanceof Error ? err.message : "network error"}`,
    );
  }
  if (!res.ok) throw await parseApiError(res, "POST /api/skill/discover");
  return await res.json() as SkillDiscoverResult;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function fetchHealth(): Promise<{ ok: boolean; service: string; ts: number } | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json() as { ok: boolean; service: string; ts: number };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Source events — push live processing events (auth required)
// ---------------------------------------------------------------------------

export interface SourceEventParams {
  type: string;
  data?: Record<string, unknown>;
}

export async function pushSourceEvent(
  sourceId: string,
  params: SourceEventParams,
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  try {
    const res = await fetch(
      `${BASE_URL}/api/sources/${encodeURIComponent(sourceId)}/events`,
      {
        method: "POST",
        headers: { ...authHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// API key provisioning (no auth required)
// ---------------------------------------------------------------------------

export interface ProvisionKeyResult {
  api_key: string;
  [key: string]: unknown;
}

export async function provisionApiKey(): Promise<ProvisionKeyResult | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/keys`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json() as ProvisionKeyResult;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Auth session link — browser sign-in URL (auth required)
// ---------------------------------------------------------------------------

export interface SessionLinkResult {
  url: string;
  [key: string]: unknown;
}

export async function createSessionLink(): Promise<SessionLinkResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/auth/session-link`, {
      method: "POST",
      headers: { ...authHeaders(apiKey), "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json() as SessionLinkResult;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OG share image URL helper (no fetch — just builds the URL)
// ---------------------------------------------------------------------------

export function getShareImageUrl(
  tradeId: string,
  format: "landscape" | "square" = "landscape",
): string {
  return `${BASE_URL}/api/og/share/${encodeURIComponent(tradeId)}?format=${format}`;
}

// ---------------------------------------------------------------------------
// Enhanced search with full params and pagination
// ---------------------------------------------------------------------------

export async function searchPasteTradeAdvanced(params: SearchParams): Promise<SearchResult> {
  const apiKey = getApiKey();
  if (!apiKey) return { trades: [], total: 0, next_cursor: null };

  const url = new URL("/api/search", BASE_URL);
  if (params.author) url.searchParams.set("author", params.author);
  if (params.ticker) url.searchParams.set("ticker", params.ticker);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.top) url.searchParams.set("top", params.top);
  if (params.direction) url.searchParams.set("direction", params.direction);
  if (params.platform) url.searchParams.set("platform", params.platform);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  try {
    const res = await fetch(url.toString(), {
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { trades: [], total: 0, next_cursor: null };

    const body = await res.json() as Record<string, unknown>;
    const rawItems = Array.isArray(body["trades"])
      ? (body["trades"] as Record<string, unknown>[])
      : Array.isArray(body["data"])
        ? (body["data"] as Record<string, unknown>[])
        : Array.isArray(body)
          ? (body as unknown as Record<string, unknown>[])
          : [];

    return {
      trades: rawItems.map(normalizeFullTrade),
      total: typeof body["total"] === "number" ? body["total"] : rawItems.length,
      next_cursor: typeof body["next_cursor"] === "string" ? body["next_cursor"] : null,
    };
  } catch {
    return { trades: [], total: 0, next_cursor: null };
  }
}
