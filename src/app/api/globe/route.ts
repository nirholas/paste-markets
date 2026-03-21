import { NextRequest, NextResponse } from "next/server";
import { buildGlobeData, type TradeInput, type CallerLocation } from "@/lib/globe-data";
import { fetchFeed } from "@/lib/upstream";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

/** Load all geocoded caller locations from DB */
async function getCallerLocations(): Promise<Map<string, CallerLocation>> {
  try {
    const rows = await sql`
      SELECT handle, lat, lng, location FROM authors
      WHERE lat IS NOT NULL AND lng IS NOT NULL
    ` as Array<{ handle: string; lat: number; lng: number; location: string | null }>;

    const map = new Map<string, CallerLocation>();
    for (const row of rows) {
      map.set(row.handle, {
        handle: row.handle,
        lat: row.lat,
        lng: row.lng,
        label: row.location ?? undefined,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const window = searchParams.get("window") ?? "7d";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);

  try {
    // Fetch trades + real locations in parallel
    const [feedResult, callerLocations] = await Promise.all([
      fetchFeed(
        "new",
        limit,
        window === "24h" ? "24h" : window === "30d" ? "30d" : "7d",
      ),
      getCallerLocations(),
    ]);

    const trades: TradeInput[] = [];

    for (const item of feedResult.items) {
      const raw = item as unknown as Record<string, unknown>;
      const tradeList = Array.isArray(raw["trades"]) ? (raw["trades"] as Record<string, unknown>[]) : [];
      const author = (raw["author"] ?? {}) as Record<string, unknown>;
      const handle = String(author["handle"] ?? raw["author_handle"] ?? "");

      if (!handle) continue;

      // Try to get P&L from the prices map returned by paste.trade
      const pricesMap = (raw["prices"] ?? {}) as Record<string, Record<string, unknown>>;

      for (const trade of tradeList) {
        const ticker = String(trade["ticker"] ?? "");
        if (!ticker) continue;

        const pnlRaw = trade["pnl_pct"] ?? trade["pnlPct"];
        let pnl = pnlRaw != null ? Number(pnlRaw) : 0;

        // Try prices map for live P&L
        if (pnl === 0) {
          const tradeId = String(trade["id"] ?? "");
          const priceEntry = pricesMap[tradeId];
          if (priceEntry) {
            const livePnl = priceEntry["pnl_pct"] ?? priceEntry["pnlPct"];
            if (livePnl != null) pnl = Number(livePnl);
          }
        }

        if (isNaN(pnl)) pnl = 0;
        trades.push({ author: handle, ticker, pnl, direction: String(trade["direction"] ?? "") });
      }

      // Fallback: if no nested trades, try flat structure
      if (tradeList.length === 0) {
        const ticker = String(raw["ticker"] ?? "");
        if (ticker) {
          const pnlRaw = raw["pnl_pct"] ?? raw["pnlPct"];
          const pnl = pnlRaw != null && !isNaN(Number(pnlRaw)) ? Number(pnlRaw) : 0;
          trades.push({ author: handle, ticker, pnl, direction: String(raw["direction"] ?? "") });
        }
      }
    }

    // Build globe data with real locations
    const globeData = buildGlobeData(trades, callerLocations);

    const uniqueCallers = new Set(trades.map((t) => t.author));
    const uniqueTickers = new Set(trades.map((t) => t.ticker));
    const avgPnl = trades.length > 0 ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;

    // Count how many callers have real locations
    const realLocationCount = [...uniqueCallers].filter((h) => callerLocations.has(h)).length;

    return NextResponse.json({
      ...globeData,
      stats: {
        totalTrades: trades.length,
        activeCallers: uniqueCallers.size,
        activeTickers: uniqueTickers.size,
        avgPnl,
        realLocations: realLocationCount,
        totalLocationsInDb: callerLocations.size,
      },
    }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[api/globe] Error:", err);
    return NextResponse.json({ error: "Failed to load globe data" }, { status: 500 });
  }
}
