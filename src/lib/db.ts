/**
 * SQLite database connection and query functions.
 * Uses better-sqlite3 (synchronous by design).
 */

import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PasteTradeTrade } from "./paste-trade";
import { computeMetrics, type AuthorMetrics, type TradeSummary } from "./metrics";
import { classifyIntegrity, extractTweetId, type IntegrityClass } from "./integrity";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/db.sqlite");
const SCHEMA_PATH = resolve(__dirname, "schema.sql");

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");

// Run schema (uses CREATE TABLE IF NOT EXISTS)
const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

// Runtime migrations — add new columns to existing databases without data loss.
// SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we probe first.
{
  const existingCols = new Set(
    (db.pragma("table_info(trades)") as Array<{ name: string }>).map((c) => c.name),
  );
  const integrityColumns: Array<[string, string]> = [
    ["tweet_id", "TEXT"],
    ["tweet_created_at", "TEXT"],
    ["submitted_at", "TEXT"],
    ["delay_minutes", "INTEGER DEFAULT 0"],
    ["integrity", "TEXT DEFAULT 'unknown'"],
    ["counted_in_stats", "INTEGER DEFAULT 1"],
    ["price_at_tweet_time", "REAL"],
    ["price_at_submission", "REAL"],
    ["tweet_deleted_at", "TEXT"],
    ["tweet_content_hash", "TEXT"],
  ];
  for (const [col, def] of integrityColumns) {
    if (!existingCols.has(col)) {
      db.exec(`ALTER TABLE trades ADD COLUMN ${col} ${def}`);
    }
  }
}

// Rankings table migrations
{
  const rankingCols = new Set(
    (db.pragma("table_info(rankings)") as Array<{ name: string }>).map((c) => c.name),
  );
  const newRankingCols: Array<[string, string]> = [
    ["prev_rank", "INTEGER"],
    ["total_pnl", "REAL"],
    ["streak", "INTEGER DEFAULT 0"],
  ];
  for (const [col, def] of newRankingCols) {
    if (!rankingCols.has(col)) {
      db.exec(`ALTER TABLE rankings ADD COLUMN ${col} ${def}`);
    }
  }
}

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
  prev_rank: number | null;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
  total_pnl: number | null;
  streak: number;
}

// --- Prepared statements ---

