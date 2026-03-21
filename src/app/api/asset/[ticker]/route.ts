import { NextRequest, NextResponse } from "next/server";
import { getAssetTrades } from "@/lib/data";
import { searchFullTrades } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export interface AssetTrade {
  id: string;
  handle: string;
  direction: "long" | "short" | "yes" | "no";
  entryPrice: number | null;
  currentPrice: number | null;
  pnlPercent: number | null;
  submittedAt: string;
  tweetUrl: string | null;
  cardUrl: string | null;
  market: string | null;
}

export interface CallerOnAsset {
  handle: string;
  callCount: number;
  winCount: number;
  hitRate: number;
  avgPnl: number | null;
}

export interface BestCall {
  handle: string;
  pnlPercent: number;
  entryPrice: number | null;
  date: string;
  cardUrl: string | null;
}

export interface AssetDetailResponse {
  ticker: string;
  currentPrice: number | null;
  totalCalls: number;
  avgPnlPercent: number | null;
  bullCount: number;
  bearCount: number;
  bestCall: BestCall | null;
  trades: AssetTrade[];
  callers: CallerOnAsset[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  // Try to get rich data with entryPrice/currentPrice from paste.trade API
  // then fall back to DB data for metadata
  const [richTrades, dbTrades] = await Promise.all([
    searchFullTrades({ ticker, top: "all", limit: 100 }).catch(() => []),
    getAssetTrades(ticker),
  ]);

  // Prefer rich API data if we got any; otherwise use DB trades
  let trades: AssetTrade[];

  if (richTrades.length > 0) {
    trades = richTrades.map((t) => ({
      id: t.trade_id ?? `${t.author_handle ?? ""}:${ticker}:${t.posted_at}`,
      handle: t.author_handle ?? "unknown",
      direction: t.direction,
      entryPrice: t.entryPrice ?? null,
      currentPrice: t.currentPrice ?? null,
      pnlPercent: t.pnlPct ?? null,
      submittedAt: t.posted_at,
      tweetUrl: t.source_url ?? null,
      cardUrl: t.trade_id ? `https://paste.trade/t/${t.trade_id}` : null,
      market: t.platform ?? null,
    }));
  } else if (dbTrades.length > 0) {
    trades = dbTrades.map((t) => ({
      id: `${t.handle}:${ticker}:${t.postedAt ?? t.entryDate ?? ""}`,
      handle: t.handle,
      direction: t.direction as AssetTrade["direction"],
      entryPrice: null,
      currentPrice: null,
      pnlPercent: t.pnlPct,
      submittedAt: t.postedAt ?? t.entryDate ?? new Date().toISOString(),
      tweetUrl: t.sourceUrl,
      cardUrl: null,
      market: t.platform,
    }));
  } else {
    return NextResponse.json(
      { error: "No trades found for ticker" },
      { status: 404 },
    );
  }

  // Sort by PnL descending
  trades.sort(
    (a, b) => (b.pnlPercent ?? -Infinity) - (a.pnlPercent ?? -Infinity),
  );

  // Aggregate stats
  const pnlTrades = trades.filter((t) => t.pnlPercent != null);
  const avgPnlPercent =
    pnlTrades.length > 0
      ? pnlTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) /
        pnlTrades.length
      : null;

  const bullCount = trades.filter(
    (t) => t.direction === "long" || t.direction === "yes",
  ).length;
  const bearCount = trades.filter(
    (t) => t.direction === "short" || t.direction === "no",
  ).length;

  // Best call
  const bestTrade = pnlTrades.reduce<AssetTrade | null>((best, t) => {
    if (!best || (t.pnlPercent ?? -Infinity) > (best.pnlPercent ?? -Infinity))
      return t;
    return best;
  }, null);

  const bestCall: BestCall | null = bestTrade
    ? {
        handle: bestTrade.handle,
        pnlPercent: bestTrade.pnlPercent!,
        entryPrice: bestTrade.entryPrice,
        date: bestTrade.submittedAt,
        cardUrl: bestTrade.cardUrl,
      }
    : null;

  // Current price from most recent trade with currentPrice
  const currentPrice =
    [...trades]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .find((t) => t.currentPrice != null)?.currentPrice ?? null;

  // Callers breakdown
  const callerMap = new Map<
    string,
    { total: number; wins: number; pnlSum: number; pnlCount: number }
  >();
  for (const trade of trades) {
    const entry = callerMap.get(trade.handle) ?? {
      total: 0,
      wins: 0,
      pnlSum: 0,
      pnlCount: 0,
    };
    entry.total++;
    if ((trade.pnlPercent ?? 0) > 0) entry.wins++;
    if (trade.pnlPercent != null) {
      entry.pnlSum += trade.pnlPercent;
      entry.pnlCount++;
    }
    callerMap.set(trade.handle, entry);
  }

  const callers: CallerOnAsset[] = Array.from(callerMap.entries())
    .map(([handle, stats]) => ({
      handle,
      callCount: stats.total,
      winCount: stats.wins,
      hitRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
      avgPnl:
        stats.pnlCount > 0 ? stats.pnlSum / stats.pnlCount : null,
    }))
    .sort((a, b) => b.callCount - a.callCount || b.hitRate - a.hitRate);

  const response: AssetDetailResponse = {
    ticker,
    currentPrice,
    totalCalls: trades.length,
    avgPnlPercent,
    bullCount,
    bearCount,
    bestCall,
    trades,
    callers,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
  });
}
