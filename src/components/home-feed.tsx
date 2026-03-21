"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import type { FeedItem } from "@/app/api/feed/route";
import type { AssetSummary } from "@/lib/data";
import { FeedCard } from "@/components/feed-card";
import { tierColor, type CallerTier } from "@/lib/alpha";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TopCaller {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  winRate: number;
  alphaScore: number;
  tier: CallerTier;
}

interface Filters {
  platform: string;
  direction: string;
  minScore: number;
  liveOnly: boolean;
  asset: string;
}

const DEFAULT_FILTERS: Filters = {
  platform: "",
  direction: "",
  minScore: 0,
  liveOnly: false,
  asset: "",
};

// ─── Local storage helpers ──────────────────────────────────────────────────

const LS_KEY = "pm_feed_filters_v1";

function loadFilters(): Filters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: Filters) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

// ─── New trade toast ────────────────────────────────────────────────────────

interface ToastItem { handle: string; ticker: string; direction: string }

function NewTradeToast({
  toast,
  onClose,
  onView,
}: {
  toast: ToastItem;
  onClose: () => void;
  onView: () => void;
}) {
  const isLong = toast.direction === "long" || toast.direction === "yes";

  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#1a1a1a] border border-[#ffffff14] rounded-2xl px-4 py-3 shadow-2xl animate-slide-up text-sm">
      <span className="w-2 h-2 rounded-full animate-live" style={{ backgroundColor: isLong ? "#22c55e" : "#ef4444" }} />
      <span className="font-semibold" style={{ color: isLong ? "#22c55e" : "#ef4444" }}>
        {toast.direction.toUpperCase()}
      </span>
      <span className="text-[#f5f5f7] font-mono font-bold">${toast.ticker}</span>
      <span className="text-[#52525b]">@{toast.handle}</span>
      <button
        onClick={onView}
        className="text-[#0066FF] hover:text-[#3385FF] transition-colors ml-1 font-medium"
      >
        view
      </button>
      <button
        onClick={onClose}
        className="text-[#52525b] hover:text-[#f5f5f7] transition-colors ml-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Trending assets sidebar ────────────────────────────────────────────────

function TrendingAssets({
  assets,
  onSelect,
}: {
  assets: AssetSummary[];
  onSelect: (ticker: string) => void;
}) {
  return (
    <div className="bg-[#111111] border border-[#ffffff0d] rounded-2xl p-4">
      <p className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-live" />
        Trending
      </p>
      <div className="space-y-1">
        {assets.slice(0, 5).map((asset) => {
          const sentiment = asset.bullCount + asset.bearCount > 0
            ? Math.round((asset.bullCount / (asset.bullCount + asset.bearCount)) * 100)
            : 50;
          const pnlColor =
            asset.avgPnl == null ? "#52525b" :
            asset.avgPnl >= 0 ? "#22c55e" : "#ef4444";

          return (
            <button
              key={asset.ticker}
              onClick={() => onSelect(asset.ticker)}
              className="w-full text-left group p-2 rounded-xl hover:bg-[#ffffff08] transition-colors"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/ticker/${asset.ticker.toUpperCase()}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-bold text-[#f5f5f7] group-hover:text-[#0066FF] transition-colors font-mono"
                >
                  ${asset.ticker}
                </Link>
                {asset.avgPnl != null && (
                  <span className="text-xs font-mono font-semibold" style={{ color: pnlColor }}>
                    {asset.avgPnl >= 0 ? "+" : ""}{asset.avgPnl.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-[#52525b]">{asset.callCount} calls</span>
                <span className="text-[11px] text-[#22c55e]">{sentiment}% long</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top callers sidebar ────────────────────────────────────────────────────

function TopCallers({ callers }: { callers: TopCaller[] }) {
  return (
    <div className="bg-[#111111] border border-[#ffffff0d] rounded-2xl p-4">
      <p className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-live" />
        Top Callers
      </p>
      <div className="space-y-1">
        {callers.slice(0, 5).map((caller) => {
          const color = tierColor(caller.tier);
          return (
            <Link
              key={caller.handle}
              href={`/${caller.handle}`}
              className="flex items-center gap-3 group p-2 rounded-xl hover:bg-[#ffffff08] transition-colors"
            >
              {caller.avatarUrl ? (
                <img
                  src={caller.avatarUrl}
                  alt={caller.handle}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066FF] to-[#3385FF] shrink-0 flex items-center justify-center text-xs text-white font-bold">
                  {caller.handle[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-[#f5f5f7] group-hover:text-[#0066FF] transition-colors font-medium truncate">
                    @{caller.handle}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                    style={{ color, backgroundColor: `${color}18` }}
                  >
                    {caller.tier}
                  </span>
                </div>
                <div className="text-[11px] text-[#52525b]">
                  {Math.round(caller.winRate)}% win rate
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link
        href="/callers"
        className="block mt-3 text-[13px] text-[#0066FF] hover:text-[#3385FF] transition-colors font-medium px-2"
      >
        View all callers
      </Link>
    </div>
  );
}

// ─── Filter pills ───────────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: "", label: "All Platforms" },
  { value: "hyperliquid", label: "Hyperliquid" },
  { value: "polymarket", label: "Polymarket" },
  { value: "robinhood", label: "Robinhood" },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "All" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

function FilterPanel({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const pillCls = (active: boolean) =>
    `text-[13px] px-3 py-1.5 rounded-full transition-colors font-medium ${
      active
        ? "bg-[#0066FF] text-white"
        : "bg-[#ffffff08] text-[#a1a1aa] hover:bg-[#ffffff14] hover:text-[#f5f5f7]"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DIRECTION_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange({ ...filters, direction: filters.direction === o.value ? "" : o.value })}
          className={pillCls(filters.direction === o.value)}
        >
          {o.label}
        </button>
      ))}

      <select
        value={filters.platform}
        onChange={(e) => onChange({ ...filters, platform: e.target.value })}
        className="text-[13px] px-3 py-1.5 rounded-full bg-[#ffffff08] text-[#a1a1aa] border-none outline-none cursor-pointer hover:bg-[#ffffff14] transition-colors font-medium appearance-none"
        aria-label="Platform"
      >
        {PLATFORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 cursor-pointer select-none text-[13px] px-3 py-1.5 rounded-full bg-[#ffffff08] text-[#a1a1aa] hover:bg-[#ffffff14] transition-colors font-medium">
        <input
          type="checkbox"
          checked={filters.liveOnly}
          onChange={(e) => onChange({ ...filters, liveOnly: e.target.checked })}
          className="accent-[#0066FF] w-3.5 h-3.5"
        />
        Live only
      </label>

      {(filters.platform || filters.direction || filters.minScore > 0 || filters.liveOnly || filters.asset) && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-[13px] text-[#ef4444] hover:text-[#ef4444]/70 transition-colors font-medium px-2"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ─── Skeleton card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#111111] border border-[#ffffff0d] rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1a1a1a]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 rounded-full bg-[#1a1a1a]" />
          <div className="h-3 w-16 rounded-full bg-[#1a1a1a]" />
        </div>
        <div className="h-7 w-16 rounded-full bg-[#1a1a1a]" />
      </div>
      <div className="h-4 w-40 rounded-full bg-[#1a1a1a]" />
      <div className="h-3 w-full rounded-full bg-[#1a1a1a]" />
      <div className="h-3 w-3/4 rounded-full bg-[#1a1a1a]" />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const TOP_TIMEFRAMES = [
  { value: "all", label: "All Time" },
  { value: "week", label: "This Week" },
  { value: "today", label: "Today" },
];

export interface HomeFeedProps {
  initialAssets?: AssetSummary[];
  initialCallers?: TopCaller[];
}

export function HomeFeed({ initialAssets = [], initialCallers = [] }: HomeFeedProps) {
  const [tab, setTab] = useState<"hot" | "new" | "top">("hot");
  const [topTimeframe, setTopTimeframe] = useState("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [trades, setTrades] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastItem | null>(null);
  const [assets, setAssets] = useState<AssetSummary[]>(initialAssets);
  const [callers, setCallers] = useState<TopCaller[]>(initialCallers);

  useEffect(() => {
    setFilters(loadFilters());
  }, []);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const buildUrl = useCallback(
    (overrideCursor?: string | null) => {
      const params = new URLSearchParams({
        tab,
        limit: String(PAGE_SIZE),
      });
      if (filters.platform) params.set("platform", filters.platform);
      if (filters.direction) params.set("direction", filters.direction);
      if (filters.minScore > 0) params.set("minScore", String(filters.minScore));
      if (filters.liveOnly) params.set("liveOnly", "true");
      if (filters.asset) params.set("asset", filters.asset);
      if (tab === "top") params.set("timeframe", topTimeframe);
      if (overrideCursor) params.set("cursor", overrideCursor);
      return `/api/feed?${params}`;
    },
    [tab, filters, topTimeframe],
  );

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setCursor(null);
    try {
      const res = await fetch(buildUrl(null));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { trades?: FeedItem[]; items?: FeedItem[]; next_cursor?: string | null };
      const incoming = data.trades ?? data.items ?? [];
      setTrades(incoming);
      setCursor(data.next_cursor ?? null);
      setHasMore(!!data.next_cursor || incoming.length === PAGE_SIZE);
    } catch {
      setTrades([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(cursor));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { trades?: FeedItem[]; items?: FeedItem[]; next_cursor?: string | null };
      const incoming = data.trades ?? data.items ?? [];
      setTrades((prev) => [...prev, ...incoming]);
      setCursor(data.next_cursor ?? null);
      setHasMore(!!data.next_cursor || incoming.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, cursor, hasMore, loadingMore]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore) loadMore(); },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  const lastTopTradeRef = useRef<string | null>(null);
  useEffect(() => {
    if (tab !== "new") return;
    const poll = async () => {
      try {
        const res = await fetch("/api/feed?tab=new&limit=1");
        if (!res.ok) return;
        const data = await res.json() as { trades?: FeedItem[]; items?: FeedItem[] };
        const top = (data.trades ?? data.items ?? [])[0];
        if (!top) return;
        const key = top.id;
        if (lastTopTradeRef.current && lastTopTradeRef.current !== key) {
          setToast({ handle: top.author_handle, ticker: top.ticker, direction: top.direction });
        }
        lastTopTradeRef.current = key;
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [tab]);

  useEffect(() => {
    if (assets.length === 0) {
      fetch("/api/assets")
        .then((r) => r.json())
        .then((d: { assets?: AssetSummary[] }) => setAssets(d.assets ?? []))
        .catch(() => {});
    }
    if (callers.length === 0) {
      fetch("/api/callers?sort=win_rate&limit=5")
        .then((r) => r.json())
        .then((d: { callers?: TopCaller[] }) => setCallers(d.callers ?? []))
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (newTab: "hot" | "new" | "top") => {
    setTab(newTab);
    setCursor(null);
  };

  const handleAssetSelect = (ticker: string) => {
    setFilters((f) => ({ ...f, asset: f.asset === ticker ? "" : ticker }));
    setTab("hot");
  };

  const handleToastView = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTab("new");
    setToast(null);
    fetchFeed();
  };

  const tabBtn = (t: "hot" | "new" | "top", label: string) => (
    <button
      onClick={() => handleTabChange(t)}
      className={`px-4 py-2 text-sm font-semibold transition-colors rounded-full ${
        tab === t
          ? "text-[#f5f5f7] bg-[#ffffff14]"
          : "text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#ffffff08]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-6">

          {/* Left sidebar */}
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start space-y-4">
            <TrendingAssets assets={assets} onSelect={handleAssetSelect} />
          </aside>

          {/* Main feed */}
          <main>
            {/* Tabs + filters */}
            <div className="flex items-center gap-1 mb-4">
              {tabBtn("hot", "Hot")}
              {tabBtn("new", "New")}
              {tabBtn("top", "Top")}
              {tab === "top" && (
                <div className="ml-auto flex items-center gap-1">
                  {TOP_TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setTopTimeframe(tf.value)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${
                        topTimeframe === tf.value
                          ? "bg-[#ffffff14] text-[#f5f5f7]"
                          : "text-[#52525b] hover:text-[#a1a1aa]"
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>

            {/* Feed */}
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : trades.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[#52525b] text-sm">No trades match your filters.</p>
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="mt-3 text-sm text-[#0066FF] hover:text-[#3385FF] transition-colors font-medium"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                trades.map((item) => (
                  <FeedCard key={item.id || `${item.author_handle}-${item.created_at}`} item={item} />
                ))
              )}
            </div>

            {/* Infinite scroll */}
            <div ref={sentinelRef} className="py-4">
              {loadingMore && (
                <div className="flex justify-center">
                  <div className="text-[#52525b] text-sm animate-pulse">Loading more...</div>
                </div>
              )}
              {!hasMore && !loading && trades.length > 0 && (
                <p className="text-center text-[#52525b] text-sm py-2">
                  You&apos;re all caught up
                </p>
              )}
            </div>
          </main>

          {/* Right sidebar */}
          <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start space-y-4">
            <TopCallers callers={callers} />
          </aside>

        </div>
      </div>

      {toast && (
        <NewTradeToast
          toast={toast}
          onClose={() => setToast(null)}
          onView={handleToastView}
        />
      )}
    </>
  );
}
