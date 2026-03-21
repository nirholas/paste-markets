import { NextRequest, NextResponse } from "next/server";
import { getCallerTipsEarned, getCallerWagerHistory } from "@/lib/wager-db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ handle: string }>;
}

/**
 * GET /api/caller/[handle]/earnings
 *
 * Returns a caller's wagering tip earnings and backing history.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  try {
    const totalTips = await getCallerTipsEarned(handle);
    const history = await getCallerWagerHistory(handle);

    const tradesWithBacking = history.filter((c) => c.wager_count > 0);
    const settledWithTips = history.filter(
      (c) => c.status === "settled" && (c.caller_tip_earned ?? 0) > 0,
    );

    const totalWageredOnCalls = history.reduce(
      (s, c) => s + c.total_wagered,
      0,
    );

    const avgTipPerBackedTrade =
      settledWithTips.length > 0 ? totalTips / settledWithTips.length : 0;

    const recentTrades = tradesWithBacking.slice(0, 10).map((c) => ({
      tradeCardId: c.trade_card_id,
      ticker: c.ticker,
      direction: c.direction,
      settlementDate: c.settlement_date,
      wagerDeadline: c.wager_deadline,
      totalWagered: c.total_wagered,
      wagerCount: c.wager_count,
      callerTipEarned: c.caller_tip_earned,
      status: c.status,
      settledAt: c.settled_at,
    }));

    return NextResponse.json({
      handle,
      totalTips: parseFloat(totalTips.toFixed(4)),
      tradesWithBacking: tradesWithBacking.length,
      totalWageredOnCalls: parseFloat(totalWageredOnCalls.toFixed(4)),
      avgTipPerBackedTrade: parseFloat(avgTipPerBackedTrade.toFixed(4)),
      recentTrades,
    });
  } catch (err) {
    console.error("[api/caller/earnings] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
