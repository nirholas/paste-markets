import type { Metadata } from "next";
import Link from "next/link";
import { SimTimeframeSelector } from "@/components/sim-timeframe-selector";
import { PnlDisplay } from "@/components/ui/pnl-display";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimTrade {
  ticker: string;
  direction: string;
  pnlPct: number;
  postedAt: string;
  platform: string | null;
  runningPortfolio: number;
  tradePnlDollars: number;
}

interface SimResult {
  handle: string;
  timeframe: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalReturnPct: number;
  totalPnlDollars: number;
  portfolioFinal: number;
  bestTrade: { ticker: string; direction: string; pnlPct: number; postedAt: string } | null;
  worstTrade: { ticker: string; direction: string; pnlPct: number; postedAt: string } | null;
  trades: SimTrade[];
  authorRank: number | null;
  authorWinRate: number | null;
}

// ---------------------------------------------------------------------------
// Page props
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ t?: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TIMEFRAMES = ["7d", "30d", "90d", "all"] as const;
type Timeframe = (typeof VALID_TIMEFRAMES)[number];

function resolveTimeframe(raw: string | undefined): Timeframe {
  if (raw && (VALID_TIMEFRAMES as readonly string[]).includes(raw)) {
    return raw as Timeframe;
  }
  return "30d";
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

function fmtDollars(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPortfolio(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { handle: rawHandle } = await params;
  const { t } = await searchParams;
  const handle = cleanHandle(rawHandle);
  const timeframe = resolveTimeframe(t);

  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  let description = `Simulate copy trading @${handle} on paste.markets. See their P&L history with $1,000 flat bets.`;

  try {
    const res = await fetch(`${baseUrl}/api/sim/${handle}?t=${timeframe}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data: SimResult = await res.json();
      const sign = data.totalReturnPct >= 0 ? "+" : "";
      description = `Copy trading @${handle}: ${sign}${data.totalReturnPct.toFixed(1)}% return on ${data.tradeCount} trades (${timeframe}). Win rate: ${data.winRate.toFixed(0)}%.`;
    }
  } catch {
    // Use default description
  }

  const title = `Copy Trading @${handle} — paste.markets`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function SimPage({ params, searchParams }: PageProps) {
  const { handle: rawHandle } = await params;
  const { t } = await searchParams;
  const handle = cleanHandle(rawHandle);
  const timeframe = resolveTimeframe(t);

  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  let data: SimResult | null = null;
  let fetchError: string | null = null;

  try {
    const res = await fetch(`${baseUrl}/api/sim/${handle}?t=${timeframe}`, {
      cache: "no-store",
    });
    if (res.status === 404) {
      fetchError = "no_trades";
    } else if (!res.ok) {
      fetchError = "error";
    } else {
      data = (await res.json()) as SimResult;
    }
  } catch {
    fetchError = "error";
  }

  const isPositive = (data?.totalReturnPct ?? 0) >= 0;
  const returnColor = isPositive ? "text-win" : "text-loss";

  return (
    <main className="min-h-screen bg-bg px-4 py-12 max-w-3xl mx-auto font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-text-primary">
            @{handle}&apos;s Copy Trading Sim
          </h1>
          <p className="text-[13px] text-text-muted mt-1">
            {data ? `${data.tradeCount} resolved trades · ${timeframe} window` : "Simulated P&L · $1,000 flat bet per trade"}
          </p>
        </div>
        <SimTimeframeSelector handle={handle} current={timeframe} />
      </div>

      {/* No trades state */}
      {fetchError === "no_trades" && (
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <p className="text-text-secondary text-sm mb-1">No trades found for this timeframe.</p>
          <p className="text-text-muted text-[12px]">
            Try a wider window or check that @{handle} has resolved calls on paste.trade.
          </p>
          <div className="flex justify-center gap-2 mt-6">
            {(["7d", "30d", "90d", "all"] as const).filter((f) => f !== timeframe).map((f) => (
              <Link
                key={f}
                href={`/sim/${handle}?t=${f}`}
                className="text-[11px] uppercase tracking-widest border border-border hover:border-accent text-text-muted hover:text-text-secondary px-3 py-1.5 rounded transition-colors"
              >
                Try {f}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Generic error state */}
      {fetchError === "error" && (
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <p className="text-text-secondary text-sm">Failed to load simulation data.</p>
          <p className="text-text-muted text-[12px] mt-1">Check that @{handle} exists on paste.trade.</p>
          <Link
            href={`/${handle}`}
            className="inline-block mt-6 text-[12px] border border-border hover:border-accent text-text-muted hover:text-text-secondary px-4 py-2 rounded transition-colors"
          >
            View @{handle}&apos;s profile
          </Link>
        </div>
      )}

      {/* Main content when data is available */}
      {data && (
        <>
          {/* Hero: total return + portfolio value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
                Total Return
              </div>
              <div className={`text-[42px] font-bold leading-none ${returnColor}`}>
                {data.totalReturnPct >= 0 ? "+" : ""}
                {data.totalReturnPct.toFixed(1)}%
              </div>
              <div className={`text-sm mt-2 ${returnColor}`}>
                {fmtDollars(data.totalPnlDollars)}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-2">
                Portfolio Value
              </div>
              <div className="text-[42px] font-bold leading-none text-text-primary">
                {fmtPortfolio(data.portfolioFinal)}
              </div>
              <div className="text-sm text-text-muted mt-2">
                started at $10,000
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
                Trades
              </div>
              <div className="text-xl font-bold text-text-primary">{data.tradeCount}</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {data.winCount}W / {data.lossCount}L
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
                Win Rate
              </div>
              <div
                className={`text-xl font-bold ${
                  data.winRate >= 50 ? "text-win" : "text-loss"
                }`}
              >
                {data.winRate.toFixed(0)}%
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {data.winCount} wins
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
                Best Trade
              </div>
              {data.bestTrade ? (
                <>
                  <div className="text-xl font-bold text-win">
                    +{data.bestTrade.pnlPct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {data.bestTrade.ticker} {data.bestTrade.direction.toUpperCase()}
                  </div>
                </>
              ) : (
                <div className="text-xl font-bold text-text-muted">--</div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
                Worst Trade
              </div>
              {data.worstTrade ? (
                <>
                  <div className="text-xl font-bold text-loss">
                    {data.worstTrade.pnlPct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {data.worstTrade.ticker} {data.worstTrade.direction.toUpperCase()}
                  </div>
                </>
              ) : (
                <div className="text-xl font-bold text-text-muted">--</div>
              )}
            </div>
          </div>

          {/* Author rank badge (if available) */}
          {(data.authorRank != null || data.authorWinRate != null) && (
            <div className="flex gap-3 mb-8">
              {data.authorRank != null && (
                <span className="text-[11px] uppercase tracking-widest border border-border text-text-muted px-3 py-1.5 rounded">
                  Rank #{data.authorRank}
                </span>
              )}
              {data.authorWinRate != null && (
                <span className="text-[11px] uppercase tracking-widest border border-border text-text-muted px-3 py-1.5 rounded">
                  {data.authorWinRate.toFixed(0)}% lifetime win rate
                </span>
              )}
              <Link
                href={`/${handle}`}
                className="text-[11px] uppercase tracking-widest border border-border hover:border-accent text-text-muted hover:text-text-secondary px-3 py-1.5 rounded transition-colors"
              >
                Full profile &rarr;
              </Link>
            </div>
          )}

          {/* Trade history table */}
          <div className="mb-4">
            <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-4">
              Trade History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    {["Ticker", "Dir", "P&L %", "$P&L", "Portfolio", "Date"].map((col) => (
                      <th
                        key={col}
                        className="text-left text-[11px] uppercase tracking-widest text-text-muted font-normal py-2 pr-5 border-b border-border"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((trade, i) => {
                    const isWin = trade.pnlPct > 0;
                    return (
                      <tr
                        key={`${trade.ticker}-${trade.postedAt}-${i}`}
                        className="border-b border-surface last:border-b-0"
                      >
                        <td className="py-2 pr-5 text-text-primary font-bold">
                          {trade.ticker}
                        </td>
                        <td className="py-2 pr-5">
                          <span
                            className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              trade.direction === "long" || trade.direction === "yes"
                                ? "text-win bg-win/10"
                                : "text-loss bg-loss/10"
                            }`}
                          >
                            {trade.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-5">
                          <PnlDisplay value={trade.pnlPct} />
                        </td>
                        <td
                          className={`py-2 pr-5 font-bold ${
                            isWin ? "text-win" : "text-loss"
                          }`}
                        >
                          {fmtDollars(trade.tradePnlDollars)}
                        </td>
                        <td className="py-2 pr-5 text-text-secondary tabular-nums">
                          {fmtPortfolio(trade.runningPortfolio)}
                        </td>
                        <td className="py-2 text-text-muted">
                          {fmtShortDate(trade.postedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-10 pt-6 border-t border-border">
            <p className="text-[11px] text-text-muted">
              Simulation assumes $1,000 flat per trade. Does not account for fees, slippage, or position timing.
            </p>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-border flex justify-between text-[11px] text-text-muted">
        <span>paste.markets</span>
        <span>data from paste.trade</span>
      </div>
    </main>
  );
}
