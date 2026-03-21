"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PnlDisplay } from "@/components/ui/pnl-display";

interface TopCaller {
  rank: number;
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  streak: number;
}

export function DailyTopCallers() {
  const [callers, setCallers] = useState<TopCaller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/leaderboard?window=24h&limit=5&sort=win_rate");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setCallers(data.entries ?? []);
        }
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Auto-refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <section className="max-w-xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-text-muted font-mono">
            Today&apos;s Top Callers
          </h2>
          <span className="text-[10px] text-text-muted font-mono animate-pulse">
            Loading...
          </span>
        </div>
        <div className="border border-border rounded-lg bg-surface/50 p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-4 w-6 bg-surface rounded" />
              <div className="h-4 w-24 bg-surface rounded" />
              <div className="h-4 w-12 bg-surface rounded ml-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (callers.length === 0) return null;

  return (
    <section className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-text-muted font-mono">
          Today&apos;s Top Callers
        </h2>
        <Link
          href="/leaderboard"
          className="text-[10px] text-accent hover:text-accent/70 transition-colors font-mono"
        >
          Full Leaderboard &rarr;
        </Link>
      </div>
      <div className="border border-border rounded-lg bg-surface/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 px-3 text-[10px] uppercase tracking-widest text-text-muted font-normal w-8">
                #
              </th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-widest text-text-muted font-normal">
                Trader
              </th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-widest text-text-muted font-normal text-right">
                Win Rate
              </th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-widest text-text-muted font-normal text-right hidden sm:table-cell">
                Avg P&L
              </th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-widest text-text-muted font-normal text-right hidden sm:table-cell">
                Streak
              </th>
            </tr>
          </thead>
          <tbody>
            {callers.map((c, i) => {
              const streakNum = typeof c.streak === "number" ? c.streak : 0;
              return (
                <tr key={c.handle} className="border-b border-border last:border-b-0 hover:bg-surface/80 transition-colors">
                  <td className="py-2 px-3">
                    <span className={`text-xs font-bold ${i === 0 ? "text-amber" : i < 3 ? "text-text-secondary" : "text-text-muted"}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <Link
                      href={`/${encodeURIComponent(c.handle)}`}
                      className="text-text-primary hover:text-accent transition-colors text-xs font-mono"
                    >
                      @{c.handle}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-xs font-mono ${c.winRate >= 65 ? "text-win" : c.winRate >= 50 ? "text-amber" : "text-loss"}`}>
                      {Math.round(c.winRate)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right hidden sm:table-cell">
                    <span className="text-xs">
                      <PnlDisplay value={c.avgPnl} />
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right hidden sm:table-cell">
                    <span className={`text-xs font-mono ${streakNum > 0 ? "text-win" : streakNum < 0 ? "text-loss" : "text-text-muted"}`}>
                      {streakNum > 0 ? `${streakNum}W` : streakNum < 0 ? `${Math.abs(streakNum)}L` : "--"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
