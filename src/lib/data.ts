/**
 * Unified data access layer.
 *
 * All data goes through the Neon Postgres database via "@/lib/db".
 * All consumers import from "@/lib/data" instead of "@/lib/db" directly.
 */

import * as db from "./db";
import { computeMetrics, type AuthorMetrics, type TradeSummary } from "./metrics";
import { classifyIntegrity } from "./integrity";
import type { RepTradeInput } from "./reputation";

export type { RepTradeInput };
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
  // X profile data
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  followers: number | null;
  following: number | null;
  tweet_count: number | null;
  x_joined_at: string | null;
  x_profile_fetched_at: string | null;
}

export interface LeaderboardEntry {
  handle: string;
  rank: number;
  prev_rank: number | null;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
  total_pnl: number | null;
  streak: number;
}

// ---------- Exported functions ----------

export function isStale(lastFetched: string | null, maxAgeMs = 60 * 60 * 1000): boolean {
  if (!lastFetched) return true;
  return Date.now() - new Date(lastFetched).getTime() > maxAgeMs;
}

export async function getOrCreateAuthor(handle: string): Promise<Author> {
  return db.getOrCreateAuthor(handle);
}

export type { XProfileData } from "./db";

export async function updateXProfile(handle: string, profile: db.XProfileData): Promise<void> {
  return db.updateXProfile(handle, profile);
}

export function isXProfileStale(fetchedAt: string | null): boolean {
  return db.isXProfileStale(fetchedAt);
}

export async function getAuthorMetrics(handle: string): Promise<AuthorMetrics | null> {
  return db.getAuthorMetrics(handle);
}

export async function syncAuthor(handle: string): Promise<AuthorMetrics> {
  const sync = await import("./sync");
  return sync.syncAuthor(handle);
}

export async function getLeaderboard(
  timeframe?: string,
  limit?: number,
  offset?: number,
  platform?: string,
): Promise<LeaderboardEntry[]> {
  const entries = await db.getLeaderboard(timeframe, limit, offset);
  if (!platform || platform === "all") return entries;
  // Platform filter: re-fetch trades per author and filter
  return filterLeaderboardByPlatform(entries, timeframe ?? "30d", platform);
}

async function filterLeaderboardByPlatform(
  entries: LeaderboardEntry[],
  timeframe: string,
  platform: string,
): Promise<LeaderboardEntry[]> {
  const { getAuthorTrades: fetchFromApi } = await import("./paste-trade");
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
        prev_rank: null,
        win_rate: metrics.winRate,
        avg_pnl: metrics.avgPnl,
        total_trades: metrics.totalTrades,
        total_pnl: metrics.totalPnl,
        streak: metrics.streak,
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
  await db.updateRankings(timeframe);
}

export async function getStreakLeaderboard(limit = 50, offset = 0): Promise<LeaderboardEntry[]> {
  return db.getStreakLeaderboard(limit, offset);
}

export async function getTickerLeaderboard(ticker: string, limit = 50): Promise<LeaderboardEntry[]> {
  return db.getTickerLeaderboard(ticker, limit);
}

export async function getPopularTickers(limit = 20): Promise<string[]> {
  return db.getPopularTickers(limit);
}

export async function recordView(handle: string, page: string): Promise<void> {
  await db.recordView(handle, page);
}

export async function getTrending(): Promise<string[]> {
  return db.getTrending();
}

export async function getAuthorRecord(handle: string): Promise<Author | undefined> {
  return db.getAuthorRecord(handle);
}

export async function searchAuthors(
  query: string,
  limit?: number,
): Promise<Array<{ handle: string; totalTrades: number; winRate: number }>> {
  return db.searchAuthors(query, limit);
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
  const tickers = await db.getAllTickers();
  return tickers.map((t) => ({
    ticker: t.ticker,
    callCount: t.call_count,
    avgPnl: t.avg_pnl,
    bullCount: t.bull_count,
    bearCount: t.bear_count,
    lastCallAt: t.last_call_at,
  }));
}

export async function getAssetTrades(ticker: string): Promise<AssetTickerTrade[]> {
  const trades = await db.getTickerTrades(ticker);
  return trades.map((t) => ({
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

export async function getHeadToHead(
  a: string,
  b: string,
): Promise<{ a: AuthorMetrics; b: AuthorMetrics } | null> {
  return db.getHeadToHead(a, b);
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
  return db.getIntegrityStats(handle);
}

/**
 * Returns raw per-trade data suitable for reputation score calculation.
 * Includes pre-computed integrity class from DB.
 */
export async function getTradesForReputation(handle: string): Promise<RepTradeInput[]> {
  const trades = await db.getAuthorTrades(handle);
  return trades.map((t) => ({
    ticker: t.ticker,
    pnl_pct: t.pnl_pct,
    integrity: (t as { integrity?: import("./integrity").IntegrityClass }).integrity,
    author_date: t.entry_date ?? null,
    posted_at: t.posted_at ?? null,
  }));
}
