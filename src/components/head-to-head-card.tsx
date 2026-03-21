import { WinRateBar } from "@/components/ui/win-rate-bar";
import { PnlDisplay } from "@/components/ui/pnl-display";

type Winner = "a" | "b" | "tie";

interface TradeHighlight {
  ticker: string;
  direction: string;
  pnl: number;
  date: string;
}

interface MetricRowProps {
  label: string;
  aValue: React.ReactNode;
  bValue: React.ReactNode;
  winner: Winner;
}

function MetricRow({ label, aValue, bValue, winner }: MetricRowProps) {
  const aColor =
    winner === "a"
      ? "text-win"
      : winner === "tie"
        ? "text-text-secondary"
        : "text-text-muted";
  const bColor =
    winner === "b"
      ? "text-win"
      : winner === "tie"
        ? "text-text-secondary"
        : "text-text-muted";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4 border-b border-border last:border-b-0">
      <div className={`text-right text-sm font-mono ${aColor}`}>{aValue}</div>
      <div className="text-[11px] uppercase tracking-widest text-text-muted text-center min-w-[100px]">
        {label}
      </div>
      <div className={`text-left text-sm font-mono ${bColor}`}>{bValue}</div>
    </div>
  );
}

function formatTrade(trade: TradeHighlight | null): string {
  if (!trade) return "--";
  const sign = trade.pnl >= 0 ? "+" : "";
  return `${trade.ticker} ${sign}${trade.pnl.toFixed(1)}%`;
}

function formatStreak(streak: number): string {
  if (streak === 0) return "0";
  if (streak > 0) return `${streak}W`;
  return `${Math.abs(streak)}L`;
}

interface HeadToHeadCardProps {
  a: {
    handle: string;
    metrics: {
      totalTrades: number;
      winRate: number;
      avgPnl: number;
      winCount: number;
      lossCount: number;
      bestTrade: TradeHighlight | null;
      worstTrade: TradeHighlight | null;
      streak: number;
    };
  };
  b: {
    handle: string;
    metrics: {
      totalTrades: number;
      winRate: number;
      avgPnl: number;
      winCount: number;
      lossCount: number;
      bestTrade: TradeHighlight | null;
      worstTrade: TradeHighlight | null;
      streak: number;
    };
  };
  comparison: {
    winRateWinner: Winner;
    avgPnlWinner: Winner;
    totalTradesWinner: Winner;
    bestTradeWinner: Winner;
    overallWinner: Winner;
    sharedTickers: Array<{ ticker: string; a_pnl: number; b_pnl: number }>;
  };
}

export function HeadToHeadCard({ a, b, comparison }: HeadToHeadCardProps) {
  // Compute streak and worst trade winners locally
  const streakA = Math.abs(a.metrics.streak);
  const streakB = Math.abs(b.metrics.streak);
  const streakWinnerRaw =
    a.metrics.streak > 0 && b.metrics.streak > 0
      ? streakA > streakB
        ? "a"
        : streakB > streakA
          ? "b"
          : "tie"
      : a.metrics.streak > 0
        ? "a"
        : b.metrics.streak > 0
          ? "b"
          : "tie";
  const streakWinner = streakWinnerRaw as Winner;

  const worstA = a.metrics.worstTrade?.pnl ?? 0;
  const worstB = b.metrics.worstTrade?.pnl ?? 0;
  // Less negative = better
  const worstTradeWinner: Winner =
    worstA > worstB ? "a" : worstB > worstA ? "b" : "tie";

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 px-6 pt-6 pb-4 border-b border-border">
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
            Fighter A
          </div>
          <div className="text-lg font-bold text-text-primary">
            @{a.handle}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {a.metrics.winCount}W - {a.metrics.lossCount}L
          </div>
        </div>
        <div className="text-center px-2">
          <div className="text-2xl font-bold text-accent tracking-tight">
            VS
          </div>
        </div>
        <div className="text-left">
          <div className="text-xs uppercase tracking-widest text-text-muted mb-1">
            Fighter B
          </div>
          <div className="text-lg font-bold text-text-primary">
            @{b.handle}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {b.metrics.winCount}W - {b.metrics.lossCount}L
          </div>
        </div>
      </div>

      {/* Metric rows */}
      <div className="px-6">
        <MetricRow
          label="Win Rate"
          aValue={
            <span className="flex items-center justify-end gap-2">
              <span>{Math.round(a.metrics.winRate)}%</span>
              <WinRateBar pct={a.metrics.winRate} length={8} />
            </span>
          }
          bValue={
            <span className="flex items-center gap-2">
              <WinRateBar pct={b.metrics.winRate} length={8} />
              <span>{Math.round(b.metrics.winRate)}%</span>
            </span>
          }
          winner={comparison.winRateWinner}
        />

        <MetricRow
          label="Avg P&L"
          aValue={<PnlDisplay value={a.metrics.avgPnl} />}
          bValue={<PnlDisplay value={b.metrics.avgPnl} />}
          winner={comparison.avgPnlWinner}
        />

        <MetricRow
          label="Total Trades"
          aValue={a.metrics.totalTrades}
          bValue={b.metrics.totalTrades}
          winner={comparison.totalTradesWinner}
        />

        <MetricRow
          label="Best Trade"
          aValue={formatTrade(a.metrics.bestTrade)}
          bValue={formatTrade(b.metrics.bestTrade)}
          winner={comparison.bestTradeWinner}
        />

        <MetricRow
          label="Worst Trade"
          aValue={formatTrade(a.metrics.worstTrade)}
          bValue={formatTrade(b.metrics.worstTrade)}
          winner={worstTradeWinner}
        />

        <MetricRow
          label="Streak"
          aValue={formatStreak(a.metrics.streak)}
          bValue={formatStreak(b.metrics.streak)}
          winner={streakWinner}
        />
      </div>

      {/* Shared tickers */}
      {comparison.sharedTickers.length > 0 && (
        <div className="px-6 py-4 border-t border-border">
          <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
            Shared Tickers
          </div>
          <div className="space-y-2">
            {comparison.sharedTickers.slice(0, 5).map((st) => {
              const aWins = st.a_pnl > st.b_pnl;
              const tie = st.a_pnl === st.b_pnl;
              return (
                <div
                  key={st.ticker}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-xs font-mono"
                >
                  <div
                    className={`text-right ${aWins ? "text-win" : tie ? "text-text-secondary" : "text-text-muted"}`}
                  >
                    <PnlDisplay value={st.a_pnl} />
                  </div>
                  <div className="text-text-secondary text-center min-w-[100px]">
                    ${st.ticker}
                  </div>
                  <div
                    className={`text-left ${!aWins ? "text-win" : tie ? "text-text-secondary" : "text-text-muted"}`}
                  >
                    <PnlDisplay value={st.b_pnl} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
