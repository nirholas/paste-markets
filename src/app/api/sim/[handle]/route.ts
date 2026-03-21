import { NextRequest, NextResponse } from "next/server";
import { searchPasteTrade } from "@/lib/paste-trade";
import { getAuthorRecord } from "@/lib/data";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES = ["7d", "30d", "90d", "all"] as const;
type Timeframe = (typeof VALID_TIMEFRAMES)[number];

function isValidTimeframe(v: string): v is Timeframe {
  return (VALID_TIMEFRAMES as readonly string[]).includes(v);
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = cleanHandle(rawHandle);

    if (!handle) {
      return NextResponse.json({ error: "Missing handle" }, { status: 400 });
    }

    const { searchParams } = request.nextUrl;
    const rawTimeframe = searchParams.get("timeframe") ?? searchParams.get("t") ?? "30d";
    const timeframe: Timeframe = isValidTimeframe(rawTimeframe) ? rawTimeframe : "30d";

    // Fetch trades from paste.trade
    const allTrades = await searchPasteTrade({
      author: handle,
      top: timeframe,
      limit: 100,
    });

    // Only keep trades where pnlPct is known
    const trades = allTrades.filter((t) => t.pnlPct != null);

    if (trades.length === 0) {
      return NextResponse.json(
        {
          error: "No trades found",
          details: `No resolved trades for @${handle} in the ${timeframe} timeframe`,
        },
        { status: 404 },
      );
    }

    // Sort by posted_at ascending (oldest first) for running portfolio calc
    const sorted = [...trades].sort(
      (a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime(),
    );

    // Simulate: $1,000 flat bet per trade
    const BASE_CAPITAL = 10_000;
    const BET_SIZE = 1_000;

    let portfolio = BASE_CAPITAL;
    let winCount = 0;
    let lossCount = 0;

    type SimTrade = {
      ticker: string;
      direction: string;
      pnlPct: number;
      postedAt: string;
      platform: string | null;
      runningPortfolio: number;
      tradePnlDollars: number;
    };

    const simTrades: SimTrade[] = sorted.map((t) => {
      const pnlPct = t.pnlPct as number; // filtered above
      const tradePnlDollars = BET_SIZE * (pnlPct / 100);
      portfolio += tradePnlDollars;
      if (pnlPct > 0) winCount++;
      else lossCount++;

      return {
        ticker: t.ticker,
        direction: t.direction,
        pnlPct,
        postedAt: fmtDate(t.posted_at),
        platform: t.platform ?? null,
        runningPortfolio: Math.round(portfolio * 100) / 100,
        tradePnlDollars: Math.round(tradePnlDollars * 100) / 100,
      };
    });

    const portfolioFinal = Math.round(portfolio * 100) / 100;
    const totalPnlDollars = Math.round((portfolioFinal - BASE_CAPITAL) * 100) / 100;
    const totalReturnPct = Math.round(((portfolioFinal - BASE_CAPITAL) / BASE_CAPITAL) * 10_000) / 100;
    const winRate = trades.length > 0 ? Math.round((winCount / trades.length) * 10_000) / 100 : 0;

    // Best and worst trades
    const byPnl = [...simTrades].sort((a, b) => b.pnlPct - a.pnlPct);
    const bestTrade = byPnl[0]
      ? {
          ticker: byPnl[0].ticker,
          direction: byPnl[0].direction,
          pnlPct: byPnl[0].pnlPct,
          postedAt: byPnl[0].postedAt,
        }
      : null;
    const worstEntry = byPnl[byPnl.length - 1];
    const worstTrade = worstEntry
      ? {
          ticker: worstEntry.ticker,
          direction: worstEntry.direction,
          pnlPct: worstEntry.pnlPct,
          postedAt: worstEntry.postedAt,
        }
      : null;

    // Fetch author record for rank/win_rate
    let authorRank: number | null = null;
    let authorWinRate: number | null = null;
    try {
      const author = await getAuthorRecord(handle);
      if (author) {
        authorRank = author.rank ?? null;
        authorWinRate = typeof author.win_rate === "number" ? author.win_rate : null;
      }
    } catch {
      // Non-fatal — continue without author record
    }

    return NextResponse.json({
      handle,
      timeframe,
      tradeCount: trades.length,
      winCount,
      lossCount,
      winRate,
      totalReturnPct,
      totalPnlDollars,
      portfolioFinal,
      bestTrade,
      worstTrade,
      trades: simTrades,
      authorRank,
      authorWinRate,
    });
  } catch (err) {
    console.error("[api/sim] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