const stmts = {
  getAuthor: db.prepare<[string], Author>("SELECT * FROM authors WHERE handle = ?"),

  insertAuthor: db.prepare(
    "INSERT OR IGNORE INTO authors (handle) VALUES (?)",
  ),

  updateAuthorMetrics: db.prepare(`
    UPDATE authors SET
      last_fetched = datetime('now'),
      total_trades = @total_trades,
      win_count = @win_count,
      loss_count = @loss_count,
      win_rate = @win_rate,
      avg_pnl = @avg_pnl,
      best_pnl = @best_pnl,
      worst_pnl = @worst_pnl,
      best_ticker = @best_ticker,
      worst_ticker = @worst_ticker
    WHERE handle = @handle
  `),

  upsertTrade: db.prepare(`
    INSERT INTO trades (
      author_handle, ticker, direction, pnl_pct, platform, entry_date, posted_at, source_url,
      tweet_id, tweet_created_at, submitted_at, delay_minutes, integrity, counted_in_stats,
      price_at_tweet_time, price_at_submission
    )
    VALUES (
      @author_handle, @ticker, @direction, @pnl_pct, @platform, @entry_date, @posted_at, @source_url,
      @tweet_id, @tweet_created_at, @submitted_at, @delay_minutes, @integrity, @counted_in_stats,
      @price_at_tweet_time, @price_at_submission
    )
    ON CONFLICT(author_handle, ticker, direction, entry_date) DO UPDATE SET
      pnl_pct = excluded.pnl_pct,
      platform = excluded.platform,
      posted_at = excluded.posted_at,
      source_url = excluded.source_url,
      fetched_at = datetime('now'),
      tweet_id = excluded.tweet_id,
      tweet_created_at = excluded.tweet_created_at,
      submitted_at = excluded.submitted_at,
      delay_minutes = excluded.delay_minutes,
      integrity = excluded.integrity,
      counted_in_stats = excluded.counted_in_stats,
      price_at_tweet_time = excluded.price_at_tweet_time,
      price_at_submission = excluded.price_at_submission
  `),

  getTradesByAuthor: db.prepare<[string], TradeSummary & {
    entry_date: string;
    posted_at: string;
    source_url: string | null;
    integrity: IntegrityClass;
    delay_minutes: number;
    counted_in_stats: number;
    tweet_deleted_at: string | null;
    price_at_tweet_time: number | null;
    price_at_submission: number | null;
  }>(
    `SELECT ticker, direction, pnl_pct, platform, entry_date, posted_at, source_url,
            integrity, delay_minutes, counted_in_stats, tweet_deleted_at,
            price_at_tweet_time, price_at_submission
     FROM trades WHERE author_handle = ? ORDER BY entry_date DESC`,
  ),

  getLeaderboard: db.prepare<[string, number, number], LeaderboardEntry>(`
    SELECT r.author_handle AS handle, r.rank, r.prev_rank, r.win_rate, r.avg_pnl,
           r.total_trades, r.total_pnl, COALESCE(r.streak, 0) as streak
    FROM rankings r
    WHERE r.timeframe = ?
    ORDER BY r.rank ASC
    LIMIT ? OFFSET ?
  `),

  getIntegrityStats: db.prepare<[string], {
    integrity: IntegrityClass;
    count: number;
  }>(`
    SELECT integrity, COUNT(*) as count
    FROM trades
    WHERE author_handle = ?
    GROUP BY integrity
  `),

  markTweetDeleted: db.prepare(
    "UPDATE trades SET tweet_deleted_at = datetime('now') WHERE tweet_id = ? AND tweet_deleted_at IS NULL",
  ),

  getLiveTradesForMonitor: db.prepare<[], {
    tweet_id: string;
    author_handle: string;
    ticker: string;
    direction: string;
    entry_date: string;
  }>(`
    SELECT tweet_id, author_handle, ticker, direction, entry_date
    FROM trades
    WHERE tweet_id IS NOT NULL
      AND tweet_deleted_at IS NULL
      AND submitted_at >= datetime('now', '-90 days')
    ORDER BY submitted_at DESC
    LIMIT 500
  `),

  deleteRankingsForTimeframe: db.prepare("DELETE FROM rankings WHERE timeframe = ?"),

  insertRanking: db.prepare(`
    INSERT INTO rankings (author_handle, rank, prev_rank, win_rate, avg_pnl, total_trades, total_pnl, streak, timeframe)
    VALUES (@author_handle, @rank, @prev_rank, @win_rate, @avg_pnl, @total_trades, @total_pnl, @streak, @timeframe)
  `),

  getPrevRanks: db.prepare<[string], { author_handle: string; rank: number }>(`
    SELECT author_handle, rank FROM rankings WHERE timeframe = ?
  `),

  getStreakLeaderboard: db.prepare<[number, number], LeaderboardEntry>(`
    SELECT r.author_handle AS handle, r.rank, r.prev_rank, r.win_rate, r.avg_pnl,
           r.total_trades, r.total_pnl, COALESCE(r.streak, 0) as streak
    FROM rankings r
    WHERE r.timeframe = '30d' AND r.streak > 0
    ORDER BY r.streak DESC, r.win_rate DESC
    LIMIT ? OFFSET ?
  `),

  updateAuthorRank: db.prepare("UPDATE authors SET rank = ? WHERE handle = ?"),

  getAllAuthors: db.prepare<[], Author>("SELECT * FROM authors ORDER BY rank ASC NULLS LAST"),

  recordView: db.prepare(
    "INSERT INTO views (author_handle, page) VALUES (?, ?)",
  ),

  getTrending: db.prepare<[], { author_handle: string }>(`
    SELECT author_handle, COUNT(*) as view_count
    FROM views
    WHERE viewed_at > datetime('now', '-24 hours')
    GROUP BY author_handle
    ORDER BY view_count DESC
    LIMIT 10
  `),

  getSmartCalls: db.prepare<[], {
    author_handle: string;
    ticker: string;
    direction: string;
    pnl_pct: number | null;
    platform: string | null;
    posted_at: string | null;
    source_url: string | null;
    win_rate: number;
    avg_pnl: number;
    total_trades: number;
  }>(`
    SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct,
           t.platform, t.posted_at, t.source_url,
           a.win_rate, a.avg_pnl, a.total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE a.win_rate >= 55
      AND a.total_trades >= 5
      AND t.posted_at >= datetime('now', '-7 days')
    ORDER BY a.win_rate DESC, t.posted_at DESC
    LIMIT 25
  `),

  getConsensusSignals: db.prepare<[], {
    ticker: string;
    direction: string;
    caller_count: number;
    avg_caller_win_rate: number;
    avg_pnl: number | null;
    latest_call: string;
    callers: string;
  }>(`
    SELECT t.ticker, t.direction,
           COUNT(DISTINCT t.author_handle) as caller_count,
           AVG(a.win_rate) as avg_caller_win_rate,
           AVG(t.pnl_pct) as avg_pnl,
           MAX(t.posted_at) as latest_call,
           GROUP_CONCAT(DISTINCT t.author_handle) as callers
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE a.win_rate >= 50
      AND a.total_trades >= 5
      AND t.posted_at >= datetime('now', '-14 days')
    GROUP BY t.ticker, t.direction
    HAVING COUNT(DISTINCT t.author_handle) >= 2
    ORDER BY caller_count DESC, avg_caller_win_rate DESC
    LIMIT 12
  `),

  getFadeCalls: db.prepare<[], {
    author_handle: string;
    ticker: string;
    direction: string;
    pnl_pct: number | null;
    platform: string | null;
    posted_at: string | null;
    win_rate: number;
    total_trades: number;
  }>(`
    SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct,
           t.platform, t.posted_at,
           a.win_rate, a.total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE a.win_rate <= 38
      AND a.total_trades >= 8
      AND t.posted_at >= datetime('now', '-7 days')
    ORDER BY a.win_rate ASC, t.posted_at DESC
    LIMIT 10
  `),

  getTickerStats: db.prepare<[string], {
    author_handle: string;
    direction: string;
    pnl_pct: number | null;
    posted_at: string | null;
    win_rate: number;
    avg_pnl: number;
    total_trades: number;
  }>(`
    SELECT t.author_handle, t.direction, t.pnl_pct, t.posted_at,
           a.win_rate, a.avg_pnl, a.total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE t.ticker = ?
      AND t.pnl_pct IS NOT NULL
    ORDER BY t.posted_at DESC
    LIMIT 50
  `),

  getRecentTrades: db.prepare<[number], {
    handle: string;
    ticker: string;
    direction: string;
    pnl_pct: number | null;
    posted_at: string;
  }>(`
    SELECT t.author_handle AS handle, t.ticker, t.direction, t.pnl_pct, t.posted_at
    FROM trades t
    WHERE t.posted_at IS NOT NULL
    ORDER BY t.posted_at DESC
    LIMIT ?
  `),
};

