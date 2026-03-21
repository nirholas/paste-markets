"use client";

import { useRouter } from "next/navigation";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";

interface CallerResult {
  handle: string;
  win_rate: number;
  avg_pnl: number;
  trades: number;
  tier: string;
}

interface TickerResult {
  ticker: string;
  calls: number;
}

interface TradeResult {
  handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  content_preview: string;
}

interface SearchResults {
  callers: CallerResult[];
  tickers: TickerResult[];
  trades: TradeResult[];
}

type ResultItem =
  | { type: "caller"; data: CallerResult }
  | { type: "ticker"; data: TickerResult }
  | { type: "trade"; data: TradeResult };

const RECENT_KEY = "paste-recent-searches";
const MAX_RECENT = 5;

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecent(query: string) {
  const recent = getRecent().filter((r) => r !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function SearchOverlay() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=8`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    search(value);
  }

  // Flatten results for arrow navigation
  function flatResults(): ResultItem[] {
    if (!results) return [];
    const items: ResultItem[] = [];
    for (const c of results.callers) items.push({ type: "caller", data: c });
    for (const t of results.tickers) items.push({ type: "ticker", data: t });
    for (const t of results.trades) items.push({ type: "trade", data: t });
    return items;
  }

  function navigate(item: ResultItem) {
    addRecent(query);
    setOpen(false);
    switch (item.type) {
      case "caller":
        router.push(`/${encodeURIComponent(item.data.handle)}`);
        break;
      case "ticker":
        router.push(`/ticker/${encodeURIComponent(item.data.ticker)}`);
        break;
      case "trade":
        router.push(`/${encodeURIComponent(item.data.handle)}`);
        break;
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const items = flatResults();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items.length > 0 && items[selectedIndex]) {
        navigate(items[selectedIndex]);
      } else if (query.trim()) {
        addRecent(query);
        setOpen(false);
        router.push(`/${encodeURIComponent(query.trim().replace(/^@/, ""))}`);
      }
    }
  }

  function handleRecentClick(q: string) {
    setQuery(q);
    search(q);
  }

  if (!open) return null;

  const items = flatResults();
  let globalIdx = 0;

  const tierColor = (tier: string) => {
    switch (tier) {
      case "S": return "text-amber";
      case "A": return "text-win";
      case "B": return "text-accent";
      default: return "text-text-muted";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ backgroundColor: "rgba(10, 10, 26, 0.95)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-2xl mt-[15vh] px-4">
        {/* Search input */}
        <div className="border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-text-muted text-2xl select-none">/</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search callers, tickers, trades..."
              className="flex-1 bg-transparent outline-none text-text-primary font-mono text-2xl placeholder:text-text-muted"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && (
              <span className="text-text-muted text-sm animate-pulse">...</span>
            )}
            <kbd className="text-text-muted text-xs border border-border rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>
        </div>

        {/* Recent searches (when no query) */}
        {!query && recentSearches.length > 0 && (
          <div className="mb-6">
            <div className="text-text-muted text-xs uppercase tracking-wider mb-3">
              Recent
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRecentClick(r)}
                  className="text-text-secondary text-sm border border-border rounded px-3 py-1 hover:border-accent hover:text-accent transition"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6 max-h-[50vh] overflow-y-auto">
            {/* Callers */}
            {results.callers.length > 0 && (
              <div>
                <div className="text-text-muted text-xs uppercase tracking-wider mb-2">
                  Callers
                </div>
                {results.callers.map((c) => {
                  const idx = globalIdx++;
                  return (
                    <button
                      key={c.handle}
                      onClick={() => navigate({ type: "caller", data: c })}
                      className={`w-full text-left px-3 py-2.5 rounded flex items-center justify-between transition ${
                        idx === selectedIndex
                          ? "bg-surface border border-accent"
                          : "hover:bg-surface border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted">@</span>
                        <span className="text-text-primary font-mono">
                          {c.handle}
                        </span>
                        <span className={`text-xs font-bold ${tierColor(c.tier)}`}>
                          {c.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className={c.win_rate >= 50 ? "text-win" : "text-loss"}>
                          {c.win_rate.toFixed(0)}% WR
                        </span>
                        <span className="text-text-muted">
                          {c.trades} trades
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tickers */}
            {results.tickers.length > 0 && (
              <div>
                <div className="text-text-muted text-xs uppercase tracking-wider mb-2">
                  Tickers
                </div>
                {results.tickers.map((t) => {
                  const idx = globalIdx++;
                  return (
                    <button
                      key={t.ticker}
                      onClick={() => navigate({ type: "ticker", data: t })}
                      className={`w-full text-left px-3 py-2.5 rounded flex items-center justify-between transition ${
                        idx === selectedIndex
                          ? "bg-surface border border-accent"
                          : "hover:bg-surface border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted">$</span>
                        <span className="text-text-primary font-mono font-bold">
                          {t.ticker}
                        </span>
                      </div>
                      <span className="text-text-muted text-sm">
                        {t.calls} call{t.calls !== 1 ? "s" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Trades */}
            {results.trades.length > 0 && (
              <div>
                <div className="text-text-muted text-xs uppercase tracking-wider mb-2">
                  Trades
                </div>
                {results.trades.map((t, i) => {
                  const idx = globalIdx++;
                  return (
                    <button
                      key={`${t.handle}-${t.ticker}-${i}`}
                      onClick={() => navigate({ type: "trade", data: t })}
                      className={`w-full text-left px-3 py-2.5 rounded flex items-center justify-between transition ${
                        idx === selectedIndex
                          ? "bg-surface border border-accent"
                          : "hover:bg-surface border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-xs">
                          @{t.handle}
                        </span>
                        <span className="text-text-secondary font-mono text-sm">
                          {t.content_preview}
                        </span>
                      </div>
                      {t.pnl_pct != null && (
                        <span
                          className={`text-sm font-mono ${
                            t.pnl_pct >= 0 ? "text-win" : "text-loss"
                          }`}
                        >
                          {t.pnl_pct > 0 ? "+" : ""}
                          {t.pnl_pct.toFixed(1)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {results.callers.length === 0 &&
              results.tickers.length === 0 &&
              results.trades.length === 0 &&
              !loading && (
                <div className="text-center py-8">
                  <p className="text-text-muted">
                    No results for &quot;{query}&quot;
                  </p>
                  <p className="text-text-muted text-sm mt-1">
                    Try a different handle or ticker
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-6 flex items-center justify-center gap-4 text-text-muted text-xs">
          <span>
            <kbd className="border border-border rounded px-1 py-0.5 mr-1">
              &uarr;&darr;
            </kbd>
            navigate
          </span>
          <span>
            <kbd className="border border-border rounded px-1 py-0.5 mr-1">
              &crarr;
            </kbd>
            select
          </span>
          <span>
            <kbd className="border border-border rounded px-1 py-0.5 mr-1">
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}

export function SearchTrigger() {
  const [modifier, setModifier] = useState("Ctrl+");

  useEffect(() => {
    if (navigator.platform?.includes("Mac")) {
      setModifier("\u2318");
    }
  }, []);

  return (
    <button
      onClick={() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true }),
        );
      }}
      className="flex items-center gap-2 text-text-muted hover:text-accent transition text-sm border border-border rounded px-2 py-1"
      title="Search (Cmd+K)"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <kbd className="text-xs opacity-60 hidden sm:inline">
        {modifier}K
      </kbd>
    </button>
  );
}
