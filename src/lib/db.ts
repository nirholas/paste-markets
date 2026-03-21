/**
 * Neon Postgres database connection and query functions.
 * Uses @neondatabase/serverless (HTTP driver).
 */

import { neon } from "@neondatabase/serverless";
import type { PasteTradeTrade } from "./paste-trade";
import { computeMetrics, type AuthorMetrics, type TradeSummary } from "./metrics";
import { classifyIntegrity, extractTweetId, type IntegrityClass } from "./integrity";

const sql = neon(process.env.DATABASE_URL!);

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

// --- Exported functions ---

export async function getOrCreateAuthor(handle: string): Promise<Author> {
  await sql`INSERT INTO authors (handle) VALUES (${handle}) ON CONFLICT DO NOTHING`;
  const rows = await sql`SELECT * FROM authors WHERE handle = ${handle}`;
  return rows[0] as Author;
}

export interface XProfileData {
  avatarUrl: string | null;
  bannerUrl: string | null;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  followers: number;
  following: number;
  tweetCount: number;
  joinedAt: string | null;
}

/** Update author row with X profile data */
export async function updateXProfile(handle: string, profile: XProfileData): Promise<void> {
  await sql`
    UPDATE authors SET
      avatar_url = ${profile.avatarUrl},
      banner_url = ${profile.bannerUrl},
      display_name = COALESCE(${profile.displayName}, display_name),
      bio = ${profile.bio},
      location = ${profile.location},
      website = ${profile.website},
      verified = ${profile.verified},
      followers = ${profile.followers},
      following = ${profile.following},
      tweet_count = ${profile.tweetCount},
      x_joined_at = ${profile.joinedAt},
      x_profile_fetched_at = NOW()
    WHERE handle = ${handle}
  `;
}

/** Check if X profile data is stale (older than 24 hours) */
export function isXProfileStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) return true;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age > 24 * 60 * 60 * 1000; // 24 hours
}

export async function upsertTrades(handle: string, trades: PasteTradeTrade[]): Promise<void> {
  for (const t of trades) {
    const tweetCreatedAt = t.author_date ?? null;
    const submittedAt = t.posted_at ?? null;
    const { integrity, delayMinutes, countedInStats } = classifyIntegrity(
      tweetCreatedAt,
      submittedAt,
    );
    const tweetId = extractTweetId(t.source_url);

    const author_handle = handle;
    const ticker = t.ticker;
    const direction = t.direction;
    const pnl_pct = t.pnlPct ?? null;
    const platform = t.platform ?? null;
    const entry_date = tweetCreatedAt;
    const posted_at = submittedAt;
    const source_url = t.source_url ?? null;
    const tweet_id = tweetId;
    const tweet_created_at = tweetCreatedAt;
    const submitted_at = submittedAt;
    const delay_minutes = delayMinutes;
    const integrityVal = integrity;
    const counted_in_stats = countedInStats ? 1 : 0;
    const price_at_tweet_time = t.entryPrice ?? null;
    const price_at_submission = t.entryPrice ?? null;

    await sql`
      INSERT INTO trades (
        author_handle, ticker, direction, pnl_pct, platform, entry_date, posted_at, source_url,
        tweet_id, tweet_created_at, submitted_at, delay_minutes, integrity, counted_in_stats,
        price_at_tweet_time, price_at_submission
      )
      VALUES (
        ${author_handle}, ${ticker}, ${direction}, ${pnl_pct}, ${platform}, ${entry_date}, ${posted_at}, ${source_url},
        ${tweet_id}, ${tweet_created_at}, ${submitted_at}, ${delay_minutes}, ${integrityVal}, ${counted_in_stats},
        ${price_at_tweet_time}, ${price_at_submission}
      )
      ON CONFLICT (author_handle, ticker, direction, entry_date) DO UPDATE SET
        pnl_pct = EXCLUDED.pnl_pct,
        platform = EXCLUDED.platform,
        posted_at = EXCLUDED.posted_at,
        source_url = EXCLUDED.source_url,
        fetched_at = NOW(),
        tweet_id = EXCLUDED.tweet_id,
        tweet_created_at = EXCLUDED.tweet_created_at,
        submitted_at = EXCLUDED.submitted_at,
        delay_minutes = EXCLUDED.delay_minutes,
        integrity = EXCLUDED.integrity,
        counted_in_stats = EXCLUDED.counted_in_stats,
        price_at_tweet_time = EXCLUDED.price_at_tweet_time,
        price_at_submission = EXCLUDED.price_at_submission
    `;
  }
}