// --- Exported functions ---

export function getOrCreateAuthor(handle: string): Author {
  stmts.insertAuthor.run(handle);
  return stmts.getAuthor.get(handle) as Author;
}

export function upsertTrades(handle: string, trades: PasteTradeTrade[]): void {
  const upsertMany = db.transaction((tradeList: PasteTradeTrade[]) => {
    for (const t of tradeList) {
      // author_date = when the tweet was posted (tweet creation time)
      // posted_at   = when submitted to paste.trade
      const tweetCreatedAt = t.author_date ?? null;
      const submittedAt = t.posted_at ?? null;
      const { integrity, delayMinutes, countedInStats } = classifyIntegrity(
        tweetCreatedAt,
        submittedAt,
      );
      const tweetId = extractTweetId(t.source_url);

      stmts.upsertTrade.run({
        author_handle: handle,
        ticker: t.ticker,
        direction: t.direction,
        pnl_pct: t.pnlPct ?? null,
        platform: t.platform ?? null,
        entry_date: tweetCreatedAt,
        posted_at: submittedAt,
        source_url: t.source_url ?? null,
        tweet_id: tweetId,
        tweet_created_at: tweetCreatedAt,
        submitted_at: submittedAt,
        delay_minutes: delayMinutes,
        integrity,
        counted_in_stats: countedInStats ? 1 : 0,
        price_at_tweet_time: t.entryPrice ?? null,
        price_at_submission: t.entryPrice ?? null, // same unless fetched late
      });
    }
  });

  upsertMany(trades);
}

export function getAuthorTrades(handle: string): TradeSummary[] {
  return stmts.getTradesByAuthor.all(handle);
}

export function getAuthorMetrics(handle: string): AuthorMetrics | null {
  const author = stmts.getAuthor.get(handle);
  if (!author) return null;

  const trades = getAuthorTrades(handle);
  return computeMetrics(handle, trades);
}

