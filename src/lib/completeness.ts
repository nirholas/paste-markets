/**
 * Completeness Score — Anti-Cherry-Pick Audit Module.
 *
 * Audits a caller by scanning their recent tweets for trade calls,
 * then cross-referencing against tracked trades in the database.
 * Produces a completeness score that reveals cherry-picking.
 */

import { neon } from "@neondatabase/serverless";
import { fetchUserTweets, type Tweet } from "./twitter-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompletenessGrade =
  | "VERIFIED"
  | "MOSTLY_COMPLETE"
  | "PARTIAL"
  | "CHERRY_PICKED"
  | "UNKNOWN";

export interface MissingCall {
  tweetId: string;
  tweetUrl: string;
  tweetText: string;
  tweetDate: string;
  detectedTicker: string;
  detectedDirection: string;
  confidence: number;
}

export interface CompletenessAudit {
  handle: string;
  auditDate: string;
  tweetsSampled: number;
  tradeRelatedTweets: number;
  trackedCalls: number;
  matchedCalls: number;
  unmatchedTweets: number;
  unmatchedTrades: number;
  completenessPercent: number;
  grade: CompletenessGrade;
  missingCalls: MissingCall[];
}

// ---------------------------------------------------------------------------
// Trade detection via Claude Haiku (same prompt as scan-processor.ts)
// ---------------------------------------------------------------------------

const DETECT_SYSTEM = `You are a trade-call detector for crypto and stock tweets.

Given a tweet, decide if it contains a specific directional trade recommendation — a call to buy or sell a named asset.

Signs of a trade call: "$TICKER long/short", "buying X", "selling X", "bullish/bearish on X with a specific ticker", price targets on named assets, "entry at X", "adding to my SOL position".

NOT a trade call: general market commentary, price observations without direction, jokes, "ser wen moon", vague statements like "market looks bad", news summaries without a recommendation.

Respond ONLY in this exact JSON (no markdown):
{
  "isTradeCall": true,
  "ticker": "SOL",
  "direction": "long",
  "market": "hyperliquid",
  "confidence": 0.85,
  "reasoning": "Explicitly says 'buying SOL here'"
}

Rules:
- confidence 0.7+ = clear call, 0.4–0.7 = possible, <0.4 = not a call
- direction: "long" | "short" | "ambiguous"
- market: "hyperliquid" (crypto perps) | "robinhood" (equities) | "polymarket" (prediction) | "crypto" (spot) | "unknown"
- If isTradeCall is false, still return valid JSON with isTradeCall: false and confidence < 0.4`;

interface TradeDetection {
  isTradeCall: boolean;
  ticker: string | null;
  direction: "long" | "short" | "ambiguous";
  market: string;
  confidence: number;
}

async function detectTrade(tweetText: string): Promise<TradeDetection | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system: DETECT_SYSTEM,
        messages: [{ role: "user", content: `Tweet: "${tweetText.slice(0, 500)}"` }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { content?: Array<{ text: string }> };
    const text = data.content?.[0]?.text ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as TradeDetection;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Database — ensure audit table exists
// ---------------------------------------------------------------------------

export async function ensureAuditTable(): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    CREATE TABLE IF NOT EXISTS caller_audits (
      id TEXT PRIMARY KEY,
      handle TEXT NOT NULL,
      audit_date TEXT NOT NULL,
      tweets_sampled INTEGER,
      trade_related_tweets INTEGER,
      tracked_calls INTEGER,
      matched_calls INTEGER,
      unmatched_tweets INTEGER,
      completeness_percent REAL,
      grade TEXT,
      missing_calls TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

// ---------------------------------------------------------------------------
// Save / load audit
// ---------------------------------------------------------------------------

export async function saveAudit(audit: CompletenessAudit): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!);
  const id = `audit_${audit.handle}_${Date.now()}`;

  await ensureAuditTable();

  await sql`
    INSERT INTO caller_audits (
      id, handle, audit_date, tweets_sampled, trade_related_tweets,
      tracked_calls, matched_calls, unmatched_tweets,
      completeness_percent, grade, missing_calls
    ) VALUES (
      ${id}, ${audit.handle}, ${audit.auditDate}, ${audit.tweetsSampled},
      ${audit.tradeRelatedTweets}, ${audit.trackedCalls}, ${audit.matchedCalls},
      ${audit.unmatchedTweets}, ${audit.completenessPercent}, ${audit.grade},
      ${JSON.stringify(audit.missingCalls)}
    )
  `;

  return id;
}

