"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PnlDisplay } from "@/components/ui/pnl-display";
import type { PredictionLeaderboardRow } from "@/lib/types";

interface PredictionLeaderboardClientProps {
  initialEntries: PredictionLeaderboardRow[];
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

function accuracyColor(pct: number): string {
  if (pct >= 70) return "text-win";
  if (pct >= 50) return "text-amber";
  return "text-loss";
}

export function PredictionLeaderboardClient({ initialEntries }: PredictionLeaderboardClientProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link
              href="/predictions"
              className="text-text-muted text-xs hover:text-amber transition-colors"
            >
              &larr; Prediction Markets
            </Link>
            <h1 className="text-2xl font-bold text-text-primary mt-1">
              PREDICTION LEADERBOARD
            </h1>
            <p className="text-text-muted text-xs mt-1">
              Top prediction market callers ranked by accuracy
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {initialEntries.length === 0 ? (
          <div className="border border-border rounded-lg p-12 text-center">
            <p className="text-text-muted text-sm">No prediction callers ranked yet</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal w-12">
                      #
                    </th>
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal">
                      Caller
                    </th>
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal">
                      Accuracy
                    </th>
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden sm:table-cell">
                      Avg P&L
                    </th>
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden sm:table-cell">
                      Predictions
                    </th>
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden md:table-cell">
                      Active
                    </th>
                    <th className="py-2 px-3 text-xs uppercase tracking-widest text-text-muted font-normal hidden lg:table-cell">
                      Accuracy Bar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {initialEntries.map((entry) => {
                    const isTop3 = entry.rank <= 3;
                    const filled = Math.round((entry.accuracy / 100) * 10);
                    const empty = 10 - filled;

                    return (
                      <tr
                        key={entry.handle}
                        onClick={() => router.push(`/${encodeURIComponent(entry.handle)}`)}
                        className={`border-b border-border cursor-pointer transition-colors hover:bg-surface/80 ${
                          isTop3 ? "bg-surface/40" : ""
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span className={`text-sm font-bold ${rankColor(entry.rank)}`}>
                            {rankLabel(entry.rank)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-text-primary hover:text-accent transition-colors">
                            @{entry.handle}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${accuracyColor(entry.accuracy)}`}>
                            {entry.accuracy}%
                          </span>
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell">
                          <PnlDisplay value={entry.avgPnl} />
                        </td>
                        <td className="py-3 px-3 hidden sm:table-cell">
                          <span className="text-text-secondary">{entry.totalPredictions}</span>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <span className="text-amber font-mono text-xs">
                            {entry.activeBets}
                          </span>
                        </td>
                        <td className="py-3 px-3 hidden lg:table-cell">
                          <span className="text-amber text-xs font-mono">
                            {"\u2588".repeat(filled)}
                          </span>
                          <span className="text-text-muted/40 text-xs font-mono">
                            {"\u2591".repeat(empty)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted mt-12">
        <p>
          paste.markets -- Prediction market data from{" "}
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            paste.trade
          </a>
        </p>
      </footer>
    </main>
  );
}
