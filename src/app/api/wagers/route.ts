import { NextRequest, NextResponse } from "next/server";
import {
  getActiveWagerConfigs,
  getSettledWagerConfigs,
  getWagerEvents,
  getWagersByWallet,
} from "@/lib/wager-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/wagers
 *
 * Returns active + settled wager configs and recent events.
 * Optional ?wallet=<address> to get user-specific wagers.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");

  // If wallet param provided, return that wallet's wagers
  if (wallet) {
    try {
      const wagers = getWagersByWallet(wallet).map((w) => ({
        id: w.id,
        trade_card_id: w.trade_card_id,
        amount: w.amount,
        status: w.status,
        wagered_at: w.wagered_at,
        pnl_amount: w.pnl_amount,
        author_handle: w.author_handle,
        ticker: w.ticker,
        direction: w.direction,
      }));
      return NextResponse.json({ wagers });
    } catch {
      return NextResponse.json({ wagers: [] });
    }
  }

  // Otherwise return feed data
  try {
    const active = getActiveWagerConfigs();
    const settled = getSettledWagerConfigs();
    const events = getWagerEvents();

    return NextResponse.json({ active, settled, events });
  } catch {
    return NextResponse.json({ active: [], settled: [], events: [] });
  }
}
