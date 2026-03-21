import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardClient } from "./client";
import { fetchLeaderboard } from "@/lib/upstream";
import { computeAlphaScore, callerTier } from "@/lib/alpha";

export const metadata: Metadata = {
  title: "CT Leaderboard -- paste.markets",
  description:
    "Real-time P&L rankings for Crypto Twitter traders. See who is actually making money on CT.",
  openGraph: {
    title: "CT Leaderboard -- paste.markets",
    description: "Real P&L rankings for Crypto Twitter traders.",
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CT Leaderboard -- paste.markets",
    images: ["/api/og/leaderboard"],
  },
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  let initialEntries: import("@/components/leaderboard-table").LeaderboardRow[] = [];

  try {
    const lbData = await fetchLeaderboard("30d", "win_rate", 25);
    initialEntries = lbData.authors.map((a, i) => {
      const alpha = computeAlphaScore(a.stats.win_rate, a.stats.avg_pnl, a.stats.trade_count);
      return {
        rank: i + 1,
        handle: a.author.handle,
        winRate: a.stats.win_rate,
        avgPnl: a.stats.avg_pnl,
        totalTrades: a.stats.trade_count,
        totalPnl: a.stats.total_pnl ?? 0,
        bestTicker: a.stats.best_ticker ?? "",
        platform: a.author.platform ?? "",
        avatarUrl: a.author.avatar_url ?? null,
        alphaScore: alpha,
        tier: callerTier(alpha),
      };
    });
  } catch (err) {
    console.error("[leaderboard/page] Failed to fetch initial entries:", err);
  }

  return (
    <Suspense fallback={null}>
      <LeaderboardClient initialEntries={initialEntries} />
    </Suspense>
  );
}