export function getLeaderboard(
  timeframe = "30d",
  limit = 50,
  offset = 0,
): LeaderboardEntry[] {
  return stmts.getLeaderboard.all(timeframe, limit, offset);
}

export function getStreakLeaderboard(limit = 50, offset = 0): LeaderboardEntry[] {
  return stmts.getStreakLeaderboard.all(limit, offset);
}

export function getTickerLeaderboard(ticker: string, limit = 50): LeaderboardEntry[] {
  const rows = db
    .prepare<[string, number], { author_handle: string; total_pnl: number; trade_count: number; win_count: number }>(`
      SELECT t.author_handle,
             SUM(t.pnl_pct) as total_pnl,
             COUNT(*) as trade_count,
             SUM(CASE WHEN t.pnl_pct > 0 THEN 1 ELSE 0 END) as win_count
      FROM trades t
      WHERE UPPER(t.ticker) = UPPER(?)
        AND t.pnl_pct IS NOT NULL
      GROUP BY t.author_handle
      HAVING trade_count >= 1
      ORDER BY total_pnl DESC
      LIMIT ?
    `)
    .all(ticker, limit);

  return rows.map((r, i) => ({
    handle: r.author_handle,
    rank: i + 1,
    prev_rank: null,
    win_rate: r.trade_count > 0 ? (r.win_count / r.trade_count) * 100 : 0,
    avg_pnl: r.trade_count > 0 ? r.total_pnl / r.trade_count : 0,
    total_trades: r.trade_count,
    total_pnl: r.total_pnl,
    streak: 0,
  }));
}

export function getPopularTickers(limit = 20): string[] {
  return db
    .prepare<[number], { ticker: string }>(`
      SELECT ticker, COUNT(*) as cnt
      FROM trades
      WHERE ticker != '' AND pnl_pct IS NOT NULL
      GROUP BY ticker
      ORDER BY cnt DESC
      LIMIT ?
    `)
    .all(limit)
    .map((r) => r.ticker);
}

export function updateRankings(timeframe = "30d"): void {
  const authors = stmts.getAllAuthors.all();

  // Get previous ranks before deleting
  const prevRankRows = stmts.getPrevRanks.all(timeframe);
  const prevRankMap = new Map<string, number>();
  for (const row of prevRankRows) {
    prevRankMap.set(row.author_handle, row.rank);
  }

  // Compute metrics for each author with trades
  const ranked: { handle: string; winRate: number; avgPnl: number; totalTrades: number; totalPnl: number; streak: number }[] = [];

  for (const author of authors) {
    const trades = getAuthorTrades(author.handle);
    if (trades.length === 0) continue;

    const metrics = computeMetrics(author.handle, trades);
    ranked.push({
      handle: author.handle,
      winRate: metrics.winRate,
      avgPnl: metrics.avgPnl,
      totalTrades: metrics.totalTrades,
      totalPnl: metrics.totalPnl,
      streak: metrics.streak,
    });
  }

  // Sort by win rate descending, then avg P&L descending as tiebreaker
  ranked.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.avgPnl - a.avgPnl;
  });

  // Write rankings in a transaction
  const writeRankings = db.transaction(() => {
    stmts.deleteRankingsForTimeframe.run(timeframe);

    for (let i = 0; i < ranked.length; i++) {
      const entry = ranked[i]!;
      const rank = i + 1;

      stmts.insertRanking.run({
        author_handle: entry.handle,
        rank,
        prev_rank: prevRankMap.get(entry.handle) ?? null,
        win_rate: entry.winRate,
        avg_pnl: entry.avgPnl,
        total_trades: entry.totalTrades,
        total_pnl: entry.totalPnl,
        streak: entry.streak,
        timeframe,
      });

      stmts.updateAuthorRank.run(rank, entry.handle);
    }
  });

  writeRankings();
}

export function updateAuthorRecord(handle: string, metrics: AuthorMetrics): void {
  stmts.updateAuthorMetrics.run({
    handle,
    total_trades: metrics.totalTrades,
    win_count: metrics.winCount,
    loss_count: metrics.lossCount,
    win_rate: metrics.winRate,
    avg_pnl: metrics.avgPnl,
    best_pnl: metrics.bestTrade?.pnl ?? null,
    worst_pnl: metrics.worstTrade?.pnl ?? null,
    best_ticker: metrics.bestTrade?.ticker ?? null,
    worst_ticker: metrics.worstTrade?.ticker ?? null,
  });
}

