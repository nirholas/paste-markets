import { NextResponse } from "next/server";
import { getCallerEarningsLeaderboard } from "@/lib/wager-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/wagers/leaderboard
 *
 * Returns top callers ranked by wager tip earnings.
 */
export async function GET() {
  try {
    const leaderboard = getCallerEarningsLeaderboard();
    return NextResponse.json({ leaderboard });
  } catch {
    return NextResponse.json({ leaderboard: [] });
  }
}