export async function getAuthorTrades(handle: string): Promise<TradeSummary[]> {
  const rows = await sql`
    SELECT ticker, direction, pnl_pct, platform, entry_date, posted_at, source_url,
           integrity, delay_minutes, counted_in_stats, tweet_deleted_at,
           price_at_tweet_time, price_at_submission
    FROM trades WHERE author_handle = ${handle} ORDER BY entry_date DESC
  `;
  return rows as TradeSummary[];
}

export async function getAuthorMetrics(handle: string): Promise<AuthorMetrics | null> {
  const authorRows = await sql`SELECT * FROM authors WHERE handle = ${handle}`;
  const author = authorRows[0];
  if (!author) return null;

  const trades = await getAuthorTrades(handle);
  return computeMetrics(handle, trades);
}

export async function getLeaderboard(
  timeframe = "30d",
  limit = 50,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const rows = await sql`
    SELECT r.author_handle AS handle, r.rank, r.prev_rank, r.win_rate, r.avg_pnl,
           r.total_trades, r.total_pnl, COALESCE(r.streak, 0) as streak
    FROM rankings r
    WHERE r.timeframe = ${timeframe}
    ORDER BY r.rank ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows as LeaderboardEntry[];
}

export async function getStreakLeaderboard(limit = 50, offset = 0): Promise<LeaderboardEntry[]> {
  const rows = await sql`
    SELECT r.author_handle AS handle, r.rank, r.prev_rank, r.win_rate, r.avg_pnl,
           r.total_trades, r.total_pnl, COALESCE(r.streak, 0) as streak
    FROM rankings r
    WHERE r.timeframe = '30d' AND r.streak > 0
    ORDER BY r.streak DESC, r.win_rate DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows as LeaderboardEntry[];
}

