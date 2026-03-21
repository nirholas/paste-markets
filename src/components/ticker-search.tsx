"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AssetSummary } from "@/lib/data";

interface Props {
  assets: AssetSummary[];
  placeholder?: string;
  className?: string;
}

export function TickerSearch({
  assets,
  placeholder = "Search tickers... e.g. BTC, ETH, TRUMP",
  className = "",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/^\$/, "");
    if (!q) return assets.slice(0, 8);
    return assets
      .filter((a) => a.ticker.includes(q))
      .slice(0, 8);
  }, [query, assets]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  function navigate(ticker: string) {
    setQuery("");
    setOpen(false);
    router.push(`/asset/${ticker}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[highlighted];
      if (item) navigate(item.ticker);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.closest("[data-ticker-search]")?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      data-ticker-search
      className={`relative ${className}`}
    >
      <div className="flex items-center bg-surface border border-border focus-within:border-accent rounded-lg px-4 py-3 transition-colors">
        <span className="text-text-muted text-sm mr-2 font-mono">$</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted font-mono text-sm"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-text-muted hover:text-text-secondary transition-colors ml-2 text-sm"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-[#0f0f22] border border-border rounded-lg overflow-hidden shadow-lg"
        >
          {results.map((asset, i) => {
            const total = asset.bullCount + asset.bearCount;
            const bullPct =
              total > 0
                ? Math.round((asset.bullCount / total) * 100)
                : 50;
            const sentimentColor =
              bullPct >= 60
                ? "text-win"
                : bullPct <= 40
                  ? "text-loss"
                  : "text-text-secondary";

            return (
              <li key={asset.ticker}>
                <button
                  onClick={() => navigate(asset.ticker)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    i === highlighted
                      ? "bg-surface"
                      : "hover:bg-surface/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-text-primary font-bold font-mono text-sm">
                      ${asset.ticker}
                    </span>
                    <span className="text-text-muted text-xs">
                      {asset.callCount} call{asset.callCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {asset.avgPnl != null && (
                      <span
                        className={
                          asset.avgPnl >= 0 ? "text-win" : "text-loss"
                        }
                      >
                        {asset.avgPnl >= 0 ? "+" : ""}
                        {asset.avgPnl.toFixed(1)}%
                      </span>
                    )}
                    <span className={`text-[10px] font-mono ${sentimentColor}`}>
                      {bullPct}% BULL
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
          <li className="border-t border-border px-4 py-2 text-[10px] text-text-muted flex justify-between items-center">
            <span>↑↓ navigate · ↵ select · esc close</span>
            <a
              href="/assets"
              className="hover:text-accent transition-colors"
              onClick={() => setOpen(false)}
            >
              View all assets →
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
