import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthorTrades } from "@/lib/paste-trade";
import { computeMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

interface SimulateBody {
  callers: string[];
  starting_capital: number;
  timeframe: string;
  allocation: "equal" | "weighted";
}

interface TradeEvent {
  date: string;
  caller: string;
  ticker: string;
  direction: string;
  pnl_pct: number;
}

export async function POST(request: NextRequest) {
  let body: SimulateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { callers, starting_capital, timeframe, allocation } = body;

  if (!callers || !Array.isArray(callers) || callers.length === 0) {
    return NextResponse.json({ error: "At least one caller required" }, { status: 400 });
  }
  if (callers.length > 10) {
    return NextResponse.json({ error: "Maximum 10 callers" }, { status: 400 });
  }
  if (!starting_capital || starting_capital < 100 || starting_capital > 1_000_000) {
    return NextResponse.json({ error: "Starting capital must be $100-$1,000,000" }, { status: 400 });
  }

  const tf = (["7d", "30d", "90d", "all"].includes(timeframe) ? timeframe : "30d") as
    | "7d" | "30d" | "90d" | "all";

  // Fetch trades for all callers in parallel
  const callerResults = await Promise.all(
    callers.map(async (handle) => {
      const raw = await getAuthorTrades(handle, tf);
      const trades = raw
        .filter((t) => t.pnlPct != null)
        .map((t) => ({
          ticker: t.ticker,
          direction: t.direction,
          pnl_pct: t.pnlPct!,
          platform: t.platform,
          entry_date: t.author_date,
          posted_at: t.posted_at,
        }));
      const metrics = computeMetrics(handle, trades);
      return { handle, trades, metrics };
    }),
  );

  // Compute allocation weights
  const weights: Record<string, number> = {};
  if (allocation === "weighted") {
    // Weight by win rate — higher win rate gets more capital
    const totalWr = callerResults.reduce((s, c) => s + Math.max(c.metrics.winRate, 1), 0);
    for (const c of callerResults) {
      weights[c.handle] = Math.max(c.metrics.winRate, 1) / totalWr;
    }
  } else {
    const w = 1 / callerResults.length;
    for (const c of callerResults) {
      weights[c.handle] = w;
    }
  }

  // Build chronological trade events
  const allEvents: TradeEvent[] = [];
  for (const c of callerResults) {
    for (const t of c.trades) {
      const date = t.entry_date ?? t.posted_at ?? "";
      if (!date) continue;
      allEvents.push({
        date,
        caller: c.handle,
        ticker: t.ticker,
        direction: t.direction,
        pnl_pct: t.pnl_pct,
      });
    }
  }

  allEvents.sort((a, b) => a.date.localeCompare(b.date));

  // Simulate portfolio: each trade applies its P&L to the caller's allocated capital
  const callerCapital: Record<string, number> = {};
  for (const c of callerResults) {
    callerCapital[c.handle] = starting_capital * weights[c.handle];
  }

  let portfolioValue = starting_capital;
  let maxValue = starting_capital;
  let maxDrawdown = 0;
  let bestTrade: { caller: string; ticker: string; pnl_pct: number; dollar: number } | null = null;
  let worstTrade: { caller: string; ticker: string; pnl_pct: number; dollar: number } | null = null;

  const callerPnl: Record<string, number> = {};
  for (const c of callerResults) {
    callerPnl[c.handle] = 0;
  }

  // Timeline: start with starting capital
  const timeline: { date: string; value: number }[] = [
    { date: allEvents[0]?.date ?? new Date().toISOString().split("T")[0], value: starting_capital },
  ];

  let totalWins = 0;
  let totalTrades = 0;

  for (const event of allEvents) {
    const callerAlloc = callerCapital[event.caller] ?? 0;
    // Each trade risks a fraction of the caller's current allocation
    // We model position sizing as spreading across all trades equally
    const callerTradeCount = callerResults.find((c) => c.handle === event.caller)?.trades.length ?? 1;
    const positionSize = callerAlloc / Math.max(callerTradeCount, 1);
    const dollarPnl = positionSize * (event.pnl_pct / 100);

    portfolioValue += dollarPnl;
    callerCapital[event.caller] = (callerCapital[event.caller] ?? 0) + dollarPnl;
    callerPnl[event.caller] = (callerPnl[event.caller] ?? 0) + dollarPnl;

    totalTrades++;
    if (event.pnl_pct > 0) totalWins++;

    if (portfolioValue > maxValue) maxValue = portfolioValue;
    const drawdown = ((maxValue - portfolioValue) / maxValue) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (!bestTrade || dollarPnl > bestTrade.dollar) {
      bestTrade = { caller: event.caller, ticker: event.ticker, pnl_pct: event.pnl_pct, dollar: dollarPnl };
    }
    if (!worstTrade || dollarPnl < worstTrade.dollar) {
      worstTrade = { caller: event.caller, ticker: event.ticker, pnl_pct: event.pnl_pct, dollar: dollarPnl };
    }

    timeline.push({ date: event.date, value: parseFloat(portfolioValue.toFixed(2)) });
  }

  // Compute Sharpe-like ratio (mean return / std deviation of returns)
  const returns = allEvents.map((e) => e.pnl_pct);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance =
    returns.length > 1
      ? returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? parseFloat((meanReturn / stdDev).toFixed(2)) : 0;

  // Per-caller breakdown
  const perCaller = callerResults.map((c) => ({
    handle: c.handle,
    trades: c.metrics.totalTrades,
    winRate: parseFloat(c.metrics.winRate.toFixed(1)),
    pnlDollar: parseFloat((callerPnl[c.handle] ?? 0).toFixed(2)),
    pnlPct: parseFloat((((callerPnl[c.handle] ?? 0) / (starting_capital * weights[c.handle])) * 100).toFixed(2)),
    weight: parseFloat((weights[c.handle] * 100).toFixed(1)),
  }));

  perCaller.sort((a, b) => b.pnlDollar - a.pnlDollar);

  const totalPnl = portfolioValue - starting_capital;
  const totalPnlPct = (totalPnl / starting_capital) * 100;

  const response = NextResponse.json({
    finalValue: parseFloat(portfolioValue.toFixed(2)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    totalPnlPct: parseFloat(totalPnlPct.toFixed(2)),
    timeline,
    perCaller,
    stats: {
      totalTrades,
      winRate: totalTrades > 0 ? parseFloat(((totalWins / totalTrades) * 100).toFixed(1)) : 0,
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      sharpeRatio,
      bestTrade: bestTrade
        ? { caller: bestTrade.caller, ticker: bestTrade.ticker, pnl_pct: bestTrade.pnl_pct, dollar: parseFloat(bestTrade.dollar.toFixed(2)) }
        : null,
      worstTrade: worstTrade
        ? { caller: worstTrade.caller, ticker: worstTrade.ticker, pnl_pct: worstTrade.pnl_pct, dollar: parseFloat(worstTrade.dollar.toFixed(2)) }
        : null,
    },
    config: {
      callers,
      starting_capital,
      timeframe: tf,
      allocation,
    },
  });

  response.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return response;
}
