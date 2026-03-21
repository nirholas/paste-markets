/**
 * GET /v1/trades
 *
 * Query params:
 *   ticker, author, direction, platform, timeframe, sort, order,
 *   limit (max 100), offset, min_pnl, integrity
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

const VALID_DIRECTIONS = new Set(["long", "short", "yes", "no"]);
const VALID_PLATFORMS = new Set(["hyperliquid", "robinhood", "polymarket"]);
const VALID_SORTS = new Set(["pnl", "date", "confidence"]);
const VALID_ORDERS = new Set(["asc", "desc"]);
const VALID_TIMEFRAMES = new Set(["today", "week", "month", "alltime"]);
const VALID_INTEGRITY = new Set(["live", "same_day", "historical", "retroactive"]);

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

  const ticker = sp.get("ticker")?.toUpperCase().trim() ?? null;
  const author = sp.get("author")?.replace(/^@/, "").toLowerCase().trim() ?? null;
  const directionRaw = sp.get("direction")?.toLowerCase() ?? null;
  const direction = directionRaw && VALID_DIRECTIONS.has(directionRaw) ? directionRaw : null;
  const platformRaw = sp.get("platform")?.toLowerCase() ?? null;
  const platform = platformRaw && VALID_PLATFORMS.has(platformRaw) ? platformRaw : null;
  const timeframeRaw = sp.get("timeframe")?.toLowerCase() ?? "week";
  const timeframe = VALID_TIMEFRAMES.has(timeframeRaw) ? timeframeRaw : "week";
  const sortRaw = sp.get("sort")?.toLowerCase() ?? "date";
  const sort = VALID_SORTS.has(sortRaw) ? sortRaw : "date";
  const orderRaw = sp.get("order")?.toLowerCase() ?? "desc";
  const order = VALID_ORDERS.has(orderRaw) ? orderRaw : "desc";
  const limit = parseLimit(sp.get("limit"), 20, 100);
  const offset = parseOffset(sp.get("offset"));
  const minPnlRaw = sp.get("min_pnl");
  const minPnl = minPnlRaw !== null ? parseFloat(minPnlRaw) : null;
  const integrityRaw = sp.get("integrity")?.toLowerCase() ?? null;
  const integrityFilter = integrityRaw && VALID_INTEGRITY.has(integrityRaw) ? integrityRaw : null;

  if (minPnl !== null && isNaN(minPnl)) {
    return errorResponse(
      "INVALID_PARAM",
      "min_pnl must be a number",
      400,
      auth.rateLimitHeaders,
    );
  }

  try {
    const { db } = await import("@/lib/db");
    const dateOffset = timeframeToSqlOffset(timeframe);

    const conditions: string[] = ["t.ticker IS NOT NULL AND t.ticker != ''"];
    const params: (string | number)[] = [];

    if (dateOffset) {
      conditions.push("COALESCE(t.posted_at, t.entry_date) > datetime('now', ?)");
      params.push(dateOffset);
    }
    if (ticker) {
      conditions.push("UPPER(t.ticker) = ?");
      params.push(ticker);
    }
    if (author) {
      conditions.push("LOWER(t.author_handle) = ?");
      params.push(author);
    }
    if (direction) {
      conditions.push("t.direction = ?");
      params.push(direction);
    }
    if (platform) {
      conditions.push("LOWER(t.platform) = ?");
      params.push(platform);
    }
    if (minPnl !== null) {
      conditions.push("t.pnl_pct >= ?");
      params.push(minPnl);
    }
    if (integrityFilter) {
      conditions.push("t.integrity = ?");
      params.push(integrityFilter);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    let orderBy: string;
    if (sort === "pnl") {
      orderBy = `t.pnl_pct ${order.toUpperCase()} NULLS LAST`;
    } else if (sort === "confidence") {
      // Proxy: authors with higher win_rate = more confidence; join authors table
      orderBy = `a.win_rate ${order.toUpperCase()} NULLS LAST`;
    } else {
      orderBy = `COALESCE(t.posted_at, t.entry_date) ${order.toUpperCase()} NULLS LAST`;
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM trades t
      LEFT JOIN authors a ON a.handle = t.author_handle
      ${whereClause}
    `;

    type CountRow = { total: number };
    const countRow = db.prepare<(string | number)[], CountRow>(countQuery).get(...params);
    const total = countRow?.total ?? 0;

    const dataQuery = `
      SELECT
        t.id,
        t.ticker,
        t.direction,
        t.platform,
        t.pnl_pct,
        COALESCE(t.posted_at, t.entry_date) AS posted_at,
        t.entry_date,
        t.source_url,
        t.author_handle,
        t.integrity,
        t.price_at_tweet_time,
        t.price_at_submission,
        a.win_rate AS author_win_rate,
        a.avg_pnl AS author_avg_pnl,
        a.total_trades AS author_total_trades
      FROM trades t
      LEFT JOIN authors a ON a.handle = t.author_handle
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    type TradeRow = {
      id: number;
      ticker: string;
      direction: string;
      platform: string | null;
      pnl_pct: number | null;
      posted_at: string | null;
      entry_date: string | null;
      source_url: string | null;
      author_handle: string;
      integrity: string | null;
      price_at_tweet_time: number | null;
      price_at_submission: number | null;
      author_win_rate: number | null;
      author_avg_pnl: number | null;
      author_total_trades: number | null;
    };

    const rows = db
      .prepare<(string | number)[], TradeRow>(dataQuery)
      .all(...params, limit, offset);

    const trades = rows.map((r) => ({
      id: String(r.id),
      ticker: r.ticker,
      direction: r.direction,
      platform: r.platform ?? null,
      author: {
        handle: r.author_handle,
        winRate: r.author_win_rate ?? null,
        avgPnl: r.author_avg_pnl ?? null,
        totalTrades: r.author_total_trades ?? null,
      },
      pnlPct: r.pnl_pct ?? null,
      sourceDate: r.entry_date ?? null,
      publishedAt: r.posted_at ?? null,
      prices: {
        atSource: r.price_at_tweet_time ?? null,
        atPublish: r.price_at_submission ?? null,
      },
      source: {
        url: r.source_url ?? null,
      },
      integrity: (r.integrity as "live" | "same_day" | "historical" | "retroactive" | null) ?? null,
      cardUrl: `${BASE_URL}/s/${r.id}`,
      shareImageUrl: `${BASE_URL}/api/og/share/${r.id}`,
    }));

    return okResponse(
      trades,
      { total, limit, offset, page: computePage(offset, limit) },
      auth.rateLimitHeaders,
    );
  } catch (err) {
    console.error("[v1/trades] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
