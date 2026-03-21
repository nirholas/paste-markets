"use client";

import { useRouter } from "next/navigation";
import { WinRateBar } from "@/components/ui/win-rate-bar";
import { PnlDisplay } from "@/components/ui/pnl-display";
import { tierColor, type CallerTier } from "@/lib/alpha";

export interface LeaderboardRow {
  rank: number;
  prevRank?: number | null;
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  alphaScore?: number;
  tier?: CallerTier;
  streak?: string | number;
  totalPnl?: number;
  bestTicker?: string;
  platform?: string;
  avatarUrl?: string | null;
}

function evScore(winRate: number, avgPnl: number): number {
  return parseFloat(((winRate / 100) * avgPnl).toFixed(1));
}

function evColor(ev: number): string {
  if (ev >= 10) return "text-win";
  if (ev >= 5) return "text-amber";
  if (ev >= 2) return "text-accent";
  return "text-text-muted";
}

interface LeaderboardTableProps {
  entries: LeaderboardRow[];
  loading?: boolean;
  showStreakColumn?: boolean;
}

function rankColor(rank: number): string {
  if (rank === 1) return "text-amber";
  if (rank === 2) return "text-text-secondary";
  if (rank === 3) return "text-amber/60";
  return "text-text-muted";
}

function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}`;
}

function winRateColor(pct: number): string {
  if (pct >= 65) return "text-win";
  if (pct >= 50) return "text-amber";
  return "text-loss";
}

function RankChange({ current, previous }: { current: number; previous?: number | null }) {
  if (previous == null) {
    return <span className="text-accent text-[10px] font-bold ml-1">NEW</span>;
  }
  const diff = previous - current;
  if (diff === 0) return null;
  if (diff > 0) {
    return (
      <span className="text-win text-[10px] font-bold ml-1">
        {"\u25B2"}{diff}
      </span>
    );
  }
  return (
    <span className="text-loss text-[10px] font-bold ml-1">
      {"\u25BC"}{Math.abs(diff)}
    </span>
  );
}

function formatStreak(streak: string | number | undefined): string {
  if (streak == null) return "--";
  const num = typeof streak === "string" ? parseInt(streak, 10) : streak;
  if (isNaN(num) || num === 0) return "--";
  if (num > 0) return `${num}W`;
  return `${Math.abs(num)}L`;
}

function streakColor(streak: string | number | undefined): string {
  if (streak == null) return "text-text-muted";
  const num = typeof streak === "string" ? parseInt(streak, 10) : streak;
  if (isNaN(num) || num === 0) return "text-text-muted";
  if (num >= 5) return "text-win";
  if (num > 0) return "text-win/70";
  if (num <= -5) return "text-loss";
  return "text-loss/70";
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      <td className="py-3 px-3 w-12">
        <div className="h-4 w-6 bg-surface rounded" />
      </td>
      <td className="py-3 px-3">
        <div className="h-4 w-28 bg-surface rounded" />
      </td>
      <td className="py-3 px-3 hidden sm:table-cell">
        <div className="h-4 w-14 bg-surface rounded" />
      </td>
      <td className="py-3 px-3 hidden sm:table-cell">
        <div className="h-4 w-16 bg-surface rounded" />
      </td>
      <td className="py-3 px-3 hidden md:table-cell">
        <div className="h-4 w-10 bg-surface rounded" />
      </td>
      <td className="py-3 px-3 hidden lg:table-cell">
        <div className="h-4 w-20 bg-surface rounded" />
      </td>
      <td className="py-3 px-3 hidden lg:table-cell">
        <div className="h-4 w-10 bg-surface rounded" />
      </td>
    </tr>
  );
}

export function LeaderboardTable({ entries, loading, showStreakColumn }: LeaderboardTableProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal w-12">
                #
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal">
                Trader
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden sm:table-cell">
                Win Rate
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden sm:table-cell">
                Avg P&L
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden md:table-cell">
                Trades
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden lg:table-cell">
                Win Bar
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden lg:table-cell">
                EV/trade
              </th>
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden lg:table-cell">
                Streak
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center">
        <p className="text-text-muted text-sm">No traders ranked yet</p>
        <p className="text-text-muted text-xs mt-2">
          Add handles below to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal w-12">
              #
            </th>
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal">
              Trader
            </th>
            {showStreakColumn && (
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal">
                Streak
              </th>
            )}
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden sm:table-cell">
              Win Rate
            </th>
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden sm:table-cell">
              Avg P&L
            </th>
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden md:table-cell">
              Trades
            </th>
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden lg:table-cell">
              Win Bar
            </th>
            <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden xl:table-cell">
              EV/trade
            </th>
            {!showStreakColumn && (
              <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden lg:table-cell">
                Streak
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isTop3 = entry.rank <= 3;
            const ev = evScore(entry.winRate, entry.avgPnl);
            const streakNum = typeof entry.streak === "string" ? parseInt(entry.streak, 10) : (entry.streak ?? 0);
            return (
              <tr
                key={entry.handle}
                onClick={() => router.push(`/${encodeURIComponent(entry.handle)}`)}
                className={`border-b border-border cursor-pointer transition-colors hover:bg-surface/80 ${
                  isTop3 ? "bg-surface/40" : ""
                }`}
              >
                <td className="py-3 px-3">
                  <div className="flex items-center">
                    <span className={`text-sm font-bold ${rankColor(entry.rank)}`}>
                      {rankLabel(entry.rank)}
                    </span>
                    <RankChange current={entry.rank} previous={entry.prevRank} />
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary hover:text-accent transition-colors">
                      @{entry.handle}
                    </span>
                    {entry.tier && (entry.tier === "S" || entry.tier === "A") && (
                      <span
                        className="text-[10px] font-bold px-1 py-0.5 rounded font-mono hidden sm:inline"
                        style={{
                          color: tierColor(entry.tier),
                          border: `1px solid ${tierColor(entry.tier)}`,
                          background: `${tierColor(entry.tier)}14`,
                        }}
                      >
                        {entry.tier}
                      </span>
                    )}
                  </div>
                </td>
                {showStreakColumn && (
                  <td className="py-3 px-3">
                    <span className={`text-sm font-bold font-mono ${streakColor(entry.streak)}`}>
                      {streakNum >= 5 && "\uD83D\uDD25"}
                      {formatStreak(entry.streak)}
                    </span>
                  </td>
                )}
                <td className="py-3 px-3 hidden sm:table-cell">
                  <span className={winRateColor(entry.winRate)}>
                    {Math.round(entry.winRate)}%
                  </span>
                </td>
                <td className="py-3 px-3 hidden sm:table-cell">
                  <PnlDisplay value={entry.avgPnl} />
                </td>
                <td className="py-3 px-3 hidden md:table-cell">
                  <span className="text-text-secondary">{entry.totalTrades}</span>
                </td>
                <td className="py-3 px-3 hidden lg:table-cell">
                  <WinRateBar pct={entry.winRate} length={12} />
                </td>
                <td className="py-3 px-3 hidden xl:table-cell">
                  <span className={`text-xs font-mono font-bold ${evColor(ev)}`}>
                    {ev >= 0 ? "+" : ""}{ev.toFixed(1)}
                  </span>
                </td>
                {!showStreakColumn && (
                  <td className="py-3 px-3 hidden lg:table-cell">
                    <span className={`text-xs font-mono ${streakColor(entry.streak)}`}>
                      {streakNum >= 5 && "\uD83D\uDD25"}
                      {formatStreak(entry.streak)}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
