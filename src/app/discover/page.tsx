import { Metadata } from "next";
import DiscoverClient from "./client";

export const metadata: Metadata = {
  title: "Discover | paste.markets",
  description:
    "Find trending callers, hot tickers, and rising stars on paste.markets",
  openGraph: {
    title: "Discover | paste.markets",
    description:
      "Find trending callers, hot tickers, and rising stars on paste.markets",
  },
};

interface DiscoverCaller {
  handle: string;
  win_rate: number;
  avg_pnl: number;
  total_pnl: number;
  trades: number;
  best_ticker: string | null;
  alpha_score: number;
  tier: string;
  avatar_url: string | null;
  platform: string | null;
}

interface DiscoverData {
  trending_callers: DiscoverCaller[];
  trending_tickers: Array<{ ticker: string; count: number }>;
  rising_stars: DiscoverCaller[];
  hot_takes: Array<{
    handle: string;
    ticker: string;
    direction: string;
    pnl_pct: number;
    posted_at: string;
  }>;
  new_callers: DiscoverCaller[];
}

async function fetchDiscoverData(): Promise<DiscoverData | null> {
  try {
    const base =
      process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
    const res = await fetch(`${base}/api/discover`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DiscoverPage() {
  const data = await fetchDiscoverData();

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary font-mono">
            Discover
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Trending callers, hot tickers, and rising stars
          </p>
        </div>

        {data ? (
          <DiscoverClient data={data} />
        ) : (
          <div className="text-center py-20">
            <p className="text-text-muted">
              Unable to load discovery data. Try again later.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
