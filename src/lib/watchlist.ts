/**
 * Caller watchlist management for real-time tweet-to-trade streaming.
 *
 * Manages which Twitter handles are actively monitored, with tier-based
 * polling intervals (S=2m, A=5m, B=15m, C=30m).
 */

import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CallerTier } from "./alpha";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/db.sqlite");
const SCHEMA_PATH = resolve(__dirname, "schema.sql");

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

// Ensure watchlist tables exist
const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

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

// ── Prepared statements ──────────────────────────────────────────────────────

const stmts = {
  getAll: db.prepare(`
    SELECT handle, display_name, tier, check_interval_ms,
           last_checked_at, last_tweet_id, enabled, created_at
    FROM caller_watchlist
    ORDER BY tier ASC, handle ASC
  `),

  getEnabled: db.prepare(`
    SELECT handle, display_name, tier, check_interval_ms,
           last_checked_at, last_tweet_id, enabled, created_at
    FROM caller_watchlist
    WHERE enabled = 1
    ORDER BY tier ASC, handle ASC
  `),

  getByHandle: db.prepare<[string]>(`
    SELECT handle, display_name, tier, check_interval_ms,
           last_checked_at, last_tweet_id, enabled, created_at
    FROM caller_watchlist
    WHERE handle = ?
  `),

  insert: db.prepare(`
    INSERT OR IGNORE INTO caller_watchlist (handle, display_name, tier, check_interval_ms, enabled)
    VALUES (@handle, @display_name, @tier, @check_interval_ms, @enabled)
  `),

  update: db.prepare(`
    UPDATE caller_watchlist SET
      display_name = COALESCE(@display_name, display_name),
      tier = COALESCE(@tier, tier),
      check_interval_ms = COALESCE(@check_interval_ms, check_interval_ms),
      enabled = COALESCE(@enabled, enabled)
    WHERE handle = @handle
  `),

  remove: db.prepare("DELETE FROM caller_watchlist WHERE handle = ?"),

  updateLastChecked: db.prepare(`
    UPDATE caller_watchlist SET
      last_checked_at = @last_checked_at,
      last_tweet_id = COALESCE(@last_tweet_id, last_tweet_id)
    WHERE handle = @handle
  `),

  count: db.prepare("SELECT COUNT(*) as total FROM caller_watchlist"),
  countEnabled: db.prepare("SELECT COUNT(*) as total FROM caller_watchlist WHERE enabled = 1"),

  // Live signals
  insertSignal: db.prepare(`
    INSERT OR IGNORE INTO live_signals (
      handle, tweet_id, tweet_text, tweet_url, tweet_date,
      ticker, direction, platform, confidence,
      entry_price, trade_url, paste_trade_id, detection_latency_ms
    ) VALUES (
      @handle, @tweet_id, @tweet_text, @tweet_url, @tweet_date,
      @ticker, @direction, @platform, @confidence,
      @entry_price, @trade_url, @paste_trade_id, @detection_latency_ms
    )
  `),

  getRecentSignals: db.prepare<[number]>(`
    SELECT * FROM live_signals
    ORDER BY detected_at DESC
    LIMIT ?
  `),

  getSignalsByConfidence: db.prepare<[number, number]>(`
    SELECT * FROM live_signals
    WHERE confidence >= ?
    ORDER BY detected_at DESC
    LIMIT ?
  `),

  getSignalsToday: db.prepare(`
    SELECT COUNT(*) as total FROM live_signals
    WHERE detected_at >= date('now')
  `),

  getChecksToday: db.prepare(`
    SELECT COUNT(*) as total FROM caller_watchlist
    WHERE last_checked_at >= date('now')
  `),

  getLastSignal: db.prepare(`
    SELECT detected_at FROM live_signals
    ORDER BY detected_at DESC
    LIMIT 1
  `),

  getAvgLatency: db.prepare(`
    SELECT AVG(detection_latency_ms) as avg_latency
    FROM live_signals
    WHERE detected_at >= date('now')
      AND detection_latency_ms IS NOT NULL
  `),
};

// ── Row mapper ───────────────────────────────────────────────────────────────

