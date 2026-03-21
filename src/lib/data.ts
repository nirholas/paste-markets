/**
 * Unified data access layer.
 *
 * When USE_SQLITE=true (or on Railway with persistent disk), uses better-sqlite3.
 * When USE_SQLITE=false (or on Vercel serverless), fetches from paste.trade
 * directly and computes metrics in-memory with Next.js caching.
 *
 * All consumers import from "@/lib/data" instead of "@/lib/db" or "@/lib/sync".
 */

import { getAuthorTrades as fetchFromApi, searchPasteTrade } from "./paste-trade";
import { computeMetrics, type AuthorMetrics, type TradeSummary } from "./metrics";
import { classifyIntegrity } from "./integrity";
import type { RepTradeInput } from "./reputation";

export type { RepTradeInput };

const useSqlite = process.env["USE_SQLITE"] !== "false";

// ---------- Types shared across both modes ----------

export type { AuthorMetrics, TradeSummary };

export interface Author {
  handle: string;
  display_name: string | null;
  added_at: string;
  last_fetched: string | null;
  total_trades: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  avg_pnl: number;
  best_pnl: number | null;
  worst_pnl: number | null;
  best_ticker: string | null;
  worst_ticker: string | null;
  rank: number | null;
}

export interface LeaderboardEntry {
  handle: string;
  rank: number;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
}

// ---------- In-memory mode (Vercel) ----------

// Simple in-memory cache with TTL
const memCache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs = 60 * 60 * 1000): void {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

async function fetchMetricsDirect(handle: string): Promise<AuthorMetrics | null> {
  const cached = getCached<AuthorMetrics>(`metrics:${handle}`);
  if (cached) return cached;

  const trades = await fetchFromApi(handle, "90d");
  if (trades.length === 0) return null;

  const tradeSummaries: TradeSummary[] = trades.map((t) => ({
    ticker: t.ticker,
    direction: t.direction,
    pnl_pct: t.pnlPct ?? 0,
    platform: t.platform,
    entry_date: t.author_date,
    posted_at: t.posted_at,
  }));

  const metrics = computeMetrics(handle, tradeSummaries);
  setCache(`metrics:${handle}`, metrics);
  return metrics;
}

function authorFromMetrics(handle: string, metrics: AuthorMetrics | null): Author {
  return {
    handle,
    display_name: null,
    added_at: new Date().toISOString(),
    last_fetched: new Date().toISOString(),
    total_trades: metrics?.totalTrades ?? 0,
    win_count: metrics?.winCount ?? 0,
    loss_count: metrics?.lossCount ?? 0,
    win_rate: metrics?.winRate ?? 0,
    avg_pnl: metrics?.avgPnl ?? 0,
    best_pnl: metrics?.bestTrade?.pnl ?? null,
    worst_pnl: metrics?.worstTrade?.pnl ?? null,
    best_ticker: metrics?.bestTrade?.ticker ?? null,
    worst_ticker: metrics?.worstTrade?.ticker ?? null,
    rank: null,
  };
}

// ---------- Exported functions ----------

export function isStale(lastFetched: string | null, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!lastFetched) return true;
  return Date.now() - new Date(lastFetched).getTime() > maxAgeMs;
}

export async function getOrCreateAuthor(handle: string): Promise<Author> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getOrCreateAuthor(handle);
  }
  const metrics = await fetchMetricsDirect(handle);
  return authorFromMetrics(handle, metrics);
}

export async function getAuthorMetrics(handle: string): Promise<AuthorMetrics | null> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getAuthorMetrics(handle);
  }
  return fetchMetricsDirect(handle);
}

export async function syncAuthor(handle: string): Promise<AuthorMetrics> {
  if (useSqlite) {
    const sync = await import("./sync");
    return sync.syncAuthor(handle);
  }
  // In serverless mode, just fetch fresh data
  const trades = await fetchFromApi(handle, "90d");
  const tradeSummaries: TradeSummary[] = trades.map((t) => ({
    ticker: t.ticker,
    direction: t.direction,
    pnl_pct: t.pnlPct ?? 0,
    platform: t.platform,
    entry_date: t.author_date,
    posted_at: t.posted_at,
  }));
  const metrics = computeMetrics(handle, tradeSummaries);
  setCache(`metrics:${handle}`, metrics);
  return metrics;
}

