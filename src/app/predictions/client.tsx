"use client";

import { useState } from "react";
import Link from "next/link";
import { ProbabilityBar } from "@/components/probability-bar";
import type { PredictionTrade } from "@/lib/types";

interface PredictionsClientProps {
  initialTrades: PredictionTrade[];
  initialStats: {
    totalBets: number;
    avgAccuracy: number;
    activeBets: number;
    resolvedBets: number;
  };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function pnlColor(pct: number): string {
  return pct >= 0 ? "text-win" : "text-loss";
}

function formatPnl(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function PredictionsClient({ initialTrades, initialStats }: PredictionsClientProps) {
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  const activeTrades = initialTrades.filter((t) => !t.resolved);
  const resolvedTrades = initialTrades.filter((t) => t.resolved);

  const displayTrades = filter === "active"
    ? activeTrades
    : filter === "resolved"
      ? resolvedTrades
      : initialTrades;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link
            href="/"
            className="text-text-muted text-xs hover:text-accent transition-colors"
          >
            paste.markets
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mt-1">
            PREDICTION MARKETS
          </h1>
          <p className="text-text-muted text-xs mt-1">
            Polymarket calls from CT traders -- tracked by real outcomes
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-4 bg-surface border border-border rounded-lg">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Total Bets</div>
              <div className="text-lg font-bold text-amber">{initialStats.totalBets}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Avg Accuracy</div>
              <div className="text-lg font-bold text-amber">{initialStats.avgAccuracy}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Active</div>
              <div className="text-lg font-bold text-text-primary">{initialStats.activeBets}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Resolved</div>
              <div className="text-lg font-bold text-text-primary">{initialStats.resolvedBets}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {(["all", "active", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-xs font-mono uppercase transition-colors ${
                  filter === f
                    ? "bg-amber/20 text-amber"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Link
            href="/predictions/leaderboard"
            className="ml-auto px-3 py-1.5 text-xs font-mono border border-border rounded-lg text-text-muted hover:border-amber hover:text-amber transition-colors"
          >
            LEADERBOARD
          </Link>
        </div>

        {/* Active Markets */}
        {(filter === "all" || filter === "active") && activeTrades.length > 0 && (
          <section className="mb-10">
            {filter === "all" && (
              <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
                Active Markets
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(filter === "active" ? displayTrades : activeTrades).map((trade) => (
                <PredictionCard key={trade.id} trade={trade} />
              ))}
            </div>
          </section>
        )}

        {/* Resolved Markets */}
        {(filter === "all" || filter === "resolved") && resolvedTrades.length > 0 && (
          <section className="mb-10">
            {filter === "all" && (
              <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
                Resolved Markets
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(filter === "resolved" ? displayTrades : resolvedTrades).map((trade) => (
                <ResolvedCard key={trade.id} trade={trade} />
              ))}
            </div>
          </section>
        )}

        {displayTrades.length === 0 && (
          <div className="border border-border rounded-lg p-12 text-center">
            <p className="text-text-muted text-sm">No prediction trades found</p>
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

function PredictionCard({ trade }: { trade: PredictionTrade }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 hover:border-amber/40 transition-colors">
      {/* Badge + caller */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href={`/${encodeURIComponent(trade.handle)}`}
          className="text-text-secondary text-sm hover:text-accent transition-colors"
        >
          @{trade.handle}
        </Link>
        <span className="text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border border-amber/40 text-amber">
          ACTIVE
        </span>
      </div>

      {/* Event title */}
      <h3 className="text-[15px] font-bold text-text-primary mb-3 leading-snug">
        {trade.event_title}
      </h3>

      {/* Position */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] text-text-muted">Position:</span>
        <span
          className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded ${
            trade.direction === "yes"
              ? "text-win bg-win/10"
              : "text-loss bg-loss/10"
          }`}
        >
          {trade.direction}
        </span>
        <span className="text-[11px] text-text-muted ml-auto">
          {timeAgo(trade.posted_at)}
        </span>
      </div>

      {/* Probability bar */}
      <div className="mb-4 pt-2">
        <ProbabilityBar
          currentProbability={trade.current_probability}
          entryProbability={trade.entry_probability}
          direction={trade.direction}
        />
      </div>

      {/* P&L */}
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-text-muted text-[11px]">Entry: </span>
          <span className="text-text-secondary font-mono">
            {Math.round(trade.entry_probability * 100)}%
          </span>
        </div>
        <div>
          <span className="text-text-muted text-[11px]">Current: </span>
          <span className="text-text-secondary font-mono">
            {Math.round(trade.current_probability * 100)}%
          </span>
        </div>
        <div>
          <span className="text-text-muted text-[11px]">P&L: </span>
          <span className={`font-bold font-mono ${pnlColor(trade.pnl_pct)}`}>
            {formatPnl(trade.pnl_pct)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResolvedCard({ trade }: { trade: PredictionTrade }) {
  const callerWasRight = trade.resolution === trade.direction;

  return (
    <div className={`bg-surface border rounded-lg p-5 transition-colors ${
      callerWasRight ? "border-win/30" : "border-loss/30"
    }`}>
      {/* Badge + caller */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href={`/${encodeURIComponent(trade.handle)}`}
          className="text-text-secondary text-sm hover:text-accent transition-colors"
        >
          @{trade.handle}
        </Link>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${callerWasRight ? "text-win" : "text-loss"}`}>
            {callerWasRight ? "\u2713" : "\u2717"}
          </span>
          <span className="text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border border-text-muted/40 text-text-muted">
            RESOLVED
          </span>
        </div>
      </div>

      {/* Event title */}
      <h3 className="text-[15px] font-bold text-text-primary mb-3 leading-snug">
        {trade.event_title}
      </h3>

      {/* Position + outcome */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted">Called:</span>
          <span
            className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded ${
              trade.direction === "yes"
                ? "text-win bg-win/10"
                : "text-loss bg-loss/10"
            }`}
          >
            {trade.direction}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-muted">Result:</span>
          <span
            className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded ${
              trade.resolution === "yes"
                ? "text-win bg-win/10"
                : "text-loss bg-loss/10"
            }`}
          >
            {trade.resolution}
          </span>
        </div>
        <span className="text-[11px] text-text-muted ml-auto">
          {timeAgo(trade.posted_at)}
        </span>
      </div>

      {/* P&L */}
      <div className="flex items-center justify-between text-sm border-t border-border pt-3">
        <div>
          <span className="text-text-muted text-[11px]">Entry: </span>
          <span className="text-text-secondary font-mono">
            {Math.round(trade.entry_probability * 100)}%
          </span>
        </div>
        <div>
          <span className={`font-bold font-mono text-lg ${pnlColor(trade.pnl_pct)}`}>
            {formatPnl(trade.pnl_pct)}
          </span>
        </div>
      </div>
    </div>
  );
}
