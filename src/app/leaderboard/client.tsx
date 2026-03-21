"use client";

import { useState, useCallback, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LeaderboardTable,
  type LeaderboardRow,
} from "@/components/leaderboard-table";
import { VenueFilter, type VenueFilterValue } from "@/components/venue-filter";
import { venueTypeToPlatform } from "@/lib/venues";

const TIMEFRAMES = ["24h", "7d", "30d", "all"] as const;
const TIMEFRAME_LABELS: Record<string, string> = {
  "24h": "24H",
  "7d": "7D",
  "30d": "30D",
  all: "ALL",
};

const SORT_OPTIONS = [
  { value: "win_rate", label: "Win Rate" },
  { value: "avg_pnl", label: "Avg P&L" },
  { value: "total_trades", label: "Total Trades" },
] as const;

type ViewMode = "rankings" | "streaks";

const PAGE_SIZE = 25;

interface LeaderboardClientProps {
  initialEntries: LeaderboardRow[];
  initialPlatform?: string;
}

interface ApiResponse {
  entries: LeaderboardRow[];
  total: number;
  timeframe: string;
  updatedAt: string;
}

function applyFade(entries: LeaderboardRow[]): LeaderboardRow[] {
  // Reverse so worst performers (best fade signals) appear at rank #1
  return [...entries].reverse().map((e, idx) => ({
    ...e,
    rank: idx + 1,
    winRate: 100 - e.winRate,
    avgPnl: -e.avgPnl,
  }));
}

