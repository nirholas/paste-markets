"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { EventItem } from "@/app/api/events/route";
import { TradeCard } from "@/components/trade-card";
import { WhatsTheBet } from "@/components/whats-the-bet";
import {
  formatProbability,
  probabilityToAmericanOdds,
  formatVolume,
} from "@/lib/category";

const PAGE_SIZE = 20;

const CATEGORY_TABS = [
  { value: "all", label: "All Events" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "macro_event", label: "Macro" },
  { value: "entertainment", label: "Entertainment" },
  { value: "prediction", label: "Other" },
] as const;

type CategoryTab = (typeof CATEGORY_TABS)[number]["value"];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "best_pnl", label: "Best P&L" },
  { value: "hottest", label: "Hottest" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

function sortItems(items: EventItem[], sort: SortOption): EventItem[] {
  const copy = [...items];
  if (sort === "best_pnl") {
    return copy.sort((a, b) => (b.pnl_pct ?? -Infinity) - (a.pnl_pct ?? -Infinity));
  }
  if (sort === "hottest") {
    // "Hottest" = largest absolute probability move
    return copy.sort((a, b) => {
      const moveA = a.pnl_pct != null ? Math.abs(a.pnl_pct) : 0;
      const moveB = b.pnl_pct != null ? Math.abs(b.pnl_pct) : 0;
      return moveB - moveA;
    });
  }
  // newest (default)
  return copy.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-6 w-32 rounded bg-border" />
        <div className="h-5 w-10 rounded bg-border" />
        <div className="h-5 w-16 rounded bg-border" />
      </div>
      <div className="h-4 w-3/4 rounded bg-border" />
      <div className="h-4 w-full rounded bg-border" />
      <div className="h-10 w-full rounded bg-border" />
    </div>
  );
}

/** Compact probability summary row for events */
function EventSummaryRow({ item }: { item: EventItem }) {
  const entryProb = item.entry_price != null && item.entry_price <= 1 ? item.entry_price : null;
  const currentProb = item.current_price != null && item.current_price <= 1 ? item.current_price : null;

  const pnlColor =
    item.pnl_pct == null
      ? "text-text-muted"
      : item.pnl_pct > 0
        ? "text-win"
        : "text-loss";

  return (
    <div className="flex flex-wrap gap-4 text-xs font-mono text-text-muted">
      {entryProb != null && (
        <span>
          At call:{" "}
          <span className="text-text-secondary">
            {formatProbability(entryProb)} ({probabilityToAmericanOdds(entryProb)})
          </span>
        </span>
      )}
      {currentProb != null && (
        <span>
          Now:{" "}
          <span className="text-text-secondary">
            {formatProbability(currentProb)} ({probabilityToAmericanOdds(currentProb)})
          </span>
        </span>
      )}
      {item.pnl_pct != null && (
        <span className={`font-bold ${pnlColor}`}>
          {item.pnl_pct > 0 ? "+" : ""}{item.pnl_pct.toFixed(1)}%
        </span>
      )}
      {item.market_volume != null && (
        <span>Vol: <span className="text-text-secondary">{formatVolume(item.market_volume)}</span></span>
      )}
    </div>
  );
}

interface EventsClientProps {
  initialItems: EventItem[];
  initialCategory: CategoryTab;
  trendingItems?: EventItem[];
}

