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

// ─── Utility ───────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-[#0f0f22] border border-[#3b82f6]/50 rounded-lg px-4 py-3 shadow-xl animate-slide-up font-mono text-xs">
      <span
        className="font-bold"
        style={{ color: isLong ? "#2ecc71" : "#e74c3c" }}
      >
        {toast.direction.toUpperCase()}
      </span>
      <span className="text-[#f0f0f0]">${toast.ticker}</span>
      <span className="text-[#555568]">@{toast.handle}</span>
      <button
        onClick={onView}
        className="text-[#3b82f6] hover:text-[#3b82f6]/70 transition-colors ml-1"
      >
        view →
      </button>
      <button
        onClick={onClose}
        className="text-[#555568] hover:text-[#f0f0f0] transition-colors ml-1"
      >
        ✕
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
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#555568] mb-3">Trending Now</p>
      <div className="space-y-2">
        {assets.slice(0, 5).map((asset) => {
          const sentiment = asset.bullCount + asset.bearCount > 0
            ? Math.round((asset.bullCount / (asset.bullCount + asset.bearCount)) * 100)
            : 50;
          const pnlColor =
            asset.avgPnl == null ? "#555568" :
            asset.avgPnl >= 0 ? "#2ecc71" : "#e74c3c";

          return (
            <button
              key={asset.ticker}
              onClick={() => onSelect(asset.ticker)}
              className="w-full text-left group"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/ticker/${asset.ticker.toUpperCase()}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm font-bold text-[#f0f0f0] group-hover:text-[#3b82f6] transition-colors"
                >
                  ${asset.ticker}
                </Link>
                {asset.avgPnl != null && (
                  <span className="text-xs font-mono" style={{ color: pnlColor }}>
                    {asset.avgPnl >= 0 ? "+" : ""}{asset.avgPnl.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[#555568]">{asset.callCount} calls</span>
                <span className="text-[10px] text-[#2ecc71]">{sentiment}% long</span>
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
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#555568] mb-3">Top Callers</p>
      <div className="space-y-3">
        {callers.slice(0, 5).map((caller) => {
          const color = tierColor(caller.tier);
          return (
            <Link
              key={caller.handle}
              href={`/${caller.handle}`}
              className="flex items-center gap-2 group"
            >
              {caller.avatarUrl ? (
                <img
                  src={caller.avatarUrl}
                  alt={caller.handle}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1a1a2e] shrink-0 flex items-center justify-center text-[10px] text-[#555568]">
                  {caller.handle[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#c8c8d0] group-hover:text-[#3b82f6] transition-colors truncate">
                    @{caller.handle}
                  </span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest border px-1"
                    style={{ color, borderColor: `${color}50` }}
                  >
                    {caller.tier}
                  </span>
                </div>
                <div className="text-[10px] text-[#555568]">
                  {Math.round(caller.winRate)}% WR
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link
        href="/callers"
        className="block mt-3 text-[11px] text-[#555568] hover:text-[#3b82f6] transition-colors"
      >
        View all callers →
      </Link>
    </div>
  );
}

// ─── Filter panel ───────────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: "", label: "All Platforms" },
  { value: "hyperliquid", label: "Hyperliquid" },
  { value: "polymarket", label: "Polymarket" },
  { value: "robinhood", label: "Robinhood" },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "All Directions" },
  { value: "long", label: "Long / Yes" },
  { value: "short", label: "Short / No" },
];

const SCORE_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 30, label: "B+" },
  { value: 50, label: "A+" },
  { value: 70, label: "S tier" },
];

const TOP_TIMEFRAMES = [
  { value: "all", label: "All Time" },
  { value: "week", label: "This Week" },
  { value: "today", label: "Today" },
];

function FilterPanel({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const selectCls =
    "border border-[#1a1a2e] bg-[#0f0f22] text-[#c8c8d0] text-[11px] px-2 py-1.5 rounded focus:outline-none focus:border-[#3b82f6] transition-colors cursor-pointer font-mono";
  const inputCls =
    "border border-[#1a1a2e] bg-[#0f0f22] text-[#c8c8d0] text-[11px] px-2 py-1.5 rounded focus:outline-none focus:border-[#3b82f6] transition-colors placeholder:text-[#555568] font-mono w-28";

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <select
        value={filters.platform}
        onChange={(e) => onChange({ ...filters, platform: e.target.value })}
        className={selectCls}
        aria-label="Platform"
      >
        {PLATFORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={filters.direction}
        onChange={(e) => onChange({ ...filters, direction: e.target.value })}
        className={selectCls}
        aria-label="Direction"
      >
        {DIRECTION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={filters.minScore}
        onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
        className={selectCls}
        aria-label="Min caller score"
      >
        {SCORE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>Score: {o.label}</option>
        ))}
      </select>

      <input
        type="text"
        value={filters.asset}
        onChange={(e) => onChange({ ...filters, asset: e.target.value.toUpperCase() })}
        placeholder="TICKER"
        className={inputCls}
        aria-label="Filter by ticker"
      />

      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.liveOnly}
          onChange={(e) => onChange({ ...filters, liveOnly: e.target.checked })}
          className="accent-[#3b82f6]"
        />
        <span className="text-[#555568] font-mono">Live calls only</span>
      </label>

      {(filters.platform || filters.direction || filters.minScore > 0 || filters.liveOnly || filters.asset) && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-[#555568] hover:text-[#e74c3c] transition-colors font-mono text-[11px]"
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
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-10 rounded bg-[#1a1a2e]" />
        <div className="h-5 w-16 rounded bg-[#1a1a2e]" />
        <div className="h-4 w-20 rounded bg-[#1a1a2e]" />
      </div>
      <div className="h-3 w-24 rounded bg-[#1a1a2e]" />
      <div className="h-3 w-full rounded bg-[#1a1a2e]" />
      <div className="h-3 w-3/4 rounded bg-[#1a1a2e]" />
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

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

  // Persist filters across sessions
  useEffect(() => {
    setFilters(loadFilters());
  }, []);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  // ── Build fetch URL ───────────────────────────────────────────────
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

  // ── Initial load / tab/filter change ─────────────────────────────
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

  // ── Load more (infinite scroll) ──────────────────────────────────
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

  // ── Intersection observer for infinite scroll ─────────────────────
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

  // ── Real-time new trade polling (every 30s on "new" tab) ──────────
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

  // ── Fetch sidebar data if not provided by server ──────────────────
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

  // ── Tab change ─────────────────────────────────────────────────────
  const handleTabChange = (newTab: "hot" | "new" | "top") => {
    setTab(newTab);
    setCursor(null);
  };

  // ── Asset filter from sidebar ──────────────────────────────────────
  const handleAssetSelect = (ticker: string) => {
    setFilters((f) => ({ ...f, asset: f.asset === ticker ? "" : ticker }));
    setTab("hot");
  };

  // ── Toast scroll to top ────────────────────────────────────────────
  const handleToastView = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTab("new");
    setToast(null);
    fetchFeed();
  };

  const tabBtn = (t: "hot" | "new" | "top", label: string) => (
    <button
      onClick={() => handleTabChange(t)}
      className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition-colors font-mono ${
        tab === t
          ? "text-[#f0f0f0] border-b-2 border-[#3b82f6]"
          : "text-[#555568] hover:text-[#c8c8d0]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Three-column layout */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-6">

          {/* ── Left sidebar: Trending Assets ───────────────────────── */}
          <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
            <TrendingAssets assets={assets} onSelect={handleAssetSelect} />
          </aside>

          {/* ── Main feed ───────────────────────────────────────────── */}
          <main>
            {/* Tab switcher */}
            <div className="flex items-center border-b border-[#1a1a2e] mb-4">
              {tabBtn("hot", "Hot")}
              {tabBtn("new", "New")}
              {tabBtn("top", "Top")}
              {tab === "top" && (
                <div className="ml-auto flex items-center gap-1 pb-0.5">
                  {TOP_TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setTopTimeframe(tf.value)}
                      className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                        topTimeframe === tf.value
                          ? "bg-[#1a1a2e] text-[#c8c8d0]"
                          : "text-[#555568] hover:text-[#c8c8d0]"
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter panel */}
            <div className="mb-4">
              <FilterPanel filters={filters} onChange={setFilters} />
            </div>

            {/* Feed cards */}
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              ) : trades.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-[#555568] text-sm font-mono">No trades match your filters.</p>
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="mt-3 text-[11px] text-[#3b82f6] hover:text-[#3b82f6]/70 transition-colors font-mono"
                  >
                    Clear filters →
                  </button>
                </div>
              ) : (
                trades.map((item) => (
                  <FeedCard key={item.id || `${item.author_handle}-${item.created_at}`} item={item} />
                ))
              )}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="py-4">
              {loadingMore && (
                <div className="flex justify-center">
                  <div className="text-[#555568] text-xs font-mono animate-pulse">Loading more...</div>
                </div>
              )}
              {!hasMore && !loading && trades.length > 0 && (
                <p className="text-center text-[#555568] text-[11px] font-mono py-2">
                  End of feed
                </p>
              )}
            </div>
          </main>

          {/* ── Right sidebar: Top Callers ───────────────────────────── */}
          <aside className="lg:sticky lg:top-6 lg:self-start space-y-4">
            <TopCallers callers={callers} />
          </aside>

        </div>
      </div>

      {/* New trade toast */}
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
