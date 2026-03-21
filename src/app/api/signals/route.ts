import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/data";
import { searchPasteTrade, type PasteTradeTrade } from "@/lib/paste-trade";
import { fetchTrades } from "@/lib/upstream";
import { computeAlphaScore, callerTier, type CallerTier } from "@/lib/alpha";

export const dynamic = "force-dynamic";

export interface NetPositioning {
  long_pct: number;
  short_pct: number;
  total_signals: number;
  net_bias: "LONG" | "SHORT" | "NEUTRAL";
}

export interface HotStreak {
  author_handle: string;
  tier: CallerTier;
  alpha_score: number;
  streak: number;
  win_rate: number;
}

export interface SignalsResponse {
  smartCalls: SmartCallItem[];
  consensus: ConsensusItem[];
  fadeCalls: FadeCallItem[];
  netPositioning: NetPositioning;
  hotStreaks: HotStreak[];
  generatedAt: string;
}

export interface SmartCallItem {
  author_handle: string;
  tier: CallerTier;
  alpha_score: number;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  platform: string | null;
  posted_at: string | null;
  source_url: string | null;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
}

export interface ConsensusItem {
  ticker: string;
  direction: string;
  caller_count: number;
  avg_caller_win_rate: number;
  avg_pnl: number | null;
  latest_call: string;
  callers: string[];
  conviction: number; // alpha-weighted: sum of caller alpha scores
}

export interface FadeCallItem {
  author_handle: string;
  ticker: string;
  direction: string;
  fade_direction: string;
  pnl_pct: number | null;
  platform: string | null;
  posted_at: string | null;
  win_rate: number;
  total_trades: number;
}

