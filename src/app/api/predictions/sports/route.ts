import { NextResponse } from "next/server";
import { classifyCategory } from "@/lib/category";
import type { SportsLeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      "https://paste.trade/api/trades?platform=polymarket&limit=50",
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

    // Filter to sports-category items only
    const sportsTrades = rawItems.filter((raw: Record<string, unknown>) => {
      const ticker = String(raw["ticker"] ?? "");
      const thesis = raw["thesis"] != null ? String(raw["thesis"]) : null;
      const marketQuestion = raw["market_question"] != null ? String(raw["market_question"]) : null;
      const instrument = raw["instrument"] != null ? String(raw["instrument"]) : null;

      const cat = classifyCategory({
        platform: "polymarket",
        ticker,
        thesis,
        market_question: marketQuestion,
        instrument,
      });

      return cat === "sports";
    });

    // Build leaderboard by handle
    const byHandle = new Map<string, {
      wins: number;
      losses: number;
      pnls: number[];
      trades: Array<{ pnl: number; date: string }>;
    }>();

    for (const raw of sportsTrades) {
      const handle = String(raw["author_handle"] ?? "");
      if (!handle) continue;

      const entry = byHandle.get(handle) ?? { wins: 0, losses: 0, pnls: [], trades: [] };
      const pnl = raw["pnl_pct"] != null ? Number(raw["pnl_pct"]) : 0;
      const date = String(raw["created_at"] ?? "");

      entry.pnls.push(pnl);
      entry.trades.push({ pnl, date });

      if (pnl > 0) entry.wins++;
      else if (pnl < 0) entry.losses++;

      byHandle.set(handle, entry);
    }

    // Calculate streaks and build rows
    const rows: SportsLeaderboardRow[] = [];

    for (const [handle, data] of byHandle) {
      const total = data.wins + data.losses;
      if (total === 0) continue;

      const win_pct = Math.round((data.wins / total) * 100);
      const avg_pnl = parseFloat(
        (data.pnls.reduce((a, b) => a + b, 0) / data.pnls.length).toFixed(1),
      );

      // Calculate streak from most recent trades
      const sorted = data.trades.sort((a, b) => b.date.localeCompare(a.date));
      let streak = 0;
      let streak_type: "W" | "L" | null = null;
      if (sorted.length > 0) {
        streak_type = sorted[0].pnl > 0 ? "W" : "L";
        for (const t of sorted) {
          if ((streak_type === "W" && t.pnl > 0) || (streak_type === "L" && t.pnl < 0)) {
            streak++;
          } else {
            break;
          }
        }
      }

      rows.push({
        rank: 0,
        handle,
        wins: data.wins,
        losses: data.losses,
        win_pct,
        avg_pnl,
        streak,
        streak_type,
      });
    }

    // Sort by win%, then avg PnL
    rows.sort((a, b) => b.win_pct - a.win_pct || b.avg_pnl - a.avg_pnl);
    rows.forEach((r, i) => { r.rank = i + 1; });

    return NextResponse.json(
      { entries: rows, total: rows.length },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } },
    );
  } catch (err) {
    console.error("[api/predictions/sports] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