export function getHeadToHead(
  a: string,
  b: string,
): { a: AuthorMetrics; b: AuthorMetrics } | null {
  const metricsA = getAuthorMetrics(a);
  const metricsB = getAuthorMetrics(b);
  if (!metricsA || !metricsB) return null;
  return { a: metricsA, b: metricsB };
}

export function recordView(handle: string, page: string): void {
  stmts.recordView.run(handle, page);
}

export function getTrending(): string[] {
  return stmts.getTrending.all().map((r) => r.author_handle);
}

export interface SmartCall {
  author_handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  platform: string | null;
  posted_at: string | null;
  source_url: string | null;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
}

export interface ConsensusSignal {
  ticker: string;
  direction: string;
  caller_count: number;
  avg_caller_win_rate: number;
  avg_pnl: number | null;
  latest_call: string;
  callers: string[];
}

export interface FadeCall {
  author_handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  platform: string | null;
  posted_at: string | null;
  win_rate: number;
  total_trades: number;
}

export interface TickerStat {
  author_handle: string;
  direction: string;
  pnl_pct: number | null;
  posted_at: string | null;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
}

export interface IntegrityStats {
  total: number;
  live: number;
  late: number;
  historical: number;
  retroactive: number;
  unknown: number;
  score: number; // % live calls (0-100)
}

export function getIntegrityStats(handle: string): IntegrityStats {
  const rows = stmts.getIntegrityStats.all(handle);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    counts[row.integrity] = row.count;
    total += row.count;
  }
  const live = counts["live"] ?? 0;
  return {
    total,
    live,
    late: counts["late"] ?? 0,
    historical: counts["historical"] ?? 0,
    retroactive: counts["retroactive"] ?? 0,
    unknown: counts["unknown"] ?? 0,
    score: total > 0 ? Math.round((live / total) * 100) : 100,
  };
}

export function markTweetDeleted(tweetId: string): void {
  stmts.markTweetDeleted.run(tweetId);
}

export function getLiveTradesForMonitor(): Array<{
  tweet_id: string;
  author_handle: string;
  ticker: string;
  direction: string;
  entry_date: string;
}> {
  return stmts.getLiveTradesForMonitor.all();
}

export function getRecentTrades(limit = 50) {
  return stmts.getRecentTrades.all(limit);
}

export function getSmartCalls(): SmartCall[] {
  return stmts.getSmartCalls.all();
}

export function getConsensusSignals(): ConsensusSignal[] {
  return stmts.getConsensusSignals.all().map((row) => ({
    ...row,
    callers: row.callers ? row.callers.split(",") : [],
  }));
}

export function getFadeCalls(): FadeCall[] {
  return stmts.getFadeCalls.all();
}

export function getTickerStats(ticker: string): TickerStat[] {
  return stmts.getTickerStats.all(ticker);
}

export interface TickerSummary {
  ticker: string;
  call_count: number;
  avg_pnl: number | null;
  bull_count: number;
  bear_count: number;
  last_call_at: string | null;
}

export interface TickerTrade {
  author_handle: string;
  direction: string;
  pnl_pct: number | null;
  platform: string | null;
  entry_date: string | null;
  posted_at: string | null;
  source_url: string | null;
  author_win_rate: number;
  author_avg_pnl: number;
  author_total_trades: number;
}

export function getAllTickers(): TickerSummary[] {
  return db
    .prepare<[], TickerSummary>(`
      SELECT ticker,
             COUNT(*) as call_count,
             AVG(pnl_pct) as avg_pnl,
             SUM(CASE WHEN direction IN ('long', 'yes') THEN 1 ELSE 0 END) as bull_count,
             SUM(CASE WHEN direction IN ('short', 'no') THEN 1 ELSE 0 END) as bear_count,
             MAX(posted_at) as last_call_at
      FROM trades
      WHERE ticker != ''
      GROUP BY ticker
      ORDER BY call_count DESC
    `)
    .all();
}

export function getTickerTrades(ticker: string): TickerTrade[] {
  return db
    .prepare<[string], TickerTrade>(`
      SELECT t.author_handle, t.direction, t.pnl_pct, t.platform,
             t.entry_date, t.posted_at, t.source_url,
             a.win_rate as author_win_rate,
             a.avg_pnl as author_avg_pnl,
             a.total_trades as author_total_trades
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE t.ticker = ?
      ORDER BY t.pnl_pct DESC NULLS LAST
      LIMIT 100
    `)
    .all(ticker);
}