function flipDirection(dir: string): string {
  if (dir === "long") return "short";
  if (dir === "short") return "long";
  if (dir === "yes") return "no";
  if (dir === "no") return "yes";
  return dir;
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ── Paste.trade API fallback ────────────────────────────────────────────────
// Used when SQLite DB is unavailable or empty (e.g., Vercel serverless).

const EMPTY_RESPONSE: SignalsResponse = {
  smartCalls: [],
  consensus: [],
  fadeCalls: [],
  netPositioning: { long_pct: 50, short_pct: 50, total_signals: 0, net_bias: "NEUTRAL" },
  hotStreaks: [],
  generatedAt: new Date().toISOString(),
};

async function buildFromApi(): Promise<SignalsResponse> {
  const leaderboard = await getLeaderboard("30d", 60, 0);
  if (leaderboard.length === 0) return { ...EMPTY_RESPONSE, generatedAt: new Date().toISOString() };

  // Compute alpha scores — the key differentiator from raw win rate
  const callerMeta = new Map(
    leaderboard.map((e) => {
      const alpha = computeAlphaScore(e.win_rate ?? 0, e.avg_pnl ?? 0, e.total_trades ?? 0);
      return [e.handle, {
        win_rate: e.win_rate ?? 0,
        avg_pnl: e.avg_pnl ?? 0,
        total_trades: e.total_trades ?? 0,
        alpha,
        tier: callerTier(alpha),
      }];
    }),
  );

  // Fetch recent trades in bulk from upstream /api/trades (single request)
  // then group by author — avoids 60+ individual /api/search calls
  const handleSet = new Set(leaderboard.map((e) => e.handle.toLowerCase()));
  let results: Array<{ handle: string; trades: PasteTradeTrade[] }> = [];

  try {
    const bulk = await fetchTrades(200);
    const byAuthor = new Map<string, PasteTradeTrade[]>();

    for (const raw of bulk.items) {
      const handle = String(raw.author_handle ?? "").toLowerCase();
      if (!handle || !handleSet.has(handle)) continue;

      const trade: PasteTradeTrade = {
        ticker: String(raw.ticker ?? ""),
        direction: (raw.direction ?? "long") as PasteTradeTrade["direction"],
        platform: raw.platform ?? undefined,
        pnlPct: raw.pnl_pct != null ? Number(raw.pnl_pct) : raw.pnlPct != null ? Number(raw.pnlPct) : undefined,
        posted_at: String(raw.posted_at ?? raw.created_at ?? new Date().toISOString()),
        source_url: raw.source_url ?? undefined,
        author_handle: handle,
      };

      const existing = byAuthor.get(handle) ?? [];
      existing.push(trade);
      byAuthor.set(handle, existing);
    }

    results = leaderboard.map((e) => ({
      handle: e.handle,
      trades: byAuthor.get(e.handle.toLowerCase()) ?? [],
    }));

    // For callers without trades in the bulk response, do targeted fetches
    const missingHandles = results.filter((r) => r.trades.length === 0).slice(0, 15);
    if (missingHandles.length > 0) {
      const fillTasks = missingHandles.map(
        (entry) => async () => {
          try {
            const trades = await searchPasteTrade({ author: entry.handle, top: "7d", limit: 25 });
            entry.trades = trades;
          } catch {
            // leave empty
          }
        },
      );
      await runWithConcurrency(fillTasks, 10);
    }
  } catch {
    // Full fallback: N+1 approach if bulk fails
    const tasks = leaderboard.map(
      (entry) => async (): Promise<{ handle: string; trades: PasteTradeTrade[] }> => {
        try {
          const trades = await searchPasteTrade({ author: entry.handle, top: "7d", limit: 25 });
          return { handle: entry.handle, trades };
        } catch {
          return { handle: entry.handle, trades: [] };
        }
      },
    );
    results = await runWithConcurrency(tasks, 10);
  }

  const smartCalls: SmartCallItem[] = [];
  const consensusMap = new Map<string, {
    direction: string;
    callers: string[];
    alphaSum: number;
    pnlSum: number;
    pnlCount: number;
    winRateSum: number;
    latestCall: string;
  }>();
  const fadeCalls: FadeCallItem[] = [];
  const hotStreaks: HotStreak[] = [];
  let longCount = 0;
  let shortCount = 0;

  for (const { handle, trades } of results) {
    const meta = callerMeta.get(handle);
    if (!meta) continue;

    const sorted = [...trades].sort(
      (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
    );

    for (const trade of trades) {
      const ticker = trade.ticker?.toUpperCase();
      if (!ticker) continue;
      const dir = trade.direction === "yes" ? "long" : trade.direction === "no" ? "short" : trade.direction;

      // Net positioning: all S/A-tier trades this week
      if (meta.tier === "S" || meta.tier === "A") {
        if (dir === "long") longCount++;
        else shortCount++;
      }

      // Smart calls: S/A tier only
      if (meta.tier === "S" || meta.tier === "A") {
        smartCalls.push({
          author_handle: handle,
          tier: meta.tier,
          alpha_score: meta.alpha,
          ticker,
          direction: dir,
          pnl_pct: trade.pnlPct ?? null,
          platform: trade.platform ?? null,
          posted_at: trade.posted_at,
          source_url: trade.source_url ?? null,
          win_rate: meta.win_rate,
          avg_pnl: meta.avg_pnl,
          total_trades: meta.total_trades,
        });
      }

      // Consensus: all callers with min alpha (B tier+)
      if (meta.alpha >= 30 && meta.total_trades >= 5) {
        const key = `${ticker}:${dir}`;
        const entry = consensusMap.get(key) ?? {
          direction: dir, callers: [], alphaSum: 0,
          pnlSum: 0, pnlCount: 0, winRateSum: 0, latestCall: trade.posted_at,
        };
        if (!entry.callers.includes(handle)) {
          entry.callers.push(handle);
          entry.alphaSum += meta.alpha;
          entry.winRateSum += meta.win_rate;
          if (trade.pnlPct != null) { entry.pnlSum += trade.pnlPct; entry.pnlCount++; }
          if (trade.posted_at > entry.latestCall) entry.latestCall = trade.posted_at;
          consensusMap.set(key, entry);
        }
      }

      // Fade: bad callers
      if (meta.win_rate <= 38 && meta.total_trades >= 8) {
        fadeCalls.push({
          author_handle: handle, ticker, direction: dir,
          fade_direction: flipDirection(dir),
          pnl_pct: trade.pnlPct ?? null,
          platform: trade.platform ?? null,
          posted_at: trade.posted_at,
          win_rate: meta.win_rate, total_trades: meta.total_trades,
        });
      }
    }

    // Hot streaks: consecutive wins from most recent trades
    const withPnl = sorted.filter((t) => t.pnlPct != null);
    if (withPnl.length >= 3 && (meta.tier === "S" || meta.tier === "A")) {
      let streak = 0;
      for (const t of withPnl) {
        if ((t.pnlPct ?? 0) > 0) streak++;
        else break;
      }
      if (streak >= 3) {
        hotStreaks.push({
          author_handle: handle, tier: meta.tier,
          alpha_score: meta.alpha, streak, win_rate: meta.win_rate,
        });
      }
    }
  }

  // Consensus
  const consensus: ConsensusItem[] = [];
  for (const [key, entry] of consensusMap.entries()) {
    if (entry.callers.length < 2) continue;
    const [ticker] = key.split(":");
    const avgWR = entry.winRateSum / entry.callers.length;
    consensus.push({
      ticker: ticker!,
      direction: entry.direction,
      caller_count: entry.callers.length,
      avg_caller_win_rate: avgWR,
      avg_pnl: entry.pnlCount > 0 ? entry.pnlSum / entry.pnlCount : null,
      latest_call: entry.latestCall,
      callers: entry.callers,
      conviction: Math.round(entry.alphaSum), // alpha-weighted
    });
  }
  consensus.sort((a, b) =>
    b.caller_count !== a.caller_count ? b.caller_count - a.caller_count : b.conviction - a.conviction,
  );

  // Dedup smart calls by handle+ticker, sort by alpha then recency
  const seenSmart = new Set<string>();
  const dedupedSmart: SmartCallItem[] = [];
  for (const c of smartCalls.sort((a, b) => b.alpha_score - a.alpha_score)) {
    const k = `${c.author_handle}|${c.ticker}`;
    if (!seenSmart.has(k)) { seenSmart.add(k); dedupedSmart.push(c); }
  }

  // Dedup fades
  const seenFade = new Set<string>();
  const dedupedFade: FadeCallItem[] = [];
  for (const c of fadeCalls.sort((a, b) => a.win_rate - b.win_rate)) {
    const k = `${c.author_handle}|${c.ticker}`;
    if (!seenFade.has(k)) { seenFade.add(k); dedupedFade.push(c); }
  }

  // Net positioning
  const totalSignals = longCount + shortCount;
  const longPct = totalSignals > 0 ? Math.round((longCount / totalSignals) * 100) : 50;
  const net_bias: NetPositioning["net_bias"] =
    longPct >= 60 ? "LONG" : longPct <= 40 ? "SHORT" : "NEUTRAL";

  hotStreaks.sort((a, b) => b.streak - a.streak || b.alpha_score - a.alpha_score);

  return {
    smartCalls: dedupedSmart.slice(0, 25),
    consensus: consensus.slice(0, 12),
    fadeCalls: dedupedFade.slice(0, 10),
    netPositioning: { long_pct: longPct, short_pct: 100 - longPct, total_signals: totalSignals, net_bias },
    hotStreaks: hotStreaks.slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}

// ── Module-level cache ───────────────────────────────────────────────────────
let signalsCache: { data: SignalsResponse; expiresAt: number } | null = null;

export async function GET() {
  try {
    if (signalsCache && Date.now() < signalsCache.expiresAt) {
      return NextResponse.json(signalsCache.data);
    }
    const result = await buildFromApi();
    signalsCache = { data: result, expiresAt: Date.now() + 5 * 60 * 1000 };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/signals] error:", err);
    const empty: SignalsResponse = {
      smartCalls: [],
      consensus: [],
      fadeCalls: [],
      netPositioning: { long_pct: 50, short_pct: 50, total_signals: 0, net_bias: "NEUTRAL" },
      hotStreaks: [],
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(empty satisfies SignalsResponse);
  }
}