export async function getTickerLeaderboard(ticker: string, limit = 50): Promise<LeaderboardEntry[]> {
  const rows = await sql`
    SELECT t.author_handle,
           SUM(t.pnl_pct) as total_pnl,
           COUNT(*) as trade_count,
           SUM(CASE WHEN t.pnl_pct > 0 THEN 1 ELSE 0 END) as win_count
    FROM trades t
    WHERE UPPER(t.ticker) = UPPER(${ticker})
      AND t.pnl_pct IS NOT NULL
    GROUP BY t.author_handle
    HAVING COUNT(*) >= 1
    ORDER BY total_pnl DESC
    LIMIT ${limit}
  `;

  return rows.map((r: any, i: number) => ({
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

export async function getPopularTickers(limit = 20): Promise<string[]> {
  const rows = await sql`
    SELECT ticker, COUNT(*) as cnt
    FROM trades
    WHERE ticker != '' AND pnl_pct IS NOT NULL
    GROUP BY ticker
    ORDER BY cnt DESC
    LIMIT ${limit}
  `;
  return rows.map((r: any) => r.ticker);
}

export async function updateRankings(timeframe = "30d"): Promise<void> {
  const authors = await sql`SELECT * FROM authors ORDER BY rank ASC NULLS LAST` as Author[];

  // Get previous ranks before deleting
  const prevRankRows = await sql`SELECT author_handle, rank FROM rankings WHERE timeframe = ${timeframe}`;
  const prevRankMap = new Map<string, number>();
  for (const row of prevRankRows) {
    prevRankMap.set(row.author_handle as string, row.rank as number);
  }

  // Compute metrics for each author with trades
  const ranked: { handle: string; winRate: number; avgPnl: number; totalTrades: number; totalPnl: number; streak: number }[] = [];

  for (const author of authors) {
    const trades = await getAuthorTrades(author.handle);
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

  // Write rankings
  await sql`DELETE FROM rankings WHERE timeframe = ${timeframe}`;

  for (let i = 0; i < ranked.length; i++) {
    const entry = ranked[i]!;
    const rank = i + 1;
    const prev_rank = prevRankMap.get(entry.handle) ?? null;

    await sql`
      INSERT INTO rankings (author_handle, rank, prev_rank, win_rate, avg_pnl, total_trades, total_pnl, streak, timeframe)
      VALUES (${entry.handle}, ${rank}, ${prev_rank}, ${entry.winRate}, ${entry.avgPnl}, ${entry.totalTrades}, ${entry.totalPnl}, ${entry.streak}, ${timeframe})
    `;

    await sql`UPDATE authors SET rank = ${rank} WHERE handle = ${entry.handle}`;
  }
}

export async function updateAuthorRecord(handle: string, metrics: AuthorMetrics): Promise<void> {
  const total_trades = metrics.totalTrades;
  const win_count = metrics.winCount;
  const loss_count = metrics.lossCount;
  const win_rate = metrics.winRate;
  const avg_pnl = metrics.avgPnl;
  const best_pnl = metrics.bestTrade?.pnl ?? null;
  const worst_pnl = metrics.worstTrade?.pnl ?? null;
  const best_ticker = metrics.bestTrade?.ticker ?? null;
  const worst_ticker = metrics.worstTrade?.ticker ?? null;

  await sql`
    UPDATE authors SET
      last_fetched = NOW(),
      total_trades = ${total_trades},
      win_count = ${win_count},
      loss_count = ${loss_count},
      win_rate = ${win_rate},
      avg_pnl = ${avg_pnl},
      best_pnl = ${best_pnl},
      worst_pnl = ${worst_pnl},
      best_ticker = ${best_ticker},
      worst_ticker = ${worst_ticker}
    WHERE handle = ${handle}
  `;
}

export async function getHeadToHead(
  a: string,
  b: string,
): Promise<{ a: AuthorMetrics; b: AuthorMetrics } | null> {
  const metricsA = await getAuthorMetrics(a);
  const metricsB = await getAuthorMetrics(b);
  if (!metricsA || !metricsB) return null;
  return { a: metricsA, b: metricsB };
}

export async function recordView(handle: string, page: string): Promise<void> {
  await sql`INSERT INTO views (author_handle, page) VALUES (${handle}, ${page})`;
}

export async function getTrending(): Promise<string[]> {
  const rows = await sql`
    SELECT author_handle, COUNT(*) as view_count
    FROM views
    WHERE viewed_at > NOW() - INTERVAL '24 hours'
    GROUP BY author_handle
    ORDER BY view_count DESC
    LIMIT 10
  `;
  return rows.map((r: any) => r.author_handle);
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

export async function getIntegrityStats(handle: string): Promise<IntegrityStats> {
  const rows = await sql`
    SELECT integrity, COUNT(*) as count
    FROM trades
    WHERE author_handle = ${handle}
    GROUP BY integrity
  `;
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    counts[row.integrity as string] = row.count as number;
    total += row.count as number;
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

export async function markTweetDeleted(tweetId: string): Promise<void> {
  await sql`UPDATE trades SET tweet_deleted_at = NOW() WHERE tweet_id = ${tweetId} AND tweet_deleted_at IS NULL`;
}

export async function getLiveTradesForMonitor(): Promise<Array<{
  tweet_id: string;
  author_handle: string;
  ticker: string;
  direction: string;
  entry_date: string;
}>> {
  const rows = await sql`
    SELECT tweet_id, author_handle, ticker, direction, entry_date
    FROM trades
    WHERE tweet_id IS NOT NULL
      AND tweet_deleted_at IS NULL
      AND submitted_at >= NOW() - INTERVAL '90 days'
    ORDER BY submitted_at DESC
    LIMIT 500
  `;
  return rows as Array<{
    tweet_id: string;
    author_handle: string;
    ticker: string;
    direction: string;
    entry_date: string;
  }>;
}

export async function getRecentTrades(limit = 50): Promise<Array<{
  handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  posted_at: string;
}>> {
  const rows = await sql`
    SELECT t.author_handle AS handle, t.ticker, t.direction, t.pnl_pct, t.posted_at
    FROM trades t
    WHERE t.posted_at IS NOT NULL
    ORDER BY t.posted_at DESC
    LIMIT ${limit}
  `;
  return rows as Array<{
    handle: string;
    ticker: string;
    direction: string;
    pnl_pct: number | null;
    posted_at: string;
  }>;
}

export async function getSmartCalls(): Promise<SmartCall[]> {
  const rows = await sql`
    SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct,
           t.platform, t.posted_at, t.source_url,
           a.win_rate, a.avg_pnl, a.total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE a.win_rate >= 55
      AND a.total_trades >= 5
      AND t.posted_at >= NOW() - INTERVAL '7 days'
    ORDER BY a.win_rate DESC, t.posted_at DESC
    LIMIT 25
  `;
  return rows as SmartCall[];
}

export async function getConsensusSignals(): Promise<ConsensusSignal[]> {
  const rows = await sql`
    SELECT t.ticker, t.direction,
           COUNT(DISTINCT t.author_handle) as caller_count,
           AVG(a.win_rate) as avg_caller_win_rate,
           AVG(t.pnl_pct) as avg_pnl,
           MAX(t.posted_at) as latest_call,
           STRING_AGG(DISTINCT t.author_handle::text, ',') as callers
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE a.win_rate >= 50
      AND a.total_trades >= 5
      AND t.posted_at >= NOW() - INTERVAL '14 days'
    GROUP BY t.ticker, t.direction
    HAVING COUNT(DISTINCT t.author_handle) >= 2
    ORDER BY caller_count DESC, avg_caller_win_rate DESC
    LIMIT 12
  `;
  return rows.map((row: any) => ({
    ...row,
    callers: row.callers ? row.callers.split(",") : [],
  }));
}

export async function getFadeCalls(): Promise<FadeCall[]> {
  const rows = await sql`
    SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct,
           t.platform, t.posted_at,
           a.win_rate, a.total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE a.win_rate <= 38
      AND a.total_trades >= 8
      AND t.posted_at >= NOW() - INTERVAL '7 days'
    ORDER BY a.win_rate ASC, t.posted_at DESC
    LIMIT 10
  `;
  return rows as FadeCall[];
}

export async function getTickerStats(ticker: string): Promise<TickerStat[]> {
  const rows = await sql`
    SELECT t.author_handle, t.direction, t.pnl_pct, t.posted_at,
           a.win_rate, a.avg_pnl, a.total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE t.ticker = ${ticker}
      AND t.pnl_pct IS NOT NULL
    ORDER BY t.posted_at DESC
    LIMIT 50
  `;
  return rows as TickerStat[];
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

export async function getAllTickers(): Promise<TickerSummary[]> {
  const rows = await sql`
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
  `;
  return rows as TickerSummary[];
}

export async function getTickerTrades(ticker: string): Promise<TickerTrade[]> {
  const rows = await sql`
    SELECT t.author_handle, t.direction, t.pnl_pct, t.platform,
           t.entry_date, t.posted_at, t.source_url,
           a.win_rate as author_win_rate,
           a.avg_pnl as author_avg_pnl,
           a.total_trades as author_total_trades
    FROM trades t
    JOIN authors a ON a.handle = t.author_handle
    WHERE t.ticker = ${ticker}
    ORDER BY t.pnl_pct DESC NULLS LAST
    LIMIT 100
  `;
  return rows as TickerTrade[];
}

export async function searchAuthors(
  query: string,
  limit = 10,
): Promise<Array<{ handle: string; totalTrades: number; winRate: number }>> {
  const pattern = `${query}%`;
  const rows = await sql`
    SELECT handle, total_trades, win_rate FROM authors WHERE handle LIKE ${pattern} ORDER BY total_trades DESC LIMIT ${limit}
  `;
  return rows.map((r: any) => ({
    handle: r.handle,
    totalTrades: r.total_trades,
    winRate: r.win_rate,
  }));
}

export async function getAuthorRecord(handle: string): Promise<Author | undefined> {
  const rows = await sql`SELECT * FROM authors WHERE handle = ${handle}`;
  return rows[0] as Author | undefined;
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

export async function insertApiKey(key: string, handle: string, tier: "free" | "developer" = "free"): Promise<void> {
  await sql`INSERT INTO api_keys (key, handle, tier) VALUES (${key}, ${handle}, ${tier}) ON CONFLICT DO NOTHING`;
}

export async function getApiKey(key: string): Promise<ApiKeyRow | undefined> {
  const rows = await sql`SELECT * FROM api_keys WHERE key = ${key} LIMIT 1`;
  return rows[0] as ApiKeyRow | undefined;
}

export async function touchApiKey(key: string): Promise<void> {
  await sql`UPDATE api_keys SET last_used = NOW(), request_count = request_count + 1 WHERE key = ${key}`;
}

export async function getApiKeysByHandle(handle: string): Promise<ApiKeyRow[]> {
  const rows = await sql`SELECT * FROM api_keys WHERE handle = ${handle} ORDER BY created_at DESC`;
  return rows as ApiKeyRow[];
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

export async function getWallPosts(
  category = "all",
  limit = 20,
  offset = 0,
): Promise<WallPost[]> {
  const rows = await sql`
    SELECT * FROM wall_posts
    WHERE (${category} = 'all' OR category = ${category})
    ORDER BY featured DESC, likes DESC, posted_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows as WallPost[];
}

export async function getWallCount(category = "all"): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) as count FROM wall_posts
    WHERE (${category} = 'all' OR category = ${category})
  `;
  return (rows[0] as { count: number }).count;
}

export async function getWallPostById(id: string): Promise<WallPost | undefined> {
  const rows = await sql`SELECT * FROM wall_posts WHERE id = ${id}`;
  return rows[0] as WallPost | undefined;
}

export async function getFeaturedWallPosts(): Promise<WallPost[]> {
  const rows = await sql`
    SELECT * FROM wall_posts
    WHERE featured = 1
    ORDER BY likes DESC, posted_at DESC
  `;
  return rows as WallPost[];
}

export async function upsertWallPost(post: Omit<WallPost, "created_at">): Promise<void> {
  await sql`
    INSERT INTO wall_posts
      (id, author_handle, author_display_name, author_avatar_url, content, tweet_url, posted_at, likes, retweets, category, featured)
    VALUES
      (${post.id}, ${post.author_handle}, ${post.author_display_name}, ${post.author_avatar_url}, ${post.content}, ${post.tweet_url}, ${post.posted_at}, ${post.likes}, ${post.retweets}, ${post.category}, ${post.featured})
    ON CONFLICT (id) DO UPDATE SET
      author_handle = EXCLUDED.author_handle,
      author_display_name = EXCLUDED.author_display_name,
      author_avatar_url = EXCLUDED.author_avatar_url,
      content = EXCLUDED.content,
      tweet_url = EXCLUDED.tweet_url,
      posted_at = EXCLUDED.posted_at,
      likes = EXCLUDED.likes,
      retweets = EXCLUDED.retweets,
      category = EXCLUDED.category,
      featured = EXCLUDED.featured
  `;
}

export async function upsertWallPostsBulk(posts: Omit<WallPost, "created_at">[]): Promise<void> {
  for (const post of posts) {
    await upsertWallPost(post);
  }
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

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function joinWaitlist(
  handle: string,
  email?: string,
  referredBy?: string,
): Promise<{ position: number; referralCode: string; total: number; isExisting: boolean }> {
  // Check if already exists
  const existingRows = await sql`SELECT * FROM waitlist WHERE twitter_handle = ${handle} LIMIT 1`;
  const existing = existingRows[0] as WaitlistEntry | undefined;
  if (existing) {
    const totalRows = await sql`SELECT COUNT(*) as count FROM waitlist`;
    const total = (totalRows[0] as { count: number }).count;
    return {
      position: existing.position,
      referralCode: existing.referral_code,
      total,
      isExisting: true,
    };
  }

  // Determine position
  const maxRow = await sql`SELECT MAX(position) as max_pos FROM waitlist`;
  const position = ((maxRow[0] as { max_pos: number | null }).max_pos ?? 0) + 1;

  // Generate unique referral code
  let referralCode = generateReferralCode();
  let codeExists = await sql`SELECT * FROM waitlist WHERE referral_code = ${referralCode} LIMIT 1`;
  while (codeExists.length > 0) {
    referralCode = generateReferralCode();
    codeExists = await sql`SELECT * FROM waitlist WHERE referral_code = ${referralCode} LIMIT 1`;
  }

  // Validate referral
  let validReferral: string | null = null;
  if (referredBy) {
    const referrerRows = await sql`SELECT * FROM waitlist WHERE referral_code = ${referredBy} LIMIT 1`;
    if (referrerRows.length > 0) {
      validReferral = referredBy;
      // Bump referrer up
      await sql`UPDATE waitlist SET position = position - 1 WHERE referred_by = ${referredBy} AND position > 1`;
    }
  }

  const emailVal = email ?? null;
  await sql`
    INSERT INTO waitlist (twitter_handle, email, referral_code, referred_by, position)
    VALUES (${handle}, ${emailVal}, ${referralCode}, ${validReferral}, ${position})
  `;

  const totalRows = await sql`SELECT COUNT(*) as count FROM waitlist`;
  const total = (totalRows[0] as { count: number }).count;
  return { position, referralCode, total, isExisting: false };
}

export async function getWaitlistCount(): Promise<number> {
  const rows = await sql`SELECT COUNT(*) as count FROM waitlist`;
  return (rows[0] as { count: number }).count;
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

export async function getUserAlerts(userHandle: string): Promise<AlertRow[]> {
  const rows = await sql`SELECT * FROM alerts WHERE user_handle = ${userHandle} ORDER BY created_at DESC`;
  return rows as AlertRow[];
}

export async function createAlert(alert: {
  user_handle: string;
  alert_type: string;
  target: string;
  threshold_pnl: number | null;
  channel: string;
}): Promise<AlertRow> {
  const inserted = await sql`
    INSERT INTO alerts (user_handle, alert_type, target, threshold_pnl, channel)
    VALUES (${alert.user_handle}, ${alert.alert_type}, ${alert.target}, ${alert.threshold_pnl}, ${alert.channel})
    RETURNING *
  `;
  return inserted[0] as AlertRow;
}

export async function deleteAlert(id: number, userHandle: string): Promise<boolean> {
  const result = await sql`DELETE FROM alerts WHERE id = ${id} AND user_handle = ${userHandle} RETURNING id`;
  return result.length > 0;
}

export async function toggleAlert(id: number, userHandle: string): Promise<AlertRow | null> {
  await sql`UPDATE alerts SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ${id} AND user_handle = ${userHandle}`;
  const rows = await sql`SELECT * FROM alerts WHERE id = ${id}`;
  const row = rows[0] as AlertRow | undefined;
  return row && row.user_handle === userHandle ? row : null;
}

export async function getTriggeredAlerts(userHandle: string): Promise<TriggeredAlert[]> {
  // Get all active alerts for user
  const allAlerts = await sql`SELECT * FROM alerts WHERE user_handle = ${userHandle} ORDER BY created_at DESC`;
  const alerts = (allAlerts as AlertRow[]).filter((a) => a.active === 1);
  if (alerts.length === 0) return [];

  const triggered: TriggeredAlert[] = [];

  for (const alert of alerts) {
    let rows: Array<{ author_handle: string; ticker: string; direction: string; pnl_pct: number | null; posted_at: string | null }> = [];
    let reason = "";

    if (alert.alert_type === "caller") {
      rows = await sql`
        SELECT author_handle, ticker, direction, pnl_pct, posted_at
        FROM trades
        WHERE author_handle = ${alert.target} AND posted_at >= NOW() - INTERVAL '7 days'
        ORDER BY posted_at DESC LIMIT 10
      ` as any[];
      reason = `you follow @${alert.target}`;
    } else if (alert.alert_type === "ticker") {
      rows = await sql`
        SELECT author_handle, ticker, direction, pnl_pct, posted_at
        FROM trades
        WHERE UPPER(ticker) = UPPER(${alert.target}) AND posted_at >= NOW() - INTERVAL '7 days'
        ORDER BY posted_at DESC LIMIT 10
      ` as any[];
      reason = `you watch $${alert.target.toUpperCase()}`;
    } else if (alert.alert_type === "consensus") {
      const threshold = parseInt(alert.target) || 2;
      const consensusRows = await sql`
        SELECT t.ticker, t.direction,
               COUNT(DISTINCT t.author_handle) as caller_count,
               MAX(t.posted_at) as latest_call,
               STRING_AGG(DISTINCT t.author_handle::text, ',') as callers
        FROM trades t
        JOIN authors a ON a.handle = t.author_handle
        WHERE a.win_rate >= 50 AND a.total_trades >= 5
          AND t.posted_at >= NOW() - INTERVAL '7 days'
        GROUP BY t.ticker, t.direction
        HAVING COUNT(DISTINCT t.author_handle) >= ${threshold}
        ORDER BY caller_count DESC LIMIT 10
      `;

      for (const cr of consensusRows) {
        triggered.push({
          alert_id: alert.id,
          alert_type: alert.alert_type,
          target: alert.target,
          trade_handle: (cr.callers as string).split(",")[0] ?? "",
          ticker: cr.ticker as string,
          direction: cr.direction as string,
          pnl_pct: null,
          posted_at: cr.latest_call as string,
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

// ---------------------------------------------------------------------------
// Source Extractions ("What's The Trade?" multi-thesis)
// ---------------------------------------------------------------------------

export interface SourceExtractionRow {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  author: string | null;
  summary: string | null;
  word_count: number;
  thesis_count: number;
  processing_time_ms: number;
  created_at: string;
}

export interface ExtractedThesisRow {
  id: string;
  extraction_id: string;
  ticker: string;
  direction: string;
  platform: string;
  confidence: number;
  reasoning: string | null;
  quote: string | null;
  timeframe: string | null;
  conviction: string;
  price_at_extraction: number | null;
  paste_trade_id: string | null;
  paste_trade_url: string | null;
  current_pnl: number | null;
  tracked_at: string | null;
  created_at: string;
}

export async function saveExtraction(extraction: {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string;
  author: string | null;
  summary: string;
  word_count: number;
  thesis_count: number;
  processing_time_ms: number;
  theses: Array<{
    id: string;
    ticker: string;
    direction: string;
    platform: string;
    confidence: number;
    reasoning: string;
    quote: string;
    timeframe: string | null;
    conviction: string;
    price_at_extraction: number | null;
  }>;
}): Promise<void> {
  await sql`
    INSERT INTO source_extractions (id, source_type, source_url, title, author, summary, word_count, thesis_count, processing_time_ms)
    VALUES (${extraction.id}, ${extraction.source_type}, ${extraction.source_url}, ${extraction.title}, ${extraction.author}, ${extraction.summary}, ${extraction.word_count}, ${extraction.thesis_count}, ${extraction.processing_time_ms})
  `;

  for (const thesis of extraction.theses) {
    await sql`
      INSERT INTO extracted_theses (id, extraction_id, ticker, direction, platform, confidence, reasoning, quote, timeframe, conviction, price_at_extraction)
      VALUES (${thesis.id}, ${extraction.id}, ${thesis.ticker}, ${thesis.direction}, ${thesis.platform}, ${thesis.confidence}, ${thesis.reasoning}, ${thesis.quote}, ${thesis.timeframe}, ${thesis.conviction}, ${thesis.price_at_extraction})
    `;
  }
}

export async function getExtraction(id: string): Promise<(SourceExtractionRow & { theses: ExtractedThesisRow[] }) | null> {
  const rows = await sql`SELECT * FROM source_extractions WHERE id = ${id}`;
  const row = rows[0] as SourceExtractionRow | undefined;
  if (!row) return null;
  const theses = await sql`SELECT * FROM extracted_theses WHERE extraction_id = ${id} ORDER BY confidence DESC`;
  return { ...row, theses: theses as ExtractedThesisRow[] };
}

export async function getRecentExtractions(limit = 10): Promise<SourceExtractionRow[]> {
  const rows = await sql`SELECT * FROM source_extractions ORDER BY created_at DESC LIMIT ${limit}`;
  return rows as SourceExtractionRow[];
}

export async function trackThesis(
  thesisId: string,
  pasteTradeId: string,
  pasteTradeUrl: string,
  priceAtExtraction: number | null,
): Promise<void> {
  await sql`
    UPDATE extracted_theses
    SET paste_trade_id = ${pasteTradeId},
        paste_trade_url = ${pasteTradeUrl},
        price_at_extraction = ${priceAtExtraction},
        tracked_at = NOW()
    WHERE id = ${thesisId}
  `;
}

export async function getSourcePerformance(extractionId: string): Promise<{
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  tracked: number;
}> {
  const theses = await sql`SELECT * FROM extracted_theses WHERE extraction_id = ${extractionId} ORDER BY confidence DESC` as ExtractedThesisRow[];
  const tracked = theses.filter((t) => t.paste_trade_id != null);
  const withPnl = tracked.filter((t) => t.current_pnl != null);
  const wins = withPnl.filter((t) => (t.current_pnl ?? 0) > 0).length;
  const losses = withPnl.filter((t) => (t.current_pnl ?? 0) <= 0).length;
  const totalPnl = withPnl.reduce((sum, t) => sum + (t.current_pnl ?? 0), 0);

  return {
    total: theses.length,
    wins,
    losses,
    winRate: withPnl.length > 0 ? (wins / withPnl.length) * 100 : 0,
    avgPnl: withPnl.length > 0 ? totalPnl / withPnl.length : 0,
    tracked: tracked.length,
  };
}

// ── Copytrading Alert Rules ──────────────────────────────────────────────────

import type { AlertRule, AlertCondition, AlertChannel } from "./alert-rules";

export interface AlertRuleRow {
  id: string;
  user_id: string;
  name: string;
  conditions: string;
  channels: string;
  enabled: number;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
}

export interface AlertNotificationRow {
  id: string;
  rule_id: string;
  trade_id: string | null;
  caller_handle: string | null;
  ticker: string | null;
  direction: string | null;
  message: string;
  channel: string;
  delivered: number;
  read_at: string | null;
  created_at: string;
}

function rowToAlertRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    enabled: row.enabled === 1,
    conditions: JSON.parse(row.conditions) as AlertCondition[],
    channels: JSON.parse(row.channels) as AlertChannel[],
    matchCount: row.match_count,
    lastMatchedAt: row.last_matched_at,
    createdAt: row.created_at,
  };
}

export async function getAlertRulesByUser(userId: string): Promise<AlertRule[]> {
  const rows = await sql`SELECT * FROM alert_rules WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return (rows as AlertRuleRow[]).map(rowToAlertRule);
}

export async function getAllEnabledAlertRules(): Promise<AlertRule[]> {
  const rows = await sql`SELECT * FROM alert_rules WHERE enabled = 1`;
  return (rows as AlertRuleRow[]).map(rowToAlertRule);
}

export async function getAlertRuleById(id: string): Promise<AlertRule | null> {
  const rows = await sql`SELECT * FROM alert_rules WHERE id = ${id}`;
  const row = rows[0] as AlertRuleRow | undefined;
  return row ? rowToAlertRule(row) : null;
}

export async function insertAlertRule(rule: AlertRule): Promise<void> {
  const conditions = JSON.stringify(rule.conditions);
  const channels = JSON.stringify(rule.channels);
  const enabled = rule.enabled ? 1 : 0;
  await sql`
    INSERT INTO alert_rules (id, user_id, name, conditions, channels, enabled)
    VALUES (${rule.id}, ${rule.userId}, ${rule.name}, ${conditions}, ${channels}, ${enabled})
  `;
}

export async function updateAlertRule(rule: AlertRule): Promise<boolean> {
  const conditions = JSON.stringify(rule.conditions);
  const channels = JSON.stringify(rule.channels);
  const enabled = rule.enabled ? 1 : 0;
  const result = await sql`
    UPDATE alert_rules SET name = ${rule.name}, conditions = ${conditions}, channels = ${channels}, enabled = ${enabled}
    WHERE id = ${rule.id} AND user_id = ${rule.userId}
    RETURNING id
  `;
  return result.length > 0;
}

export async function deleteAlertRule(id: string, userId: string): Promise<boolean> {
  const result = await sql`DELETE FROM alert_rules WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return result.length > 0;
}

export async function toggleAlertRule(id: string, userId: string): Promise<AlertRule | null> {
  await sql`UPDATE alert_rules SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ${id} AND user_id = ${userId}`;
  const rows = await sql`SELECT * FROM alert_rules WHERE id = ${id}`;
  const row = rows[0] as AlertRuleRow | undefined;
  return row && row.user_id === userId ? rowToAlertRule(row) : null;
}

export async function incrementAlertRuleMatch(id: string): Promise<void> {
  await sql`UPDATE alert_rules SET match_count = match_count + 1, last_matched_at = NOW() WHERE id = ${id}`;
}

export async function insertAlertNotification(notif: {
  id: string;
  ruleId: string;
  tradeId?: string;
  callerHandle?: string;
  ticker?: string;
  direction?: string;
  message: string;
  channel: string;
  delivered: boolean;
}): Promise<void> {
  const trade_id = notif.tradeId ?? null;
  const caller_handle = notif.callerHandle ?? null;
  const ticker = notif.ticker ?? null;
  const direction = notif.direction ?? null;
  const delivered = notif.delivered ? 1 : 0;
  await sql`
    INSERT INTO alert_notifications (id, rule_id, trade_id, caller_handle, ticker, direction, message, channel, delivered)
    VALUES (${notif.id}, ${notif.ruleId}, ${trade_id}, ${caller_handle}, ${ticker}, ${direction}, ${notif.message}, ${notif.channel}, ${delivered})
  `;
}

export async function getUnreadNotifications(userId: string): Promise<AlertNotificationRow[]> {
  const rows = await sql`
    SELECT n.* FROM alert_notifications n
    JOIN alert_rules r ON r.id = n.rule_id
    WHERE r.user_id = ${userId} AND n.read_at IS NULL
    ORDER BY n.created_at DESC
    LIMIT 50
  `;
  return rows as AlertNotificationRow[];
}

export async function getNotificationsByUser(userId: string, limit = 50): Promise<AlertNotificationRow[]> {
  const rows = await sql`
    SELECT n.* FROM alert_notifications n
    JOIN alert_rules r ON r.id = n.rule_id
    WHERE r.user_id = ${userId}
    ORDER BY n.created_at DESC
    LIMIT ${limit}
  `;
  return rows as AlertNotificationRow[];
}

export async function markNotificationRead(userId: string, notifId: string): Promise<void> {
  await sql`
    UPDATE alert_notifications SET read_at = NOW()
    WHERE rule_id IN (SELECT id FROM alert_rules WHERE user_id = ${userId})
      AND read_at IS NULL AND id = ${notifId}
  `;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await sql`
    UPDATE alert_notifications SET read_at = NOW()
    WHERE rule_id IN (SELECT id FROM alert_rules WHERE user_id = ${userId})
      AND read_at IS NULL
  `;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) as count FROM alert_notifications n
    JOIN alert_rules r ON r.id = n.rule_id
    WHERE r.user_id = ${userId} AND n.read_at IS NULL
  `;
  return (rows[0] as { count: number })?.count ?? 0;
}

export { sql };
