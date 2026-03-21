import { NextRequest, NextResponse } from "next/server";
import { buildGlobeData, type TradeInput } from "@/lib/globe-data";
import { fetchFeed } from "@/lib/upstream";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const window = searchParams.get("window") ?? "7d";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 200);

  try {
    // Fetch recent trades from paste.trade feed
    const feedResult = await fetchFeed(
      "new",
      limit,
      window === "24h" ? "24h" : window === "30d" ? "30d" : "7d",
    );

    const trades: TradeInput[] = [];

    for (const item of feedResult.items) {
      const raw = item as Record<string, unknown>;
      const tradeList = Array.isArray(raw["trades"]) ? (raw["trades"] as Record<string, unknown>[]) : [];
      const author = (raw["author"] ?? {}) as Record<string, unknown>;
      const handle = String(author["handle"] ?? raw["author_handle"] ?? "");

      if (!handle) continue;

      for (const trade of tradeList) {
        const ticker = String(trade["ticker"] ?? "");
        const pnlRaw = trade["pnl_pct"] ?? trade["pnlPct"];
        const pnl = pnlRaw != null ? Number(pnlRaw) : null;

        if (ticker && pnl != null && !isNaN(pnl)) {
          trades.push({ author: handle, ticker, pnl, direction: String(trade["direction"] ?? "") });
        }
      }

      // Fallback: if no nested trades, try flat structure
      if (tradeList.length === 0) {
        const ticker = String(raw["ticker"] ?? "");
        const pnlRaw = raw["pnl_pct"] ?? raw["pnlPct"];
        const pnl = pnlRaw != null ? Number(pnlRaw) : null;

        if (ticker && pnl != null && !isNaN(pnl)) {
          trades.push({ author: handle, ticker, pnl, direction: String(raw["direction"] ?? "") });
        }
      }
    }

    const globeData = buildGlobeData(trades);

    const uniqueCallers = new Set(trades.map((t) => t.author));
    const uniqueTickers = new Set(trades.map((t) => t.ticker));
    const avgPnl = trades.length > 0 ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;

    return NextResponse.json({
      ...globeData,
      stats: {
        totalTrades: trades.length,
        activeCallers: uniqueCallers.size,
        activeTickers: uniqueTickers.size,
        avgPnl,
      },
    }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[api/globe] Error:", err);
    return NextResponse.json({ error: "Failed to load globe data" }, { status: 500 });
  }
}
