import type { Metadata } from "next";
import { Suspense } from "react";
import { CallersClient } from "./client";

export const metadata: Metadata = {
  title: "Discover Callers — paste.markets",
  description:
    "Find the best CT traders ranked by real P&L. Filter by asset, platform, and sort by win rate, total PnL, or activity.",
  openGraph: {
    title: "Discover Callers — paste.markets",
    description: "Find the best CT traders ranked by real P&L.",
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Discover Callers — paste.markets",
    images: ["/api/og/leaderboard"],
  },
};

export const dynamic = "force-dynamic";

export default async function CallersPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  type CallerCard = {
    rank: number;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    totalTrades: number;
    bestTicker: string | null;
    platform: string | null;
    alphaScore: number;
    tier: string;
  };

  let initialCallers: CallerCard[] = [];
  let initialTotal = 0;

  try {
    const res = await fetch(`${baseUrl}/api/callers?sort=win_rate&limit=48`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      initialCallers = data.callers ?? [];
      initialTotal = data.total ?? 0;
    }
  } catch (err) {
    console.error("[callers/page] Failed to fetch initial callers:", err);
  }

  return (
    <Suspense fallback={null}>
      <CallersClient
        initialCallers={initialCallers as Parameters<typeof CallersClient>[0]["initialCallers"]}
        initialTotal={initialTotal}
      />
    </Suspense>
  );
}
