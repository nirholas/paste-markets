/**
 * Backtest processor — exhaustive, non-selective scan of a Twitter account.
 *
 * Differences from scan-processor.ts:
 *  - Fetches up to 1000 tweets (not 200)
 *  - Computes full BacktestReport with follow/fade, grading, breakdowns
 *  - Reports granular phase progress (fetching → detecting → pricing → aggregating)
 */

import { fetchUserTweets, type Tweet } from "./twitter-fetch";
import {
  setBacktestScanning,
  setBacktestAnalyzing,
  updateBacktestProgress,
  completeBacktestJob,
  failBacktestJob,
} from "./backtest-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacktestCall {
  tweetId: string;
  tweetUrl: string;
  tweetText: string;
  tweetDate: string;
  ticker: string;
  direction: "long" | "short";
  platform: string;
  confidence: number;
  priceAtTweet: number;
  currentPrice: number;
  pnlPercent: number;
  holdDays: number;
}

export interface BacktestReport {
  handle: string;
  displayName: string;
  avatarUrl: string;
  scanDate: string;
  tweetsCovered: number;
  dateRange: { from: string; to: string };

  follow: {
    totalCalls: number;
    winRate: number;
    avgPnlPercent: number;
    cumulativePnl: number;
    bestCall: BacktestCall | null;
    worstCall: BacktestCall | null;
    sharpeApprox: number;
    maxDrawdown: number;
    winStreak: number;
    lossStreak: number;
  };

  fade: {
    winRate: number;
    avgPnlPercent: number;
    cumulativePnl: number;
  };

  grade: "S" | "A" | "B" | "C" | "D" | "F";
  gradeLabel: string;
  jimCramerScore: boolean;

  byAsset: Array<{
    ticker: string;
    calls: number;
    winRate: number;
    avgPnl: number;
  }>;
  byPlatform: Array<{
    platform: string;
    calls: number;
    winRate: number;
  }>;
  byMonth: Array<{
    month: string;
    calls: number;
    pnl: number;
  }>;

  calls: BacktestCall[];
}

// ---------------------------------------------------------------------------
// Trade detection (reuses same Claude Haiku approach as scan-processor)
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
// Submit to paste.trade for historical price
// ---------------------------------------------------------------------------

const PLATFORM_MAP: Record<string, string> = {
  hyperliquid: "hyperliquid",
  robinhood: "robinhood",
  polymarket: "polymarket",
  crypto: "hyperliquid",
  unknown: "hyperliquid",
};

const INSTRUMENT_MAP: Record<string, string> = {
  hyperliquid: "perps",
  robinhood: "stock",
  polymarket: "prediction",
  crypto: "perps",
  unknown: "perps",
};

interface PasteTradeCard {
  trade_id?: string;
  id?: string;
  url?: string;
  pnlPct?: number;
  pnl_pct?: number;
  entryPrice?: number;
  entry_price?: number;
  currentPrice?: number;
  current_price?: number;
}

