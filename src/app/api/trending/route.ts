import { NextRequest, NextResponse } from "next/server";
import { fetchFeed } from "@/lib/upstream";
import { getTrending, getAuthorMetrics } from "@/lib/data";

export const dynamic = "force-dynamic";

let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const window = (searchParams.get("window") ?? "7d") as "24h" | "7d" | "30d" | "all";

  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
    });
  }

  try {
    // Primary: use paste.trade /api/feed?sort=top for trending trades
    const feedResult = await fetchFeed("top", 20, window);

    if (feedResult.items.length > 0) {
      const trending = feedResult.items.map((item, i) => {
        const author = item.author as Record<string, unknown>;
        const trades = item.trades as Record<string, unknown>[];
        const firstTrade = trades[0] ?? {};
        return {
          rank: i + 1,
          handle: author?.["handle"] ? String(author["handle"]) : "unknown",
          avatar_url: author?.["avatar_url"] ? String(author["avatar_url"]) : null,
          ticker: firstTrade["ticker"] ? String(firstTrade["ticker"]) : null,
          direction: firstTrade["direction"] ? String(firstTrade["direction"]) : null,
          pnl_pct: feedResult.pnls?.[String(firstTrade["trade_id"] ?? firstTrade["id"])] ?? null,
          trade_count: item.tradeCount,
          source_url: (item.source as Record<string, unknown>)?.["url"] ? String((item.source as Record<string, unknown>)["url"]) : null,
        };
      });

      const result = { trending, window, source: "paste.trade" };
      cache = { data: result, expiresAt: Date.now() + CACHE_TTL };

      return NextResponse.json(result, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" },
      });
    }

    // Fallback: local DB trending
    const handles = await getTrending();
    const trending: Array<{ handle: string; views: number; winRate: number }> = [];
    for (const handle of handles) {
      const metrics = await getAuthorMetrics(handle);
      trending.push({
        handle,
        views: 0,
        winRate: metrics?.winRate ?? 0,
      });
    }

    return NextResponse.json({ trending });
  } catch (err) {
    console.error("[api/trending] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