export function LeaderboardClient({ initialEntries, initialPlatform }: LeaderboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<LeaderboardRow[]>(initialEntries);
  const [total, setTotal] = useState(initialEntries.length);
  const [timeframe, setTimeframe] = useState("30d");
  const [platform, setPlatform] = useState(initialPlatform ?? "all");
  const [venueFilter, setVenueFilter] = useState<VenueFilterValue>("all");
  const [sort, setSort] = useState("win_rate");
  const [minTrades, setMinTrades] = useState(5);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [fadeMode, setFadeMode] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("rankings");

  // Handle submission
  const [submitHandle, setSubmitHandle] = useState("");
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  // Read initial fade state from URL
  useEffect(() => {
    setFadeMode(searchParams.get("fade") === "true");
    if (searchParams.get("view") === "streaks") setViewMode("streaks");
  }, [searchParams]);

  const fetchData = useCallback(
    async (params: {
      timeframe: string;
      platform: string;
      sort: string;
      minTrades: number;
      offset: number;
      fade: boolean;
      liveOnly?: boolean;
      viewMode: ViewMode;
    }) => {
      setLoading(true);
      try {
        // "events" is a UI alias for polymarket — map it before the API call
        const apiPlatform = params.platform === "events" ? "polymarket" : params.platform;

        const qsObj: Record<string, string> = {
          window: params.timeframe,
          platform: apiPlatform,
          sort: params.sort,
          limit: String(PAGE_SIZE),
          offset: String(params.offset),
          min_trades: String(params.minTrades),
          ...(params.fade ? { order: "asc" } : {}),
          ...(params.liveOnly ? { live_only: "true" } : {}),
        };

        if (params.viewMode === "streaks") {
          qsObj.mode = "streaks";
        }

        const qs = new URLSearchParams(qsObj);
        const res = await fetch(`/api/leaderboard?${qs.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        const data: ApiResponse = await res.json();
        setEntries(data.entries);
        setTotal(data.total);
        setUpdatedAt(data.updatedAt);
      } catch {
        // Keep current data on error
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Re-fetch when filters change (skip initial mount since we have SSR data)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    fetchData({ timeframe, platform, sort, minTrades, offset, fade: fadeMode, liveOnly, viewMode });
  }, [timeframe, platform, sort, minTrades, offset, fadeMode, liveOnly, viewMode, fetchData, mounted]);

  function handleTimeframeChange(tf: string) {
    setOffset(0);
    setTimeframe(tf);
  }

  function handlePlatformChange(p: string) {
    setOffset(0);
    setPlatform(p);
  }

  function handleVenueFilterChange(v: VenueFilterValue) {
    setVenueFilter(v);
    setOffset(0);
    setPlatform(venueTypeToPlatform(v));
  }

  function handleSortChange(s: string) {
    setOffset(0);
    setSort(s);
  }

  function handleMinTradesChange(val: string) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setOffset(0);
      setMinTrades(parsed);
    }
  }

  function handleFadeToggle() {
    const next = !fadeMode;
    setFadeMode(next);
    setOffset(0);
    // Update URL param
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("fade", "true");
    } else {
      params.delete("fade");
    }
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  }

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setOffset(0);
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "streaks") {
      params.set("view", "streaks");
    } else {
      params.delete("view");
    }
    router.replace(`/leaderboard?${params.toString()}`, { scroll: false });
  }

  const currentStart = offset + 1;
  const currentEnd = Math.min(offset + PAGE_SIZE, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  // Apply fade transformation to display entries
  const displayEntries = fadeMode ? applyFade(entries) : entries;

  async function handleAddHandle(e: FormEvent) {
    e.preventDefault();
    const handle = submitHandle.trim().replace(/^@/, "");
    if (!handle) return;

    setSubmitStatus("Adding...");
    try {
      const res = await fetch(`/api/author/${encodeURIComponent(handle)}`, {
        method: "GET",
      });
      if (res.ok) {
        setSubmitStatus(`@${handle} added. Refreshing...`);
        setSubmitHandle("");
        // Refresh the leaderboard
        await fetchData({ timeframe, platform, sort, minTrades, offset, fade: fadeMode, liveOnly, viewMode });
        setSubmitStatus(null);
      } else {
        setSubmitStatus(`Could not find @${handle}`);
      }
    } catch {
      setSubmitStatus("Network error. Try again.");
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-text-muted text-xs hover:text-accent transition-colors"
            >
              paste.markets
            </Link>
            <h1 className="text-2xl font-bold text-text-primary mt-1 flex items-center gap-3">
              {viewMode === "streaks"
                ? "HOT STREAKS"
                : platform === "events"
                  ? "SPORTS & EVENTS CALLERS"
                  : platform !== "all"
                    ? `${platform.toUpperCase()} CALLERS`
                    : "CT LEADERBOARD"}
              {fadeMode && (
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-loss text-loss tracking-widest">
                  FADE MODE
                </span>
              )}
            </h1>
            <p className="text-text-muted text-xs mt-1">
              {viewMode === "streaks"
                ? "Callers currently on winning streaks"
                : fadeMode
                  ? "Inverted rankings — best fade signals at the top"
                  : platform === "events"
                    ? "Best Polymarket callers on CT — sports, politics, macro"
                    : platform !== "all"
                      ? `Best ${platform} callers on CT by win rate`
                      : "Real P&L rankings for Crypto Twitter"}
            </p>
          </div>
          {updatedAt && (
            <span className="text-text-muted text-xs hidden sm:block">
              Updated{" "}
              {new Date(updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          <button
            onClick={() => handleViewModeChange("rankings")}
            className={`px-4 py-2 text-xs font-mono transition-colors ${
              viewMode === "rankings"
                ? "text-text-primary border-b-2 border-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            RANKINGS
          </button>
          <button
            onClick={() => handleViewModeChange("streaks")}
            className={`px-4 py-2 text-xs font-mono transition-colors ${
              viewMode === "streaks"
                ? "text-text-primary border-b-2 border-accent"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            HOT STREAKS
          </button>
          <Link
            href="/leaderboard/BTC"
            className="px-4 py-2 text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
          >
            BY ASSET
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Timeframe */}
          {viewMode === "rankings" && (
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                    timeframe === tf
                      ? "bg-accent text-text-primary"
                      : "text-text-muted hover:text-text-secondary hover:bg-surface"
                  }`}
                >
                  {TIMEFRAME_LABELS[tf]}
                </button>
              ))}
            </div>
          )}

          {/* Venue Filter */}
          <VenueFilter value={venueFilter} onChange={handleVenueFilterChange} />

          {/* Sort */}
          {viewMode === "rankings" && (
            <div className="flex items-center gap-2">
              <label className="text-text-muted text-xs">Sort:</label>
              <select
                value={sort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-accent transition-colors font-mono appearance-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Min trades */}
          {viewMode === "rankings" && (
            <div className="flex items-center gap-2">
              <label className="text-text-muted text-xs">Min Trades:</label>
              <input
                type="number"
                min={0}
                value={minTrades}
                onChange={(e) => handleMinTradesChange(e.target.value)}
                className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text-secondary outline-none focus:border-accent transition-colors font-mono w-16"
              />
            </div>
          )}

          {/* Live Only toggle */}
          <button
            onClick={() => { setLiveOnly((v) => !v); setOffset(0); }}
            className={`px-3 py-1.5 text-xs font-mono border rounded-lg transition-colors ${
              liveOnly
                ? "border-win text-win bg-win/10 hover:bg-win/20"
                : "border-border text-text-muted hover:border-win hover:text-win"
            }`}
            title="Only show callers whose trades were submitted within 1 hour of the tweet"
          >
            {liveOnly ? "LIVE ONLY ON" : "LIVE ONLY"}
          </button>

          {/* Fade toggle */}
          {viewMode === "rankings" && (
            <button
              onClick={handleFadeToggle}
              className={`ml-auto px-3 py-1.5 text-xs font-mono border rounded-lg transition-colors ${
                fadeMode
                  ? "border-loss text-loss bg-loss/10 hover:bg-loss/20"
                  : "border-border text-text-muted hover:border-loss hover:text-loss"
              }`}
            >
              {fadeMode ? "FADE ON" : "FADE MODE"}
            </button>
          )}
        </div>

        {/* Table */}
        <div
          className={`border rounded-lg overflow-hidden transition-colors ${
            fadeMode ? "border-loss/40" : "border-border"
          }`}
        >
          <LeaderboardTable
            entries={displayEntries}
            loading={loading}
            showStreakColumn={viewMode === "streaks"}
          />
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-text-muted text-xs">
              Showing {currentStart}-{currentEnd} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={!hasPrev}
                className={`px-3 py-1.5 text-xs border border-border rounded-lg font-mono transition-colors ${
                  hasPrev
                    ? "text-text-secondary hover:border-accent hover:text-text-primary cursor-pointer"
                    : "text-text-muted/30 cursor-not-allowed"
                }`}
              >
                Prev
              </button>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={!hasNext}
                className={`px-3 py-1.5 text-xs border border-border rounded-lg font-mono transition-colors ${
                  hasNext
                    ? "text-text-secondary hover:border-accent hover:text-text-primary cursor-pointer"
                    : "text-text-muted/30 cursor-not-allowed"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Add Handle Form */}
        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            ADD A TRADER
          </h2>
          <form
            onSubmit={handleAddHandle}
            className="flex items-center gap-3 max-w-md"
          >
            <div className="flex items-center bg-surface border border-border rounded-lg px-3 py-2 flex-1 focus-within:border-accent transition-colors">
              <span className="text-text-muted text-sm mr-1 select-none">
                @
              </span>
              <input
                type="text"
                value={submitHandle}
                onChange={(e) => {
                  setSubmitHandle(e.target.value);
                  setSubmitStatus(null);
                }}
                placeholder="handle"
                className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted font-mono text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs border border-border rounded-lg text-text-secondary hover:border-accent hover:text-text-primary transition-colors font-mono"
            >
              Track
            </button>
          </form>
          {submitStatus && (
            <p className="text-text-muted text-xs mt-2">{submitStatus}</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted mt-12">
        <p>
          paste.markets -- Real P&L data from{" "}
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            paste.trade
          </a>{" "}
          by{" "}
          <a
            href="https://x.com/frankdegods"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            @frankdegods
          </a>
        </p>
      </footer>
    </main>
  );
}
