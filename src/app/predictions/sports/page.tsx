import type { Metadata } from "next";
import Link from "next/link";
import type { SportsLeaderboardRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Sports Prediction Leaderboard -- paste.markets",
  description:
    "Top sports prediction callers ranked by win rate. NCAA, NBA, NFL, UFC -- see who calls games right.",
  openGraph: {
    title: "Sports Prediction Leaderboard -- paste.markets",
    description: "Sports betting accuracy rankings from CT callers on Polymarket.",
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sports Prediction Leaderboard -- paste.markets",
    images: ["/api/og/leaderboard"],
  },
};

export const dynamic = "force-dynamic";

export default async function SportsLeaderboardPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let entries: SportsLeaderboardRow[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/predictions/sports`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      entries = data.entries ?? [];
    }
  } catch (err) {
    console.error("[predictions/sports] Failed to fetch:", err);
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <Link href="/" className="hover:text-accent transition-colors">paste.markets</Link>
            <span>/</span>
            <Link href="/events" className="hover:text-accent transition-colors">Events</Link>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            SPORTS PREDICTION LEADERBOARD
          </h1>
          <p className="text-text-muted text-xs mt-1">
            Who calls games right? Win rate, average P&amp;L, and streaks for sports prediction callers.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {entries.length === 0 ? (
          <div className="border border-border rounded-lg p-12 text-center">
            <p className="text-text-muted text-sm">No sports callers found yet</p>
            <p className="text-text-muted text-xs mt-2">
              Sports prediction calls will populate this leaderboard as they&apos;re tracked.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="bg-surface px-4 py-2.5 grid grid-cols-[40px_1fr_80px_60px_80px_70px] gap-2 text-[10px] uppercase tracking-widest text-text-muted border-b border-border">
              <span>#</span>
              <span>Handle</span>
              <span className="text-right">W/L</span>
              <span className="text-right">Win%</span>
              <span className="text-right">Avg PnL</span>
              <span className="text-right">Streak</span>
            </div>

            {/* Rows */}
            {entries.map((entry) => {
              const winPctColor =
                entry.win_pct >= 70
                  ? "text-win"
                  : entry.win_pct >= 50
                    ? "text-amber"
                    : "text-loss";

              const streakColor =
                entry.streak_type === "W" ? "text-win" : entry.streak_type === "L" ? "text-loss" : "text-text-muted";

              return (
                <div
                  key={entry.handle}
                  className="px-4 py-3 grid grid-cols-[40px_1fr_80px_60px_80px_70px] gap-2 items-center border-b border-border last:border-b-0 hover:bg-surface/50 transition-colors"
                >
                  <span className="text-text-muted font-mono text-sm">
                    {entry.rank}
                  </span>
                  <Link
                    href={`/${encodeURIComponent(entry.handle)}`}
                    className="text-text-primary text-sm font-bold hover:text-accent transition-colors truncate"
                  >
                    @{entry.handle}
                  </Link>
                  <span className="text-right text-sm font-mono text-text-secondary">
                    {entry.wins}/{entry.losses}
                  </span>
                  <span className={`text-right text-sm font-mono font-bold ${winPctColor}`}>
                    {entry.win_pct}%
                  </span>
                  <span
                    className={`text-right text-sm font-mono font-bold ${
                      entry.avg_pnl >= 0 ? "text-win" : "text-loss"
                    }`}
                  >
                    {entry.avg_pnl >= 0 ? "+" : ""}{entry.avg_pnl.toFixed(1)}%
                  </span>
                  <span className={`text-right text-sm font-mono font-bold ${streakColor}`}>
                    {entry.streak > 0 ? `${entry.streak_type}${entry.streak}` : "--"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Navigation links */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
          <Link
            href="/events"
            className="text-xs text-text-muted hover:text-accent transition-colors font-mono"
          >
            &larr; Event Markets
          </Link>
          <Link
            href="/predictions/leaderboard"
            className="text-xs text-text-muted hover:text-accent transition-colors font-mono"
          >
            All Predictions &rarr;
          </Link>
        </div>
      </div>

      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted mt-12">
        <p>
          paste.markets -- Sports prediction data from Polymarket
        </p>
      </footer>
    </main>
  );
}