export function searchAuthors(
  query: string,
  limit = 10,
): Array<{ handle: string; totalTrades: number; winRate: number }> {
  const rows = db
    .prepare<[string, number], { handle: string; total_trades: number; win_rate: number }>(
      "SELECT handle, total_trades, win_rate FROM authors WHERE handle LIKE ? ORDER BY total_trades DESC LIMIT ?",
    )
    .all(`${query}%`, limit);

  return rows.map((r) => ({
    handle: r.handle,
    totalTrades: r.total_trades,
    winRate: r.win_rate,
  }));
}

export function getAuthorRecord(handle: string): Author | undefined {
  return stmts.getAuthor.get(handle);
}

// ─── API key management ───────────────────────────────────────────────────────

export interface ApiKeyRow {
  key: string;
  handle: string;
  tier: "free" | "developer";
  created_at: string;
  last_used: string | null;
  request_count: number;
}

const apiKeyStmts = {
  insert: db.prepare<[string, string, string], void>(
    "INSERT OR IGNORE INTO api_keys (key, handle, tier) VALUES (?, ?, ?)",
  ),
  get: db.prepare<[string], ApiKeyRow>(
    "SELECT * FROM api_keys WHERE key = ? LIMIT 1",
  ),
  touch: db.prepare<[string], void>(
    "UPDATE api_keys SET last_used = datetime('now'), request_count = request_count + 1 WHERE key = ?",
  ),
  getByHandle: db.prepare<[string], ApiKeyRow>(
    "SELECT * FROM api_keys WHERE handle = ? ORDER BY created_at DESC",
  ),
};

export function insertApiKey(key: string, handle: string, tier: "free" | "developer" = "free"): void {
  apiKeyStmts.insert.run(key, handle, tier);
}

export function getApiKey(key: string): ApiKeyRow | undefined {
  return apiKeyStmts.get.get(key);
}

export function touchApiKey(key: string): void {
  apiKeyStmts.touch.run(key);
}

export function getApiKeysByHandle(handle: string): ApiKeyRow[] {
  return apiKeyStmts.getByHandle.all(handle);
}

// ─── Wall posts ───────────────────────────────────────────────────────────────

export interface WallPost {
  id: string;
  author_handle: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content: string;
  tweet_url: string | null;
  posted_at: string;
  likes: number;
  retweets: number;
  category: "reaction" | "testimonial" | "feature_request";
  featured: number;
  created_at: string;
}

const wallStmts = {
  getWallPosts: db.prepare<[string, number, number], WallPost>(`
    SELECT * FROM wall_posts
    WHERE (? = 'all' OR category = ?)
    ORDER BY featured DESC, likes DESC, posted_at DESC
    LIMIT ? OFFSET ?
  `),
  getWallPostById: db.prepare<[string], WallPost>(`
    SELECT * FROM wall_posts WHERE id = ?
  `),
  getFeaturedWallPosts: db.prepare<[], WallPost>(`
    SELECT * FROM wall_posts
    WHERE featured = 1
    ORDER BY likes DESC, posted_at DESC
  `),
  getWallCount: db.prepare<[string], { count: number }>(`
    SELECT COUNT(*) as count FROM wall_posts
    WHERE (? = 'all' OR category = ?)
  `),
  upsertWallPost: db.prepare(`
    INSERT OR REPLACE INTO wall_posts
      (id, author_handle, author_display_name, author_avatar_url, content, tweet_url, posted_at, likes, retweets, category, featured)
    VALUES
      (@id, @author_handle, @author_display_name, @author_avatar_url, @content, @tweet_url, @posted_at, @likes, @retweets, @category, @featured)
  `),
};

export function getWallPosts(
  category = "all",
  limit = 20,
  offset = 0,
): WallPost[] {
  return wallStmts.getWallPosts.all(category, category, limit, offset);
}

export function getWallCount(category = "all"): number {
  return (wallStmts.getWallCount.get(category, category) as { count: number }).count;
}

export function getWallPostById(id: string): WallPost | undefined {
  return wallStmts.getWallPostById.get(id);
}

export function getFeaturedWallPosts(): WallPost[] {
  return wallStmts.getFeaturedWallPosts.all();
}

