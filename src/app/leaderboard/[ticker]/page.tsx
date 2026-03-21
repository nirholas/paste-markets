import type { Metadata } from "next";
import { Suspense } from "react";
import { TickerLeaderboardClient } from "./client";

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const t = decodeURIComponent(ticker).toUpperCase();
  return {
    title: `Best ${t} Callers — paste.markets`,
    description: `Who's the best ${t} caller on CT? Ranked by real P&L.`,
    openGraph: {
      title: `Best ${t} Callers — paste.markets`,
      description: `Top ${t} traders ranked by real P&L on Crypto Twitter.`,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function TickerLeaderboardPage({ params }: Props) {
  const { ticker } = await params;
  const t = decodeURIComponent(ticker).toUpperCase();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let initialEntries: import("@/components/leaderboard-table").LeaderboardRow[] = [];
  let popularTickers: string[] = [];

  try {
    const [entriesRes, tickersRes] = await Promise.all([
      fetch(`${baseUrl}/api/leaderboard?ticker=${encodeURIComponent(t)}&limit=25`, {
        cache: "no-store",
      }),
      fetch(`${baseUrl}/api/assets`, { next: { revalidate: 300 } }).catch(() => null),
    ]);

    if (entriesRes.ok) {
      const data = await entriesRes.json();
      initialEntries = data.entries ?? [];
    }

    if (tickersRes?.ok) {
      const data = await tickersRes.json();
      popularTickers = (data.assets ?? [])
        .slice(0, 12)
        .map((a: { ticker: string }) => a.ticker);
    }
  } catch (err) {
    console.error("[leaderboard/ticker] Failed to fetch:", err);
  }

  // Ensure current ticker is in the list
  if (!popularTickers.includes(t)) {
    popularTickers = [t, ...popularTickers.slice(0, 11)];
  }

  return (
    <Suspense fallback={null}>
      <TickerLeaderboardClient
        ticker={t}
        initialEntries={initialEntries}
        popularTickers={popularTickers}
      />
    </Suspense>
  );
}
