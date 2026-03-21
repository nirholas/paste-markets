import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { computeAlphaScore, callerTier } from "@/lib/alpha";

export const dynamic = "force-dynamic";

const PASTE_TRADE_BASE = "https://paste.trade";
const VALID_WINDOWS = new Set(["7d", "30d", "all"]);
const VALID_SORTS = new Set(["avg_pnl", "win_rate", "total_trades"]);
const VALID_PLATFORMS = new Set(["all", "hyperliquid", "polymarket", "robinhood"]);
const DEFAULT_WINDOW = "30d";
const DEFAULT_SORT = "win_rate";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const useSqlite = process.env["USE_SQLITE"] !== "false";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Accept both "window" and "timeframe" for backwards compatibility
  const windowRaw = searchParams.get("window") ?? searchParams.get("timeframe") ?? DEFAULT_WINDOW;
  const window = VALID_WINDOWS.has(windowRaw) ? windowRaw : DEFAULT_WINDOW;

  const sort = VALID_SORTS.has(searchParams.get("sort") ?? "")
    ? (searchParams.get("sort") as string)
    : DEFAULT_SORT;

  const limitRaw = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(limitRaw) ? DEFAULT_LIMIT : Math.min(Math.max(1, limitRaw), MAX_LIMIT);

  const platformRaw = (searchParams.get("platform") ?? "all").toLowerCase();
  const platform = VALID_PLATFORMS.has(platformRaw) ? platformRaw : "all";

  // ── SQLite mode (Railway / persistent disk) ──────────────────────────────
  if (useSqlite) {
    try {
      const { getLeaderboard } = await import("@/lib/data");

      let entries = await getLeaderboard(window, limit, 0, platform);

      // Auto-seed on first visit if leaderboard is empty
      if (entries.length === 0) {
        console.log("[api/leaderboard] Leaderboard empty — triggering seed sync...");
        const { seedFromApi } = await import("@/lib/seed-from-api");
        await seedFromApi();
        entries = await getLeaderboard(window, limit, 0, platform);
      }

      // Sort entries per requested sort param
      if (sort === "avg_pnl") {
        entries = [...entries].sort((a, b) => b.avg_pnl - a.avg_pnl);
      } else if (sort === "total_trades") {
        entries = [...entries].sort((a, b) => b.total_trades - a.total_trades);
      }
      // win_rate is already the default sort from getLeaderboard

      const mapped = entries.map((e, i) => {
        const alpha = computeAlphaScore(e.win_rate, e.avg_pnl, e.total_trades);
        return {
          rank: i + 1,
          handle: e.handle,
          winRate: e.win_rate,
          avgPnl: e.avg_pnl,
          totalTrades: e.total_trades,
          totalPnl: null as number | null,
          bestTicker: null as string | null,
          platform: platform !== "all" ? platform : null,
          avatarUrl: null as string | null,
          alphaScore: alpha,
          tier: callerTier(alpha),
        };
      });

      const response = NextResponse.json({
        entries: mapped,
        total: mapped.length,
        window,
        sort,
        platform,
        updatedAt: new Date().toISOString(),
      });

      response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return response;
    } catch (err) {
      console.error("[api/leaderboard] SQLite mode error:", err);
      // Fall through to paste.trade proxy on error
    }
  }

  // ── Serverless / proxy mode ──────────────────────────────────────────────
  const key = process.env.PASTE_TRADE_KEY;
  if (!key) {
    console.error("[api/leaderboard] PASTE_TRADE_KEY is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const upstream = new URL(`${PASTE_TRADE_BASE}/api/leaderboard`);
  upstream.searchParams.set("window", window);
  upstream.searchParams.set("sort", sort);
  upstream.searchParams.set("limit", String(limit));

  let upstreamData: {
    window: string;
    sort: string;
    computed_at: string;
    authors: Array<{
      rank: number;
      author: {
        handle: string;
        name: string | null;
        avatar_url: string;
        platform: string;
      };
      stats: {
        trade_count: number;
        avg_pnl: number;
        win_rate: number;
        best_pnl: number;
        best_ticker: string;
        total_pnl: number;
      };
    }>;
  };

  try {
    const res = await fetch(upstream.toString(), {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[api/leaderboard] paste.trade responded ${res.status}: ${body}`,
      );
      return NextResponse.json(
        { error: "Upstream error", status: res.status },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    upstreamData = await res.json();
  } catch (err) {
    console.error("[api/leaderboard] Fetch failed:", err);
    return NextResponse.json({ error: "Upstream unreachable" }, { status: 502 });
  }

  let allEntries = upstreamData.authors.map((item) => {
    const rawAvatar = item.author.avatar_url;
    const avatarUrl =
      rawAvatar && rawAvatar.startsWith("/")
        ? `${PASTE_TRADE_BASE}${rawAvatar}`
        : rawAvatar || null;

    const alpha = computeAlphaScore(item.stats.win_rate, item.stats.avg_pnl, item.stats.trade_count);
    return {
      rank: item.rank,
      handle: item.author.handle,
      winRate: item.stats.win_rate,
      avgPnl: item.stats.avg_pnl,
      totalTrades: item.stats.trade_count,
      totalPnl: item.stats.total_pnl,
      bestTicker: item.stats.best_ticker,
      platform: item.author.platform,
      avatarUrl,
      alphaScore: alpha,
      tier: callerTier(alpha),
    };
  });

  // Platform filter — recompute per-platform metrics for each author
  if (platform !== "all") {
    const { searchPasteTrade } = await import("@/lib/paste-trade");
    const { computeMetrics } = await import("@/lib/metrics");

    const tf = (window === "7d" ? "7d" : window === "all" ? "all" : "30d") as
      | "7d" | "30d" | "90d" | "all";

    const filtered = await Promise.all(
      allEntries.map(async (entry) => {
        try {
          const trades = await searchPasteTrade({ author: entry.handle, top: tf, limit: 100 });
          const platTrades = trades.filter(
            (t) => t.platform?.toLowerCase() === platform,
          );
          if (platTrades.length < 2) return null;
          const summaries = platTrades.map((t) => ({
            ticker: t.ticker,
            direction: t.direction,
            pnl_pct: t.pnlPct ?? 0,
            platform: t.platform,
            entry_date: t.author_date,
            posted_at: t.posted_at,
          }));
          const m = computeMetrics(entry.handle, summaries);
          const alpha = computeAlphaScore(m.winRate, m.avgPnl, m.totalTrades);
          return { ...entry, winRate: m.winRate, avgPnl: m.avgPnl, totalTrades: m.totalTrades, alphaScore: alpha, tier: callerTier(alpha) };
        } catch {
          return null;
        }
      }),
    );

    allEntries = filtered
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => b.winRate - a.winRate)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }

  const response = NextResponse.json({
    entries: allEntries,
    total: allEntries.length,
    window: upstreamData.window,
    sort: upstreamData.sort,
    platform,
    updatedAt: upstreamData.computed_at,
  });

  response.headers.set(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=30",
  );

  return response;
}
