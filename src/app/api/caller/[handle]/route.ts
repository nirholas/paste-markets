import { NextRequest, NextResponse } from "next/server";
import {
  syncAuthor,
  isStale,
  getOrCreateAuthor,
  getAuthorMetrics,
  recordView,
  getTradesForReputation,
} from "@/lib/data";
import { searchFullTrades } from "@/lib/paste-trade";
import {
  calculateReputationScore,
  getCachedScore,
  setCachedScore,
} from "@/lib/reputation";

export const dynamic = "force-dynamic";

const PASTE_TRADE_BASE = "https://paste.trade";

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = cleanHandle(rawHandle);

    if (!handle) {
      return NextResponse.json({ error: "Missing handle" }, { status: 400 });
    }

    // Ensure author exists and sync if stale
    const author = await getOrCreateAuthor(handle);
    if (isStale(author.last_fetched)) {
      try {
        await syncAuthor(handle);
      } catch (err) {
        console.error(`[api/caller] sync failed for ${handle}:`, err);
      }
    }

    const metrics = await getAuthorMetrics(handle);
    if (!metrics || metrics.totalTrades === 0) {
      return NextResponse.json(
        { error: "No data for this caller", handle },
        { status: 404 },
      );
    }

    // Record view for trending
    await recordView(handle, "profile");

    // Re-read for rank after potential sync
    const refreshed = await getOrCreateAuthor(handle);

    // Fetch avatar + display name from full trade data (async, best-effort)
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
      // avatar is optional — silently skip
    }

    // Determine joinedAt: earliest trade date
    const allDates = metrics.recentTrades
      .map((t) => t.entry_date ?? t.posted_at ?? "")
      .filter(Boolean)
      .sort();
    const joinedAt = allDates[0] ?? refreshed.added_at;

    // Build streak shape
    const streakCount = Math.abs(metrics.streak);
    const currentStreak = {
      type: (metrics.streak >= 0 ? "W" : "L") as "W" | "L",
      count: streakCount,
    };

    // Best 5 trades sorted by PnL
    const best5 = [...metrics.recentTrades]
      .filter((t) => t.pnl_pct != null)
      .sort((a, b) => b.pnl_pct - a.pnl_pct)
      .slice(0, 5)
      .map((t) => ({
        ticker: t.ticker,
        direction: t.direction,
        pnl_pct: t.pnl_pct,
        platform: t.platform ?? null,
        entry_date: t.entry_date ?? t.posted_at ?? "",
        source_url: t.source_url ?? null,
      }));

    const recentTrades = metrics.recentTrades.map((t) => ({
      ticker: t.ticker,
      direction: t.direction,
      pnl_pct: t.pnl_pct,
      platform: t.platform ?? null,
      entry_date: t.entry_date ?? t.posted_at ?? "",
      source_url: t.source_url ?? null,
    }));

    // Reputation score — use cache or compute fresh
    let repScore = getCachedScore(handle);
    if (!repScore) {
      try {
        const repTrades = await getTradesForReputation(handle);
        repScore = calculateReputationScore(handle, repTrades);
        setCachedScore(handle, repScore);
      } catch {
        // score is optional — don't fail the whole request
      }
    }

    return NextResponse.json({
      handle,
      displayName: displayName ?? handle,
      avatarUrl,
      verified: false,
      bio: "",
      joinedAt,
      rank: refreshed.rank ?? null,
      stats: {
        totalCalls: metrics.totalTrades,
        winRate: metrics.winRate,
        avgPnlPercent: metrics.avgPnl,
        totalPnlPercent: metrics.totalPnl,
        bestTrade: metrics.bestTrade,
        worstTrade: metrics.worstTrade,
        currentStreak,
      },
      reputationScore: repScore?.score ?? null,
      reputationTier: repScore?.tier ?? null,
      reputationBreakdown: repScore?.breakdown ?? null,
      qualifyingCalls: repScore?.qualifyingCalls ?? null,
      topAssets: metrics.topAssets,
      recentTrades,
      best5Trades: best5,
      pnlHistory: metrics.pnlHistory,
      lastUpdated: refreshed.last_fetched ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/caller] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