export function upsertWallPost(post: Omit<WallPost, "created_at">): void {
  wallStmts.upsertWallPost.run(post);
}

export function upsertWallPostsBulk(posts: Omit<WallPost, "created_at">[]): void {
  const insertMany = db.transaction((list: Omit<WallPost, "created_at">[]) => {
    for (const post of list) {
      wallStmts.upsertWallPost.run(post);
    }
  });
  insertMany(posts);
}

// ─── Waitlist ──────────────────────────────────────────────────────────────────

export interface WaitlistEntry {
  id: number;
  twitter_handle: string;
  email: string | null;
  referral_code: string;
  referred_by: string | null;
  position: number;
  status: "waiting" | "invited" | "active";
  created_at: string;
}

const waitlistStmts = {
  getByHandle: db.prepare<[string], WaitlistEntry>(
    "SELECT * FROM waitlist WHERE twitter_handle = ? LIMIT 1",
  ),
  getByReferralCode: db.prepare<[string], WaitlistEntry>(
    "SELECT * FROM waitlist WHERE referral_code = ? LIMIT 1",
  ),
  insert: db.prepare(`
    INSERT INTO waitlist (twitter_handle, email, referral_code, referred_by, position)
    VALUES (@twitter_handle, @email, @referral_code, @referred_by, @position)
  `),
  getCount: db.prepare<[], { count: number }>(
    "SELECT COUNT(*) as count FROM waitlist",
  ),
  getMaxPosition: db.prepare<[], { max_pos: number | null }>(
    "SELECT MAX(position) as max_pos FROM waitlist",
  ),
  bumpPosition: db.prepare<[string], void>(
    "UPDATE waitlist SET position = position - 1 WHERE referred_by = ? AND position > 1",
  ),
};

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function joinWaitlist(
  handle: string,
  email?: string,
  referredBy?: string,
): { position: number; referralCode: string; total: number; isExisting: boolean } {
  // Check if already exists
  const existing = waitlistStmts.getByHandle.get(handle);
  if (existing) {
    const total = (waitlistStmts.getCount.get() as { count: number }).count;
    return {
      position: existing.position,
      referralCode: existing.referral_code,
      total,
      isExisting: true,
    };
  }

  // Determine position
  const maxRow = waitlistStmts.getMaxPosition.get() as { max_pos: number | null };
  const position = (maxRow.max_pos ?? 0) + 1;

  // Generate unique referral code
  let referralCode = generateReferralCode();
  while (waitlistStmts.getByReferralCode.get(referralCode)) {
    referralCode = generateReferralCode();
  }

  // Validate referral
  let validReferral: string | null = null;
  if (referredBy) {
    const referrer = waitlistStmts.getByReferralCode.get(referredBy);
    if (referrer) {
      validReferral = referredBy;
      // Bump referrer up
      waitlistStmts.bumpPosition.run(referredBy);
    }
  }

  waitlistStmts.insert.run({
    twitter_handle: handle,
    email: email ?? null,
    referral_code: referralCode,
    referred_by: validReferral,
    position,
  });

  const total = (waitlistStmts.getCount.get() as { count: number }).count;
  return { position, referralCode, total, isExisting: false };
}

