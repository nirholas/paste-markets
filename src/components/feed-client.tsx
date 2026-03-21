"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { FeedItem } from "@/app/api/feed/route";
import { TradeCard } from "@/components/trade-card";
import { LiveSignalCard } from "@/components/live-signal-card";
import { useEventStream } from "@/lib/use-event-stream";

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

function timeAgoShort(isoString: string | null): string {
  if (!isoString) return "never";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Add Caller Modal ─────────────────────────────────────────────────────────

function AddCallerModal({ onClose, onAdd }: { onClose: () => void; onAdd: (handle: string) => void }) {
  const [handle, setHandle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const h = handle.trim().replace(/^@/, "");
    if (!h) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: h }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add caller");
        return;
      }
      onAdd(h);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 w-full max-w-sm space-y-4">
        <h3 className="text-sm font-bold text-[#f0f0f0] uppercase tracking-widest">
          Add Caller to Watch
        </h3>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@handle"
          className="w-full border border-[#1a1a2e] bg-[#0a0a1a] text-[#c8c8d0] text-xs px-3 py-2 rounded focus:outline-none focus:border-[#3b82f6] font-mono"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p className="text-[#e74c3c] text-xs">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="text-xs text-[#555568] hover:text-[#c8c8d0] transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !handle.trim()}
            className="text-xs border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-colors px-4 py-1.5 rounded disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main FeedClient ──────────────────────────────────────────────────────────

export function FeedClient() {
  const [trades, setTrades] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [ticker, setTicker] = useState("");
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [showAddCaller, setShowAddCaller] = useState(false);
  const offsetRef = useRef(0);

  const stream = useEventStream(liveMode);
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

  // Auto-refresh every 60s (only when not in live mode)
  useEffect(() => {
    if (liveMode) return;
    const interval = setInterval(() => {
      fetchTrades(0, false);
    }, 60_000);
    return () => clearInterval(interval);
  }, [ticker, platform, category, liveMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Header with LIVE toggle */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-widest text-text-muted">
            LIVE FEED
          </p>
          <button
            onClick={() => setLiveMode(!liveMode)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono border rounded transition-all ${
              liveMode
                ? "border-[#2ecc71] text-[#2ecc71] bg-[#2ecc71]/10"
                : "border-[#1a1a2e] text-[#555568] hover:border-[#555568]"
            }`}
          >
            {liveMode && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ecc71] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2ecc71]" />
              </span>
            )}
            {liveMode ? "LIVE" : "Go Live"}
          </button>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">
          Real-time trade calls from CT
        </h1>
        <p className="text-text-secondary text-sm mt-2">
          {liveMode
            ? `Monitoring ${stream.activeCallers} callers | Last signal: ${timeAgoShort(stream.lastSignalAt)}`
            : "All trades being posted to paste.trade. Refreshes every 60 seconds."}
        </p>
      </div>

      {/* Live mode status bar */}
      {liveMode && (
        <div className="flex items-center justify-between mb-4 px-3 py-2 border border-[#1a1a2e] rounded bg-[#0f0f22]">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] uppercase tracking-widest font-mono ${stream.connected ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
              {stream.connected ? "Connected" : "Reconnecting..."}
            </span>
            {stream.tradesFoundToday > 0 && (
              <span className="text-[10px] text-[#555568] font-mono">
                {stream.tradesFoundToday} signals today
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCaller(true)}
              className="text-[10px] text-[#3b82f6] hover:text-[#3b82f6]/70 transition-colors font-mono"
            >
              + Add Caller
            </button>
            <Link
              href="/signals"
              className="text-[10px] text-[#f39c12] hover:text-[#f39c12]/70 transition-colors font-mono"
            >
              View Signals →
            </Link>
          </div>
        </div>
      )}

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

      {/* Live streaming signals (shown above regular feed) */}
      {liveMode && stream.liveEvents.length > 0 && (
        <div className="space-y-3 mb-6">
          {stream.liveEvents.map((event, i) => (
            <LiveSignalCard
              key={`${event.handle}-${event.tweetUrl}-${i}`}
              event={event}
              animate={i === 0}
            />
          ))}
          <div className="border-b border-[#1a1a2e] my-4" />
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

      {/* Add Caller Modal */}
      {showAddCaller && (
        <AddCallerModal
          onClose={() => setShowAddCaller(false)}
          onAdd={() => {
            // Could refresh stats here
          }}
        />
      )}
    </div>
  );
}
