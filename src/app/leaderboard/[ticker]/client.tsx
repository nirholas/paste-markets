"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LeaderboardTable,
  type LeaderboardRow,
} from "@/components/leaderboard-table";

interface TickerLeaderboardClientProps {
  ticker: string;
  initialEntries: LeaderboardRow[];
  popularTickers: string[];
}

export function TickerLeaderboardClient({
  ticker: initialTicker,
  initialEntries,
  popularTickers,
}: TickerLeaderboardClientProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardRow[]>(initialEntries);
  const [ticker, setTicker] = useState(initialTicker);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const fetchTicker = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leaderboard?ticker=${encodeURIComponent(t)}&limit=25`,
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      // keep current data
    } finally {
      setLoading(false);
    }
  }, []);

  function handleTickerSelect(t: string) {
    const upper = t.toUpperCase();
    setTicker(upper);
    router.replace(`/leaderboard/${encodeURIComponent(upper)}`, { scroll: false });
    fetchTicker(upper);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const val = searchInput.trim().toUpperCase();
    if (!val) return;
    handleTickerSelect(val);
    setSearchInput("");
  }

  // Sync entries when initialTicker changes via navigation
  useEffect(() => {
    setTicker(initialTicker);
    setEntries(initialEntries);
  }, [initialTicker, initialEntries]);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link
            href="/leaderboard"
            className="text-text-muted text-xs hover:text-accent transition-colors"
          >
            &larr; Back to Leaderboard
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mt-2">
            BEST {ticker} CALLERS
          </h1>
          <p className="text-text-muted text-xs mt-1">
            Who&apos;s the best {ticker} caller on CT? Ranked by total P&L on {ticker}.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Ticker Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {popularTickers.map((t) => (
            <button
              key={t}
              onClick={() => handleTickerSelect(t)}
              className={`px-3 py-1.5 text-xs font-mono border rounded-lg transition-colors ${
                ticker === t
                  ? "bg-accent text-text-primary border-accent"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-accent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 mb-6 max-w-xs">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search ticker..."
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors font-mono"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-accent hover:text-text-primary transition-colors font-mono"
          >
            Go
          </button>
        </form>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <LeaderboardTable entries={entries} loading={loading} />
        </div>

        {entries.length === 0 && !loading && (
          <p className="text-text-muted text-xs text-center mt-6">
            No callers found for {ticker}. Try a different ticker.
          </p>
        )}
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
          </a>
        </p>
      </footer>
    </main>
  );
}
