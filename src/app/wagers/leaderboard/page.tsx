import type { Metadata } from "next";
import Link from "next/link";
import {
  getCallerEarningsLeaderboard,
  type CallerEarnings,
} from "@/lib/wager-db";

export const metadata: Metadata = {
  title: "Top Earners — Caller Tips — paste.markets",
  description: "Leaderboard of CT callers ranked by wager tip earnings.",
  openGraph: {
    title: "Top Earners — Caller Tips — paste.markets",
    description: "See which callers earn the most from wagers on their trade calls.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Earners — paste.markets",
  },
};

function formatUSDC(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const dynamic = "force-dynamic";

export default function WagerLeaderboardPage() {
  let leaderboard: CallerEarnings[] = [];
  try {
    leaderboard = getCallerEarningsLeaderboard();
  } catch {
    // db not ready
  }

  return (
    <main className="min-h-screen">
      <section className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <div className="mb-8">
          <Link
            href="/wagers"
            className="text-xs text-[#555568] hover:text-[#3b82f6] transition-colors font-mono mb-3 inline-block"
          >
            ← Back to Wagers
          </Link>
          <p className="text-xs uppercase tracking-widest text-[#555568] mb-2">
            TOP EARNERS
          </p>
          <h1 className="text-2xl font-bold text-[#f0f0f0]">
            Caller Tips Leaderboard
          </h1>
          <p className="text-[#c8c8d0] text-sm mt-2">
            Callers earn 10% of profits when people back their winning trades.
          </p>
        </div>

        {leaderboard.length === 0 ? (
          <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-8 text-center">
            <p className="text-sm text-[#555568]">No settled wagers yet</p>
            <p className="text-xs text-[#555568] mt-1">
              Be the first to{" "}
              <Link href="/feed" className="text-[#3b82f6] hover:underline">
                back a call
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Header */}
            <div className="grid grid-cols-[3rem_1fr_6rem_6rem] gap-2 text-[10px] uppercase tracking-widest text-[#555568] px-4 py-2 border-b border-[#1a1a2e]">
              <span>Rank</span>
              <span>Caller</span>
              <span className="text-right">Tips Earned</span>
              <span className="text-right">Backed Trades</span>
            </div>

            {leaderboard.map((entry, i) => {
              const rank = i + 1;
              const rankColors: Record<number, string> = {
                1: "text-[#f39c12]",
                2: "text-[#c8c8d0]",
                3: "text-[#cd7f32]",
              };
              const rankColor = rankColors[rank] ?? "text-[#555568]";

              return (
                <div
                  key={entry.author_handle}
                  className="grid grid-cols-[3rem_1fr_6rem_6rem] gap-2 items-center px-4 py-3 border-b border-[#1a1a2e] hover:bg-[#0f0f22] transition-colors"
                >
                  <span className={`font-bold font-mono ${rankColor}`}>
                    #{rank}
                  </span>
                  <Link
                    href={`/${entry.author_handle}`}
                    className="text-sm text-[#c8c8d0] hover:text-[#3b82f6] transition-colors font-mono truncate"
                  >
                    @{entry.author_handle}
                  </Link>
                  <span className="text-right text-sm font-bold text-[#2ecc71] font-mono">
                    ${formatUSDC(entry.total_tips)}
                  </span>
                  <span className="text-right text-xs text-[#555568] font-mono">
                    {entry.backed_trade_count} trade{entry.backed_trade_count !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
