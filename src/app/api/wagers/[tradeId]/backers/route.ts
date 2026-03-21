import { NextRequest, NextResponse } from "next/server";
import { getBackersByTrade, getTopBacker, getWagerStats } from "@/lib/wager-db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ tradeId: string }>;
}

/**
 * GET /api/wagers/[tradeId]/backers
 *
 * Returns full backer list for a trade with stats.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { tradeId } = await params;

  const stats = await getWagerStats(tradeId);
  if (!stats) {
    return NextResponse.json({ backers: [], stats: null });
  }

  const backers = (await getBackersByTrade(tradeId)).map((b) => ({
    handle: b.handle,
    backer_avatar_url: b.backer_avatar_url,
    amount: b.amount,
    wagered_at: b.wagered_at,
  }));

  const topBacker = await getTopBacker(tradeId);

  return NextResponse.json({
    backers,
    stats: {
      total_wagered: stats.total_wagered,
      backer_count: stats.wager_count,
      status: stats.status,
    },
    top_backer: topBacker
      ? {
          handle: topBacker.handle,
          amount: topBacker.amount,
        }
      : null,
  });
}
