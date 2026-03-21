"use client";

import { useState, useCallback, useEffect, useRef, type FormEvent } from "react";
import Link from "next/link";
import { tierColor, type CallerTier } from "@/lib/alpha";
import { ReputationBadge, type ReputationTier } from "@/components/reputation-badge";

interface CallerCard {
  rank: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  totalTrades: number;
  bestTicker: string | null;
  platform: string | null;
  alphaScore: number;
  tier: CallerTier;
  reputationScore: number;
  reputationTier: ReputationTier;
}

interface ApiResponse {
  callers: CallerCard[];
  total: number;
  page: number;
}

const SORT_OPTIONS = [
  { value: "reputation", label: "REPUTATION" },
  { value: "win_rate", label: "WIN RATE" },
  { value: "total_pnl", label: "TOTAL PNL" },
  { value: "avg_pnl", label: "AVG PNL" },
  { value: "most_active", label: "MOST ACTIVE" },
  { value: "newest", label: "HOT (7D)" },
] as const;

const MARKET_OPTIONS = [
  { value: "all", label: "ALL" },
  { value: "hyperliquid", label: "HL" },
  { value: "polymarket", label: "PM" },
  { value: "robinhood", label: "RH" },
] as const;

const TIER_OPTIONS = [
  { value: "", label: "ALL TIERS" },
  { value: "Oracle", label: "🔮 Oracle" },
  { value: "Alpha", label: "⚡ Alpha" },
  { value: "Reliable", label: "✅ Reliable" },
  { value: "Developing", label: "📊 Developing" },
] as const;

