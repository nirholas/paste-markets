"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { FeedItem } from "@/app/api/feed/route";
import { TradeCard } from "@/components/trade-card";

const PAGE_SIZE = 20;

const PLATFORM_OPTIONS = [
  { value: "", label: "All Platforms" },
  { value: "hyperliquid", label: "Hyperliquid" },
  { value: "polymarket", label: "Polymarket" },
  { value: "robinhood", label: "Robinhood" },
];

// Category filter tabs (shown when polymarket is selected or "all" with events)
const CATEGORY_OPTIONS = [
  { value: "", label: "All" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "macro_event", label: "Macro" },
  { value: "entertainment", label: "Entertainment" },
  { value: "prediction", label: "Other" },
];

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-20 rounded bg-border" />
        <div className="h-5 w-14 rounded bg-border" />
      </div>
      <div className="h-4 w-32 rounded bg-border" />
      <div className="h-4 w-full rounded bg-border" />
      <div className="h-4 w-3/4 rounded bg-border" />
      <div className="h-6 w-24 rounded bg-border" />
    </div>
  );
}

export function FeedClient() {
  const [trades, setTrades] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [ticker, setTicker] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const offsetRef = useRef(0);

  const showCategoryFilter = platform === "polymarket" || platform === "";

  const fetchTrades = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (ticker) params.set("ticker", ticker);
      if (platform) params.set("platform", platform);
      if (category) params.set("category", category);

      try {
        const res = await fetch(`/api/feed?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { items: FeedItem[]; total: number } = await res.json();
        const incoming = data.items ?? [];
        if (append) {
          setTrades((prev) => [...prev, ...incoming]);
        } else {
          setTrades(incoming);
        }
        offsetRef.current = offset + incoming.length;
        setHasMore(incoming.length === PAGE_SIZE);
      } catch {
        if (!append) setTrades([]);
        setHasMore(false);
      }
    },
    [ticker, platform, category],
  );

  // Reset when filters change
  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    offsetRef.current = 0;
    fetchTrades(0, false).finally(() => setLoading(false));
  }, [fetchTrades]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTrades(0, false);
    }, 60_000);
    return () => clearInterval(interval);
  }, [ticker, platform, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset category when switching away from polymarket
  function handlePlatformChange(p: string) {
    setPlatform(p);
    if (p !== "polymarket") setCategory("");
    offsetRef.current = 0;
  }

  function handleCategoryChange(c: string) {
    setCategory(c);
    offsetRef.current = 0;
  }

  async function loadMore() {
    setLoadingMore(true);
    await fetchTrades(offsetRef.current, true);
    setLoadingMore(false);
  }

  const inputCls =
    "border border-border bg-surface text-text-secondary text-xs px-3 py-1.5 rounded focus:outline-none focus:border-accent transition-colors placeholder:text-text-muted font-mono";

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="TICKER (e.g. SOL)"
          className={inputCls}
          style={{ width: 160 }}
        />
        {/* Platform tab strip */}
        <div className="flex items-center border border-border rounded overflow-hidden">
          {PLATFORM_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => handlePlatformChange(o.value)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                platform === o.value
                  ? "bg-accent text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter (Polymarket sub-tabs) */}
      {showCategoryFilter && (platform === "polymarket" || category !== "") && (
        <div className="flex flex-wrap items-center gap-1 mb-4">
          <span className="text-[10px] uppercase tracking-widest text-text-muted mr-1">
            Category:
          </span>
          {CATEGORY_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => handleCategoryChange(o.value)}
              className={`px-2.5 py-1 text-xs font-mono border rounded transition-colors ${
                category === o.value
                  ? "border-accent text-accent bg-accent/10"
                  : "border-border text-text-muted hover:border-accent/50 hover:text-text-secondary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Trade cards */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : trades.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-muted text-sm">No trades yet.</p>
            {(platform || category) && (
              <p className="text-text-muted text-xs mt-1">
                Try removing filters.
              </p>
            )}
          </div>
        ) : (
          trades.map((trade) => (
            <TradeCard
              key={trade.id}
              tradeId={trade.id}
              ticker={trade.ticker}
              direction={trade.direction as "long" | "short" | "yes" | "no"}
              platform={trade.platform}
              entryPrice={trade.entry_price}
              currentPrice={trade.current_price}
              pnlPct={trade.pnl_pct}
              headlineQuote={trade.headline_quote}
              thesis={trade.thesis}
              authorHandle={trade.author_handle}
              winRate={trade.win_rate ?? undefined}
              postedAt={trade.created_at}
              sourceUrl={trade.source_url}
              category={trade.category}
              contractTitle={trade.market_question ?? trade.instrument}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {!loading && trades.length > 0 && hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="border border-border bg-surface text-text-secondary text-xs px-6 py-2 rounded hover:border-accent hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
