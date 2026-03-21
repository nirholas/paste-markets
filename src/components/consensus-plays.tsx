"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import type { ConsensusPlay } from "@/lib/consensus";
import ConvictionMeter from "./conviction-meter";
import { VenueFilter, type VenueFilterValue } from "@/components/venue-filter";
import { venueTypeToPlatform } from "@/lib/venues";

type SortMode = "conviction" | "callers" | "pnl";

const CONSENSUS_LABELS: Record<ConsensusPlay["consensus"], string> = {
  strong_long: "STRONG LONG",
  strong_short: "STRONG SHORT",
  contested: "CONTESTED",
  mixed: "MIXED",
};

const CONSENSUS_COLORS: Record<ConsensusPlay["consensus"], string> = {
  strong_long: "#2ecc71",
  strong_short: "#e74c3c",
  contested: "#f39c12",
  mixed: "#555568",
};

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
}

function ConsensusCard({ play }: { play: ConsensusPlay }) {
  const [expanded, setExpanded] = useState(false);
  const total = play.long_count + play.short_count;
  const longPct = total > 0 ? Math.round((play.long_count / total) * 100) : 0;
  const shortPct = 100 - longPct;
  const majorityCount = Math.max(play.long_count, play.short_count);
  const consensusColor = CONSENSUS_COLORS[play.consensus];
  const isContested = play.consensus === "contested";

  const visibleCallers = expanded
    ? play.callers
    : play.callers.slice(0, 5);
  const hiddenCount = play.callers.length - 5;

  const borderStyle = play.conviction_score >= 60
    ? `2px solid ${consensusColor}`
    : `1px solid ${isContested ? "#f39c12" : "#1a1a2e"}`;

  return (
    <div
      className="bg-surface rounded-lg p-5 transition-all hover:bg-[#12122a]"
      style={{
        border: borderStyle,
        opacity: play.conviction_score < 30 ? 0.7 : 1,
      }}
    >
      {/* Header: Ticker + Consensus Label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-text-primary font-bold text-lg">${play.ticker}</span>
          <span
            className="text-xs font-bold px-2 py-0.5 border rounded uppercase tracking-wide"
            style={{ color: consensusColor, borderColor: consensusColor }}
          >
            {CONSENSUS_LABELS[play.consensus]}
          </span>
          <span className="text-text-muted text-xs">
            ({majorityCount} of {total} callers)
          </span>
        </div>
        <div className="text-right">
          <span className="text-text-muted text-xs uppercase tracking-wider">
            Conviction
          </span>
          <div
            className="text-lg font-bold"
            style={{
              color:
                play.conviction_score >= 60
                  ? "#2ecc71"
                  : play.conviction_score >= 40
                    ? "#f39c12"
                    : "#555568",
            }}
          >
            {play.conviction_score}
          </div>
        </div>
      </div>

      {/* Conviction Meter */}
      <ConvictionMeter
        longPct={longPct}
        shortPct={shortPct}
        ticker={play.ticker}
        consensus={play.consensus}
      />

      {/* P&L Stats */}
      <div className="flex items-center gap-6 mt-3 text-xs">
        {play.long_count > 0 && (
          <span>
            <span className="text-text-muted">Avg P&L (longs): </span>
            <span
              className="font-medium"
              style={{ color: play.avg_pnl_long >= 0 ? "#2ecc71" : "#e74c3c" }}
            >
              {formatPnl(play.avg_pnl_long)}
            </span>
          </span>
        )}
        {play.short_count > 0 && (
          <span>
            <span className="text-text-muted">Avg P&L (shorts): </span>
            <span
              className="font-medium"
              style={{ color: play.avg_pnl_short >= 0 ? "#2ecc71" : "#e74c3c" }}
            >
              {formatPnl(play.avg_pnl_short)}
            </span>
          </span>
        )}
        {play.platform !== "mixed" && (
          <span className="text-text-muted">
            {play.platform}
          </span>
        )}
      </div>

      {/* Callers */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left mt-3"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-text-muted text-xs">Callers:</span>
          {visibleCallers.map((c) => (
            <Link
              key={c.handle}
              href={`/${c.handle}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs hover:text-text-primary transition-colors inline-flex items-center gap-0.5"
              style={{ color: c.direction === "long" ? "#2ecc71" : "#e74c3c" }}
            >
              @{c.handle}
              <span className="text-text-muted">({c.winRate.toFixed(0)}%)</span>
            </Link>
          ))}
          {!expanded && hiddenCount > 0 && (
            <span className="text-text-muted text-xs">+{hiddenCount} more</span>
          )}
        </div>
      </button>

      {/* Expanded caller details */}
      {expanded && (
        <div className="mt-3 bg-bg border border-border rounded p-3 space-y-1.5">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-xs text-text-muted mb-1">
            <span>Caller</span>
            <span>Dir</span>
            <span>Win Rate</span>
            <span>Avg P&L</span>
          </div>
          {play.callers.map((c) => (
            <div
              key={c.handle}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center text-sm"
            >
              <Link
                href={`/${c.handle}`}
                className="text-accent hover:text-text-primary transition-colors text-xs"
              >
                @{c.handle}
              </Link>
              <span
                className="text-xs font-bold uppercase"
                style={{ color: c.direction === "long" ? "#2ecc71" : "#e74c3c" }}
              >
                {c.direction}
              </span>
              <span className="text-xs text-text-secondary">
                {c.winRate.toFixed(0)}%
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: c.avgPnl >= 0 ? "#2ecc71" : "#e74c3c" }}
              >
                {formatPnl(c.avgPnl)}
              </span>
            </div>
          ))}
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
  const [sortMode, setSortMode] = useState<SortMode>("conviction");
  const [timeframe, setTimeframe] = useState("30d");
  const [venueFilter, setVenueFilter] = useState<VenueFilterValue>("all");
  const [currentPlays, setCurrentPlays] = useState<ConsensusPlay[]>(plays);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt);
  const [loading, setLoading] = useState(false);

  const fetchConsensus = useCallback(async (tf: string, venue: VenueFilterValue) => {
    setLoading(true);
    try {
      const platform = venueTypeToPlatform(venue);
      const qs = new URLSearchParams({
        timeframe: tf,
        min_callers: "3",
        ...(platform !== "all" ? { platform } : {}),
      });
      const res = await fetch(`/api/consensus?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPlays(data.plays);
        setCurrentUpdatedAt(data.updatedAt);
      }
    } catch {
      // keep current data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Refetch when filters change (skip initial mount)
    fetchConsensus(timeframe, venueFilter);
  }, [timeframe, venueFilter, fetchConsensus]);

  const sortedPlays = useMemo(() => {
    const sorted = [...currentPlays];
    switch (sortMode) {
      case "conviction":
        sorted.sort((a, b) => b.conviction_score - a.conviction_score);
        break;
      case "callers":
        sorted.sort(
          (a, b) =>
            b.long_count + b.short_count - (a.long_count + a.short_count),
        );
        break;
      case "pnl": {
        const bestPnl = (p: ConsensusPlay) =>
          Math.max(
            p.long_count > 0 ? p.avg_pnl_long : -Infinity,
            p.short_count > 0 ? p.avg_pnl_short : -Infinity,
          );
        sorted.sort((a, b) => bestPnl(b) - bestPnl(a));
        break;
      }
    }
    return sorted;
  }, [currentPlays, sortMode]);

  const updatedDate = new Date(currentUpdatedAt);
  const timeStr = updatedDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (currentPlays.length === 0 && !loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-text-primary tracking-tight uppercase mb-4">
          CT Consensus
        </h1>
        <p className="text-text-muted text-sm">
          Not enough data yet — needs 3+ callers on the same ticker.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pb-16">
      {/* Header */}
      <div className="flex items-end justify-between mb-2">
        <h1 className="text-xl font-bold text-text-primary tracking-tight uppercase">
          CT Consensus
        </h1>
        <span className="text-xs text-text-muted">
          {timeframe} · updated {timeStr}
        </span>
      </div>

      <p className="text-xs text-text-muted mb-4 leading-relaxed">
        When multiple top callers agree on the same ticker. Weighted by real win
        rate — not just vote count.
      </p>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Timeframe selector */}
        <div className="flex items-center gap-1">
          {["7d", "30d", "90d"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="text-xs px-2.5 py-1 border rounded transition-colors"
              style={{
                borderColor: timeframe === tf ? "#3b82f6" : "#1a1a2e",
                color: timeframe === tf ? "#f0f0f0" : "#555568",
                background: timeframe === tf ? "#3b82f620" : "transparent",
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Venue Filter */}
        <VenueFilter value={venueFilter} onChange={setVenueFilter} />

        {/* Sort selector */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-text-muted text-xs mr-1">Sort:</span>
          {(
            [
              ["conviction", "Conviction"],
              ["callers", "# Callers"],
              ["pnl", "Avg P&L"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortMode(key)}
              className="text-xs px-2.5 py-1 border rounded transition-colors"
              style={{
                borderColor: sortMode === key ? "#3b82f6" : "#1a1a2e",
                color: sortMode === key ? "#f0f0f0" : "#555568",
                background: sortMode === key ? "#3b82f620" : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className={`space-y-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
        {sortedPlays.map((play) => (
          <ConsensusCard key={play.ticker} play={play} />
        ))}
      </div>
    </div>
  );
}
