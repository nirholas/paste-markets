/**
 * GET /v1/trades/top
 *
 * Top performing trades, optionally filtered by timeframe.
 *
 * Query params:
 *   timeframe=today|week|month|alltime  (default: week)
 *   platform=hyperliquid|robinhood|polymarket
 *   limit (max 100, default 20)
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

const VALID_PLATFORMS = new Set(["hyperliquid", "robinhood", "polymarket"]);
const BASE_URL = process.env["NEXT_PUBLIC_BASE_URL"] ?? "https://paste.trade";

function timeframeToSqlOffset(tf: string): string | null {
  switch (tf) {
    case "today": return "-1 days";
    case "week": return "-7 days";
    case "month": return "-30 days";
    case "alltime": return null;
    default: return "-7 days";
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const sp = req.nextUrl.searchParams;
  const timeframe = sp.get("timeframe") ?? "week";
  const platformRaw = sp.get("platform")?.toLowerCase() ?? null;
  const platform = platformRaw && VALID_PLATFORMS.has(platformRaw) ? platformRaw : null;
  const limit = parseLimit(sp.get("limit"), 20, 100);
  const offset = parseOffset(sp.get("offset"));

  try {
    const { db } = await import("@/lib/db");
    const dateOffset = timeframeToSqlOffset(timeframe);

    const conditions: string[] = [
      "t.ticker IS NOT NULL AND t.ticker != ''",
      "t.pnl_pct IS NOT NULL",
    ];
    const params: (string | number)[] = [];

    if (dateOffset) {
      conditions.push("COALESCE(t.posted_at, t.entry_date) > datetime('now', ?)");
      params.push(dateOffset);
    }
    if (platform) {
      conditions.push("LOWER(t.platform) = ?");
      params.push(platform);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    type CountRow = { total: number };
    const countRow = db
      .prepare<(string | number)[], CountRow>(`
        SELECT COUNT(*) as total FROM trades t ${whereClause}
      `)
      .get(...params);
    const total = countRow?.total ?? 0;

    type TradeRow = {
      id: number;
      ticker: string;
      direction: string;
      platform: string | null;
      pnl_pct: number;
      posted_at: string | null;
      entry_date: string | null;
      source_url: string | null;
      author_handle: string;
      integrity: string | null;
      price_at_tweet_time: number | null;
      price_at_submission: number | null;
    };

    const rows = db
      .prepare<(string | number)[], TradeRow>(`
        SELECT t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
               COALESCE(t.posted_at, t.entry_date) AS posted_at,
               t.entry_date, t.source_url, t.author_handle,
               t.integrity, t.price_at_tweet_time, t.price_at_submission
        FROM trades t
        ${whereClause}
        ORDER BY t.pnl_pct DESC
        LIMIT ? OFFSET ?
      `)
      .all(...params, limit, offset);

    const trades = rows.map((r) => ({
      id: String(r.id),
      ticker: r.ticker,
      direction: r.direction,
      platform: r.platform ?? null,
      author: { handle: r.author_handle },
      pnlPct: r.pnl_pct,
      sourceDate: r.entry_date ?? null,
      publishedAt: r.posted_at ?? null,
      prices: {
        atSource: r.price_at_tweet_time ?? null,
        atPublish: r.price_at_submission ?? null,
      },
      source: { url: r.source_url ?? null },
      integrity: r.integrity ?? null,
      cardUrl: `${BASE_URL}/s/${r.id}`,
      shareImageUrl: `${BASE_URL}/api/og/share/${r.id}`,
    }));

    return okResponse(
      trades,
      { total, limit, offset, page: computePage(offset, limit) },
      auth.rateLimitHeaders,
    );
  } catch (err) {
    console.error("[v1/trades/top] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
