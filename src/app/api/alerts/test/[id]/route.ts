import { NextRequest, NextResponse } from "next/server";
import { getAlertRuleById } from "@/lib/db";
import { evaluateRule } from "@/lib/alert-rules";
import type { DetectedTrade } from "@/lib/alert-rules";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RecentTradeRow {
  author_handle: string;
  ticker: string;
  direction: string;
  platform: string | null;
  pnl_pct: number | null;
  posted_at: string | null;
  confidence: number | null;
  tier: string | null;
}

/** GET /api/alerts/test/[id] — test a rule against recent trades */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const rule = await getAlertRuleById(id);
  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  // Get recent trades + live_signals, convert to DetectedTrade format
  const recentTrades = await sql`
    SELECT t.author_handle, t.ticker, t.direction, t.platform, t.pnl_pct, t.posted_at,
           NULL as confidence, w.tier
    FROM trades t
    LEFT JOIN caller_watchlist w ON w.handle = t.author_handle
    WHERE t.posted_at >= (NOW() - INTERVAL '30 days')::text
    ORDER BY t.posted_at DESC
    LIMIT 200
  ` as RecentTradeRow[];

  const recentSignals = await sql`
    SELECT ls.handle, ls.ticker, ls.direction, ls.platform, ls.confidence, w.tier
    FROM live_signals ls
    LEFT JOIN caller_watchlist w ON w.handle = ls.handle
    WHERE ls.detected_at >= (NOW() - INTERVAL '30 days')::text
    ORDER BY ls.detected_at DESC
    LIMIT 100
  ` as { handle: string; ticker: string; direction: string; platform: string | null; confidence: number; tier: string | null }[];

  const trades: DetectedTrade[] = [
    ...recentTrades.map((t) => ({
      callerHandle: t.author_handle,
      ticker: t.ticker,
      direction: t.direction,
      platform: t.platform ?? undefined,
      pnlPct: t.pnl_pct ?? undefined,
      confidence: t.confidence ?? undefined,
      tier: t.tier ?? undefined,
    })),
    ...recentSignals.map((s) => ({
      callerHandle: s.handle,
      ticker: s.ticker,
      direction: s.direction,
      platform: s.platform ?? undefined,
      confidence: s.confidence,
      tier: s.tier ?? undefined,
    })),
  ];

  const matched = trades.filter((t) => evaluateRule(rule, t));

  return NextResponse.json({
    ruleId: id,
    ruleName: rule.name,
    totalTested: trades.length,
    matchCount: matched.length,
    matches: matched.slice(0, 20).map((t) => ({
      caller: t.callerHandle,
      ticker: t.ticker,
      direction: t.direction,
      platform: t.platform,
      confidence: t.confidence,
      tier: t.tier,
    })),
  });
}
