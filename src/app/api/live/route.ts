import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchTrades } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  try {
    const data = await fetchTrades(limit);
    const trades = (data.items as Record<string, unknown>[]).map((raw) => ({
      handle: String(raw["author_handle"] ?? ""),
      ticker: String(raw["ticker"] ?? ""),
      direction: String(raw["direction"] ?? "long"),
      pnl_pct: raw["pnl_pct"] != null ? Number(raw["pnl_pct"]) : raw["pnlPct"] != null ? Number(raw["pnlPct"]) : null,
      posted_at: String(raw["created_at"] ?? raw["posted_at"] ?? new Date().toISOString()),
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
    console.error("Live feed error:", err);
    return NextResponse.json({ error: "Failed to fetch live trades" }, { status: 500 });
  }
}
