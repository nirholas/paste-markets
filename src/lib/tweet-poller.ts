/**
 * Background tweet polling service.
 *
 * Continuously monitors watched callers' tweets, detects trade calls
 * via Claude Haiku, and submits them to paste.trade + local SSE stream.
 */

import { fetchUserTweets, type Tweet } from "./twitter-fetch";
import {
  getEnabledWatched,
  updateLastChecked,
  insertSignal,
  type WatchedCaller,
} from "./watchlist";

// ── Types ────────────────────────────────────────────────────────────────────

export interface NewTradeEvent {
  handle: string;
  displayName: string | null;
  ticker: string;
  direction: string;
  platform: string | null;
  confidence: number;
  tweetUrl: string;
  tweetText: string;
  tweetDate: string;
  tradeUrl: string | null;
  entryPrice: number | null;
  detectionLatencyMs: number;
}

export interface CallerCheckedEvent {
  handle: string;
  tweetsChecked: number;
  callsFound: number;
}

// ── SSE event emitter (in-process pub/sub) ───────────────────────────────────

type SSEListener = (event: string, data: unknown) => void;

const listeners = new Set<SSEListener>();

export function addSSEListener(fn: SSEListener): void {
  listeners.add(fn);
}

export function removeSSEListener(fn: SSEListener): void {
  listeners.delete(fn);
}

export function emit(event: string, data: unknown): void {
  for (const fn of listeners) {
    try {
      fn(event, data);
    } catch {
      // ignore listener errors
    }
  }
}

// ── Trade detection (reuses scan-processor's approach) ───────────────────────

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

// ── Submit to paste.trade ────────────────────────────────────────────────────

const PLATFORM_MAP: Record<string, string> = {
  hyperliquid: "hyperliquid",
  robinhood: "robinhood",
  polymarket: "polymarket",
  crypto: "hyperliquid",
  unknown: "hyperliquid",
};

interface PasteTradeCard {
  trade_id?: string;
  id?: string;
  url?: string;
  entryPrice?: number;
  entry_price?: number;
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
    instrument: "perps",
    thesis: tweet.text.slice(0, 500),
    source_url: tweet.url,
    author_handle: handle,
  });

  return result as unknown as PasteTradeCard | null;
}

// ── Core: poll a single caller ───────────────────────────────────────────────

const MIN_CONFIDENCE = 0.65;

export async function pollCaller(caller: WatchedCaller): Promise<NewTradeEvent[]> {
  const events: NewTradeEvent[] = [];
  const startTime = Date.now();

  try {
    // Fetch recent tweets (small batch for polling)
    const tweets = await fetchUserTweets(caller.handle, 10);

    // Filter to tweets newer than last_tweet_id
    let newTweets: Tweet[];
    if (caller.lastTweetId) {
      const lastId = BigInt(caller.lastTweetId);
      newTweets = tweets.filter((t) => {
        try {
          return BigInt(t.id) > lastId;
        } catch {
          return false;
        }
      });
    } else {
      // First poll — only check the most recent 3 tweets
      newTweets = tweets.slice(0, 3);
    }

    let callsFound = 0;

    for (const tweet of newTweets) {
      if (tweet.text.length < 15) continue;

      const detection = await detectTrade(tweet.text);

      if (
        !detection?.isTradeCall ||
        !detection.ticker ||
        detection.confidence < MIN_CONFIDENCE
      ) {
        continue;
      }

      callsFound++;
      const detectionLatencyMs = Date.now() - new Date(tweet.created_at).getTime();

      // Submit to paste.trade
      const card = await submitToPasteTrade(
        tweet,
        detection as TradeDetection & { ticker: string },
        caller.handle,
      );

      const tradeId = card?.trade_id ?? card?.id;
      const tradeUrl = card?.url ?? (tradeId ? `https://paste.trade/t/${tradeId}` : null);
      const entryPrice = card?.entryPrice ?? card?.entry_price ?? null;

      // Store in local DB
      await insertSignal({
        handle: caller.handle,
        tweetId: tweet.id,
        tweetText: tweet.text,
        tweetUrl: tweet.url,
        tweetDate: tweet.created_at,
        ticker: detection.ticker.toUpperCase(),
        direction: detection.direction,
        platform: PLATFORM_MAP[detection.market] ?? null,
        confidence: detection.confidence,
        entryPrice: entryPrice ?? undefined,
        tradeUrl: tradeUrl ?? undefined,
        pasteTradeId: tradeId,
        detectionLatencyMs,
      });

      const event: NewTradeEvent = {
        handle: caller.handle,
        displayName: caller.displayName,
        ticker: detection.ticker.toUpperCase(),
        direction: detection.direction,
        platform: PLATFORM_MAP[detection.market] ?? null,
        confidence: detection.confidence,
        tweetUrl: tweet.url,
        tweetText: tweet.text,
        tweetDate: tweet.created_at,
        tradeUrl,
        entryPrice,
        detectionLatencyMs,
      };

      events.push(event);
      emit("new_trade", event);

      // Throttle API calls
      await new Promise((r) => setTimeout(r, 250));
    }

    // Update last checked + last tweet ID
    const newestId = tweets[0]?.id;
    await updateLastChecked(caller.handle, newestId);

    // Emit caller checked event
    emit("caller_checked", {
      handle: caller.handle,
      tweetsChecked: newTweets.length,
      callsFound,
    } satisfies CallerCheckedEvent);
  } catch (err) {
    console.warn(
      `[tweet-poller] Error polling @${caller.handle}:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  return events;
}

// ── Background polling loop ──────────────────────────────────────────────────

let pollingActive = false;
let pollingTimeout: ReturnType<typeof setTimeout> | null = null;

export function isPollingActive(): boolean {
  return pollingActive;
}

export async function startPollingLoop(): Promise<void> {
  if (pollingActive) return;
  pollingActive = true;

  console.log("[tweet-poller] Starting polling loop...");

  async function tick() {
    if (!pollingActive) return;

    try {
      const callers = await getEnabledWatched();

      if (callers.length === 0) {
        // No callers — wait 60s and retry
        pollingTimeout = setTimeout(tick, 60_000);
        return;
      }

      const now = Date.now();

      // Find callers due for a check
      const due = callers.filter((c) => {
        if (!c.lastChecked) return true;
        const elapsed = now - new Date(c.lastChecked).getTime();
        return elapsed >= c.checkIntervalMs;
      });

      // Process due callers sequentially to avoid rate limits
      for (const caller of due) {
        if (!pollingActive) break;
        await pollCaller(caller);
        // Small pause between callers
        await new Promise((r) => setTimeout(r, 1000));
      }

      // Emit heartbeat
      emit("heartbeat", {
        timestamp: new Date().toISOString(),
        activeCallers: callers.length,
      });

      // Schedule next tick — shortest remaining interval
      const nextCheckIn = callers.reduce((min, c) => {
        if (!c.lastChecked) return Math.min(min, 1000);
        const elapsed = now - new Date(c.lastChecked).getTime();
        const remaining = Math.max(0, c.checkIntervalMs - elapsed);
        return Math.min(min, remaining);
      }, 60_000);

      pollingTimeout = setTimeout(tick, Math.max(nextCheckIn, 5000));
    } catch (err) {
      console.error("[tweet-poller] Loop error:", err);
      pollingTimeout = setTimeout(tick, 30_000);
    }
  }

  // Initial tick
  await tick();
}

export function stopPollingLoop(): void {
  pollingActive = false;
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
  console.log("[tweet-poller] Polling stopped.");
}
