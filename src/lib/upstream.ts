/**
 * Resilient paste.trade API client with automatic fallbacks.
 *
 * paste.trade exposes two relevant endpoint families:
 *   /api/leaderboard  — pre-computed rankings (may not exist)
 *   /api/trades       — live trade feed (may not exist)
 *   /api/search       — always exists (confirmed)
 *
 * When the primary endpoints are unavailable we fall back to /api/search
 * and compute the same data in-memory.
 */

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
  ticker?: string | null;
  direction?: string | null;
  platform?: string | null;
  instrument?: string | null;
  author_handle?: string | null;
  author_avatar_url?: string | null;
  headline_quote?: string | null;
  thesis?: string | null;
  source_url?: string | null;
  created_at?: string | null;
  posted_at?: string | null;
  entry_price?: number | null;
  current_price?: number | null;
  pnl_pct?: number | null;
  pnlPct?: number | null;
  win_rate?: number | null;
  market_question?: string | null;
  wager_count?: number | null;
  wager_total?: number | null;
  integrity?: string | null;
}

export interface TradesData {
  items: RawTrade[];
  next_cursor: string | null;
  total: number;
}

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
    const best = data.trades.reduce((best, t) => (t.pnl > best.pnl ? t : best), data.trades[0]);

    authors.push({
      rank: 0,
      author: { handle, name: null, avatar_url: data.avatar_url, platform: data.platform },
      stats: {
        trade_count: data.trades.length,
        avg_pnl: parseFloat(avg_pnl.toFixed(2)),
        win_rate: parseFloat(win_rate.toFixed(1)),
        best_pnl: best.pnl,
        best_ticker: best.ticker,
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
 * Fetch leaderboard. Tries /api/leaderboard first, falls back to /api/search.
 */
export async function fetchLeaderboard(
  window = "30d",
  sort = "win_rate",
  limit = 100,
): Promise<LeaderboardData> {
  const key = process.env["PASTE_TRADE_KEY"];
  if (!key) {
    return { window, sort, computed_at: new Date().toISOString(), authors: [] };
  }

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

  // Fallback: build from /api/search
  console.log("[upstream] /api/leaderboard unavailable — falling back to /api/search");
  return leaderboardFromSearch(key, window, sort, limit);
}

// ── Trades feed (with /api/search fallback) ───────────────────────────────────

/**
 * Fetch live trades. Tries /api/trades first, falls back to /api/search.
 */
export async function fetchTrades(
  limit = 100,
  cursor?: string,
  platform?: string,
  ticker?: string,
): Promise<TradesData> {
  const key = process.env["PASTE_TRADE_KEY"];
  if (!key) return { items: [], next_cursor: null, total: 0 };

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

  // Fallback: use /api/search
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

    // Apply platform filter if needed
    const filtered = platform
      ? raw.filter((t) => t.platform?.toLowerCase() === platform.toLowerCase())
      : raw;

    // Normalize to RawTrade shape
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
