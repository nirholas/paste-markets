/**
 * /api/alpha — EV-scored, quality-filtered live trade feed.
 *
 * The intelligence layer on top of paste.trade:
 *   EV = (win_rate / 100) × avg_pnl
 *
 * Only surfaces callers from the paste.trade leaderboard (validated track records).
 * Sorts by EV descending so the highest-conviction signals appear first.
 * Flags consensus when 2+ callers share the same ticker+direction.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchLeaderboard, fetchTrades } from "@/lib/upstream";

export const dynamic = "force-dynamic";

const PASTE_BASE = "https://paste.trade";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export type Tier = "ELITE" | "SMART" | "TRACKED";

export interface AlphaTrade {
  id: string;
  handle: string;
  avatarUrl: string | null;
  ticker: string;
  direction: "long" | "short" | "yes" | "no";
  platform: string | null;
  instrument: string | null;
  postedAt: string;
  sourceUrl: string | null;
  headlineQuote: string | null;
  thesis: string | null;
  // Caller quality
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  evScore: number; // (winRate / 100) * avgPnl
  tier: Tier;
  // Outcome
  pnlPct: number | null;
  entryPrice: number | null;
  // Consensus
  consensusCount: number; // callers who share ticker+direction (excluding self)
  consensusHandles: string[];
}

export interface AlphaResponse {
  trades: AlphaTrade[];
  total: number;
  updatedAt: string;
}

// ---------- Cache ----------
let cache: { data: AlphaResponse; expiresAt: number } | null = null;

// ---------- Helpers ----------

function fixUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return `${PASTE_BASE}${url}`;
  return url;
}

function toTier(winRate: number): Tier {
  if (winRate >= 65) return "ELITE";
  if (winRate >= 55) return "SMART";
  return "TRACKED";
}

function computeEv(winRate: number, avgPnl: number): number {
  return parseFloat(((winRate / 100) * avgPnl).toFixed(2));
}

type Direction = "long" | "short" | "yes" | "no";

function toDirection(raw: string): Direction {
  if (raw === "long" || raw === "short" || raw === "yes" || raw === "no") return raw;
  return "long";
}

// ---------- Build ----------

interface LeaderboardAuthor {
  rank: number;
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  avatarUrl: string | null;
}

interface RawFeedItem {
  id?: unknown;
  ticker?: unknown;
  direction?: unknown;
  platform?: unknown;
  instrument?: unknown;
  author_handle?: unknown;
  author_avatar_url?: unknown;
  headline_quote?: unknown;
  thesis?: unknown;
  source_url?: unknown;
  created_at?: unknown;
  pnl_pct?: unknown;
  entry_price?: unknown;
  pnlPct?: unknown;
  entryPrice?: unknown;
}

async function buildAlpha(): Promise<AlphaResponse> {
  // Fetch leaderboard + live feed in parallel
  const [lbData, feedData] = await Promise.all([
    fetchLeaderboard("30d", "win_rate", 100),
    fetchTrades(100),
  ]);

  // Build caller quality map: handle → { winRate, avgPnl, totalTrades, avatarUrl }
  const callerMap = new Map<string, Omit<LeaderboardAuthor, "rank" | "handle">>();

  for (const item of lbData.authors) {
    const rawAvatar = item.author?.avatar_url;
    callerMap.set(item.author.handle, {
      winRate: item.stats.win_rate ?? 0,
      avgPnl: item.stats.avg_pnl ?? 0,
      totalTrades: item.stats.trade_count ?? 0,
      avatarUrl: fixUrl(rawAvatar),
    });
  }

  // Parse feed items — only keep callers in leaderboard
  const rawItems: RawFeedItem[] = feedData.items as RawFeedItem[];

  const enriched: Array<Omit<AlphaTrade, "consensusCount" | "consensusHandles">> = [];

  for (const raw of rawItems) {
    const handle = String(raw.author_handle ?? "");
    if (!handle) continue;

    const caller = callerMap.get(handle);
    if (!caller) continue; // skip unvalidated callers
    if (caller.totalTrades < 3) continue; // require minimum track record

    const ticker = String(raw.ticker ?? "").toUpperCase();
    if (!ticker) continue;

    const direction = toDirection(String(raw.direction ?? "long"));
    const evScore = computeEv(caller.winRate, caller.avgPnl);

    const pnlRaw = raw.pnl_pct ?? raw.pnlPct;
    const entryRaw = raw.entry_price ?? raw.entryPrice;

    enriched.push({
      id: String(raw.id ?? Math.random()),
      handle,
      avatarUrl: fixUrl(raw.author_avatar_url as string | null) ?? caller.avatarUrl,
      ticker,
      direction,
      platform: raw.platform != null ? String(raw.platform) : null,
      instrument: raw.instrument != null ? String(raw.instrument) : null,
      postedAt: String(raw.created_at ?? new Date().toISOString()),
      sourceUrl: raw.source_url != null ? String(raw.source_url) : null,
      headlineQuote: raw.headline_quote != null ? String(raw.headline_quote) : null,
      thesis: raw.thesis != null ? String(raw.thesis) : null,
      winRate: caller.winRate,
      avgPnl: caller.avgPnl,
      totalTrades: caller.totalTrades,
      evScore,
      tier: toTier(caller.winRate),
      pnlPct: pnlRaw != null && !isNaN(Number(pnlRaw)) ? Number(pnlRaw) : null,
      entryPrice: entryRaw != null && !isNaN(Number(entryRaw)) ? Number(entryRaw) : null,
    });
  }

  // Dedup: one entry per handle+ticker+direction (keep highest-EV one)
  const seen = new Map<string, (typeof enriched)[0]>();
  for (const trade of enriched) {
    const key = `${trade.handle}:${trade.ticker}:${trade.direction}`;
    const existing = seen.get(key);
    if (!existing || trade.evScore > existing.evScore) {
      seen.set(key, trade);
    }
  }

  const deduped = Array.from(seen.values());

  // Build consensus map: ticker+direction → [handles]
  const consensusMap = new Map<string, string[]>();
  for (const trade of deduped) {
    const ck = `${trade.ticker}:${trade.direction}`;
    const arr = consensusMap.get(ck) ?? [];
    arr.push(trade.handle);
    consensusMap.set(ck, arr);
  }

  // Add consensus info + sort by EV
  const trades: AlphaTrade[] = deduped
    .map((trade) => {
      const ck = `${trade.ticker}:${trade.direction}`;
      const peers = (consensusMap.get(ck) ?? []).filter((h) => h !== trade.handle);
      return { ...trade, consensusCount: peers.length, consensusHandles: peers };
    })
    .sort((a, b) => b.evScore - a.evScore);

  return {
    trades,
    total: trades.length,
    updatedAt: new Date().toISOString(),
  };
}

// ---------- Handler ----------

export async function GET(request: NextRequest) {
  if (cache && Date.now() < cache.expiresAt) {
    const { searchParams } = request.nextUrl;
    return filterAndReturn(cache.data, searchParams);
  }

  try {
    const data = await buildAlpha();
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    const { searchParams } = request.nextUrl;
    return filterAndReturn(data, searchParams);
  } catch (err) {
    console.error("[api/alpha] error:", err);
    return NextResponse.json({ trades: [], total: 0, updatedAt: new Date().toISOString() });
  }
}

function filterAndReturn(data: AlphaResponse, searchParams: URLSearchParams): NextResponse {
  let trades = data.trades;

  // ?tier=elite|smart|all
  const tier = (searchParams.get("tier") ?? "all").toLowerCase();
  if (tier === "elite") {
    trades = trades.filter((t) => t.tier === "ELITE");
  } else if (tier === "smart") {
    trades = trades.filter((t) => t.tier === "ELITE" || t.tier === "SMART");
  }

  // ?minEV=0.05
  const minEV = parseFloat(searchParams.get("minEV") ?? "0");
  if (!isNaN(minEV) && minEV > 0) {
    trades = trades.filter((t) => t.evScore >= minEV);
  }

  // ?consensus=1 — only show trades with 1+ other callers agreeing
  if (searchParams.get("consensus") === "1") {
    trades = trades.filter((t) => t.consensusCount > 0);
  }

  // ?limit=N
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(1, rawLimit), 100);
  trades = trades.slice(0, limit);

  return NextResponse.json({
    trades,
    total: trades.length,
    updatedAt: data.updatedAt,
  });
}
