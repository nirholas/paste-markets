"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CallerResult {
  handle: string;
  totalTrades?: number;
  winRate?: number;
}

interface SelectedCaller {
  handle: string;
  winRate?: number;
}

interface CallerSelectorProps {
  selected: SelectedCaller[];
  onChange: (callers: SelectedCaller[]) => void;
  max?: number;
}

export default function CallerSelector({ selected, onChange, max = 10 }: CallerSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CallerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      setQuery(value);
      setOpen(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 300);
    },
    [search],
  );

  const addCaller = useCallback(
    (caller: CallerResult) => {
      if (selected.length >= max) return;
      if (selected.some((s) => s.handle === caller.handle)) return;
      onChange([...selected, { handle: caller.handle, winRate: caller.winRate }]);
      setQuery("");
      setResults([]);
      setOpen(false);
    },
    [selected, onChange, max],
  );

  const removeCaller = useCallback(
    (handle: string) => {
      onChange(selected.filter((s) => s.handle !== handle));
    },
    [selected, onChange],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const winRateColor = (wr: number | undefined) => {
    if (wr == null) return "text-text-muted";
    if (wr >= 65) return "text-win";
    if (wr >= 50) return "text-amber";
    return "text-loss";
  };

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Selected callers as chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((caller) => (
            <span
              key={caller.handle}
              className="inline-flex items-center gap-2 bg-surface border border-border rounded px-3 py-1.5 text-sm"
            >
              <span className="text-text-primary">@{caller.handle}</span>
              {caller.winRate != null && (
                <span className={`text-[10px] uppercase tracking-widest ${winRateColor(caller.winRate)}`}>
                  {Math.round(caller.winRate)}%
                </span>
              )}
              <button
                onClick={() => removeCaller(caller.handle)}
                className="text-text-muted hover:text-loss transition ml-1"
                aria-label={`Remove ${caller.handle}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {selected.length < max && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder={selected.length === 0 ? "Search callers (e.g. @frankdegods)" : "Add another caller..."}
            className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none transition font-mono"
          />
          {loading && (
            <span className="absolute right-3 top-3 text-text-muted text-xs">...</span>
          )}

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
              {results
                .filter((r) => !selected.some((s) => s.handle === r.handle))
                .map((result) => (
                  <button
                    key={result.handle}
                    onClick={() => addCaller(result)}
                    className="w-full text-left px-4 py-2.5 hover:bg-border/30 transition flex items-center justify-between"
                  >
                    <span className="text-text-primary text-sm">@{result.handle}</span>
                    <span className="flex items-center gap-3">
                      {result.winRate != null && result.winRate > 0 && (
                        <span className={`text-xs ${winRateColor(result.winRate)}`}>
                          {Math.round(result.winRate)}% WR
                        </span>
                      )}
                      {result.totalTrades != null && result.totalTrades > 0 && (
                        <span className="text-text-muted text-xs">{result.totalTrades} trades</span>
                      )}
                    </span>
                  </button>
                ))}
            </div>
          )}

          {open && query.length >= 2 && !loading && results.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg px-4 py-3 text-text-muted text-sm z-50">
              No callers found
            </div>
          )}
        </div>
      )}

      {selected.length >= max && (
        <p className="text-text-muted text-xs">Maximum {max} callers selected</p>
      )}
    </div>
  );
}