function PnlTag({ value }: { value: number }) {
  const color = value >= 0 ? "text-win" : "text-loss";
  return (
    <span className={`text-xs font-bold font-mono ${color}`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function Avatar({ url, handle }: { url: string | null; handle: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted text-xs font-bold flex-shrink-0">
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`@${handle}`}
      onError={() => setFailed(true)}
      className="w-10 h-10 rounded-full border border-border flex-shrink-0 object-cover"
    />
  );
}

function CallerCardItem({ caller }: { caller: CallerCard }) {
  const tierC = tierColor(caller.tier);

  return (
    <Link
      href={`/${encodeURIComponent(caller.handle)}`}
      className="block bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4 hover:border-accent transition-colors group"
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar url={caller.avatarUrl} handle={caller.handle} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-text-primary font-bold text-sm truncate group-hover:text-accent transition-colors">
              @{caller.handle}
            </span>
            <ReputationBadge tier={caller.reputationTier} score={caller.reputationScore} size="sm" showScore />
            {(caller.tier === "S" || caller.tier === "A") && (
              <span
                className="text-[9px] font-bold px-1 py-0.5 rounded font-mono flex-shrink-0"
                style={{
                  color: tierC,
                  border: `1px solid ${tierC}`,
                  background: `${tierC}14`,
                }}
              >
                {caller.tier}
              </span>
            )}
          </div>
          <div className="text-text-muted text-[11px] mt-0.5">
            {caller.totalTrades} trades
            {caller.platform && ` · ${caller.platform.toUpperCase()}`}
          </div>
        </div>
        <span className="text-text-muted text-[11px] font-mono flex-shrink-0">
          #{caller.rank}
        </span>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-0.5">
            Win Rate
          </div>
          <div
            className={`text-sm font-bold font-mono ${
              caller.winRate >= 65
                ? "text-win"
                : caller.winRate >= 50
                  ? "text-amber"
                  : "text-loss"
            }`}
          >
            {Math.round(caller.winRate)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-0.5">
            Avg P&L
          </div>
          <PnlTag value={caller.avgPnl} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-0.5">
            Total P&L
          </div>
          <PnlTag value={caller.totalPnl} />
        </div>
      </div>

      {/* Best ticker badge */}
      {caller.bestTicker && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">Top asset:</span>
          <span className="text-[10px] font-bold text-accent font-mono px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20">
            {caller.bestTicker}
          </span>
        </div>
      )}
    </Link>
  );
}

interface CallersClientProps {
  initialCallers: CallerCard[];
  initialTotal: number;
}

export function CallersClient({ initialCallers, initialTotal }: CallersClientProps) {
  const [callers, setCallers] = useState<CallerCard[]>(initialCallers);
  const [total, setTotal] = useState(initialTotal);
  const [sort, setSort] = useState("reputation");
  const [market, setMarket] = useState("all");
  const [tier, setTier] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [asset, setAsset] = useState("");
  const [mounted, setMounted] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCallers = useCallback(
    async (params: {
      sort: string;
      market: string;
      tier: string;
      page: number;
      q: string;
      asset: string;
    }) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          sort: params.sort,
          market: params.market,
          page: String(params.page),
          limit: "48",
          ...(params.tier ? { tier: params.tier } : {}),
          ...(params.q ? { q: params.q } : {}),
          ...(params.asset ? { asset: params.asset } : {}),
        });
        const res = await fetch(`/api/callers?${qs}`);
        if (!res.ok) throw new Error("fetch failed");
        const data: ApiResponse = await res.json();
        setCallers(data.callers);
        setTotal(data.total);
      } catch {
        // keep current data
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!mounted) { setMounted(true); return; }
    fetchCallers({ sort, market, tier, page, q: query, asset });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, market, tier, page, mounted]);

  function handleSortChange(s: string) {
    setPage(1);
    setSort(s);
  }

  function handleMarketChange(m: string) {
    setPage(1);
    setMarket(m);
  }

  function handleTierChange(t: string) {
    setPage(1);
    setTier(t);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchCallers({ sort, market, tier, page: 1, q: query, asset });
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchCallers({ sort, market, tier, page: 1, q: val, asset });
    }, 400);
  }

  const totalPages = Math.ceil(total / 48);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link href="/" className="text-text-muted text-xs hover:text-accent transition-colors">
            paste.markets
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mt-1">CALLER DISCOVERY</h1>
          <p className="text-text-muted text-xs mt-1">
            Find the best traders on CT — ranked by real P&L performance
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Sort */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSortChange(opt.value)}
                className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
                  sort === opt.value
                    ? "bg-accent text-text-primary"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Market */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {MARKET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleMarketChange(opt.value)}
                className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
                  market === opt.value
                    ? "bg-accent text-text-primary"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Tier filter */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {TIER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleTierChange(opt.value)}
                className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
                  tier === opt.value
                    ? "bg-accent text-text-primary"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Asset filter */}
          <div className="flex items-center bg-surface border border-border rounded-lg px-2 py-1.5 focus-within:border-accent transition-colors">
            <span className="text-text-muted text-[11px] mr-1 select-none">$</span>
            <input
              type="text"
              value={asset}
              onChange={(e) => setAsset(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  fetchCallers({ sort, market, tier, page: 1, q: query, asset });
                }
              }}
              placeholder="BTC"
              className="bg-transparent outline-none text-text-primary placeholder:text-text-muted font-mono text-[11px] w-12"
            />
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="ml-auto">
            <div className="flex items-center bg-surface border border-border rounded-lg px-3 py-1.5 focus-within:border-accent transition-colors">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search @handle..."
                className="bg-transparent outline-none text-text-primary placeholder:text-text-muted font-mono text-[11px] w-40"
              />
            </div>
          </form>
        </div>

        {/* Result count */}
        <div className="text-text-muted text-[11px] mb-4">
          {loading ? "Loading..." : `${total} callers`}
        </div>

        {/* Grid */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 transition-opacity ${loading ? "opacity-50" : ""}`}
        >
          {callers.map((caller) => (
            <CallerCardItem key={caller.handle} caller={caller} />
          ))}
        </div>

        {callers.length === 0 && !loading && (
          <div className="text-center py-16 text-text-muted text-sm">
            No callers found.
            {query && " Try a different search."}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-4 py-2 text-xs border border-border rounded-lg font-mono transition-colors ${
                page > 1
                  ? "text-text-secondary hover:border-accent hover:text-text-primary cursor-pointer"
                  : "text-text-muted/30 cursor-not-allowed"
              }`}
            >
              Prev
            </button>
            <span className="text-text-muted text-xs">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`px-4 py-2 text-xs border border-border rounded-lg font-mono transition-colors ${
                page < totalPages
                  ? "text-text-secondary hover:border-accent hover:text-text-primary cursor-pointer"
                  : "text-text-muted/30 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted mt-12">
        <p>
          paste.markets — data from{" "}
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            paste.trade
          </a>
        </p>
      </footer>
    </main>
  );
}
