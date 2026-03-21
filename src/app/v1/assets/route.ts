/**
 * GET /v1/assets
 *
 * Returns all tracked tickers with aggregate stats.
 *
 * Query params:
 *   sort=calls|pnl|bullish     (default: calls)
 *   limit (max 200, default 50)
 *   offset
 *   q=                          search ticker
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

const VALID_SORTS = new Set(["calls", "pnl", "bullish"]);

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const sp = req.nextUrl.searchParams;
  const sortRaw = sp.get("sort")?.toLowerCase() ?? "calls";
  const sort = VALID_SORTS.has(sortRaw) ? sortRaw : "calls";
  const limit = parseLimit(sp.get("limit"), 50, 200);
  const offset = parseOffset(sp.get("offset"));
  const query = sp.get("q")?.toUpperCase().trim() ?? "";

  try {
    const { getAssets } = await import("@/lib/data");
    let assets = await getAssets();

    if (query) {
      assets = assets.filter((a) => a.ticker.toUpperCase().includes(query));
    }

    // Sort
    if (sort === "pnl") {
      assets.sort((a, b) => (b.avgPnl ?? -Infinity) - (a.avgPnl ?? -Infinity));
    } else if (sort === "bullish") {
      assets.sort((a, b) => {
        const ratioA = a.callCount > 0 ? a.bullCount / a.callCount : 0;
        const ratioB = b.callCount > 0 ? b.bullCount / b.callCount : 0;
        return ratioB - ratioA;
      });
    }
    // "calls" is default sort from getAssets()

    const total = assets.length;
    const page_assets = assets.slice(offset, offset + limit).map((a) => ({
      ticker: a.ticker,
      callCount: a.callCount,
      avgPnl: a.avgPnl !== null ? parseFloat(a.avgPnl.toFixed(2)) : null,
      bullCount: a.bullCount,
      bearCount: a.bearCount,
      bullRatio: a.callCount > 0
        ? parseFloat((a.bullCount / a.callCount).toFixed(3))
        : null,
      lastCallAt: a.lastCallAt,
    }));

    return okResponse(
      page_assets,
      { total, limit, offset, page: computePage(offset, limit) },
      auth.rateLimitHeaders,
    );
  } catch (err) {
    console.error("[v1/assets] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
