"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatProbability, formatVolume, probabilityToAmericanOdds } from "@/lib/category";

interface BetResult {
  id: string;
  ticker: string;
  direction: string;
  market_question: string | null;
  current_price: number | null;
  market_volume: number | null;
  expires_at: string | null;
  polymarket_url: string | null;
  category: string;
}

export function WhatsTheBet() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BetResult | null>(null);
  const [noResults, setNoResults] = useState(false);

  const search = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setNoResults(false);

    try {
      // Search events API for matching markets
      const res = await fetch(`/api/events?limit=10&category=all`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const items = data.items ?? [];

      // Find best match by keyword matching against market_question or ticker
      const lowerQuery = text.toLowerCase();
      const keywords = lowerQuery.split(/\s+/).filter((w: string) => w.length > 2);

      let bestMatch: BetResult | null = null;
      let bestScore = 0;

      for (const item of items) {
        const searchText = [
          item.market_question ?? "",
          item.ticker ?? "",
          item.thesis ?? "",
        ].join(" ").toLowerCase();

        let score = 0;
        for (const keyword of keywords) {
          if (searchText.includes(keyword)) score++;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            id: item.id,
            ticker: item.ticker,
            direction: item.direction,
            market_question: item.market_question,
            current_price: item.current_price,
            market_volume: item.market_volume,
            expires_at: item.expires_at,
            polymarket_url: item.polymarket_url,
            category: item.category ?? "prediction",
          };
        }
      }

      if (bestMatch && bestScore > 0) {
        setResult(bestMatch);
      } else {
        setNoResults(true);
      }
    } catch {
      setNoResults(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-lg font-bold text-text-primary mb-1">
        What&apos;s the Bet?
      </h2>
      <p className="text-text-muted text-xs mb-4">
        Ask a question. We find the Polymarket event.
      </p>

      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Will Kentucky win March Madness?"
          disabled={loading}
          className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50 font-mono"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="mt-3 w-full border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-text-primary hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Searching..." : "Find Market"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="border border-amber/30 rounded-lg p-4 bg-amber/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest text-amber font-mono">Found</span>
          </div>
          <h3 className="text-sm font-bold text-text-primary mb-2">
            {result.market_question ?? result.ticker}
          </h3>

          <div className="flex flex-wrap gap-4 text-xs font-mono text-text-muted mb-3">
            {result.current_price != null && (
              <span>
                Current:{" "}
                <span className="text-win font-bold">
                  YES at {formatProbability(result.current_price)} ({probabilityToAmericanOdds(result.current_price)})
                </span>
              </span>
            )}
            {result.market_volume != null && result.market_volume > 0 && (
              <span>Volume: <span className="text-text-secondary">{formatVolume(result.market_volume)}</span></span>
            )}
            {result.expires_at && (
              <span>
                Settles:{" "}
                <span className="text-text-secondary">
                  {new Date(result.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/events/${result.id}`}
              className="text-[10px] uppercase tracking-widest text-accent hover:text-text-primary transition-colors font-mono"
            >
              View Details
            </Link>
            {result.polymarket_url && (
              <a
                href={result.polymarket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] uppercase tracking-widest text-text-muted hover:text-accent transition-colors font-mono"
              >
                Polymarket
              </a>
            )}
          </div>
        </div>
      )}

      {noResults && (
        <div className="text-center py-4">
          <p className="text-text-muted text-xs">No matching market found.</p>
          <p className="text-text-muted text-xs mt-1">
            Try{" "}
            <Link href="/trade" className="text-accent hover:text-text-primary transition-colors">
              What&apos;s The Trade?
            </Link>
            {" "}for AI-powered analysis.
          </p>
        </div>
      )}
    </div>
  );
}