export function getWaitlistCount(): number {
  return (waitlistStmts.getCount.get() as { count: number }).count;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface AlertRow {
  id: number;
  user_handle: string;
  alert_type: "caller" | "ticker" | "consensus";
  target: string;
  threshold_pnl: number | null;
  channel: string;
  active: number;
  created_at: string;
}

export interface TriggeredAlert {
  alert_id: number;
  alert_type: string;
  target: string;
  trade_handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  posted_at: string | null;
  reason: string;
}

const alertStmts = {
  getByUser: db.prepare<[string], AlertRow>(
    "SELECT * FROM alerts WHERE user_handle = ? ORDER BY created_at DESC",
  ),
  insert: db.prepare(`
    INSERT INTO alerts (user_handle, alert_type, target, threshold_pnl, channel)
    VALUES (@user_handle, @alert_type, @target, @threshold_pnl, @channel)
  `),
  delete: db.prepare<[number, string], void>(
    "DELETE FROM alerts WHERE id = ? AND user_handle = ?",
  ),
  toggle: db.prepare<[number, string], void>(
    "UPDATE alerts SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ? AND user_handle = ?",
  ),
  getById: db.prepare<[number], AlertRow>(
    "SELECT * FROM alerts WHERE id = ?",
  ),
};

export function getUserAlerts(userHandle: string): AlertRow[] {
  return alertStmts.getByUser.all(userHandle);
}

export function createAlert(alert: {
  user_handle: string;
  alert_type: string;
  target: string;
  threshold_pnl: number | null;
  channel: string;
}): AlertRow {
  const result = alertStmts.insert.run(alert);
  return alertStmts.getById.get(result.lastInsertRowid as number) as AlertRow;
}

export function deleteAlert(id: number, userHandle: string): boolean {
  const result = alertStmts.delete.run(id, userHandle);
  return result.changes > 0;
}

export function toggleAlert(id: number, userHandle: string): AlertRow | null {
  alertStmts.toggle.run(id, userHandle);
  const row = alertStmts.getById.get(id);
  return row && row.user_handle === userHandle ? row : null;
}

export function getTriggeredAlerts(userHandle: string): TriggeredAlert[] {
  // Get all active alerts for user
  const alerts = alertStmts.getByUser.all(userHandle).filter((a) => a.active === 1);
  if (alerts.length === 0) return [];

  const triggered: TriggeredAlert[] = [];

  for (const alert of alerts) {
    let rows: Array<{ author_handle: string; ticker: string; direction: string; pnl_pct: number | null; posted_at: string | null }> = [];
    let reason = "";

    if (alert.alert_type === "caller") {
      rows = db
        .prepare<[string], { author_handle: string; ticker: string; direction: string; pnl_pct: number | null; posted_at: string | null }>(`
          SELECT author_handle, ticker, direction, pnl_pct, posted_at
          FROM trades
          WHERE author_handle = ? AND posted_at >= datetime('now', '-7 days')
          ORDER BY posted_at DESC LIMIT 10
        `)
        .all(alert.target);
      reason = `you follow @${alert.target}`;
    } else if (alert.alert_type === "ticker") {
      rows = db
        .prepare<[string], { author_handle: string; ticker: string; direction: string; pnl_pct: number | null; posted_at: string | null }>(`
          SELECT author_handle, ticker, direction, pnl_pct, posted_at
          FROM trades
          WHERE UPPER(ticker) = UPPER(?) AND posted_at >= datetime('now', '-7 days')
          ORDER BY posted_at DESC LIMIT 10
        `)
        .all(alert.target);
      reason = `you watch $${alert.target.toUpperCase()}`;
    } else if (alert.alert_type === "consensus") {
      const threshold = parseInt(alert.target) || 2;
      const consensusRows = db
        .prepare<[number], { ticker: string; direction: string; caller_count: number; latest_call: string; callers: string }>(`
          SELECT t.ticker, t.direction,
                 COUNT(DISTINCT t.author_handle) as caller_count,
                 MAX(t.posted_at) as latest_call,
                 GROUP_CONCAT(DISTINCT t.author_handle) as callers
          FROM trades t
          JOIN authors a ON a.handle = t.author_handle
          WHERE a.win_rate >= 50 AND a.total_trades >= 5
            AND t.posted_at >= datetime('now', '-7 days')
          GROUP BY t.ticker, t.direction
          HAVING COUNT(DISTINCT t.author_handle) >= ?
          ORDER BY caller_count DESC LIMIT 10
        `)
        .all(threshold);

      for (const cr of consensusRows) {
        triggered.push({
          alert_id: alert.id,
          alert_type: alert.alert_type,
          target: alert.target,
          trade_handle: cr.callers.split(",")[0] ?? "",
          ticker: cr.ticker,
          direction: cr.direction,
          pnl_pct: null,
          posted_at: cr.latest_call,
          reason: `${cr.caller_count}+ callers agree on $${cr.ticker}`,
        });
      }
      continue;
    }

    // Filter by threshold if set
    for (const row of rows) {
      if (alert.threshold_pnl != null && row.pnl_pct != null && row.pnl_pct < alert.threshold_pnl) {
        continue;
      }
      triggered.push({
        alert_id: alert.id,
        alert_type: alert.alert_type,
        target: alert.target,
        trade_handle: row.author_handle,
        ticker: row.ticker,
        direction: row.direction,
        pnl_pct: row.pnl_pct,
        posted_at: row.posted_at,
        reason,
      });
    }
  }

  return triggered;
}

export { db };
