import { NextRequest, NextResponse } from "next/server";
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
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const timeframe = searchParams.get("timeframe") ?? "7d";
  const sort = searchParams.get("sort") ?? "recent";
  const platform = searchParams.get("platform") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  try {
    const intervalMap: Record<string, string> = {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
    };
    const interval = intervalMap[timeframe] ?? "7 days";

    let rows;
    const orderBy = sort === "pnl" ? "t.pnl_pct DESC NULLS LAST" : "COALESCE(t.posted_at, t.entry_date) DESC";

    if (platform !== "all" && platform && timeframe !== "all") {
      rows = await sql`
        SELECT
          t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
          COALESCE(t.posted_at, t.entry_date) AS posted_at,
          t.source_url, t.author_handle
        FROM trades t
        WHERE COALESCE(t.posted_at, t.entry_date) > NOW() - ${interval}::interval
          AND t.platform = ${platform}
          AND t.ticker IS NOT NULL
        ORDER BY ${sort === "pnl" ? sql`t.pnl_pct DESC NULLS LAST` : sql`COALESCE(t.posted_at, t.entry_date) DESC`}
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (platform !== "all" && platform) {
      rows = await sql`
        SELECT
          t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
          COALESCE(t.posted_at, t.entry_date) AS posted_at,
          t.source_url, t.author_handle
        FROM trades t
        WHERE t.platform = ${platform}
          AND t.ticker IS NOT NULL
        ORDER BY ${sort === "pnl" ? sql`t.pnl_pct DESC NULLS LAST` : sql`COALESCE(t.posted_at, t.entry_date) DESC`}
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (timeframe !== "all") {
      rows = await sql`
        SELECT
          t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
          COALESCE(t.posted_at, t.entry_date) AS posted_at,
          t.source_url, t.author_handle
        FROM trades t
        WHERE COALESCE(t.posted_at, t.entry_date) > NOW() - ${interval}::interval
          AND t.ticker IS NOT NULL
        ORDER BY ${sort === "pnl" ? sql`t.pnl_pct DESC NULLS LAST` : sql`COALESCE(t.posted_at, t.entry_date) DESC`}
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      rows = await sql`
        SELECT
          t.id, t.ticker, t.direction, t.platform, t.pnl_pct,
          COALESCE(t.posted_at, t.entry_date) AS posted_at,
          t.source_url, t.author_handle
        FROM trades t
        WHERE t.ticker IS NOT NULL
        ORDER BY ${sort === "pnl" ? sql`t.pnl_pct DESC NULLS LAST` : sql`COALESCE(t.posted_at, t.entry_date) DESC`}
        LIMIT ${limit} OFFSET ${offset}
      `;
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