export async function getLatestAudit(handle: string): Promise<CompletenessAudit | null> {
  const sql = neon(process.env.DATABASE_URL!);

  await ensureAuditTable();

  const rows = await sql`
    SELECT * FROM caller_audits
    WHERE handle = ${handle.toLowerCase()}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    handle: row.handle as string,
    auditDate: row.audit_date as string,
    tweetsSampled: row.tweets_sampled as number,
    tradeRelatedTweets: row.trade_related_tweets as number,
    trackedCalls: row.tracked_calls as number,
    matchedCalls: row.matched_calls as number,
    unmatchedTweets: row.unmatched_tweets as number,
    unmatchedTrades: (row.tracked_calls as number) - (row.matched_calls as number),
    completenessPercent: row.completeness_percent as number,
    grade: row.grade as CompletenessGrade,
    missingCalls: JSON.parse((row.missing_calls as string) || "[]"),
  };
}

// ---------------------------------------------------------------------------
// Grade calculation
// ---------------------------------------------------------------------------

function calculateGrade(
  completenessPercent: number,
  trackedCalls: number,
  unmatchedTweets: number,
): CompletenessGrade {
  if (trackedCalls < 3 && unmatchedTweets < 3) return "UNKNOWN";
  if (completenessPercent >= 90 && trackedCalls >= 10) return "VERIFIED";
  if (completenessPercent >= 70) return "MOSTLY_COMPLETE";
  if (completenessPercent >= 40) return "PARTIAL";
  if (completenessPercent < 40 && unmatchedTweets >= 5) return "CHERRY_PICKED";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Core audit function
// ---------------------------------------------------------------------------

export async function auditCaller(handle: string): Promise<CompletenessAudit> {
  const sql = neon(process.env.DATABASE_URL!);
  const cleanHandle = handle.replace(/^@/, "").toLowerCase().trim();

  // 1. Fetch last 200 tweets
  let tweets: Tweet[];
  try {
    tweets = await fetchUserTweets(cleanHandle, 200);
  } catch {
    tweets = [];
  }

  // 2. Run each through trade detection (confidence >= 0.6)
  const detectedTrades: Array<{
    tweet: Tweet;
    detection: TradeDetection & { ticker: string };
  }> = [];

  for (const tweet of tweets) {
    if (tweet.text.length < 15) continue;

    const detection = await detectTrade(tweet.text);
    if (
      detection?.isTradeCall &&
      detection.ticker &&
      detection.confidence >= 0.6
    ) {
      detectedTrades.push({
        tweet,
        detection: detection as TradeDetection & { ticker: string },
      });
    }

    // Throttle API calls
    await new Promise((r) => setTimeout(r, 200));
  }

  // 3. Get tracked trades from DB for this handle
  const trackedRows = await sql`
    SELECT ticker, direction, tweet_date, source_url
    FROM trades
    WHERE LOWER(author_handle) = ${cleanHandle}
    ORDER BY tweet_date DESC
  `;

  const trackedCalls = trackedRows.length;

  // 4. Match detected tweets against tracked trades
  let matchedCalls = 0;
  const missingCalls: MissingCall[] = [];

  for (const { tweet, detection } of detectedTrades) {
    const tweetDate = new Date(tweet.created_at);
    const ticker = detection.ticker.toUpperCase();
    const direction = detection.direction;

    // Check if a matching trade exists (same handle + ticker + direction + within 24h)
    const isMatched = trackedRows.some((row) => {
      const rowTicker = (row.ticker as string || "").toUpperCase();
      const rowDirection = (row.direction as string || "").toLowerCase();
      const rowDate = new Date(row.tweet_date as string);

      const tickerMatch = rowTicker === ticker;
      const directionMatch =
        rowDirection === direction ||
        (direction === "ambiguous" && (rowDirection === "long" || rowDirection === "short"));
      const dateMatch =
        Math.abs(tweetDate.getTime() - rowDate.getTime()) < 24 * 60 * 60 * 1000;

      return tickerMatch && directionMatch && dateMatch;
    });

    if (isMatched) {
      matchedCalls++;
    } else {
      missingCalls.push({
        tweetId: tweet.id,
        tweetUrl: tweet.url,
        tweetText: tweet.text.slice(0, 280),
        tweetDate: tweet.created_at,
        detectedTicker: ticker,
        detectedDirection: direction,
        confidence: detection.confidence,
      });
    }
  }

  // 5. Calculate completeness
  const tradeRelatedTweets = detectedTrades.length;
  const unmatchedTweets = tradeRelatedTweets - matchedCalls;
  const unmatchedTrades = Math.max(0, trackedCalls - matchedCalls);

  // Completeness = matched / total unique calls (detected tweets + unmatched tracked)
  const totalUniqueCalls = tradeRelatedTweets + unmatchedTrades;
  const completenessPercent =
    totalUniqueCalls > 0
      ? Math.round((matchedCalls / totalUniqueCalls) * 100)
      : 100;

  const grade = calculateGrade(completenessPercent, trackedCalls, unmatchedTweets);

  const audit: CompletenessAudit = {
    handle: cleanHandle,
    auditDate: new Date().toISOString(),
    tweetsSampled: tweets.length,
    tradeRelatedTweets,
    trackedCalls,
    matchedCalls,
    unmatchedTweets,
    unmatchedTrades,
    completenessPercent,
    grade,
    missingCalls,
  };

  // 6. Save to DB
  await saveAudit(audit);

  return audit;
}
