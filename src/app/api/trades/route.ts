import { NextRequest, NextResponse } from "next/server";
import { fetchTradesList } from "@/lib/paste-trade";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface FeedTrade {
  id: string;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform: string | null;
  pnlPct: number | null;
  posted_at: string;
  source_url: string | null;
  author_handle: string;
  thesis?: string | null;
  headline_quote?: string | null;
  author_avatar_url?: string | null;
}

type TradeRow = {
  id: number;
  ticker: string;
  direction: string;
  platform: string | null;
  pnl_pct: number | null;
  posted_at: string | null;
  source_url: string | null;
  author_handle: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const timeframe = searchParams.get("timeframe") ?? "7d";
  const sort = searchParams.get("sort") ?? "recent";
  const platform = searchParams.get("platform") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    // Primary: fetch from paste.trade /api/trades (public, richer data)
    const platFilter = platform !== "all" && platform ? platform : undefined;
    const upstream = await fetchTradesList({
      limit,
      platform: platFilter,
      cursor: cursor ?? (offset > 0 ? String(offset) : undefined),
    });

    if (upstream.items.length > 0) {
      const trades: FeedTrade[] = upstream.items.map((raw) => ({
        id: String(raw["id"] ?? raw["trade_id"] ?? ""),
        ticker: String(raw["ticker"] ?? ""),
        direction: (raw["direction"] ?? "long") as FeedTrade["direction"],
        platform: raw["platform"] != null ? String(raw["platform"]) : null,
        pnlPct: raw["pnl_pct"] != null ? Number(raw["pnl_pct"]) : null,
        posted_at: String(raw["created_at"] ?? raw["posted_at"] ?? new Date().toISOString()),
        source_url: raw["source_url"] != null ? String(raw["source_url"]) : null,
        author_handle: String(raw["author_handle"] ?? ""),
        thesis: raw["thesis"] != null ? String(raw["thesis"]) : null,
        headline_quote: raw["headline_quote"] != null ? String(raw["headline_quote"]) : null,
        author_avatar_url: raw["author_avatar_url"] != null ? String(raw["author_avatar_url"]) : null,
      }));

      return NextResponse.json({
        trades,
        next_cursor: upstream.next_cursor,
        total: upstream.total,
      });
    }

    // Fallback: local DB
    const intervalMap: Record<string, string> = {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
    };
    const interval = timeframe !== "all" ? (intervalMap[timeframe] ?? "7 days") : null;

    let rows;
    if (sort === "pnl") {
      rows = interval
        ? await sql`
            SELECT t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
                   COALESCE(t.posted_at, t.entry_date) AS posted_at,
                   t.source_url, t.author_handle
            FROM trades t
            WHERE COALESCE(t.posted_at, t.entry_date) > NOW() - ${interval}::interval
              AND t.ticker IS NOT NULL
              ${platFilter ? sql`AND t.platform = ${platFilter}` : sql``}
            ORDER BY t.pnl_pct DESC NULLS LAST
            LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
                   COALESCE(t.posted_at, t.entry_date) AS posted_at,
                   t.source_url, t.author_handle
            FROM trades t
            WHERE t.ticker IS NOT NULL
              ${platFilter ? sql`AND t.platform = ${platFilter}` : sql``}
            ORDER BY t.pnl_pct DESC NULLS LAST
            LIMIT ${limit} OFFSET ${offset}
          `;
    } else {
      rows = interval
        ? await sql`
            SELECT t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
                   COALESCE(t.posted_at, t.entry_date) AS posted_at,
                   t.source_url, t.author_handle
            FROM trades t
            WHERE COALESCE(t.posted_at, t.entry_date) > NOW() - ${interval}::interval
              AND t.ticker IS NOT NULL
              ${platFilter ? sql`AND t.platform = ${platFilter}` : sql``}
            ORDER BY COALESCE(t.posted_at, t.entry_date) DESC
            LIMIT ${limit} OFFSET ${offset}
          `
        : await sql`
            SELECT t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
                   COALESCE(t.posted_at, t.entry_date) AS posted_at,
                   t.source_url, t.author_handle
            FROM trades t
            WHERE t.ticker IS NOT NULL
              ${platFilter ? sql`AND t.platform = ${platFilter}` : sql``}
            ORDER BY COALESCE(t.posted_at, t.entry_date) DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
    }

    const trades: FeedTrade[] = (rows as TradeRow[]).map((r) => ({
      id: String(r.id),
      ticker: r.ticker,
      direction: r.direction as FeedTrade["direction"],
      platform: r.platform,
      pnlPct: r.pnl_pct ?? null,
      posted_at: r.posted_at ?? new Date().toISOString(),
      source_url: r.source_url,
      author_handle: r.author_handle,
    }));

    return NextResponse.json({ trades });
  } catch (err) {
    console.error("[api/trades] Error:", err);
    return NextResponse.json({ trades: [] });
  }
}
