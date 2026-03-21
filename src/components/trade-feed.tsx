"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import type { FeedItem } from "@/app/api/feed/route";

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function directionColor(direction: string): string {
  return direction === "long" || direction === "yes" ? "#2ecc71" : "#e74c3c";
}

function TradeRow({ trade, isNew }: { trade: FeedItem; isNew: boolean }) {
  const pnlColor =
    trade.pnl_pct == null
      ? "#555568"
      : trade.pnl_pct >= 0
        ? "#2ecc71"
        : "#e74c3c";

  const pnlLabel =
    trade.pnl_pct == null
      ? "OPEN"
      : `${trade.pnl_pct >= 0 ? "+" : ""}${trade.pnl_pct.toFixed(1)}%`;

  const href = trade.source_url ?? `/${trade.author_handle}`;

  return (
    <a
      href={href}
      target={trade.source_url ? "_blank" : undefined}
      rel={trade.source_url ? "noopener noreferrer" : undefined}
      className={`feed-row flex items-center justify-between py-3 px-2 -mx-2 border-b border-[#1a1a2e] hover:bg-[#0f0f22]/50 transition-colors${isNew ? " feed-row-new" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {/* Ticker + direction */}
      <div className="flex items-center gap-3 min-w-0 w-[140px] shrink-0">
        <Link
          href={`/ticker/${trade.ticker.toUpperCase()}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-bold uppercase tracking-wide transition-colors hover:text-[#3b82f6]"
          style={{ color: "#f0f0f0" }}
        >
          {trade.ticker}
        </Link>
        <span
          className="text-xs font-bold uppercase"
          style={{ color: directionColor(trade.direction) }}
        >
          {trade.direction.toUpperCase()}
        </span>
      </div>

      {/* Caller */}
      <div className="flex-1 min-w-0 px-2">
        <Link
          href={`/${trade.author_handle}`}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-[#c8c8d0] hover:text-[#3b82f6] transition-colors"
        >
          @{trade.author_handle}
        </Link>
        {trade.win_rate != null && (
          <span className="text-xs text-[#555568] ml-1">
            ({Math.round(trade.win_rate)}% WR)
          </span>
        )}
      </div>

      {/* P&L */}
      <div
        className="text-sm font-bold w-[72px] text-right shrink-0"
        style={{ color: pnlColor }}
      >
        {pnlLabel}
      </div>

      {/* Time ago */}
      <div className="text-xs text-[#555568] w-[56px] text-right shrink-0 ml-2">
        {timeAgo(trade.created_at)}
      </div>
    </a>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-3 px-2 -mx-2 border-b border-[#1a1a2e]">
      <div className="h-4 w-28 rounded bg-[#1a1a2e] animate-pulse" />
      <div className="h-3 w-36 rounded bg-[#1a1a2e] animate-pulse mx-2" />
      <div className="h-4 w-14 rounded bg-[#1a1a2e] animate-pulse" />
    </div>
  );
}

interface TradeFeedProps {
  limit?: number;
}

export function TradeFeed({ limit = 50 }: TradeFeedProps) {
  const [trades, setTrades] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const prevKeysRef = useRef<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  function tradeKey(t: FeedItem) {
    return `${t.author_handle}|${t.ticker}|${t.direction}|${t.created_at}`;
  }

  async function fetchFeed() {
    try {
      const res = await fetch("/api/feed");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const incoming: FeedItem[] = (data.items ?? data.trades ?? []).slice(0, limit);

      const prev = prevKeysRef.current;
      const freshKeys = new Set<string>();
      if (prev.size > 0) {
        for (const t of incoming) {
          const k = tradeKey(t);
          if (!prev.has(k)) freshKeys.add(k);
        }
      }

      prevKeysRef.current = new Set(incoming.map(tradeKey));
      setTrades(incoming);
      setNewKeys(freshKeys);
      setLoading(false);
      setError(false);

      if (freshKeys.size > 0) {
        setTimeout(() => setNewKeys(new Set()), 800);
      }
    } catch {
      setLoading(false);
      setError(true);
    }
  }

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 60_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  if (loading) {
    return (
      <div className="border-t border-[#1a1a2e]">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (error || trades.length === 0) {
    return (
      <div className="border-t border-[#1a1a2e] py-8 text-center text-xs text-[#555568]">
        No trades available right now.
      </div>
    );
  }

  return (
    <div className="border-t border-[#1a1a2e]">
      {trades.map((trade) => (
        <TradeRow
          key={tradeKey(trade)}
          trade={trade}
          isNew={newKeys.has(tradeKey(trade))}
        />
      ))}
    </div>
  );
}
