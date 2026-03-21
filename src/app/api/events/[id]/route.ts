import { NextRequest, NextResponse } from "next/server";
import type { EventItem } from "../route";

export const dynamic = "force-dynamic";

interface CallerPosition {
  handle: string;
  direction: "yes" | "no";
  entry_probability: number;
  current_probability: number;
  pnl_pct: number;
  called_at: string;
}

interface MarketDetail {
  market: EventItem;
  callers: CallerPosition[];
  consensus: {
    yes_count: number;
    no_count: number;
    total: number;
    yes_pct: number;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    // Fetch the specific trade/market from paste.trade
    const { getTradeById, fetchTradesList } = await import("@/lib/paste-trade");
    const raw = await getTradeById(id);

    if (!raw) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Also fetch all trades for this market question to build caller consensus
    const marketQuestion = raw.market_question ?? raw.ticker ?? "";
    const allTradesData = await fetchTradesList({ platform: "polymarket", limit: 50 });

    let callers: CallerPosition[] = [];

    {
      const items = allTradesData.items;

      // Find trades on the same market
      const relatedTrades = items.filter((t: Record<string, unknown>) => {
        const q = String(t["market_question"] ?? t["ticker"] ?? "");
        return q === marketQuestion || String(t["id"]) === id;
      });

      callers = relatedTrades.map((t: Record<string, unknown>) => {
        const entry = Number(t["entry_price"] ?? t["entryPrice"] ?? 0.5);
        const current = Number(t["current_price"] ?? t["currentPrice"] ?? 0.5);
        const dir = String(t["direction"] ?? "yes").toLowerCase() as "yes" | "no";

        let pnl_pct: number;
        if (dir === "yes") {
          pnl_pct = entry > 0 ? ((current - entry) / entry) * 100 : 0;
        } else {
          pnl_pct = entry < 1 ? (((1 - current) - (1 - entry)) / (1 - entry)) * 100 : 0;
        }

        return {
          handle: String(t["author_handle"] ?? ""),
          direction: dir,
          entry_probability: entry,
          current_probability: current,
          pnl_pct: parseFloat(pnl_pct.toFixed(1)),
          called_at: String(t["created_at"] ?? new Date().toISOString()),
        };
      });
    }

    const yesCallers = callers.filter((c) => c.direction === "yes");
    const noCallers = callers.filter((c) => c.direction === "no");

    const rawAny = raw as Record<string, unknown>;
    const avatarUrl = raw.author_avatar_url
      ? (raw.author_avatar_url.startsWith("/")
        ? `https://paste.trade${raw.author_avatar_url}`
        : raw.author_avatar_url)
      : null;

    const detail: MarketDetail = {
      market: {
        id: raw.trade_id ?? id,
        ticker: raw.ticker ?? "",
        direction: raw.direction ?? "yes",
        author_handle: raw.author_handle ?? "",
        author_avatar_url: avatarUrl,
        headline_quote: raw.headline_quote ?? null,
        thesis: raw.thesis ?? null,
        platform: "polymarket",
        instrument: raw.platform ?? null,
        source_url: raw.source_url ?? null,
        created_at: raw.posted_at ?? new Date().toISOString(),
        entry_price: raw.entryPrice ?? null,
        current_price: raw.currentPrice ?? null,
        pnl_pct: raw.pnlPct ?? null,
        win_rate: null,
        market_question: raw.market_question ?? null,
        market_volume: rawAny["market_volume"] != null ? Number(rawAny["market_volume"]) : null,
        expires_at: rawAny["expires_at"] ? String(rawAny["expires_at"]) : null,
        polymarket_url: rawAny["polymarket_url"] ? String(rawAny["polymarket_url"]) : null,
        category: "prediction",
      },
      callers,
      consensus: {
        yes_count: yesCallers.length,
        no_count: noCallers.length,
        total: callers.length,
        yes_pct:
          callers.length > 0
            ? Math.round((yesCallers.length / callers.length) * 100)
            : 50,
      },
    };

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=15" },
    });
  } catch (err) {
    console.error("[api/events/[id]] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
