"use client";

import { useState, useEffect, useCallback } from "react";
import type { AssetDetailResponse } from "@/app/api/asset/[ticker]/route";

interface Props {
  ticker: string;
  initialPrice: number | null;
  initialWinRate: number | null;
}

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  if (price >= 1000)
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}

export function AssetLivePrice({ ticker, initialPrice, initialWinRate }: Props) {
  const [price, setPrice] = useState(initialPrice);
  const [winRate, setWinRate] = useState(initialWinRate);
  const [fetchedAt, setFetchedAt] = useState<Date>(new Date());
  const [freshnessLabel, setFreshnessLabel] = useState("just now");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/asset/${ticker}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: AssetDetailResponse = await res.json();
      if (data.currentPrice != null) setPrice(data.currentPrice);
      if (data.winRate != null) setWinRate(data.winRate);
      setFetchedAt(new Date());
    } catch {
      // silently ignore refresh errors
    }
  }, [ticker]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Update freshness label every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setFreshnessLabel(timeAgo(fetchedAt));
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchedAt]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-1 sm:gap-4">
      {price != null && (
        <div>
          <div className="text-text-secondary text-sm font-mono">
            current price{" "}
            <span className="text-text-primary font-bold">{formatPrice(price)}</span>
          </div>
          <div className="text-[10px] text-text-muted mt-0.5 font-mono">
            as of {freshnessLabel}
          </div>
        </div>
      )}
      {winRate != null && (
        <div className="text-sm font-mono">
          <span className="text-text-muted text-[10px] uppercase tracking-widest mr-1">
            Win Rate
          </span>
          <span
            className={`font-bold ${
              winRate >= 65
                ? "text-win"
                : winRate >= 50
                  ? "text-amber"
                  : "text-loss"
            }`}
          >
            {Math.round(winRate)}%
          </span>
        </div>
      )}
    </div>
  );
}
