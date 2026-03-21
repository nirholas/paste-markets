import { NextResponse } from "next/server";

const PASTE_TRADE_BASE = "https://paste.trade";

// ---------- Types ----------

export interface ConsensusCallerEntry {
  handle: string;
  winRate: number;
  avgPnl: number;
}

export interface ConsensusPlay {
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  callerCount: number;
  avgWinRate: number;
  avgEntryPrice: number | null;
  currentPnl: number | null;
  callers: ConsensusCallerEntry[];
}

export interface ConsensusResponse {
  plays: ConsensusPlay[];
  timeframe: "30d";
  updatedAt: string;
}

// ---------- Cache ----------

interface CacheEntry {
  data: ConsensusResponse;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------- Upstream Types ----------

interface UpstreamTrade {
  ticker: string;
  direction: string;
  author?: { handle: string };
  pnl_pct?: number | null;
  entry_price?: number | null;
}

interface UpstreamLeaderboardAuthor {
  author: { handle: string };
  stats: { win_rate: number; avg_pnl: number };
}

// ---------- Logic ----------

async function buildConsensus(): Promise<ConsensusResponse> {
  const key = process.env.PASTE_TRADE_KEY;
  if (!key) {
    console.error("[api/consensus] PASTE_TRADE_KEY is not set");
    return { plays: [], timeframe: "30d", updatedAt: new Date().toISOString() };
  }

  // 1. Fetch trades and leaderboard in parallel
  const [tradesRes, leaderboardRes] = await Promise.all([
    fetch(`${PASTE_TRADE_BASE}/api/trades?limit=200`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    }),
    fetch(`${PASTE_TRADE_BASE}/api/leaderboard?limit=50`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    }),
  ]);

  if (!tradesRes.ok) {
    const body = await tradesRes.text().catch(() => "");
    console.error(
      `[api/consensus] trades fetch failed ${tradesRes.status}: ${body}`,
    );
    return { plays: [], timeframe: "30d", updatedAt: new Date().toISOString() };
  }

  if (!leaderboardRes.ok) {
    const body = await leaderboardRes.text().catch(() => "");
    console.error(
      `[api/consensus] leaderboard fetch failed ${leaderboardRes.status}: ${body}`,
    );
    return { plays: [], timeframe: "30d", updatedAt: new Date().toISOString() };
  }

  const tradesData: { results?: UpstreamTrade[] } | UpstreamTrade[] =
    await tradesRes.json();
  const leaderboardData: {
    authors?: UpstreamLeaderboardAuthor[];
  } = await leaderboardRes.json();

  const trades: UpstreamTrade[] = Array.isArray(tradesData)
    ? tradesData
    : (tradesData as { results?: UpstreamTrade[] }).results ?? [];

  const leaderboardAuthors: UpstreamLeaderboardAuthor[] =
    leaderboardData.authors ?? [];

  // 2. Build winRate map: handle → win_rate
  const winRateMap = new Map<string, { winRate: number; avgPnl: number }>();
  for (const item of leaderboardAuthors) {
    winRateMap.set(item.author.handle, {
      winRate: item.stats.win_rate,
      avgPnl: item.stats.avg_pnl,
    });
  }

  // 3. Group trades by ticker:direction, tracking unique handles
  type GroupKey = string;
  interface TradeRecord {
    handle: string;
    entryPrice: number | null;
    pnlPct: number | null;
  }

  const groups = new Map<GroupKey, TradeRecord[]>();

  for (const trade of trades) {
    if (!trade.ticker || !trade.direction) continue;
    const handle = trade.author?.handle;
    if (!handle) continue;

    const key = `${trade.ticker.toUpperCase()}:${trade.direction}`;
    const existing = groups.get(key) ?? [];

    // One entry per unique handle per key
    const alreadyAdded = existing.some((r) => r.handle === handle);
    if (!alreadyAdded) {
      existing.push({
        handle,
        entryPrice: trade.entry_price ?? null,
        pnlPct: trade.pnl_pct ?? null,
      });
      groups.set(key, existing);
    }
  }

  // 4. Filter to groups with 2+ callers, compute stats
  const plays: ConsensusPlay[] = [];

  for (const [key, records] of groups.entries()) {
    if (records.length < 2) continue;

    const [ticker, direction] = key.split(":") as [string, string];
    const callerCount = records.length;

    // avgWinRate from winRate map, fall back to 0 if not in leaderboard
    const totalWR = records.reduce(
      (s, r) => s + (winRateMap.get(r.handle)?.winRate ?? 0),
      0,
    );
    const avgWinRate = totalWR / callerCount;

    const allEntries = records
      .map((r) => r.entryPrice)
      .filter((v): v is number => v !== null);
    const avgEntryPrice =
      allEntries.length > 0
        ? allEntries.reduce((s, v) => s + v, 0) / allEntries.length
        : null;

    const allPnls = records
      .map((r) => r.pnlPct)
      .filter((v): v is number => v !== null);
    const currentPnl =
      allPnls.length > 0
        ? allPnls.reduce((s, v) => s + v, 0) / allPnls.length
        : null;

    plays.push({
      ticker,
      direction: direction as ConsensusPlay["direction"],
      callerCount,
      avgWinRate,
      avgEntryPrice,
      currentPnl,
      callers: records.map((r) => ({
        handle: r.handle,
        winRate: winRateMap.get(r.handle)?.winRate ?? 0,
        avgPnl: winRateMap.get(r.handle)?.avgPnl ?? 0,
      })),
    });
  }

  // 5. Sort: callerCount DESC, then avgWinRate DESC
  plays.sort((a, b) => {
    if (b.callerCount !== a.callerCount) return b.callerCount - a.callerCount;
    return b.avgWinRate - a.avgWinRate;
  });

  return {
    plays: plays.slice(0, 10),
    timeframe: "30d",
    updatedAt: new Date().toISOString(),
  };
}

// ---------- Handler ----------

export const dynamic = "force-dynamic";

export async function GET() {
  // Serve from cache if fresh
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await buildConsensus();
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/consensus] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
