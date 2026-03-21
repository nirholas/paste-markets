"use client";

import { useState } from "react";
import Link from "next/link";
import type { ConsensusPlay } from "@/app/api/consensus/route";

function directionColor(direction: ConsensusPlay["direction"]): string {
  return direction === "long" || direction === "yes" ? "#2ecc71" : "#e74c3c";
}

function callerCountColor(count: number): string {
  if (count >= 5) return "#2ecc71";
  if (count >= 4) return "#f39c12";
  return "#c8964a"; // amber-ish for 3
}

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function ConsensusRow({ play, rank }: { play: ConsensusPlay; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const dirColor = directionColor(play.direction);
  const countColor = callerCountColor(play.callerCount);
  const visibleCallers = expanded ? play.callers : play.callers.slice(0, 3);
  const hiddenCount = play.callers.length - 3;

  return (
    <div className="border-b border-[#1a1a2e] last:border-0">
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left py-4 px-2 hover:bg-[#0f0f22]/60 transition-colors flex flex-col gap-2"
      >
        {/* Top line */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[#555568] text-sm w-6 shrink-0">#{rank}</span>
          <span className="text-[#f0f0f0] font-bold text-base">${play.ticker}</span>
          <span
            className="text-xs font-bold px-2 py-0.5 border rounded uppercase"
            style={{ color: dirColor, borderColor: dirColor }}
          >
            {play.direction}
          </span>
          <span
            className="text-xs font-bold px-2 py-0.5 border rounded"
            style={{ color: countColor, borderColor: countColor }}
          >
            {play.callerCount} callers
          </span>
          <span className="text-sm text-[#c8c8d0]">
            {play.avgWinRate.toFixed(0)}% avg WR
          </span>
        </div>

        {/* Callers row */}
        <div className="flex items-center gap-2 flex-wrap pl-9">
          {visibleCallers.map((c) => (
            <Link
              key={c.handle}
              href={`/${c.handle}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-[#3b82f6] hover:text-[#f0f0f0] transition-colors"
            >
              @{c.handle}
              <span className="text-[#555568] ml-1">({c.winRate.toFixed(0)}%)</span>
            </Link>
          ))}
          {!expanded && hiddenCount > 0 && (
            <span className="text-xs text-[#555568]">+{hiddenCount}</span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 pl-9 text-xs text-[#555568]">
          {play.avgEntryPrice != null && (
            <span>Avg entry: {formatPrice(play.avgEntryPrice)}</span>
          )}
          {play.currentPnl != null ? (
            <span
              className="font-medium"
              style={{ color: play.currentPnl >= 0 ? "#2ecc71" : "#e74c3c" }}
            >
              Avg P&L: {formatPnl(play.currentPnl)}
            </span>
          ) : (
            <span>Avg P&L: OPEN</span>
          )}
        </div>
      </button>

      {/* Expanded: all callers with individual stats */}
      {expanded && (
        <div className="pb-4 px-2 pl-9">
          <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded p-3 space-y-2">
            {play.callers.map((c) => (
              <div key={c.handle} className="flex items-center justify-between text-sm">
                <Link
                  href={`/${c.handle}`}
                  className="text-[#3b82f6] hover:text-[#f0f0f0] transition-colors"
                >
                  @{c.handle}
                </Link>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[#c8c8d0]">{c.winRate.toFixed(0)}% WR</span>
                  <span
                    style={{ color: c.avgPnl >= 0 ? "#2ecc71" : "#e74c3c" }}
                  >
                    {formatPnl(c.avgPnl)} avg
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  plays: ConsensusPlay[];
  updatedAt: string;
}

export default function ConsensusPlays({ plays, updatedAt }: Props) {
  const updatedDate = new Date(updatedAt);
  const timeStr = updatedDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (plays.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[#555568] text-sm">
          Not enough data yet — needs 3+ callers on the same ticker.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      {/* Header */}
      <div className="flex items-end justify-between mb-2">
        <h1 className="text-xl font-bold text-[#f0f0f0] tracking-tight uppercase">
          Consensus Plays
        </h1>
        <span className="text-xs text-[#555568]">30d · updated {timeStr}</span>
      </div>

      <p className="text-xs text-[#555568] mb-6 leading-relaxed">
        When 3+ top callers agree on the same ticker.
        <br />
        Weighted by real win rate — not just vote count.
      </p>

      {/* Plays list */}
      <div className="border-t border-[#1a1a2e]">
        {plays.map((play, i) => (
          <ConsensusRow key={`${play.ticker}:${play.direction}`} play={play} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
