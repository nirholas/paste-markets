import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LeaderboardClient } from "../../client";

const VALID_PLATFORMS = ["hyperliquid", "polymarket", "robinhood"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

const PLATFORM_META: Record<Platform, { title: string; description: string }> = {
  hyperliquid: {
    title: "Best Hyperliquid Callers on CT",
    description: "Who are the best perp traders on Crypto Twitter? Ranked by real P&L on Hyperliquid.",
  },
  polymarket: {
    title: "Best Polymarket Callers on CT",
    description: "Top prediction market callers on Crypto Twitter. Ranked by real P&L on Polymarket.",
  },
  robinhood: {
    title: "Best Equity Callers on CT",
    description: "Top stock and equity callers on Crypto Twitter. Ranked by real P&L.",
  },
};

interface Props {
  params: Promise<{ platform: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  if (!VALID_PLATFORMS.includes(platform as Platform)) return {};
  const meta = PLATFORM_META[platform as Platform];
  return {
    title: `${meta.title} -- paste.markets`,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      images: [{ url: `/api/og/leaderboard?platform=${platform}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      images: [`/api/og/leaderboard?platform=${platform}`],
    },
  };
}

export async function generateStaticParams() {
  return VALID_PLATFORMS.map((platform) => ({ platform }));
}

export const dynamic = "force-dynamic";

export default async function PlatformLeaderboardPage({ params }: Props) {
  const { platform } = await params;

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  let initialEntries: import("@/components/leaderboard-table").LeaderboardRow[] = [];

  try {
    const res = await fetch(
      `${baseUrl}/api/leaderboard?window=30d&limit=25&platform=${platform}`,
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
          totalPnl?: number;
          bestTicker?: string;
          platform?: string;
          avatarUrl?: string | null;
        }) => ({
          rank: entry.rank,
          handle: entry.handle,
          winRate: entry.winRate,
          avgPnl: entry.avgPnl,
          totalTrades: entry.totalTrades,
          totalPnl: entry.totalPnl,
          bestTicker: entry.bestTicker,
          platform: entry.platform,
          avatarUrl: entry.avatarUrl ?? null,
        }),
      );
    }
  } catch (err) {
    console.error(`[leaderboard/${platform}] Failed to fetch:`, err);
  }

  return (
    <Suspense fallback={null}>
      <LeaderboardClient initialEntries={initialEntries} initialPlatform={platform} />
    </Suspense>
  );
}
