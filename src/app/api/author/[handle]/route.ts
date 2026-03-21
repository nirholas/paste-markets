import { NextRequest, NextResponse } from "next/server";
import {
  syncAuthor,
  isStale,
  getOrCreateAuthor,
  getAuthorMetrics,
  recordView,
} from "@/lib/data";
import type { TradeSummary } from "@/lib/metrics";
import type { Author } from "@/lib/data";

export const dynamic = "force-dynamic";

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = cleanHandle(rawHandle);

    if (!handle) {
      return NextResponse.json(
        { error: "Missing handle parameter" },
        { status: 400 },
      );
    }

    // Ensure author exists in DB
    const author = await getOrCreateAuthor(handle);

    // Sync from paste.trade if data is stale
    if (isStale(author.last_fetched)) {
      try {
        await syncAuthor(handle);
      } catch (err) {
        console.error(`[api/author] Failed to sync ${handle}:`, err);
        // Continue with cached data if sync fails
      }
    }

    // Get metrics from DB
    const metrics = await getAuthorMetrics(handle);
    if (!metrics) {
      return NextResponse.json(
        { error: "Author not found", details: `No data for @${handle}` },
        { status: 404 },
      );
    }

    // Record the view for trending
    await recordView(handle, "profile");

    // Build response
    const trades: Array<{
      ticker: string;
      direction: string;
      pnl_pct: number;
      platform?: string;
      entry_date: string;
    }> = metrics.recentTrades.map((t: TradeSummary) => ({
      ticker: t.ticker,
      direction: t.direction,
      pnl_pct: t.pnl_pct,
      platform: t.platform,
      entry_date: t.entry_date ?? t.posted_at ?? "",
    }));

    // Re-read the author for rank + last_fetched after potential sync
    const refreshed: Author = await getOrCreateAuthor(handle);

    return NextResponse.json({
      handle,
      metrics: {
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        avgPnl: metrics.avgPnl,
        winCount: metrics.winCount,
        lossCount: metrics.lossCount,
        bestTrade: metrics.bestTrade,
        worstTrade: metrics.worstTrade,
        streak: metrics.streak,
      },
      trades,
      rank: refreshed.rank ?? null,
      lastUpdated: refreshed.last_fetched ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/author] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
