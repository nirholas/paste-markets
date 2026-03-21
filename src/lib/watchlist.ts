/**
 * Caller watchlist management for real-time tweet-to-trade streaming.
 *
 * Manages which Twitter handles are actively monitored, with tier-based
 * polling intervals (S=2m, A=5m, B=15m, C=30m).
 */

import { sql } from "./db";
import type { CallerTier } from "./alpha";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WatchedCaller {
  handle: string;
  displayName: string | null;
  tier: CallerTier;
  lastChecked: string | null;
  lastTweetId: string | null;
  checkIntervalMs: number;
  enabled: boolean;
  createdAt: string;
}

export interface LiveSignal {
  id: number;
  handle: string;
  tweetId: string;
  tweetText: string;
  tweetUrl: string;
  tweetDate: string;
  ticker: string;
  direction: string;
  platform: string | null;
  confidence: number;
  entryPrice: number | null;
  tradeUrl: string | null;
  pasteTradeId: string | null;
  detectedAt: string;
  detectionLatencyMs: number | null;
}

// ── Tier → interval mapping ──────────────────────────────────────────────────

const TIER_INTERVALS: Record<CallerTier, number> = {
  S: 2 * 60 * 1000,    // 2 minutes
  A: 5 * 60 * 1000,    // 5 minutes
  B: 15 * 60 * 1000,   // 15 minutes
  C: 30 * 60 * 1000,   // 30 minutes
};

export function tierToInterval(tier: CallerTier): number {
  return TIER_INTERVALS[tier] ?? TIER_INTERVALS.C;
}

// ── Row mapper ───────────────────────────────────────────────────────────────

interface WatchlistRow {
  handle: string;
  display_name: string | null;
  tier: string;
  check_interval_ms: number;
  last_checked_at: string | null;
  last_tweet_id: string | null;
  enabled: number | boolean;
  created_at: string;
}

function mapRow(row: WatchlistRow): WatchedCaller {
  return {
    handle: row.handle,
    displayName: row.display_name,
    tier: (row.tier as CallerTier) || "C",
    lastChecked: row.last_checked_at,
    lastTweetId: row.last_tweet_id,
    checkIntervalMs: row.check_interval_ms,
    enabled: row.enabled === 1 || row.enabled === true,
    createdAt: row.created_at,
  };
}

interface SignalRow {
  id: number;
  handle: string;
  tweet_id: string;
  tweet_text: string;
  tweet_url: string;
  tweet_date: string;
  ticker: string;
  direction: string;
  platform: string | null;
  confidence: number;
  entry_price: number | null;
  trade_url: string | null;
  paste_trade_id: string | null;
  detected_at: string;
  detection_latency_ms: number | null;
}