interface WatchlistRow {
  handle: string;
  display_name: string | null;
  tier: string;
  check_interval_ms: number;
  last_checked_at: string | null;
  last_tweet_id: string | null;
  enabled: number;
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
    enabled: row.enabled === 1,
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

export function getAllWatched(): WatchedCaller[] {
  return (stmts.getAll.all() as WatchlistRow[]).map(mapRow);
}

export function getEnabledWatched(): WatchedCaller[] {
  return (stmts.getEnabled.all() as WatchlistRow[]).map(mapRow);
}

export function getWatchedCaller(handle: string): WatchedCaller | null {
  const row = stmts.getByHandle.get(handle) as WatchlistRow | undefined;
  return row ? mapRow(row) : null;
}

export function addToWatchlist(
  handle: string,
  tier: CallerTier = "C",
  displayName?: string,
): boolean {
  const result = stmts.insert.run({
    handle: handle.toLowerCase().replace(/^@/, ""),
    display_name: displayName ?? null,
    tier,
    check_interval_ms: tierToInterval(tier),
    enabled: 1,
  });
  return result.changes > 0;
}

export function updateWatchedCaller(
  handle: string,
  updates: {
    tier?: CallerTier;
    displayName?: string;
    enabled?: boolean;
  },
): boolean {
  const interval = updates.tier ? tierToInterval(updates.tier) : undefined;
  const result = stmts.update.run({
    handle: handle.toLowerCase().replace(/^@/, ""),
    display_name: updates.displayName ?? null,
    tier: updates.tier ?? null,
    check_interval_ms: interval ?? null,
    enabled: updates.enabled != null ? (updates.enabled ? 1 : 0) : null,
  });
  return result.changes > 0;
}

export function removeFromWatchlist(handle: string): boolean {
  const result = stmts.remove.run(handle.toLowerCase().replace(/^@/, ""));
  return result.changes > 0;
}

export function updateLastChecked(
  handle: string,
  lastTweetId?: string,
): void {
  stmts.updateLastChecked.run({
    handle: handle.toLowerCase().replace(/^@/, ""),
    last_checked_at: new Date().toISOString(),
    last_tweet_id: lastTweetId ?? null,
  });
}

// ── Signal storage ───────────────────────────────────────────────────────────

export function insertSignal(signal: {
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
}): boolean {
  const result = stmts.insertSignal.run({
    handle: signal.handle,
    tweet_id: signal.tweetId,
    tweet_text: signal.tweetText,
    tweet_url: signal.tweetUrl,
    tweet_date: signal.tweetDate,
    ticker: signal.ticker,
    direction: signal.direction,
    platform: signal.platform ?? null,
    confidence: signal.confidence,
    entry_price: signal.entryPrice ?? null,
    trade_url: signal.tradeUrl ?? null,
    paste_trade_id: signal.pasteTradeId ?? null,
    detection_latency_ms: signal.detectionLatencyMs ?? null,
  });
  return result.changes > 0;
}

export function getRecentSignals(limit = 50): LiveSignal[] {
  return (stmts.getRecentSignals.all(limit) as SignalRow[]).map(mapSignal);
}

export function getHighConfidenceSignals(minConfidence = 0.75, limit = 50): LiveSignal[] {
  return (stmts.getSignalsByConfidence.all(minConfidence, limit) as SignalRow[]).map(mapSignal);
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

export function getWatchlistStats(): WatchlistStats {
  const total = (stmts.count.get() as { total: number }).total;
  const active = (stmts.countEnabled.get() as { total: number }).total;
  const checksToday = (stmts.getChecksToday.get() as { total: number }).total;
  const tradesFoundToday = (stmts.getSignalsToday.get() as { total: number }).total;
  const lastSignal = stmts.getLastSignal.get() as { detected_at: string } | undefined;
  const avgLatency = stmts.getAvgLatency.get() as { avg_latency: number | null } | undefined;

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
  const existing = (stmts.count.get() as { total: number }).total;
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
      const ok = addToWatchlist(entry.handle, tier);
      if (ok) added++;
    }

    return added;
  } catch {
    return 0;
  }
}
