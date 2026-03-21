import { PnlDisplay } from "@/components/ui/pnl-display";
import { WinRateBar } from "@/components/ui/win-rate-bar";

interface ScorecardProps {
  handle: string;
  metrics: {
    winRate: number;
    avgPnl: number;
    totalTrades: number;
    streak: number;
    bestTrade: {
      ticker: string;
      direction: string;
      pnl: number;
      date: string;
    } | null;
    worstTrade: {
      ticker: string;
      direction: string;
      pnl: number;
      date: string;
    } | null;
  };
  rank?: number | null;
}

function fmtShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatStreak(streak: number): string {
  if (streak === 0) return "--";
  const prefix = streak > 0 ? "W" : "L";
  return `${prefix}${Math.abs(streak)}`;
}

export function Scorecard({ metrics, rank }: ScorecardProps) {
  const streakColor =
    metrics.streak > 0
      ? "text-win"
      : metrics.streak < 0
        ? "text-loss"
        : "text-text-muted";

  return (
    <div className="bg-surface border border-border rounded-lg p-6 relative">
      {/* Rank badge */}
      {rank != null && (
        <div className="absolute top-6 right-6 text-right">
          <div className="text-xs uppercase tracking-widest text-text-muted">
            Rank
          </div>
          <div className="text-2xl font-bold text-accent">#{rank}</div>
        </div>
      )}

      {/* Stats grid */}
      <div className="space-y-3">
        {/* Win Rate */}
        <div className="flex items-baseline gap-3">
          <span className="text-text-muted text-[13px] w-28 shrink-0">
            Win Rate
          </span>
          <span
            className={`font-bold ${metrics.winRate >= 50 ? "text-win" : "text-loss"}`}
          >
            {Math.round(metrics.winRate)}%
          </span>
          <WinRateBar pct={metrics.winRate} />
        </div>

        {/* Avg P&L */}
        <div className="flex items-baseline gap-3">
          <span className="text-text-muted text-[13px] w-28 shrink-0">
            Avg P&L
          </span>
          <span className="font-bold">
            <PnlDisplay value={metrics.avgPnl} />
          </span>
        </div>

        {/* Total Trades */}
        <div className="flex items-baseline gap-3">
          <span className="text-text-muted text-[13px] w-28 shrink-0">
            Total Trades
          </span>
          <span className="font-bold text-text-primary">
            {metrics.totalTrades}
          </span>
        </div>

        {/* Streak */}
        <div className="flex items-baseline gap-3">
          <span className="text-text-muted text-[13px] w-28 shrink-0">
            Streak
          </span>
          <span className={`font-bold ${streakColor}`}>
            {formatStreak(metrics.streak)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border my-5" />

      {/* Best / Worst calls */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <span className="text-text-muted text-[13px] w-28 shrink-0">
            Best Call
          </span>
          {metrics.bestTrade ? (
            <span className="text-[13px] text-win">
              ${metrics.bestTrade.ticker} {metrics.bestTrade.direction.toUpperCase()}{" "}
              +{metrics.bestTrade.pnl.toFixed(1)}% (
              {fmtShortDate(metrics.bestTrade.date)})
            </span>
          ) : (
            <span className="text-text-muted text-[13px]">--</span>
          )}
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-text-muted text-[13px] w-28 shrink-0">
            Worst Call
          </span>
          {metrics.worstTrade ? (
            <span className="text-[13px] text-loss">
              ${metrics.worstTrade.ticker}{" "}
              {metrics.worstTrade.direction.toUpperCase()}{" "}
              {metrics.worstTrade.pnl.toFixed(1)}% (
              {fmtShortDate(metrics.worstTrade.date)})
            </span>
          ) : (
            <span className="text-text-muted text-[13px]">--</span>
          )}
        </div>
      </div>
    </div>
  );
}
