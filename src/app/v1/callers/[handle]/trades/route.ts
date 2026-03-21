/**
 * GET /v1/callers/[handle]/trades
 *
 * All trades by a caller.
 *
 * Query params:
 *   timeframe=7d|30d|90d|all  (default: 30d)
 *   platform=hyperliquid|robinhood|polymarket
 *   sort=pnl|date              (default: date)
 *   order=asc|desc             (default: desc)
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

const VALID_TIMEFRAMES = new Set(["7d", "30d", "90d", "all"]);
const VALID_PLATFORMS = new Set(["hyperliquid", "robinhood", "polymarket"]);
const BASE_URL = process.env["NEXT_PUBLIC_BASE_URL"] ?? "https://paste.trade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { handle: rawHandle } = await params;
  const handle = rawHandle?.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return errorResponse("INVALID_PARAM", "Missing caller handle", 400, auth.rateLimitHeaders);
  }

  const sp = req.nextUrl.searchParams;
  const timeframeRaw = (sp.get("timeframe") ?? "30d").toLowerCase();
  const timeframe = VALID_TIMEFRAMES.has(timeframeRaw) ? timeframeRaw : "30d";
  const platformRaw = sp.get("platform")?.toLowerCase() ?? null;
  const platform = platformRaw && VALID_PLATFORMS.has(platformRaw) ? platformRaw : null;
  const sort = sp.get("sort") === "pnl" ? "pnl" : "date";
  const order = sp.get("order") === "asc" ? "ASC" : "DESC";
  const limit = parseLimit(sp.get("limit"), 20, 100);
  const offset = parseOffset(sp.get("offset"));

  try {
    const { db } = await import("@/lib/db");

    const timeframeToOffset: Record<string, string | null> = {
      "7d": "-7 days",
      "30d": "-30 days",
      "90d": "-90 days",
      "all": null,
    };
    const dateOffset = timeframeToOffset[timeframe] ?? null;

    const conditions = [
      "t.author_handle = ?",
      "t.ticker IS NOT NULL AND t.ticker != ''",
    ];
    const params: (string | number)[] = [handle];

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
      .prepare<(string | number)[], CountRow>(`SELECT COUNT(*) as total FROM trades t ${whereClause}`)
      .get(...params);
    const total = countRow?.total ?? 0;

    if (total === 0) {
      // Check if author exists at all
      const authorRow = db
        .prepare<[string], { handle: string }>("SELECT handle FROM authors WHERE handle = ? LIMIT 1")
        .get(handle);
      if (!authorRow) {
        return errorResponse(
          "NOT_FOUND",
          `Caller "@${handle}" not found.`,
          404,
          auth.rateLimitHeaders,
        );
      }
    }

    const orderBy = sort === "pnl" ? `t.pnl_pct ${order} NULLS LAST` : `COALESCE(t.posted_at, t.entry_date) ${order} NULLS LAST`;

    type TradeRow = {
      id: number;
      ticker: string;
      direction: string;
      platform: string | null;
      pnl_pct: number | null;
      posted_at: string | null;
      entry_date: string | null;
      source_url: string | null;
      integrity: string | null;
      price_at_tweet_time: number | null;
      price_at_submission: number | null;
    };

    const rows = db
      .prepare<(string | number)[], TradeRow>(`
        SELECT t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
               COALESCE(t.posted_at, t.entry_date) AS posted_at,
               t.entry_date, t.source_url, t.integrity,
               t.price_at_tweet_time, t.price_at_submission
        FROM trades t
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `)
      .all(...params, limit, offset);

    const trades = rows.map((r) => ({
      id: String(r.id),
      ticker: r.ticker,
      direction: r.direction,
      platform: r.platform ?? null,
      pnlPct: r.pnl_pct ?? null,
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
    console.error("[v1/callers/[handle]/trades] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
