import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardClient } from "./client";

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let initialEntries: import("@/components/leaderboard-table").LeaderboardRow[] = [];

  try {
    const res = await fetch(
      `${baseUrl}/api/leaderboard?window=30d&limit=25`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = await res.json();
      initialEntries = (data.entries ?? []).map(
        (entry: {
          rank: number;
          handle: string;
          winRate: number;
          avgPnl: number;
          totalTrades: number;
          totalPnl: number;
          bestTicker: string;
          platform: string;
          avatarUrl: string | null;
        }) => ({
          rank: entry.rank,
          handle: entry.handle,
          winRate: entry.winRate,
          avgPnl: entry.avgPnl,
          totalTrades: entry.totalTrades,
          totalPnl: entry.totalPnl,
          bestTicker: entry.bestTicker,
          platform: entry.platform,
          avatarUrl: entry.avatarUrl,
        }),
      );
    } else {
      console.error(
        `[leaderboard/page] API responded ${res.status}`,
      );
    }
  } catch (err) {
    console.error("[leaderboard/page] Failed to fetch initial entries:", err);
  }

  return (
    <Suspense fallback={null}>
      <LeaderboardClient initialEntries={initialEntries} />
    </Suspense>
  );
}
