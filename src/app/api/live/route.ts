import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  try {
    const { getRecentTrades } = await import("@/lib/db");
    const trades = await getRecentTrades(limit);

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