function mapSignal(row: SignalRow): LiveSignal {
  return {
    id: row.id,
    handle: row.handle,
    tweetId: row.tweet_id,
    tweetText: row.tweet_text,
    tweetUrl: row.tweet_url,
    tweetDate: row.tweet_date,
    ticker: row.ticker,
    direction: row.direction,
    platform: row.platform,
    confidence: row.confidence,
    entryPrice: row.entry_price,
    tradeUrl: row.trade_url,
    pasteTradeId: row.paste_trade_id,
    detectedAt: row.detected_at,
    detectionLatencyMs: row.detection_latency_ms,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAllWatched(): Promise<WatchedCaller[]> {
  const rows = await sql`
    SELECT handle, display_name, tier, check_interval_ms,
           last_checked_at, last_tweet_id, enabled, created_at
    FROM caller_watchlist
    ORDER BY tier ASC, handle ASC
  `;
  return (rows as WatchlistRow[]).map(mapRow);
}

export async function getEnabledWatched(): Promise<WatchedCaller[]> {
  const rows = await sql`
    SELECT handle, display_name, tier, check_interval_ms,
           last_checked_at, last_tweet_id, enabled, created_at
    FROM caller_watchlist
    WHERE enabled = true
    ORDER BY tier ASC, handle ASC
  `;
  return (rows as WatchlistRow[]).map(mapRow);
}

export async function getWatchedCaller(handle: string): Promise<WatchedCaller | null> {
  const rows = await sql`
    SELECT handle, display_name, tier, check_interval_ms,
           last_checked_at, last_tweet_id, enabled, created_at
    FROM caller_watchlist
    WHERE handle = ${handle}
  `;
  const row = rows[0] as WatchlistRow | undefined;
  return row ? mapRow(row) : null;
}

export async function addToWatchlist(
  handle: string,
  tier: CallerTier = "C",
  displayName?: string,
): Promise<boolean> {
  const cleanHandle = handle.toLowerCase().replace(/^@/, "");
  const display_name = displayName ?? null;
  const check_interval_ms = tierToInterval(tier);
  const rows = await sql`
    INSERT INTO caller_watchlist (handle, display_name, tier, check_interval_ms, enabled)
    VALUES (${cleanHandle}, ${display_name}, ${tier}, ${check_interval_ms}, true)
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  return rows.length > 0;
}

export async function updateWatchedCaller(
  handle: string,
  updates: {
    tier?: CallerTier;
    displayName?: string;
    enabled?: boolean;
  },
): Promise<boolean> {
  const cleanHandle = handle.toLowerCase().replace(/^@/, "");
  const interval = updates.tier ? tierToInterval(updates.tier) : null;
  const display_name = updates.displayName ?? null;
  const tier = updates.tier ?? null;
  const enabled = updates.enabled != null ? updates.enabled : null;
  const rows = await sql`
    UPDATE caller_watchlist SET
      display_name = COALESCE(${display_name}, display_name),
      tier = COALESCE(${tier}, tier),
      check_interval_ms = COALESCE(${interval}, check_interval_ms),
      enabled = COALESCE(${enabled}, enabled)
    WHERE handle = ${cleanHandle}
    RETURNING *
  `;
  return rows.length > 0;
}

export async function removeFromWatchlist(handle: string): Promise<boolean> {
  const cleanHandle = handle.toLowerCase().replace(/^@/, "");
  const rows = await sql`
    DELETE FROM caller_watchlist WHERE handle = ${cleanHandle}
    RETURNING *
  `;
  return rows.length > 0;
}

export async function updateLastChecked(
  handle: string,
  lastTweetId?: string,
): Promise<void> {
  const cleanHandle = handle.toLowerCase().replace(/^@/, "");
  const last_checked_at = new Date().toISOString();
  const last_tweet_id = lastTweetId ?? null;
  await sql`
    UPDATE caller_watchlist SET
      last_checked_at = ${last_checked_at},
      last_tweet_id = COALESCE(${last_tweet_id}, last_tweet_id)
    WHERE handle = ${cleanHandle}
  `;
}

// ── Signal storage ───────────────────────────────────────────────────────────

export async function insertSignal(signal: {
  handle: string;
  tweetId: string;
  tweetText: string;
  tweetUrl: string;
  tweetDate: string;
  ticker: string;
  direction: string;
  platform: string | null;
  confidence: number;
  entryPrice?: number;
  tradeUrl?: string;
  pasteTradeId?: string;
  detectionLatencyMs?: number;
}): Promise<boolean> {
  const platform = signal.platform ?? null;
  const entry_price = signal.entryPrice ?? null;
  const trade_url = signal.tradeUrl ?? null;
  const paste_trade_id = signal.pasteTradeId ?? null;
  const detection_latency_ms = signal.detectionLatencyMs ?? null;
  const rows = await sql`
    INSERT INTO live_signals (
      handle, tweet_id, tweet_text, tweet_url, tweet_date,
      ticker, direction, platform, confidence,
      entry_price, trade_url, paste_trade_id, detection_latency_ms
    ) VALUES (
      ${signal.handle}, ${signal.tweetId}, ${signal.tweetText}, ${signal.tweetUrl}, ${signal.tweetDate},
      ${signal.ticker}, ${signal.direction}, ${platform}, ${signal.confidence},
      ${entry_price}, ${trade_url}, ${paste_trade_id}, ${detection_latency_ms}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  return rows.length > 0;
}

export async function getRecentSignals(limit = 50): Promise<LiveSignal[]> {
  const rows = await sql`
    SELECT * FROM live_signals
    ORDER BY detected_at DESC
    LIMIT ${limit}
  `;
  return (rows as SignalRow[]).map(mapSignal);
}

export async function getHighConfidenceSignals(minConfidence = 0.75, limit = 50): Promise<LiveSignal[]> {
  const rows = await sql`
    SELECT * FROM live_signals
    WHERE confidence >= ${minConfidence}
    ORDER BY detected_at DESC
    LIMIT ${limit}
  `;
  return (rows as SignalRow[]).map(mapSignal);
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface WatchlistStats {
  totalCallers: number;
  activeCallers: number;
  totalChecksToday: number;
  tradesFoundToday: number;
  avgLatencyMs: number;
  lastSignalAt: string | null;
}

export async function getWatchlistStats(): Promise<WatchlistStats> {
  const [totalRows, activeRows, checksTodayRows, tradesTodayRows, lastSignalRows, avgLatencyRows] =
    await Promise.all([
      sql`SELECT COUNT(*) as total FROM caller_watchlist`,
      sql`SELECT COUNT(*) as total FROM caller_watchlist WHERE enabled = true`,
      sql`SELECT COUNT(*) as total FROM caller_watchlist WHERE last_checked_at >= CURRENT_DATE`,
      sql`SELECT COUNT(*) as total FROM live_signals WHERE detected_at >= CURRENT_DATE`,
      sql`SELECT detected_at FROM live_signals ORDER BY detected_at DESC LIMIT 1`,
      sql`SELECT AVG(detection_latency_ms) as avg_latency FROM live_signals WHERE detected_at >= CURRENT_DATE AND detection_latency_ms IS NOT NULL`,
    ]);

  const total = (totalRows[0] as { total: number }).total;
  const active = (activeRows[0] as { total: number }).total;
  const checksToday = (checksTodayRows[0] as { total: number }).total;
  const tradesFoundToday = (tradesTodayRows[0] as { total: number }).total;
  const lastSignal = lastSignalRows[0] as { detected_at: string } | undefined;
  const avgLatency = avgLatencyRows[0] as { avg_latency: number | null } | undefined;

  return {
    totalCallers: total,
    activeCallers: active,
    totalChecksToday: checksToday,
    tradesFoundToday: tradesFoundToday,
    avgLatencyMs: Math.round(avgLatency?.avg_latency ?? 0),
    lastSignalAt: lastSignal?.detected_at ?? null,
  };
}

// ── Auto-populate from leaderboard ───────────────────────────────────────────

export async function autoPopulateFromLeaderboard(): Promise<number> {
  const countRows = await sql`SELECT COUNT(*) as total FROM caller_watchlist`;
  const existing = (countRows[0] as { total: number }).total;
  if (existing > 0) return 0;

  try {
    const res = await fetch(
      `${process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000"}/api/leaderboard?limit=50&window=30d`,
    );
    if (!res.ok) return 0;

    const data = await res.json() as {
      entries: Array<{
        handle: string;
        alphaScore: number;
        tier: CallerTier;
      }>;
    };

    let added = 0;
    for (const entry of data.entries) {
      const tier = entry.tier ?? "C";
      const ok = await addToWatchlist(entry.handle, tier);
      if (ok) added++;
    }

    return added;
  } catch {
    return 0;
  }
}
