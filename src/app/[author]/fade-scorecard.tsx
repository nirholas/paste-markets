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

interface FadeStatsData {
  fadeWinRate: number;
  fadeAvgPnl: number;
  fadeTotalPnl: number;
  originalWinRate: number;
  originalAvgPnl: number;
  originalTotalPnl: number;
  fadeRating: string;
  isProfitableFade: boolean;
  totalTrades: number;
}

interface FadeScorecardWrapperProps {
  handle: string;
  metrics: ScorecardMetrics;
  rank?: number | null;
  fadeStats?: FadeStatsData | null;
}

function invertDirection(dir: string): string {
  if (dir === "long") return "short";
  if (dir === "short") return "long";
  if (dir === "yes") return "no";
  if (dir === "no") return "yes";
  return dir;
}

function formatPnl(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function ratingColor(rating: string): string {
  if (rating === "S") return "text-[#f39c12]";
  if (rating === "A") return "text-win";
  if (rating === "B") return "text-accent";
  if (rating === "C") return "text-text-secondary";
  return "text-text-muted";
}

function ratingBorderColor(rating: string): string {
  if (rating === "S") return "border-[#f39c12]";
  if (rating === "A") return "border-win";
  if (rating === "B") return "border-accent";
  return "border-border";
}

export function FadeScorecardWrapper({
  handle,
  metrics,
  rank,
  fadeStats,
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
      {/* Side-by-side Follow vs Fade comparison */}
      {fadeStats && (
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">
            Fade Analysis
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {/* FOLLOW column */}
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-win" />
                Follow @{handle}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-text-muted">Win Rate</span>
                  <span className={`text-sm font-bold ${fadeStats.originalWinRate >= 50 ? "text-win" : "text-loss"}`}>
                    {Math.round(fadeStats.originalWinRate)}%
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-text-muted">Avg P&L</span>
                  <span className={`text-sm font-bold ${fadeStats.originalAvgPnl >= 0 ? "text-win" : "text-loss"}`}>
                    {formatPnl(fadeStats.originalAvgPnl)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-text-muted">Total P&L</span>
                  <span className={`text-sm font-bold ${fadeStats.originalTotalPnl >= 0 ? "text-win" : "text-loss"}`}>
                    {formatPnl(fadeStats.originalTotalPnl)}
                  </span>
                </div>
              </div>
            </div>

            {/* FADE column */}
            <div className={`bg-surface border rounded-lg p-4 ${fadeStats.isProfitableFade ? "border-loss/60" : "border-border"}`}>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-loss" />
                Fade @{handle}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-text-muted">Win Rate</span>
                  <span className={`text-sm font-bold ${fadeStats.fadeWinRate >= 50 ? "text-win" : "text-loss"}`}>
                    {Math.round(fadeStats.fadeWinRate)}%
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-text-muted">Avg P&L</span>
                  <span className={`text-sm font-bold ${fadeStats.fadeAvgPnl >= 0 ? "text-win" : "text-loss"}`}>
                    {formatPnl(fadeStats.fadeAvgPnl)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-text-muted">Total P&L</span>
                  <span className={`text-sm font-bold ${fadeStats.fadeTotalPnl >= 0 ? "text-win" : "text-loss"}`}>
                    {formatPnl(fadeStats.fadeTotalPnl)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fade rating + profitable badge */}
          <div className="flex items-center gap-3 mt-3">
            <div className={`text-xs font-mono font-bold uppercase tracking-widest border px-2 py-1 rounded ${ratingColor(fadeStats.fadeRating)} ${ratingBorderColor(fadeStats.fadeRating)}`}>
              Fade Rating: {fadeStats.fadeRating}
            </div>
            {fadeStats.isProfitableFade && (
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest border border-loss text-loss bg-loss/10 px-2 py-1 rounded animate-pulse">
                PROFITABLE FADE
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing scorecard with fade toggle */}
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
