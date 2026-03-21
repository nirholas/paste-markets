/**
 * GET /v1/assets/[ticker]
 *
 * Returns stats + all trades for a specific ticker.
 *
 * Query params:
 *   limit (max 100, default 50)
 *   offset
 */

import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api-auth";
import {
  okResponse,
  errorResponse,
  parseLimit,
  parseOffset,
  computePage,
} from "@/lib/v1-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { ticker: rawTicker } = await params;
  const ticker = rawTicker?.toUpperCase().trim();

  if (!ticker) {
    return errorResponse("INVALID_PARAM", "Missing ticker", 400, auth.rateLimitHeaders);
  }

  const sp = req.nextUrl.searchParams;
  const limit = parseLimit(sp.get("limit"), 50, 100);
  const offset = parseOffset(sp.get("offset"));

  try {
    const { getAssets, getAssetTrades } = await import("@/lib/data");

    const assets = await getAssets();
    const assetSummary = assets.find(
      (a) => a.ticker.toUpperCase() === ticker,
    );

    if (!assetSummary) {
      return errorResponse(
        "NOT_FOUND",
        `Ticker "${ticker}" not found in tracked assets.`,
        404,
        auth.rateLimitHeaders,
      );
    }

    const allTrades = await getAssetTrades(ticker);
    const total = allTrades.length;
    const pageTrades = allTrades.slice(offset, offset + limit).map((t) => ({
      caller: {
        handle: t.handle,
        winRate: t.authorWinRate,
        avgPnl: t.authorAvgPnl,
        totalTrades: t.authorTotalTrades,
      },
      direction: t.direction,
      pnlPct: t.pnlPct !== null ? parseFloat(t.pnlPct.toFixed(2)) : null,
      platform: t.platform,
      sourceDate: t.entryDate,
      publishedAt: t.postedAt,
      source: { url: t.sourceUrl },
    }));

    const stats = {
      ticker,
      callCount: assetSummary.callCount,
      avgPnl: assetSummary.avgPnl !== null ? parseFloat(assetSummary.avgPnl.toFixed(2)) : null,
      bullCount: assetSummary.bullCount,
      bearCount: assetSummary.bearCount,
      bullRatio: assetSummary.callCount > 0
        ? parseFloat((assetSummary.bullCount / assetSummary.callCount).toFixed(3))
        : null,
      lastCallAt: assetSummary.lastCallAt,
    };

    return okResponse(
      { stats, trades: pageTrades },
      { total, limit, offset, page: computePage(offset, limit) },
      auth.rateLimitHeaders,
    );
  } catch (err) {
    console.error("[v1/assets/[ticker]] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
