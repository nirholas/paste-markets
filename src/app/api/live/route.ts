import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const useSqlite = process.env["USE_SQLITE"] !== "false";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  if (useSqlite) {
    try {
      const { getRecentTrades } = await import("@/lib/db");
      const trades = getRecentTrades(limit);

      return NextResponse.json(
        { trades, updatedAt: new Date().toISOString() },
        {
          headers: {
            "Cache-Control": "s-maxage=15, stale-while-revalidate=10",
          },
        },
      );
    } catch (err) {
      console.error("Live feed SQLite error:", err);
      return NextResponse.json({ error: "Failed to fetch live trades" }, { status: 500 });
    }
  }

  // Proxy mode: fetch from paste.trade API
  try {
    const key = process.env["PASTE_TRADE_KEY"];
    const res = await fetch(
      `https://paste.trade/api/search?top=1d&limit=${limit}`,
      {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
        next: { revalidate: 15 },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream API error" }, { status: 502 });
    }

    const raw = await res.json();
    const items = Array.isArray(raw) ? raw : raw.data ?? raw.trades ?? [];

    const trades = items.map((t: Record<string, unknown>) => ({
      handle: (t.author_handle ?? t.handle ?? "anon") as string,
      ticker: (t.ticker ?? "???") as string,
      direction: (t.direction ?? "long") as string,
      pnl_pct: (t.pnlPct ?? t.pnl_pct ?? null) as number | null,
      posted_at: (t.posted_at ?? t.author_date ?? new Date().toISOString()) as string,
    }));

    return NextResponse.json(
      { trades, updatedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "s-maxage=15, stale-while-revalidate=10",
        },
      },
    );
  } catch (err) {
    console.error("Live feed proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch live trades" }, { status: 500 });
  }
}
