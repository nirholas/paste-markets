/**
 * GET /v1/trades/[id]
 *
 * Returns a single trade by its numeric ID, with full detail shape.
 */

import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { okResponse, errorResponse } from "@/lib/v1-response";

export const dynamic = "force-dynamic";

const BASE_URL = process.env["NEXT_PUBLIC_BASE_URL"] ?? "https://paste.trade";
const PASTE_TRADE_BASE = "https://paste.trade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { id: rawId } = await params;
  const id = rawId?.trim();

  if (!id) {
    return errorResponse("INVALID_PARAM", "Missing trade ID", 400, auth.rateLimitHeaders);
  }

  try {
    const { db } = await import("@/lib/db");

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
      author_display_name: string | null;
      author_win_rate: number | null;
      author_avg_pnl: number | null;
      author_total_trades: number | null;
    };

    const row = db
      .prepare<[string], TradeRow>(`
        SELECT
          t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
          t.posted_at, t.entry_date, t.source_url, t.author_handle,
          t.integrity, t.price_at_tweet_time, t.price_at_submission,
          a.display_name AS author_display_name,
          a.win_rate AS author_win_rate,
          a.avg_pnl AS author_avg_pnl,
          a.total_trades AS author_total_trades
        FROM trades t
        LEFT JOIN authors a ON a.handle = t.author_handle
        WHERE t.id = ?
        LIMIT 1
      `)
      .get(id);

    if (!row) {
      // Try fetching from paste.trade API as fallback
      const apiKey = process.env["PASTE_TRADE_KEY"];
      if (apiKey) {
        try {
          const { getTradeById } = await import("@/lib/paste-trade");
          const fullTrade = await getTradeById(id);
          if (fullTrade) {
            const avatarRaw = fullTrade.author_avatar_url ?? null;
            const avatarUrl = avatarRaw?.startsWith("/")
              ? `${PASTE_TRADE_BASE}${avatarRaw}`
              : avatarRaw ?? null;

            return okResponse(
              {
                id: fullTrade.trade_id ?? id,
                ticker: fullTrade.ticker,
                direction: fullTrade.direction,
                platform: fullTrade.platform ?? null,
                author: {
                  handle: fullTrade.author_handle ?? null,
                  displayName: fullTrade.author_handle ?? null,
                  avatarUrl,
                  verified: false,
                },
                sourceDate: fullTrade.author_date ?? null,
                publishedAt: fullTrade.posted_at,
                prices: {
                  atSource: fullTrade.entryPrice ?? null,
                  atPublish: null,
                  current: fullTrade.currentPrice ?? null,
                  pnlFromSource: fullTrade.pnlPct ?? null,
                  pnlFromPublish: null,
                },
                derivation: {
                  steps: fullTrade.chain_steps ?? [],
                  thesis: fullTrade.thesis ?? null,
                  quote: fullTrade.headline_quote ?? null,
                },
                source: {
                  url: fullTrade.source_url ?? null,
                  type: "twitter",
                  title: null,
                },
                integrity: null,
                cardUrl: `${BASE_URL}/s/${id}`,
                shareImageUrl: `${BASE_URL}/api/og/share/${id}`,
              },
              undefined,
              auth.rateLimitHeaders,
            );
          }
        } catch {
          // fall through to 404
        }
      }

      return errorResponse("NOT_FOUND", `Trade with ID "${id}" not found.`, 404, auth.rateLimitHeaders);
    }

    const avatarRaw = null; // Not stored locally; would need separate fetch
    const trade = {
      id: String(row.id),
      ticker: row.ticker,
      direction: row.direction,
      platform: row.platform ?? null,
      author: {
        handle: row.author_handle,
        displayName: row.author_display_name ?? row.author_handle,
        avatarUrl: avatarRaw,
        verified: false,
        stats: {
          winRate: row.author_win_rate ?? null,
          avgPnl: row.author_avg_pnl ?? null,
          totalTrades: row.author_total_trades ?? null,
        },
      },
      sourceDate: row.entry_date ?? null,
      publishedAt: row.posted_at ?? null,
      prices: {
        atSource: row.price_at_tweet_time ?? null,
        atPublish: row.price_at_submission ?? null,
        current: null,
        pnlFromSource: row.pnl_pct ?? null,
        pnlFromPublish: null,
      },
      derivation: {
        steps: [],
        thesis: null,
        quote: null,
      },
      source: {
        url: row.source_url ?? null,
        type: row.source_url?.includes("twitter.com") || row.source_url?.includes("x.com")
          ? "twitter"
          : row.source_url?.includes("youtube.com")
            ? "youtube"
            : "article",
        title: null,
      },
      integrity: row.integrity ?? null,
      cardUrl: `${BASE_URL}/s/${row.id}`,
      shareImageUrl: `${BASE_URL}/api/og/share/${row.id}`,
    };

    return okResponse(trade, undefined, auth.rateLimitHeaders);
  } catch (err) {
    console.error("[v1/trades/[id]] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
