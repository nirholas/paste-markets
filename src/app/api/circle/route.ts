import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeAlphaScore, callerTier } from "@/lib/alpha";
import type { CallerTier } from "@/lib/alpha";

export const dynamic = "force-dynamic";

const VALID_TIMEFRAMES = new Set(["7d", "30d", "all"]);
const DEFAULT_TIMEFRAME = "30d";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface CircleCaller {
  rank: number;
  handle: string;
  avatarUrl: string | null;
  winRate: number;
  totalTrades: number;
  avgPnl: number;
  totalPnl: number;
  alphaScore: number;
  tier: CallerTier;
  ring: "inner" | "middle" | "outer";
}

function assignRing(rank: number): "inner" | "middle" | "outer" {
  if (rank <= 5) return "inner";
  if (rank <= 15) return "middle";
  return "outer";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const timeframeRaw =
    searchParams.get("timeframe") ?? searchParams.get("window") ?? DEFAULT_TIMEFRAME;
  const timeframe = VALID_TIMEFRAMES.has(timeframeRaw) ? timeframeRaw : DEFAULT_TIMEFRAME;

  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  try {
    const { fetchLeaderboard } = await import("@/lib/upstream");
    const data = await fetchLeaderboard(timeframe, "win_rate", limit);

    const callers: CircleCaller[] = data.authors.map((item, i) => {
      const rank = i + 1;
      const alpha = computeAlphaScore(
        item.stats.win_rate,
        item.stats.avg_pnl,
        item.stats.trade_count,
      );
      const rawAvatar = item.author.avatar_url;
      const avatarUrl =
        rawAvatar && rawAvatar.startsWith("/")
          ? `https://paste.trade${rawAvatar}`
          : rawAvatar || null;

      return {
        rank,
        handle: item.author.handle,
        avatarUrl,
        winRate: item.stats.win_rate,
        totalTrades: item.stats.trade_count,
        avgPnl: item.stats.avg_pnl,
        totalPnl: item.stats.total_pnl,
        alphaScore: alpha,
        tier: callerTier(alpha),
        ring: assignRing(rank),
      };
    });

    const response = NextResponse.json({
      callers,
      total: callers.length,
      timeframe,
      updatedAt: data.computed_at,
    });

    response.headers.set("Cache-Control", "s-maxage=120, stale-while-revalidate=60");
    return response;
  } catch (err) {
    console.error("[api/circle] Error:", err);
    return NextResponse.json({ error: "Failed to fetch circle data" }, { status: 500 });
  }
}
