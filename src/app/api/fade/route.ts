import { NextResponse } from "next/server";
import { getLeaderboard, getAuthorMetrics } from "@/lib/data";
import { computeFadeScore, type FadeStats } from "@/lib/metrics";
import { searchPasteTrade } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export interface FadeCaller {
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  rank: number;
  // Fade metrics
  fadeWinRate: number;
  fadeAvgPnl: number;
  fadeTotalPnl: number;
  fadeRating: FadeStats["fadeRating"];
  isProfitableFade: boolean;
  // Most recent open/active call to fade
  fadeTicker: string | null;
  fadeDirection: "long" | "short" | "yes" | "no" | null;
  fadePostedAt: string | null;
  fadeSourceUrl: string | null;
  fadePnlPct: number | null;
}

export interface FadeResponse {
  callers: FadeCaller[];
  updatedAt: string;
}

let cache: { data: FadeResponse; expiresAt: number } | null = null;

async function buildFadeData(): Promise<FadeResponse> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  // Get the full leaderboard, then reverse-sort for the fade board
  const leaderboard = await getLeaderboard("30d", 100, 0);

  if (leaderboard.length === 0) {
    return { callers: [], updatedAt: new Date().toISOString() };
  }

  // Filter to callers with 5+ trades
  const qualified = leaderboard.filter((e) => e.total_trades >= 5);

  // For each caller, compute fade score from their actual trades
  const callersWithFade = await Promise.all(
    qualified.map(async (entry) => {
      const metrics = await getAuthorMetrics(entry.handle);
      const trades = metrics?.recentTrades ?? [];
      const fadeScore = computeFadeScore(trades);

      // Fetch most recent trade for the fade play suggestion
      let fadeTicker: string | null = null;
      let fadeDirection: FadeCaller["fadeDirection"] = null;
      let fadePostedAt: string | null = null;
      let fadeSourceUrl: string | null = null;
      let fadePnlPct: number | null = null;

      try {
        const recentTrades = await searchPasteTrade({
          author: entry.handle,
          top: "7d",
          limit: 5,
        });
        if (recentTrades.length > 0) {
          const latest = recentTrades.sort(
            (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
          )[0]!;
          fadeTicker = latest.ticker;
          fadeDirection = latest.direction;
          fadePostedAt = latest.posted_at;
          fadeSourceUrl = latest.source_url ?? null;
          fadePnlPct = latest.pnlPct ?? null;
        }
      } catch {
        // ignore
      }

      return {
        handle: entry.handle,
        winRate: entry.win_rate,
        avgPnl: entry.avg_pnl,
        totalTrades: entry.total_trades,
        fadeWinRate: fadeScore.fadeWinRate,
        fadeAvgPnl: fadeScore.fadeAvgPnl,
        fadeTotalPnl: fadeScore.fadeTotalPnl,
        fadeRating: fadeScore.fadeRating,
        isProfitableFade: fadeScore.isProfitableFade,
        fadeTicker,
        fadeDirection,
        fadePostedAt,
        fadeSourceUrl,
        fadePnlPct,
      };
    })
  );

  // Sort by fade profitability: fade avg pnl descending (best fades first)
  const sorted = callersWithFade
    .sort((a, b) => b.fadeAvgPnl - a.fadeAvgPnl)
    .slice(0, 25)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const data: FadeResponse = { callers: sorted, updatedAt: new Date().toISOString() };
  cache = { data, expiresAt: Date.now() + 10 * 60 * 1000 }; // 10min
  return data;
}

export async function GET() {
  const data = await buildFadeData();
  return NextResponse.json(data);
}
