import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/data";
import { searchPasteTrade } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export interface FadeCaller {
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  rank: number;
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

  // Sort ascending by avg_pnl (worst performers first), filter to callers with 5+ trades
  const worst = [...leaderboard]
    .filter((e) => e.total_trades >= 5)
    .sort((a, b) => a.avg_pnl - b.avg_pnl)
    .slice(0, 15);

  // Fetch their most recent trade to show as the "fade play"
  const callers = await Promise.all(
    worst.map(async (entry, i): Promise<FadeCaller> => {
      let fadeTicker: string | null = null;
      let fadeDirection: FadeCaller["fadeDirection"] = null;
      let fadePostedAt: string | null = null;
      let fadeSourceUrl: string | null = null;
      let fadePnlPct: number | null = null;

      try {
        const trades = await searchPasteTrade({
          author: entry.handle,
          top: "7d",
          limit: 5,
        });
        if (trades.length > 0) {
          const latest = trades.sort(
            (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
          )[0]!;
          fadeTicker = latest.ticker;
          fadeDirection = latest.direction;
          fadePostedAt = latest.posted_at;
          fadeSourceUrl = latest.source_url ?? null;
          fadePnlPct = latest.pnlPct ?? null;
        }
      } catch {
        // ignore — just show caller without a live fade play
      }

      return {
        handle: entry.handle,
        winRate: entry.win_rate,
        avgPnl: entry.avg_pnl,
        totalTrades: entry.total_trades,
        rank: i + 1,
        fadeTicker,
        fadeDirection,
        fadePostedAt,
        fadeSourceUrl,
        fadePnlPct,
      };
    })
  );

  const data: FadeResponse = { callers, updatedAt: new Date().toISOString() };
  cache = { data, expiresAt: Date.now() + 10 * 60 * 1000 }; // 10min
  return data;
}

export async function GET() {
  const data = await buildFadeData();
  return NextResponse.json(data);
}