export async function getLeaderboard(
  timeframe?: string,
  limit?: number,
  offset?: number,
  platform?: string,
): Promise<LeaderboardEntry[]> {
  if (useSqlite) {
    const db = await import("./db");
    const entries = await db.getLeaderboard(timeframe, limit, offset);
    if (!platform || platform === "all") return entries;
    // Platform filter in SQLite mode: re-fetch trades per author and filter
    return filterLeaderboardByPlatform(entries, timeframe ?? "30d", platform);
  }

  // Serverless: build leaderboard from global feed
  const tf = (["7d", "30d", "90d", "all"].includes(timeframe ?? "30d")
    ? timeframe ?? "30d"
    : "30d") as "7d" | "30d" | "90d" | "all";
  const plat = platform ?? "all";
  const cacheKey = `leaderboard:${tf}:${plat}`;

  const cached = getCached<LeaderboardEntry[]>(cacheKey);
  if (cached) {
    return cached.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50));
  }

  // Fetch global feed (no author filter) — paste.trade returns author_handle on each trade
  const globalTrades = await searchPasteTrade({ top: tf, limit: 200 });

  let entries: LeaderboardEntry[] = [];

  if (globalTrades.length > 0 && globalTrades.some((t) => t.author_handle)) {
    // Group by author_handle
    const byAuthor = new Map<string, typeof globalTrades>();
    for (const trade of globalTrades) {
      if (!trade.author_handle) continue;
      const existing = byAuthor.get(trade.author_handle) ?? [];
      existing.push(trade);
      byAuthor.set(trade.author_handle, existing);
    }
    entries = buildLeaderboardEntries(byAuthor, plat);
  } else {
    // Global feed doesn't include author_handle — fall back to known handles
    const { seedFromApi } = await import("./seed-from-api");
    await seedFromApi();
    // After seeding, try cache again
    const warmed = getCached<LeaderboardEntry[]>(cacheKey);
    if (warmed) return warmed.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50));
  }

  setCache(cacheKey, entries, 10 * 60 * 1000);
  return entries.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50));
}

function buildLeaderboardEntries(
  byAuthor: Map<string, Array<{ ticker: string; direction: string; pnlPct?: number; platform?: string; author_date?: string; posted_at: string }>>,
  platform: string,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  for (const [handle, trades] of byAuthor.entries()) {
    const filtered =
      platform !== "all"
        ? trades.filter((t) => t.platform?.toLowerCase() === platform.toLowerCase())
        : trades;

    if (filtered.length < 2) continue;

    const summaries: TradeSummary[] = filtered.map((t) => ({
      ticker: t.ticker,
      direction: t.direction,
      pnl_pct: t.pnlPct ?? 0,
      platform: t.platform,
      entry_date: t.author_date,
      posted_at: t.posted_at,
    }));

    const metrics = computeMetrics(handle, summaries);
    entries.push({
      handle,
      rank: 0,
      win_rate: metrics.winRate,
      avg_pnl: metrics.avgPnl,
      total_trades: metrics.totalTrades,
    });
  }

  entries.sort((a, b) => b.win_rate - a.win_rate);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

async function filterLeaderboardByPlatform(
  entries: LeaderboardEntry[],
  timeframe: string,
  platform: string,
): Promise<LeaderboardEntry[]> {
  const tf = (["7d", "30d", "90d", "all"].includes(timeframe)
    ? timeframe : "30d") as "7d" | "30d" | "90d" | "all";

  const results = await Promise.allSettled(
    entries.map(async (e) => {
      const trades = await fetchFromApi(e.handle, tf);
      const filtered = trades.filter(
        (t) => t.platform?.toLowerCase() === platform.toLowerCase(),
      );
      if (filtered.length < 2) return null;
      const summaries: TradeSummary[] = filtered.map((t) => ({
        ticker: t.ticker,
        direction: t.direction,
        pnl_pct: t.pnlPct ?? 0,
        platform: t.platform,
        entry_date: t.author_date,
        posted_at: t.posted_at,
      }));
      const metrics = computeMetrics(e.handle, summaries);
      return {
        handle: e.handle,
        rank: 0,
        win_rate: metrics.winRate,
        avg_pnl: metrics.avgPnl,
        total_trades: metrics.totalTrades,
      } as LeaderboardEntry;
    }),
  );

  const filtered = results
    .filter((r): r is PromiseFulfilledResult<LeaderboardEntry> =>
      r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);

  filtered.sort((a, b) => b.win_rate - a.win_rate);
  filtered.forEach((e, i) => { e.rank = i + 1; });
  return filtered;
}

export async function updateRankings(timeframe?: string): Promise<void> {
  if (useSqlite) {
    const db = await import("./db");
    db.updateRankings(timeframe);
  }
  // No-op in serverless mode
}

export async function recordView(handle: string, page: string): Promise<void> {
  if (useSqlite) {
    const db = await import("./db");
    db.recordView(handle, page);
  }
  // No-op in serverless mode
}

export async function getTrending(): Promise<string[]> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getTrending();
  }
  return [];
}

export async function getAuthorRecord(handle: string): Promise<Author | undefined> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getAuthorRecord(handle);
  }
  const metrics = await fetchMetricsDirect(handle);
  if (!metrics) return undefined;
  return authorFromMetrics(handle, metrics);
}

export async function searchAuthors(
  query: string,
  limit?: number,
): Promise<Array<{ handle: string; totalTrades: number; winRate: number }>> {
  if (useSqlite) {
    const db = await import("./db");
    return db.searchAuthors(query, limit);
  }
  // In serverless mode, we can't search locally — return empty
  return [];
}

