import { NextResponse } from "next/server";
import { classifyCategory } from "@/lib/category";
import type { EventItem } from "../route";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      "https://paste.trade/api/trades?platform=polymarket&limit=30",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const body = await res.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    // Group by market question to count callers
    const marketMap = new Map<string, { item: EventItem; callerCount: number; totalVolume: number }>();

    for (const raw of rawItems) {
      const question = String(raw["market_question"] ?? raw["ticker"] ?? "");
      const ticker = String(raw["ticker"] ?? "");
      const thesis = raw["thesis"] != null ? String(raw["thesis"]) : null;
      const marketQuestion = raw["market_question"] != null ? String(raw["market_question"]) : null;
      const instrument = raw["instrument"] != null ? String(raw["instrument"]) : null;

      const category = classifyCategory({
        platform: "polymarket",
        ticker,
        thesis,
        market_question: marketQuestion,
        instrument,
      });

      const avatarUrl = raw["author_avatar_url"];
      const fixedAvatar = avatarUrl
        ? (String(avatarUrl).startsWith("/") ? `https://paste.trade${avatarUrl}` : String(avatarUrl))
        : null;

      const sourceUrl = raw["source_url"] != null ? String(raw["source_url"]) : null;
      const polymarketUrl =
        sourceUrl?.includes("polymarket.com") ? sourceUrl :
        raw["polymarket_url"] != null ? String(raw["polymarket_url"]) : null;

      const item: EventItem = {
        id: String(raw["id"] ?? ""),
        ticker,
        direction: String(raw["direction"] ?? "yes"),
        author_handle: String(raw["author_handle"] ?? ""),
        author_avatar_url: fixedAvatar,
        headline_quote: raw["headline_quote"] != null ? String(raw["headline_quote"]) : null,
        thesis,
        platform: "polymarket",
        instrument,
        source_url: sourceUrl,
        created_at: String(raw["created_at"] ?? new Date().toISOString()),
        entry_price: raw["entry_price"] != null ? Number(raw["entry_price"]) : null,
        current_price: raw["current_price"] != null ? Number(raw["current_price"]) : null,
        pnl_pct: raw["pnl_pct"] != null ? Number(raw["pnl_pct"]) : null,
        win_rate: raw["win_rate"] != null ? Number(raw["win_rate"]) : null,
        market_question: marketQuestion,
        market_volume: raw["market_volume"] != null ? Number(raw["market_volume"]) : null,
        expires_at: raw["expires_at"] != null ? String(raw["expires_at"]) : null,
        polymarket_url: polymarketUrl,
        category,
      };

      const existing = marketMap.get(question);
      if (existing) {
        existing.callerCount += 1;
        existing.totalVolume += item.market_volume ?? 0;
      } else {
        marketMap.set(question, {
          item,
          callerCount: 1,
          totalVolume: item.market_volume ?? 0,
        });
      }
    }

    // Sort by caller count (trending = most tracked)
    const trending = Array.from(marketMap.values())
      .sort((a, b) => b.callerCount - a.callerCount || b.totalVolume - a.totalVolume)
      .slice(0, 10)
      .map(({ item, callerCount }) => ({
        ...item,
        caller_count: callerCount,
      }));

    return NextResponse.json(
      { items: trending },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } },
    );
  } catch (err) {
    console.error("[api/events/trending] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
