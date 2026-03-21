import { NextRequest, NextResponse } from "next/server";
import {
  syncAuthor,
  isStale,
  getOrCreateAuthor,
  getAuthorMetrics,
  recordView,
} from "@/lib/data";
import { fetchAuthorProfile } from "@/lib/upstream";
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

    // Primary: try upstream paste.trade API (no DB dependency)
    try {
      const upstream = await fetchAuthorProfile(handle);
      if (upstream && upstream.metrics.totalTrades > 0) {
        const metrics = upstream.metrics;
        const trades = metrics.recentTrades.map((t: TradeSummary) => ({
          ticker: t.ticker,
          direction: t.direction,
          pnl_pct: t.pnl_pct,
          platform: t.platform,
          entry_date: t.entry_date ?? t.posted_at ?? "",
        }));

        // Record the view (fire-and-forget)
        recordView(handle, "profile").catch(() => {});

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
          rank: upstream.rank,
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(`[api/author] Upstream fetch failed for ${handle}:`, err);
    }

    // Fallback: local DB
    const author = await getOrCreateAuthor(handle);

    if (isStale(author.last_fetched)) {
      try {
        await syncAuthor(handle);
      } catch (err) {
        console.error(`[api/author] Failed to sync ${handle}:`, err);
      }
    }

    const metrics = await getAuthorMetrics(handle);
    if (!metrics) {
      return NextResponse.json(
        { error: "Author not found", details: `No data for @${handle}` },
        { status: 404 },
      );
    }

    recordView(handle, "profile").catch(() => {});

    const trades = metrics.recentTrades.map((t: TradeSummary) => ({
      ticker: t.ticker,
      direction: t.direction,
      pnl_pct: t.pnl_pct,
      platform: t.platform,
      entry_date: t.entry_date ?? t.posted_at ?? "",
    }));

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
