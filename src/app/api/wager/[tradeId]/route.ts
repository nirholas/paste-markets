import { NextRequest, NextResponse } from "next/server";
import { getWagerStats, getWagersByTrade, getWagerConfig } from "@/lib/wager-db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ tradeId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { tradeId } = await params;

  const stats = getWagerStats(tradeId);
  if (!stats) {
    // Not yet configured — return empty stats so UI can still render
    return NextResponse.json({
      enabled: false,
      stats: null,
      wagers: [],
    });
  }

  const config = getWagerConfig(tradeId);
  const wagers = getWagersByTrade(tradeId).map((w) => ({
    id: w.id,
    handle: w.handle,
    amount: w.amount,
    currency: w.currency,
    status: w.status,
    wageredAt: w.wagered_at,
    pnlAmount: w.pnl_amount,
    // Never expose wallet_address publicly
  }));

  return NextResponse.json({
    enabled: true,
    stats,
    wagerVaultAddress: config?.wager_vault_address ?? null,
    wagers,
  });
}
