"use client";

import { useEffect, useState, useCallback } from "react";

interface TickerTrade {
  handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  posted_at: string;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPnl(pnl: number | null): { text: string; color: string } {
  if (pnl === null || pnl === undefined) {
    return { text: "open", color: "#a1a1aa" };
  }
  const sign = pnl >= 0 ? "+" : "";
  return {
    text: `${sign}${pnl.toFixed(1)}%`,
    color: pnl >= 0 ? "#22c55e" : "#ef4444",
  };
}

function TickerItem({ trade }: { trade: TickerTrade }) {
  const { text: pnlText, color: pnlColor } = formatPnl(trade.pnl_pct);
  const isLong = trade.direction === "long" || trade.direction === "yes";

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-4 text-[13px]">
      <span className="text-[#a1a1aa]">@{trade.handle}</span>
      <span style={{ color: isLong ? "#22c55e" : "#ef4444" }} className="font-semibold">
        {trade.direction.toUpperCase()}
      </span>
      <span className="text-[#f5f5f7] font-bold font-mono">${trade.ticker}</span>
      <span style={{ color: pnlColor }} className="font-semibold font-mono">
        {pnlText}
      </span>
      <span className="text-[#52525b]">{formatTimeAgo(trade.posted_at)}</span>
    </span>
  );
}

export default function TradeTicker() {
  const [trades, setTrades] = useState<TickerTrade[]>([]);

  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch("/api/live?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.trades) && data.trades.length > 0) {
        setTrades(data.trades);
      }
    } catch {
      // silently ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 30_000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  if (trades.length === 0) return null;

  const doubled = [...trades, ...trades];

  return (
    <div
      className="relative w-full overflow-hidden border-b border-[#ffffff08]"
      style={{ height: 36, background: "#08080d" }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16"
        style={{ background: "linear-gradient(to right, #08080d, transparent)" }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16"
        style={{ background: "linear-gradient(to left, #08080d, transparent)" }}
      />

      <div className="ticker-track flex items-center h-full">
        {doubled.map((trade, i) => (
          <TickerItem key={`${trade.handle}-${trade.ticker}-${i}`} trade={trade} />
        ))}
      </div>
    </div>
  );
}
