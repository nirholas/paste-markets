/**
 * GET /v1/callers/[handle]
 *
 * Returns a caller's profile + aggregate stats.
 */

import { NextRequest } from "next/server";
import { authenticate } from "@/lib/api-auth";
import { okResponse, errorResponse } from "@/lib/v1-response";

export const dynamic = "force-dynamic";

const PASTE_TRADE_BASE = "https://paste.trade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return errorResponse(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { handle: rawHandle } = await params;
  const handle = rawHandle?.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return errorResponse("INVALID_PARAM", "Missing caller handle", 400, auth.rateLimitHeaders);
  }

  try {
    const { getOrCreateAuthor, getAuthorMetrics, syncAuthor, isStale } = await import("@/lib/data");
    const { searchFullTrades } = await import("@/lib/paste-trade");

    const author = await getOrCreateAuthor(handle);
    if (isStale(author.last_fetched)) {
      try {
        await syncAuthor(handle);
      } catch {
        // best-effort
      }
    }

    const metrics = await getAuthorMetrics(handle);
    if (!metrics || metrics.totalTrades === 0) {
      return errorResponse(
        "NOT_FOUND",
        `Caller "@${handle}" not found or has no tracked trades.`,
        404,
        auth.rateLimitHeaders,
      );
    }

    const refreshed = await getOrCreateAuthor(handle);

    // Best-effort avatar fetch
    let avatarUrl: string | null = null;
    let displayName: string | null = refreshed.display_name;
    try {
      const fullTrades = await searchFullTrades({ author: handle, top: "30d", limit: 3 });
      for (const t of fullTrades) {
        if (t.author_avatar_url) {
          const raw = t.author_avatar_url;
          avatarUrl = raw.startsWith("/") ? `${PASTE_TRADE_BASE}${raw}` : raw;
          break;
        }
      }
    } catch {
      // avatar is optional
    }

    const allDates = metrics.recentTrades
      .map((t) => t.entry_date ?? t.posted_at ?? "")
      .filter(Boolean)
      .sort();
    const joinedAt = allDates[0] ?? refreshed.added_at;
    const streakCount = Math.abs(metrics.streak);

    return okResponse(
      {
        handle,
        displayName: displayName ?? handle,
        avatarUrl,
        verified: false,
        joinedAt,
        rank: refreshed.rank ?? null,
        stats: {
          totalCalls: metrics.totalTrades,
          winRate: parseFloat(metrics.winRate.toFixed(1)),
          avgPnlPercent: parseFloat(metrics.avgPnl.toFixed(2)),
          totalPnlPercent: parseFloat(metrics.totalPnl.toFixed(2)),
          winCount: metrics.winCount,
          lossCount: metrics.lossCount,
          bestTrade: metrics.bestTrade,
          worstTrade: metrics.worstTrade,
          currentStreak: {
            type: (metrics.streak >= 0 ? "W" : "L") as "W" | "L",
            count: streakCount,
          },
          tradesByPlatform: metrics.tradesByPlatform,
        },
        topAssets: metrics.topAssets,
        pnlHistory: metrics.pnlHistory,
        lastUpdated: refreshed.last_fetched ?? new Date().toISOString(),
      },
      undefined,
      auth.rateLimitHeaders,
    );
  } catch (err) {
    console.error("[v1/callers/[handle]] Error:", err);
    return errorResponse("INTERNAL_ERROR", "Internal server error", 500, auth.rateLimitHeaders);
  }
}
