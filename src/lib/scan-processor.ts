/**
 * Core bulk-scan pipeline.
 *
 * For each tweet from a target handle:
 *  1. Run Claude Haiku to detect whether it's a trade call
 *  2. If confidence >= 0.7, submit to paste.trade to lock historical price + create card
 *  3. Collect PnL, compute aggregate stats, store in scan_jobs table
 */

import { fetchUserTweets, type Tweet } from "./twitter-fetch";
import {
  setJobRunning,
  updateJobProgress,
  completeJob,
  failJob,
} from "./scan-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedCall {
  tweetId: string;
  tweetUrl: string;
  tweetText: string;
  tweetDate: string;
  detectedCall: {
    ticker: string;
    direction: "long" | "short" | "ambiguous";
    market: string;
    confidence: number;
  };
  priceAtTweet?: number;
  currentPrice?: number;
  pnlPercent?: number;
  pasteTradeCardUrl?: string;
  trade_id?: string;
}

export interface ScanStats {
  winRate: number;
  avgPnlPercent: number;
  totalPnlIfFollowed: number;
  inversePerformance: number;
  bestCall: DetectedCall | null;
  worstCall: DetectedCall | null;
}

export interface ScanResult {
  handle: string;
  tweetsScanned: number;
  callsFound: number;
  stats: ScanStats;
  calls: DetectedCall[];
}

// ---------------------------------------------------------------------------
// Trade detection via Claude Haiku
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
// Submit to paste.trade → get historical price + PnL
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
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) return null;

  const direction = (["long", "short", "yes", "no"].includes(detection.direction)
    ? detection.direction
    : "long") as "long" | "short" | "yes" | "no";

  try {
    const res = await fetch("https://paste.trade/api/trades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ticker: detection.ticker.toUpperCase(),
        direction,
        platform: PLATFORM_MAP[detection.market] ?? "hyperliquid",
        instrument: INSTRUMENT_MAP[detection.market] ?? "perps",
        thesis: tweet.text.slice(0, 500),
        source_url: tweet.url,
        author_handle: handle,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn(`[scan-processor] paste.trade error ${res.status} for tweet ${tweet.id}`);
      return null;
    }

    return (await res.json()) as PasteTradeCard;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stats computation
// ---------------------------------------------------------------------------

function computeStats(calls: DetectedCall[]): ScanStats {
  const withPnl = calls.filter((c) => c.pnlPercent != null);

  const winRate =
    withPnl.length > 0
      ? (withPnl.filter((c) => (c.pnlPercent ?? 0) > 0).length / withPnl.length) * 100
      : 0;

  const totalPnl = withPnl.reduce((sum, c) => sum + (c.pnlPercent ?? 0), 0);
  const avgPnl = withPnl.length > 0 ? totalPnl / withPnl.length : 0;

  const sorted = [...withPnl].sort(
    (a, b) => (b.pnlPercent ?? 0) - (a.pnlPercent ?? 0),
  );

  return {
    winRate,
    avgPnlPercent: avgPnl,
    totalPnlIfFollowed: totalPnl,
    inversePerformance: -totalPnl,
    bestCall: sorted[0] ?? null,
    worstCall: sorted[sorted.length - 1] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main processing entry point
// ---------------------------------------------------------------------------

export async function processScanJob(jobId: string, handle: string): Promise<void> {
  setJobRunning(jobId);

  try {
    const tweets = await fetchUserTweets(handle, 200);

    const calls: DetectedCall[] = [];
    let tweetsScanned = 0;

    for (const tweet of tweets) {
      tweetsScanned++;

      // Report progress every 10 tweets
      if (tweetsScanned % 10 === 0) {
        updateJobProgress(jobId, tweetsScanned, calls.length);
      }

      // Skip very short tweets (likely not calls)
      if (tweet.text.length < 15) continue;

      const detection = await detectTrade(tweet.text);

      if (!detection?.isTradeCall || !detection.ticker || detection.confidence < 0.7) {
        continue;
      }

      // Submit to paste.trade for historical price lookup
      const card = await submitToPasteTrade(
        tweet,
        detection as TradeDetection & { ticker: string },
        handle,
      );

      const pnlPct =
        card?.pnlPct ?? card?.pnl_pct ?? undefined;
      const entryPrice =
        card?.entryPrice ?? card?.entry_price ?? undefined;
      const currentPrice =
        card?.currentPrice ?? card?.current_price ?? undefined;
      const tradeId = card?.trade_id ?? card?.id ?? undefined;

      calls.push({
        tweetId: tweet.id,
        tweetUrl: tweet.url,
        tweetText: tweet.text,
        tweetDate: tweet.created_at,
        detectedCall: {
          ticker: detection.ticker.toUpperCase(),
          direction: detection.direction,
          market: detection.market,
          confidence: detection.confidence,
        },
        ...(pnlPct != null && { pnlPercent: pnlPct }),
        ...(entryPrice != null && { priceAtTweet: entryPrice }),
        ...(currentPrice != null && { currentPrice }),
        ...(card?.url && { pasteTradeCardUrl: card.url }),
        ...(tradeId && !card?.url && {
          pasteTradeCardUrl: `https://paste.trade/t/${tradeId}`,
        }),
        ...(tradeId && { trade_id: tradeId }),
      });

      updateJobProgress(jobId, tweetsScanned, calls.length);

      // Throttle to avoid hammering Anthropic + paste.trade APIs
      await new Promise((r) => setTimeout(r, 250));
    }

    // Final progress
    updateJobProgress(jobId, tweetsScanned, calls.length);

    const result: ScanResult = {
      handle,
      tweetsScanned,
      callsFound: calls.length,
      stats: computeStats(calls),
      calls,
    };

    completeJob(jobId, result);
  } catch (err) {
    failJob(jobId, err instanceof Error ? err.message : String(err));
  }
}
