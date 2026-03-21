import { NextRequest, NextResponse } from "next/server";

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

const TIMEFRAME_MAP: Record<string, string | null> = {
  "7d": "-7 days",
  "30d": "-30 days",
  "90d": "-90 days",
  "all": null,
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const timeframe = searchParams.get("timeframe") ?? "7d";
  const sort = searchParams.get("sort") ?? "recent";
  const platform = searchParams.get("platform") ?? "all";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  const useSqlite = process.env["USE_SQLITE"] !== "false";

  if (!useSqlite) {
    return NextResponse.json({ trades: [] });
  }

  try {
    const { db } = await import("@/lib/db");

    const dateOffset = TIMEFRAME_MAP[timeframe] ?? "-7 days";

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (dateOffset !== null) {
      conditions.push("COALESCE(t.posted_at, t.entry_date) > datetime('now', ?)");
      params.push(dateOffset);
    }

    if (platform !== "all" && platform) {
      conditions.push("t.platform = ?");
      params.push(platform);
    }

    // Only include rows where we have at least a ticker
    conditions.push("t.ticker IS NOT NULL");

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const orderBy =
      sort === "pnl"
        ? "t.pnl_pct DESC"
        : "COALESCE(t.posted_at, t.entry_date) DESC";

    const query = `
      SELECT
        t.id,
        t.ticker,
        t.direction,
        t.platform,
        t.pnl_pct,
        COALESCE(t.posted_at, t.entry_date) AS posted_at,
        t.source_url,
        t.author_handle
      FROM trades t
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
      source_url: string | null;
      author_handle: string;
    };

    const rows = db
      .prepare<(string | number)[], TradeRow>(query)
      .all(...params, limit, offset);

    const trades: FeedTrade[] = rows.map((r) => ({
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