async function submitToPasteTrade(
  tweet: Tweet,
  detection: TradeDetection & { ticker: string },
  handle: string,
): Promise<PasteTradeCard | null> {
  const { submitTrade } = await import("@/lib/paste-trade");

  const direction = (["long", "short"].includes(detection.direction)
    ? detection.direction
    : "long") as "long" | "short";

  const result = await submitTrade({
    ticker: detection.ticker.toUpperCase(),
    direction,
    platform: PLATFORM_MAP[detection.market] ?? "hyperliquid",
    instrument: INSTRUMENT_MAP[detection.market] ?? "perps",
    thesis: tweet.text.slice(0, 500),
    source_url: tweet.url,
    author_handle: handle,
  });

  return result as unknown as PasteTradeCard | null;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

type Grade = "S" | "A" | "B" | "C" | "D" | "F";

function computeGrade(winRate: number, avgPnl: number, totalCalls: number): Grade {
  if (winRate >= 70 && avgPnl >= 15 && totalCalls >= 15) return "S";
  if (winRate >= 60 && avgPnl >= 8 && totalCalls >= 10) return "A";
  if (winRate >= 55 && avgPnl >= 3) return "B";
  if (winRate >= 45) return "C";
  if (winRate >= 35) return "D";
  return "F";
}

function gradeLabel(grade: Grade): string {
  switch (grade) {
    case "S": return "Elite Caller";
    case "A": return "Solid Caller";
    case "B": return "Above Average";
    case "C": return "Coin Flip";
    case "D": return "Below Average";
    case "F": return "Fade Material";
  }
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function computeStreaks(pnls: number[]): { winStreak: number; lossStreak: number } {
  let maxWin = 0;
  let maxLoss = 0;
  let curWin = 0;
  let curLoss = 0;

  for (const pnl of pnls) {
    if (pnl > 0) {
      curWin++;
      curLoss = 0;
      maxWin = Math.max(maxWin, curWin);
    } else {
      curLoss++;
      curWin = 0;
      maxLoss = Math.max(maxLoss, curLoss);
    }
  }

  return { winStreak: maxWin, lossStreak: maxLoss };
}

function computeMaxDrawdown(pnls: number[]): number {
  let peak = 0;
  let cumulative = 0;
  let maxDd = 0;

  for (const pnl of pnls) {
    cumulative += pnl;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDd) maxDd = dd;
  }

  return maxDd;
}

function computeSharpe(pnls: number[]): number {
  if (pnls.length < 2) return 0;
  const avg = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const variance = pnls.reduce((s, v) => s + (v - avg) ** 2, 0) / pnls.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) return 0;
  return parseFloat((avg / stddev).toFixed(2));
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processBacktestJob(
  jobId: string,
  handle: string,
  maxTweets = 800,
): Promise<void> {
  setBacktestScanning(jobId);

  try {
    // Phase 1: Fetch tweets
    updateBacktestProgress(jobId, "fetching_tweets", 0, 0, 0);
    const tweets = await fetchUserTweets(handle, maxTweets);
    const totalTweets = tweets.length;
    updateBacktestProgress(jobId, "detecting_calls", 0, totalTweets, 0);

    // Phase 2: Detect calls + price them
    const calls: BacktestCall[] = [];
    let tweetsScanned = 0;

    for (const tweet of tweets) {
      tweetsScanned++;

      if (tweetsScanned % 10 === 0) {
        updateBacktestProgress(jobId, "detecting_calls", tweetsScanned, totalTweets, calls.length);
      }

      if (tweet.text.length < 15) continue;

      const detection = await detectTrade(tweet.text);
      if (!detection?.isTradeCall || !detection.ticker || detection.confidence < 0.7) {
        continue;
      }

      // Submit to paste.trade for historical price
      const card = await submitToPasteTrade(
        tweet,
        detection as TradeDetection & { ticker: string },
        handle,
      );

      const pnlPct = card?.pnlPct ?? card?.pnl_pct;
      const entryPrice = card?.entryPrice ?? card?.entry_price;
      const currentPrice = card?.currentPrice ?? card?.current_price;

      if (pnlPct == null || entryPrice == null || currentPrice == null) {
        // Skip calls without pricing data — can't grade what we can't measure
        continue;
      }

      const direction: "long" | "short" =
        detection.direction === "short" ? "short" : "long";

      const tweetDate = tweet.created_at;
      const holdDays = Math.max(
        1,
        Math.round(
          (Date.now() - new Date(tweetDate).getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      calls.push({
        tweetId: tweet.id,
        tweetUrl: tweet.url,
        tweetText: tweet.text,
        tweetDate,
        ticker: detection.ticker.toUpperCase(),
        direction,
        platform: PLATFORM_MAP[detection.market] ?? "hyperliquid",
        confidence: detection.confidence,
        priceAtTweet: entryPrice,
        currentPrice,
        pnlPercent: pnlPct,
        holdDays,
      });

      updateBacktestProgress(jobId, "pricing", tweetsScanned, totalTweets, calls.length);

      // Throttle
      await new Promise((r) => setTimeout(r, 250));
    }

    // Phase 3: Aggregate
    setBacktestAnalyzing(jobId);
    updateBacktestProgress(jobId, "aggregating", tweetsScanned, totalTweets, calls.length);

    const report = buildReport(handle, calls, tweetsScanned);
    completeBacktestJob(jobId, report);
  } catch (err) {
    failBacktestJob(jobId, err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildReport(
  handle: string,
  calls: BacktestCall[],
  tweetsCovered: number,
): BacktestReport {
  const pnls = calls.map((c) => c.pnlPercent);
  const wins = pnls.filter((p) => p > 0);
  const totalCalls = calls.length;

  // Follow stats
  const winRate = totalCalls > 0 ? (wins.length / totalCalls) * 100 : 0;
  const avgPnl = totalCalls > 0 ? pnls.reduce((s, v) => s + v, 0) / totalCalls : 0;
  const cumulativePnl = pnls.reduce((s, v) => s + v, 0);
  const { winStreak, lossStreak } = computeStreaks(pnls);
  const maxDrawdown = computeMaxDrawdown(pnls);
  const sharpeApprox = computeSharpe(pnls);

  // Sort by PnL to find best/worst
  const sorted = [...calls].sort((a, b) => b.pnlPercent - a.pnlPercent);
  const bestCall = sorted[0] ?? null;
  const worstCall = sorted[sorted.length - 1] ?? null;

  // Fade stats (invert every call)
  const fadePnls = pnls.map((p) => -p);
  const fadeWins = fadePnls.filter((p) => p > 0);
  const fadeWinRate = totalCalls > 0 ? (fadeWins.length / totalCalls) * 100 : 0;
  const fadeAvgPnl = totalCalls > 0 ? fadePnls.reduce((s, v) => s + v, 0) / totalCalls : 0;
  const fadeCumulativePnl = fadePnls.reduce((s, v) => s + v, 0);

  // Grade
  const grade = computeGrade(winRate, avgPnl, totalCalls);
  let label = gradeLabel(grade);
  const jimCramerScore = fadeCumulativePnl > cumulativePnl;
  if (jimCramerScore) {
    label += " (Fade Material)";
  }

  // Date range
  const dates = calls.map((c) => c.tweetDate).sort();
  const dateRange = {
    from: dates[0] ?? new Date().toISOString(),
    to: dates[dates.length - 1] ?? new Date().toISOString(),
  };

  // By asset
  const assetMap = new Map<string, { pnls: number[] }>();
  for (const call of calls) {
    const entry = assetMap.get(call.ticker) ?? { pnls: [] };
    entry.pnls.push(call.pnlPercent);
    assetMap.set(call.ticker, entry);
  }
  const byAsset = Array.from(assetMap.entries())
    .map(([ticker, { pnls: p }]) => ({
      ticker,
      calls: p.length,
      winRate: (p.filter((v) => v > 0).length / p.length) * 100,
      avgPnl: p.reduce((s, v) => s + v, 0) / p.length,
    }))
    .sort((a, b) => b.calls - a.calls);

  // By platform
  const platMap = new Map<string, { wins: number; total: number }>();
  for (const call of calls) {
    const entry = platMap.get(call.platform) ?? { wins: 0, total: 0 };
    entry.total++;
    if (call.pnlPercent > 0) entry.wins++;
    platMap.set(call.platform, entry);
  }
  const byPlatform = Array.from(platMap.entries())
    .map(([platform, { wins: w, total: t }]) => ({
      platform,
      calls: t,
      winRate: (w / t) * 100,
    }))
    .sort((a, b) => b.calls - a.calls);

  // By month
  const monthMap = new Map<string, { calls: number; pnl: number }>();
  for (const call of calls) {
    const month = call.tweetDate.slice(0, 7); // "2026-01"
    const entry = monthMap.get(month) ?? { calls: 0, pnl: 0 };
    entry.calls++;
    entry.pnl += call.pnlPercent;
    monthMap.set(month, entry);
  }
  const byMonth = Array.from(monthMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    handle,
    displayName: `@${handle}`,
    avatarUrl: "",
    scanDate: new Date().toISOString(),
    tweetsCovered,
    dateRange,

    follow: {
      totalCalls,
      winRate,
      avgPnlPercent: avgPnl,
      cumulativePnl,
      bestCall,
      worstCall,
      sharpeApprox,
      maxDrawdown,
      winStreak,
      lossStreak,
    },

    fade: {
      winRate: fadeWinRate,
      avgPnlPercent: fadeAvgPnl,
      cumulativePnl: fadeCumulativePnl,
    },

    grade,
    gradeLabel: label,
    jimCramerScore,

    byAsset,
    byPlatform,
    byMonth,
    calls: sorted, // sorted by PnL desc for display
  };
}