export interface AssetSummary {
  ticker: string;
  callCount: number;
  avgPnl: number | null;
  bullCount: number;
  bearCount: number;
  lastCallAt: string | null;
}

export interface AssetTickerTrade {
  handle: string;
  direction: string;
  pnlPct: number | null;
  platform: string | null;
  entryDate: string | null;
  postedAt: string | null;
  sourceUrl: string | null;
  authorWinRate: number;
  authorAvgPnl: number;
  authorTotalTrades: number;
}

export async function getAssets(): Promise<AssetSummary[]> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getAllTickers().map((t) => ({
      ticker: t.ticker,
      callCount: t.call_count,
      avgPnl: t.avg_pnl,
      bullCount: t.bull_count,
      bearCount: t.bear_count,
      lastCallAt: t.last_call_at,
    }));
  }

  // Serverless: group global feed by ticker
  const trades = await searchPasteTrade({ top: "all", limit: 200 });
  const byTicker = new Map<string, typeof trades>();
  for (const trade of trades) {
    if (!trade.ticker) continue;
    const existing = byTicker.get(trade.ticker) ?? [];
    existing.push(trade);
    byTicker.set(trade.ticker, existing);
  }

  return Array.from(byTicker.entries())
    .map(([ticker, list]) => {
      const pnlList = list.filter((t) => t.pnlPct != null);
      const avgPnl =
        pnlList.length > 0
          ? pnlList.reduce((s, t) => s + (t.pnlPct ?? 0), 0) / pnlList.length
          : null;
      const bullCount = list.filter(
        (t) => t.direction === "long" || t.direction === "yes",
      ).length;
      const bearCount = list.filter(
        (t) => t.direction === "short" || t.direction === "no",
      ).length;
      const lastCallAt = list.reduce<string | null>(
        (latest, t) => (!latest || t.posted_at > latest ? t.posted_at : latest),
        null,
      );
      return {
        ticker,
        callCount: list.length,
        avgPnl,
        bullCount,
        bearCount,
        lastCallAt,
      };
    })
    .sort((a, b) => b.callCount - a.callCount);
}

export async function getAssetTrades(ticker: string): Promise<AssetTickerTrade[]> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getTickerTrades(ticker).map((t) => ({
      handle: t.author_handle,
      direction: t.direction,
      pnlPct: t.pnl_pct,
      platform: t.platform,
      entryDate: t.entry_date,
      postedAt: t.posted_at,
      sourceUrl: t.source_url,
      authorWinRate: t.author_win_rate,
      authorAvgPnl: t.author_avg_pnl,
      authorTotalTrades: t.author_total_trades,
    }));
  }

  // Serverless: search paste.trade by ticker
  const trades = await searchPasteTrade({ ticker, top: "all", limit: 100 });
  return trades.map((t) => ({
    handle: t.author_handle ?? "unknown",
    direction: t.direction,
    pnlPct: t.pnlPct ?? null,
    platform: t.platform ?? null,
    entryDate: t.author_date ?? null,
    postedAt: t.posted_at,
    sourceUrl: t.source_url ?? null,
    authorWinRate: 0,
    authorAvgPnl: 0,
    authorTotalTrades: 0,
  }));
}

export async function getHeadToHead(
  a: string,
  b: string,
): Promise<{ a: AuthorMetrics; b: AuthorMetrics } | null> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getHeadToHead(a, b);
  }
  const [metricsA, metricsB] = await Promise.all([
    fetchMetricsDirect(a),
    fetchMetricsDirect(b),
  ]);
  if (!metricsA || !metricsB) return null;
  return { a: metricsA, b: metricsB };
}

export interface IntegrityStats {
  total: number;
  live: number;
  late: number;
  historical: number;
  retroactive: number;
  unknown: number;
  score: number;
}

export async function getIntegrityStats(handle: string): Promise<IntegrityStats | null> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getIntegrityStats(handle);
  }
  // In serverless mode we don't store integrity locally — return null
  return null;
}

/**
 * Returns raw per-trade data suitable for reputation score calculation.
 * In SQLite mode: includes pre-computed integrity class from DB.
 * In serverless mode: computes integrity from paste.trade timestamps.
 */
export async function getTradesForReputation(handle: string): Promise<RepTradeInput[]> {
  if (useSqlite) {
    const db = await import("./db");
    return db.getAuthorTrades(handle).map((t) => ({
      ticker: t.ticker,
      pnl_pct: t.pnl_pct,
      integrity: (t as { integrity?: import("./integrity").IntegrityClass }).integrity,
      author_date: t.entry_date ?? null,
      posted_at: t.posted_at ?? null,
    }));
  }

  // Serverless: fetch from paste.trade and compute integrity on the fly
  const trades = await fetchFromApi(handle, "90d");
  return trades.map((t) => {
    const { integrity } = classifyIntegrity(t.author_date ?? null, t.posted_at ?? null);
    return {
      ticker: t.ticker,
      pnl_pct: t.pnlPct ?? null,
      integrity,
      author_date: t.author_date ?? null,
      posted_at: t.posted_at ?? null,
    };
  });
}
