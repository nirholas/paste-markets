/**
 * Tweet Monitor — background job endpoint.
 *
 * Checks whether tracked tweets still exist (to detect deleted tweets).
 * Intended to be called hourly by a cron job or external scheduler.
 *
 * Authorization: requires CRON_SECRET header to prevent public abuse.
 *
 * Note: This endpoint probes tweet URLs via Twitter's oEmbed API (no auth
 * required), which returns a 404 when a tweet is deleted or made private.
 * It does NOT require a Twitter API key.
 *
 * To enable: set CRON_SECRET env var and call POST /api/tweet-monitor
 * with Authorization: Bearer <CRON_SECRET>.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds (Vercel Pro limit)

// Batch size to avoid hitting rate limits
const BATCH_SIZE = 20;
const DELAY_MS = 500; // 500ms between batches

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Check if a tweet still exists via Twitter's public oEmbed endpoint. */
async function tweetExists(tweetId: string): Promise<boolean> {
  try {
    const url = `https://publish.twitter.com/oembed?url=https%3A%2F%2Ftwitter.com%2Fi%2Fstatus%2F${tweetId}&dnt=true`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "paste.markets/1.0" },
    });
    // 200 = exists; 404 = deleted/unavailable; 403 = protected
    return res.status === 200;
  } catch {
    // Network error — assume still exists to avoid false positives
    return true;
  }
}

export async function POST(request: NextRequest) {
  // Auth check
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Only available in SQLite mode
  const useSqlite = process.env["USE_SQLITE"] !== "false";
  if (!useSqlite) {
    return NextResponse.json({
      message: "Tweet monitoring requires SQLite mode",
      checked: 0,
      deleted: 0,
    });
  }

  let db: Awaited<typeof import("@/lib/db")>;
  try {
    db = await import("@/lib/db");
  } catch (err) {
    console.error("[tweet-monitor] Failed to import db:", err);
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  }

  const trades = db.getLiveTradesForMonitor();
  console.log(`[tweet-monitor] Checking ${trades.length} tweets for deletion`);

  let checked = 0;
  let deleted = 0;

  // Process in batches
  for (let i = 0; i < trades.length; i += BATCH_SIZE) {
    const batch = trades.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (trade) => {
        const exists = await tweetExists(trade.tweet_id);
        checked++;
        if (!exists) {
          db.markTweetDeleted(trade.tweet_id);
          deleted++;
          console.log(
            `[tweet-monitor] Tweet ${trade.tweet_id} (${trade.author_handle}/${trade.ticker}) marked deleted`,
          );
        }
      }),
    );

    if (i + BATCH_SIZE < trades.length) {
      await sleep(DELAY_MS);
    }
  }

  return NextResponse.json({
    message: "Tweet monitor complete",
    checked,
    deleted,
    total: trades.length,
    runAt: new Date().toISOString(),
  });
}

/** GET for health check / manual trigger status */
export async function GET() {
  const useSqlite = process.env["USE_SQLITE"] !== "false";

  if (!useSqlite) {
    return NextResponse.json({ status: "inactive", reason: "Requires SQLite mode" });
  }

  try {
    const db = await import("@/lib/db");
    const trades = db.getLiveTradesForMonitor();
    return NextResponse.json({
      status: "ready",
      pendingChecks: trades.length,
      description: "POST this endpoint with Authorization: Bearer <CRON_SECRET> to run",
    });
  } catch {
    return NextResponse.json({ status: "error", reason: "DB unavailable" }, { status: 500 });
  }
}
