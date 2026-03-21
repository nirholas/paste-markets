"use client";

import { useState } from "react";
import { Scorecard } from "@/components/scorecard";

interface ScorecardMetrics {
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
}

interface FadeScorecardWrapperProps {
  handle: string;
  metrics: ScorecardMetrics;
  rank?: number | null;
}

function invertDirection(dir: string): string {
  if (dir === "long") return "short";
  if (dir === "short") return "long";
  if (dir === "yes") return "no";
  if (dir === "no") return "yes";
  return dir;
}

export function FadeScorecardWrapper({
  handle,
  metrics,
  rank,
}: FadeScorecardWrapperProps) {
  const [faded, setFaded] = useState(false);

  const displayMetrics: ScorecardMetrics = faded
    ? {
        winRate: 100 - metrics.winRate,
        avgPnl: -metrics.avgPnl,
        totalTrades: metrics.totalTrades,
        streak: -metrics.streak,
        bestTrade: metrics.worstTrade
          ? {
              ...metrics.worstTrade,
              pnl: -metrics.worstTrade.pnl,
              direction: invertDirection(metrics.worstTrade.direction),
            }
          : null,
        worstTrade: metrics.bestTrade
          ? {
              ...metrics.bestTrade,
              pnl: -metrics.bestTrade.pnl,
              direction: invertDirection(metrics.bestTrade.direction),
            }
          : null,
      }
    : metrics;

  return (
    <div>
      {faded && (
        <div className="mb-3 px-4 py-2 rounded-lg border border-loss/40 bg-loss/5 text-xs text-loss font-mono">
          If you faded @{handle}: {Math.round(displayMetrics.winRate)}% WR,{" "}
          {displayMetrics.avgPnl >= 0 ? "+" : ""}
          {displayMetrics.avgPnl.toFixed(1)}% avg P&L
        </div>
      )}

      <div className={faded ? "ring-1 ring-loss/30 rounded-lg" : ""}>
        <Scorecard
          handle={handle}
          metrics={displayMetrics}
          rank={faded ? undefined : rank}
        />
      </div>

      <button
        onClick={() => setFaded((f) => !f)}
        className={`mt-3 text-xs font-mono border rounded-lg px-3 py-1.5 transition-colors ${
          faded
            ? "border-loss text-loss bg-loss/10 hover:bg-loss/20"
            : "border-border text-text-muted hover:border-loss hover:text-loss"
        }`}
      >
        {faded ? "Show Normal" : "Fade This Caller"}
      </button>
    </div>
  );
}
