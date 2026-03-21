/**
 * Data sync logic.
 * Fetches fresh data from paste.trade for an author and updates the local DB.
 * Called by API routes when data is stale (>1 hour old).
 */

import { getAuthorTrades as fetchFromApi } from "./paste-trade";
import {
  getOrCreateAuthor,
  upsertTrades,
  getAuthorMetrics,
  getAuthorRecord,
  updateAuthorRecord,
} from "./db";
import type { AuthorMetrics } from "./metrics";

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export function isStale(lastFetched: string | null, maxAgeMs = DEFAULT_MAX_AGE_MS): boolean {
  if (!lastFetched) return true;
  const fetchedAt = new Date(lastFetched).getTime();
  return Date.now() - fetchedAt > maxAgeMs;
}

export async function syncAuthor(handle: string): Promise<AuthorMetrics> {
  // Ensure author exists
  getOrCreateAuthor(handle);

  // Check staleness
  const author = getAuthorRecord(handle);
  if (author && !isStale(author.last_fetched)) {
    const existing = getAuthorMetrics(handle);
    if (existing) return existing;
  }

  // Fetch fresh trades from paste.trade
  const trades = await fetchFromApi(handle);

  if (trades.length > 0) {
    upsertTrades(handle, trades);
  }

  // Recompute metrics from all cached trades
  const metrics = getAuthorMetrics(handle);
  if (!metrics) {
    // No trades at all — return empty metrics
    return {
      handle,
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      bestTrade: null,
      worstTrade: null,
      tradesByPlatform: {},
      recentTrades: [],
      streak: 0,
      topAssets: [],
      pnlHistory: [],
    };
  }

  // Update author record with latest metrics
  updateAuthorRecord(handle, metrics);

  return metrics;
}

export async function syncMultipleAuthors(handles: string[]): Promise<void> {
  for (const handle of handles) {
    await syncAuthor(handle);
    // Rate limit: 500ms between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
