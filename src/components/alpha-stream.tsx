"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { AlphaTrade, Tier } from "@/app/api/alpha/route";

// ─── EV Bar ────────────────────────────────────────────────────────────────

function EvBar({ ev, max = 20 }: { ev: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (ev / max) * 100));
  const blocks = Math.round(pct / 10);
  const color =
    ev >= 10 ? "#2ecc71" : ev >= 5 ? "#f39c12" : ev >= 2 ? "#3b82f6" : "#555568";
  return (
    <span className="font-mono text-[10px]" style={{ color }}>
      {"█".repeat(blocks)}{"░".repeat(10 - blocks)}
    </span>
  );
}

// ─── Tier Badge ────────────────────────────────────────────────────────────

const TIER_STYLE: Record<Tier, string> = {
  ELITE: "text-[#f39c12] border-[#f39c12]",
  SMART: "text-[#3b82f6] border-[#3b82f6]",
  TRACKED: "text-[#555568] border-[#555568]",
};

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span className={`text-[9px] px-1.5 py-0.5 border rounded font-mono font-bold ${TIER_STYLE[tier]}`}>
      {tier}
    </span>
  );
}

// ─── Direction Badge ────────────────────────────────────────────────────────

function DirBadge({ direction }: { direction: AlphaTrade["direction"] }) {
  const isBull = direction === "long" || direction === "yes";
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 border uppercase font-bold font-mono"
      style={{
        color: isBull ? "#2ecc71" : "#e74c3c",
        borderColor: isBull ? "#2ecc71" : "#e74c3c",
      }}
    >
      {direction}
    </span>
  );
}

// ─── P&L Display ───────────────────────────────────────────────────────────

function PnlBadge({ pnl }: { pnl: number | null }) {
  if (pnl == null) {
    return <span className="text-[10px] text-[#555568] font-mono">OPEN</span>;
  }
  const color = pnl >= 0 ? "#2ecc71" : "#e74c3c";
  const sign = pnl >= 0 ? "+" : "";
  return (
    <span className="text-xs font-bold font-mono" style={{ color }}>
      {sign}{pnl.toFixed(1)}%
    </span>
  );
}

// ─── Time ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Trade Row ─────────────────────────────────────────────────────────────