export function EventsClient({ initialItems, initialCategory, trendingItems = [] }: EventsClientProps) {
  const [items, setItems] = useState<EventItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length === PAGE_SIZE);
  const [category, setCategory] = useState<CategoryTab>(initialCategory);
  const [sort, setSort] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<"cards" | "compact">("cards");
  const cursorRef = useRef<string | null>(null);

  const fetchItems = useCallback(
    async (cat: CategoryTab, append: boolean, cursor?: string | null) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cat !== "all") params.set("category", cat);
      if (cursor) params.set("cursor", cursor);

      try {
        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { items: EventItem[]; next_cursor: string | null } = await res.json();
        const incoming = data.items ?? [];
        if (append) {
          setItems((prev) => [...prev, ...incoming]);
        } else {
          setItems(incoming);
        }
        cursorRef.current = data.next_cursor ?? null;
        setHasMore(incoming.length === PAGE_SIZE);
      } catch {
        if (!append) setItems([]);
        setHasMore(false);
      }
    },
    [],
  );

  // Re-fetch when category changes (skip initial since we have SSR data)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    setLoading(true);
    cursorRef.current = null;
    fetchItems(category, false, null).finally(() => setLoading(false));
  }, [category, fetchItems, mounted]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchItems(category, true, cursorRef.current);
    setLoadingMore(false);
  }

  const displayItems = sortItems(items, sort);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/" className="text-text-muted text-xs hover:text-accent transition-colors">
            paste.markets
          </Link>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                EVENTS & PREDICTIONS
              </h1>
              <p className="text-text-muted text-xs mt-1">
                Polymarket calls — sports, politics, macro, entertainment
              </p>
            </div>
            <div className="flex items-center gap-3 hidden sm:flex">
              <Link
                href="/events/calendar"
                className="text-xs text-text-muted hover:text-amber transition-colors"
              >
                Calendar
              </Link>
              <Link
                href="/predictions/sports"
                className="text-xs text-text-muted hover:text-win transition-colors"
              >
                Sports Board
              </Link>
              <Link
                href="/leaderboard?platform=polymarket"
                className="text-xs text-text-muted hover:text-accent transition-colors"
              >
                Top callers
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Category tabs */}
        <div className="flex items-center border border-border rounded-lg overflow-hidden mb-4">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCategory(tab.value)}
              className={`flex-1 px-3 py-2 text-xs font-mono transition-colors ${
                category === tab.value
                  ? "bg-accent text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 mb-6">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-xs">Sort:</span>
            <div className="flex items-center border border-border rounded overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                    sort === opt.value
                      ? "bg-surface text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* View mode */}
          <div className="ml-auto flex items-center border border-border rounded overflow-hidden">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                viewMode === "cards"
                  ? "bg-surface text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              title="Card view"
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                viewMode === "compact"
                  ? "bg-surface text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              title="Compact view"
            >
              Compact
            </button>
          </div>
        </div>

        {/* Trending section (only on "all" tab) */}
        {!loading && category === "all" && trendingItems.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">
              Trending Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trendingItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="bg-surface border border-amber/20 rounded-lg p-4 hover:border-amber/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-amber font-mono">
                      {(item as EventItem & { caller_count?: number }).caller_count ?? 1} caller{((item as EventItem & { caller_count?: number }).caller_count ?? 1) !== 1 ? "s" : ""}
                    </span>
                    {item.expires_at && (
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(item.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-text-primary mb-2 leading-snug">
                    {item.market_question ?? item.ticker}
                  </p>
                  <div className="flex items-center justify-between">
                    {item.current_price != null && (
                      <span className="text-xs font-mono text-win">
                        YES {Math.round(item.current_price * 100)}%
                      </span>
                    )}
                    <Link
                      href={`/${item.author_handle}`}
                      className="text-xs text-text-muted hover:text-accent transition-colors"
                    >
                      @{item.author_handle}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Items */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="py-16 text-center border border-border rounded-lg">
            <p className="text-text-muted text-sm">No {category !== "all" ? category.replace("_", " ") : "events"} calls yet.</p>
            <p className="text-text-muted text-xs mt-2">
              Prediction market calls will appear here as they&apos;re tracked.
            </p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="space-y-4">
            {displayItems.map((item) => (
              <TradeCard
                key={item.id}
                tradeId={item.id}
                ticker={item.ticker}
                direction={item.direction as "yes" | "no" | "long" | "short"}
                platform={item.platform}
                entryPrice={item.entry_price}
                currentPrice={item.current_price}
                pnlPct={item.pnl_pct}
                headlineQuote={item.headline_quote}
                thesis={item.thesis}
                authorHandle={item.author_handle}
                winRate={item.win_rate ?? undefined}
                postedAt={item.created_at}
                sourceUrl={item.source_url}
                contractTitle={item.market_question ?? item.instrument}
                marketVolume={item.market_volume}
                expiresAt={item.expires_at}
                polymarketUrl={item.polymarket_url}
                category={item.category}
              />
            ))}
          </div>
        ) : (
          /* Compact list view */
          <div className="border border-border rounded-lg overflow-hidden">
            {displayItems.map((item, i) => (
              <div
                key={item.id}
                className={`px-4 py-3 space-y-1 hover:bg-surface/50 transition-colors ${
                  i < displayItems.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-bold text-text-primary tracking-tight">
                    {item.ticker.toUpperCase()}
                  </span>
                  <span
                    className={`text-xs font-bold uppercase ${
                      item.direction === "yes" ? "text-accent" : "text-loss"
                    }`}
                  >
                    {item.direction.toUpperCase()}
                  </span>
                  <Link
                    href={`/${item.author_handle}`}
                    className="text-xs text-text-secondary hover:text-accent transition-colors"
                  >
                    @{item.author_handle}
                  </Link>
                  <span className="text-xs text-text-muted ml-auto">
                    {new Date(item.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {(item.market_question ?? item.headline_quote) && (
                  <p className="text-xs text-text-muted truncate">
                    {item.market_question ?? item.headline_quote}
                  </p>
                )}
                <EventSummaryRow item={item} />
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && displayItems.length > 0 && hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="border border-border bg-surface text-text-secondary text-xs px-6 py-2 rounded hover:border-accent hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>

      {/* What's the Bet? */}
      <div className="max-w-3xl mx-auto px-4 mt-8 mb-4">
        <WhatsTheBet />
      </div>

      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted mt-8">
        <p>
          paste.markets — Event market data from{" "}
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            paste.trade
          </a>
          {" "}+ Polymarket
        </p>
      </footer>
    </main>
  );
}
