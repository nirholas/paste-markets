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
    return { text: "open", color: "#f39c12" };
  }
  const sign = pnl >= 0 ? "+" : "";
  return {
    text: `${sign}${pnl.toFixed(1)}%`,
    color: pnl >= 0 ? "#2ecc71" : "#e74c3c",
  };
}

function TickerItem({ trade }: { trade: TickerTrade }) {
  const { text: pnlText, color: pnlColor } = formatPnl(trade.pnl_pct);
  const dirLabel = trade.direction.toUpperCase();

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-4">
      <span className="text-[#c8c8d0]">@{trade.handle}</span>
      <span className="text-[#555568]">|</span>
      <span className="text-[#f0f0f0]">{dirLabel}</span>
      <span className="text-[#3b82f6] font-bold">${trade.ticker}</span>
      <span className="text-[#555568]">|</span>
      <span style={{ color: pnlColor }} className="font-bold">
        {pnlText}
      </span>
      <span className="text-[#555568]">|</span>
      <span className="text-[#555568]">{formatTimeAgo(trade.posted_at)}</span>
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

  // Duplicate the list so the marquee loops seamlessly
  const doubled = [...trades, ...trades];

  return (
    <div
      className="relative w-full overflow-hidden border-b border-[#1a1a2e]"
      style={{ height: 32, background: "#08081a" }}
    >
      {/* Left fade */}
      <div
        className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12"
        style={{
          background: "linear-gradient(to right, #08081a, transparent)",
        }}
      />
      {/* Right fade */}
      <div
        className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12"
        style={{
          background: "linear-gradient(to left, #08081a, transparent)",
        }}
      />

      <div className="ticker-track flex items-center h-full text-xs font-mono">
        {doubled.map((trade, i) => (
          <TickerItem key={`${trade.handle}-${trade.ticker}-${i}`} trade={trade} />
        ))}
      </div>
    </div>
  );
}