function TradeRow({ trade, rank }: { trade: AlphaTrade; rank: number }) {
  const evPositive = trade.evScore > 0;
  const evColor =
    trade.evScore >= 10 ? "#2ecc71" : trade.evScore >= 5 ? "#f39c12" : trade.evScore >= 2 ? "#3b82f6" : "#555568";

  return (
    <div className="border-b border-[#1a1a2e] py-4 hover:bg-[#0f0f22]/50 transition-colors px-1 -mx-1">
      <div className="flex items-start gap-4">
        {/* EV Score — the primary signal */}
        <div className="w-20 shrink-0 text-right">
          <div
            className="text-lg font-bold font-mono leading-none"
            style={{ color: evColor }}
          >
            {evPositive ? "+" : ""}{trade.evScore.toFixed(1)}
          </div>
          <div className="text-[9px] text-[#555568] font-mono mt-0.5">EV/TRADE</div>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#1a1a2e] self-stretch shrink-0" />

        {/* Trade details */}
        <div className="flex-1 min-w-0">
          {/* Row 1: caller + tier + ticker + direction + pnl */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Link
              href={`/${trade.handle}`}
              className="text-[#c8c8d0] text-sm font-mono hover:text-[#3b82f6] transition-colors"
            >
              @{trade.handle}
            </Link>
            <TierBadge tier={trade.tier} />
            <span className="text-[#555568] text-[10px] font-mono">{trade.winRate.toFixed(0)}% WR</span>
            <span className="text-[#1a1a2e]">·</span>
            <Link
              href={`/ticker/${trade.ticker}`}
              className="text-[#f0f0f0] font-bold text-sm font-mono hover:text-[#3b82f6] transition-colors"
            >
              ${trade.ticker}
            </Link>
            <DirBadge direction={trade.direction} />
            <PnlBadge pnl={trade.pnlPct} />
          </div>

          {/* Row 2: EV bar + metadata */}
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <EvBar ev={trade.evScore} />
            {trade.platform && (
              <span className="text-[10px] text-[#555568] font-mono">{trade.platform}</span>
            )}
            {trade.instrument && trade.instrument !== trade.ticker && (
              <span className="text-[10px] text-[#555568] font-mono">{trade.instrument}</span>
            )}
            <span className="text-[10px] text-[#555568] font-mono">{timeAgo(trade.postedAt)}</span>
          </div>

          {/* Thesis/quote */}
          {(trade.headlineQuote ?? trade.thesis) && (
            <p className="text-[11px] text-[#555568] font-mono leading-relaxed truncate">
              &ldquo;{(trade.headlineQuote ?? trade.thesis)!.slice(0, 120)}&rdquo;
            </p>
          )}

          {/* Consensus badge */}
          {trade.consensusCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] text-[#f39c12] font-mono font-bold">
                {trade.consensusCount + 1} agree
              </span>
              <span className="text-[10px] text-[#555568] font-mono">
                {trade.consensusHandles.slice(0, 2).map((h) => `@${h}`).join(" ")}
                {trade.consensusHandles.length > 2 && ` +${trade.consensusHandles.length - 2}`}
              </span>
            </div>
          )}
        </div>

        {/* Rank */}
        <div className="text-[#1a1a2e] text-xs font-mono w-6 text-right shrink-0 mt-0.5">
          #{rank}
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ────────────────────────────────────────────────────────────

type FilterTier = "all" | "smart" | "elite";

interface Filters {
  tier: FilterTier;
  consensus: boolean;
}

function FilterBar({
  filters,
  setFilters,
  count,
  updatedAt,
  loading,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  count: number;
  updatedAt: string;
  loading: boolean;
}) {
  const btnBase = "text-[10px] uppercase tracking-widest px-3 py-1 border font-mono transition-colors";
  const active = "border-[#3b82f6] text-[#3b82f6]";
  const inactive = "border-[#1a1a2e] text-[#555568] hover:border-[#3b82f6] hover:text-[#3b82f6]";

  const tiers: { label: string; value: FilterTier }[] = [
    { label: "All", value: "all" },
    { label: "Smart+", value: "smart" },
    { label: "Elite", value: "elite" },
  ];

  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div className="flex items-center gap-2">
        {tiers.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilters({ ...filters, tier: t.value })}
            className={`${btnBase} ${filters.tier === t.value ? active : inactive}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setFilters({ ...filters, consensus: !filters.consensus })}
          className={`${btnBase} ${filters.consensus ? active : inactive}`}
        >
          Consensus
        </button>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[#555568] font-mono">
        {loading && <span className="text-[#3b82f6]">refreshing...</span>}
        <span>{count} signals</span>
        {updatedAt && <span>updated {timeAgo(updatedAt)}</span>}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AlphaStream() {
  const [trades, setTrades] = useState<AlphaTrade[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ tier: "all", consensus: false });

  const fetchAlpha = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (filters.tier !== "all") params.set("tier", filters.tier);
      if (filters.consensus) params.set("consensus", "1");

      const res = await fetch(`/api/alpha?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { trades: AlphaTrade[]; updatedAt: string } = await res.json();
      setTrades(data.trades);
      setUpdatedAt(data.updatedAt);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch on mount + filter change
  useEffect(() => {
    fetchAlpha(false);
  }, [fetchAlpha]);

  // Auto-refresh every 90s
  useEffect(() => {
    const id = setInterval(() => fetchAlpha(true), 90_000);
    return () => clearInterval(id);
  }, [fetchAlpha]);

  return (
    <div>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        count={trades.length}
        updatedAt={updatedAt}
        loading={loading}
      />

      {loading && trades.length === 0 ? (
        <div className="space-y-px">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-[#1a1a2e] py-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-20 space-y-1">
                  <div className="h-6 w-12 bg-[#1a1a2e] rounded ml-auto" />
                  <div className="h-3 w-16 bg-[#1a1a2e] rounded ml-auto" />
                </div>
                <div className="w-px bg-[#1a1a2e]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-[#1a1a2e] rounded" />
                  <div className="h-3 w-32 bg-[#1a1a2e] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : trades.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[#555568] text-sm font-mono">No qualifying signals right now.</p>
          <p className="text-[#555568] text-xs font-mono mt-2">
            Try a broader filter or check back soon.
          </p>
        </div>
      ) : (
        <div>
          {trades.map((trade, i) => (
            <TradeRow key={`${trade.handle}:${trade.ticker}:${trade.direction}`} trade={trade} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
