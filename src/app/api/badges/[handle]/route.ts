import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { getAuthorMetrics } from "@/lib/data";
import { getAuthorTrades } from "@/lib/paste-trade";
import { computeBadges } from "@/lib/compute-badges";
import type { TradeSummary } from "@/lib/metrics";

interface RouteParams {
  params: Promise<{ handle: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  const metrics = await getAuthorMetrics(handle);
  if (!metrics || metrics.totalTrades === 0) {
    return NextResponse.json({ handle, badges: [] });
  }

  // Fetch full trade history for badge computation
  let trades: TradeSummary[] = [];
  try {
    const raw = await getAuthorTrades(handle, "all");
    trades = raw.map((t) => ({
      ticker: t.ticker,
      direction: t.direction,
      pnl_pct: t.pnlPct ?? 0,
      platform: t.platform,
      entry_date: t.author_date,
      posted_at: t.posted_at,
    }));
  } catch {
    // Fall back to metrics.recentTrades
    trades = metrics.recentTrades;
  }

  const earned = computeBadges(metrics, trades);

  return NextResponse.json({
    handle,
    badges: earned.map((e) => ({
      id: e.badge.id,
      name: e.badge.name,
      description: e.badge.description,
      icon: e.badge.icon,
      tier: e.badge.tier,
      earnedAt: e.earnedAt,
    })),
  });
}
