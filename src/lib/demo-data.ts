/**
 * Deterministic demo data generator for author profiles.
 * Used as a fallback when both the upstream API and local DB are unavailable.
 * Generates realistic-looking data seeded from the handle name.
 */

import type { AuthorMetrics, TradeSummary, TopAsset, PnlPoint } from "./metrics";

// Simple deterministic hash from a string
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Seeded pseudo-random number generator (Mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TICKERS = [
  "BTC", "ETH", "SOL", "DOGE", "AAPL", "TSLA", "NVDA", "SPY",
  "AVAX", "LINK", "ARB", "OP", "PEPE", "WIF", "JUP", "ONDO",
  "AMZN", "GOOGL", "META", "AMD",
];

const PLATFORMS = ["hyperliquid", "robinhood", "polymarket", "binance"];

export function generateDemoMetrics(handle: string): AuthorMetrics {
  const seed = hashCode(handle);
  const rand = mulberry32(seed);

  const totalTrades = 15 + Math.floor(rand() * 40); // 15-54 trades
  const winRate = 42 + rand() * 30; // 42-72%
  const winCount = Math.round((winRate / 100) * totalTrades);
  const lossCount = totalTrades - winCount;

  // Generate individual trades
  const trades: TradeSummary[] = [];
  const now = Date.now();

  for (let i = 0; i < totalTrades; i++) {
    const tickerIdx = Math.floor(rand() * TICKERS.length);
    const ticker = TICKERS[tickerIdx]!;
    const direction = rand() > 0.3 ? "long" : "short";
    const platform = PLATFORMS[Math.floor(rand() * PLATFORMS.length)]!;

    // Bias PnL based on win rate
    const isWin = rand() < winRate / 100;
    let pnl: number;
    if (isWin) {
      pnl = 2 + rand() * 45; // +2% to +47%
    } else {
      pnl = -(1 + rand() * 30); // -1% to -31%
    }
    pnl = parseFloat(pnl.toFixed(1));

    // Spread trades over last 90 days
    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(now - daysAgo * 86400000).toISOString().split("T")[0]!;

    trades.push({
      ticker,
      direction,
      pnl_pct: pnl,
      platform,
      entry_date: date,
      posted_at: date,
    });
  }

  // Sort by date descending
  trades.sort((a, b) => (b.entry_date ?? "").localeCompare(a.entry_date ?? ""));

  const withPnl = trades.filter((t) => t.pnl_pct != null);
  const avgPnl = parseFloat(
    (withPnl.reduce((sum, t) => sum + t.pnl_pct, 0) / withPnl.length).toFixed(1),
  );
  const totalPnl = parseFloat(withPnl.reduce((sum, t) => sum + t.pnl_pct, 0).toFixed(1));

  // Best / worst
  const sorted = [...withPnl].sort((a, b) => b.pnl_pct - a.pnl_pct);
  const bestT = sorted[0]!;
  const worstT = sorted[sorted.length - 1]!;

  const bestTrade = {
    ticker: bestT.ticker,
    direction: bestT.direction,
    pnl: bestT.pnl_pct,
    date: bestT.entry_date ?? "",
  };
  const worstTrade = {
    ticker: worstT.ticker,
    direction: worstT.direction,
    pnl: worstT.pnl_pct,
    date: worstT.entry_date ?? "",
  };

  // Streak
  let streak = 0;
  if (trades.length > 0) {
    const isWinning = trades[0]!.pnl_pct > 0;
    for (const t of trades) {
      if ((t.pnl_pct > 0) === isWinning) streak++;
      else break;
    }
    if (!isWinning) streak = -streak;
  }

  // Platform breakdown
  const tradesByPlatform: Record<string, number> = {};
  for (const t of trades) {
    const p = t.platform ?? "unknown";
    tradesByPlatform[p] = (tradesByPlatform[p] ?? 0) + 1;
  }

  // Top assets
  const tickerMap = new Map<string, { wins: number; total: number }>();
  for (const t of withPnl) {
    const s = tickerMap.get(t.ticker) ?? { wins: 0, total: 0 };
    s.total++;
    if (t.pnl_pct > 0) s.wins++;
    tickerMap.set(t.ticker, s);
  }
  const topAssets: TopAsset[] = Array.from(tickerMap.entries())
    .map(([ticker, s]) => ({ ticker, callCount: s.total, winRate: (s.wins / s.total) * 100 }))
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, 10);

  // PnL history
  const chronological = [...withPnl]
    .filter((t): t is TradeSummary & { entry_date: string } => t.entry_date != null)
    .sort((a, b) => a.entry_date!.localeCompare(b.entry_date!));
  let cumPnl = 0;
  const pnlHistory: PnlPoint[] = chronological.map((t) => {
    cumPnl += t.pnl_pct;
    return { date: t.entry_date!, cumulativePnl: parseFloat(cumPnl.toFixed(2)) };
  });

  return {
    handle,
    totalTrades,
    winCount,
    lossCount,
    winRate: parseFloat(winRate.toFixed(1)),
    avgPnl,
    totalPnl,
    bestTrade,
    worstTrade,
    tradesByPlatform,
    recentTrades: trades.slice(0, 20),
    streak,
    topAssets,
    pnlHistory,
  };
}

export function generateDemoXProfile(handle: string) {
  const seed = hashCode(handle);
  const rand = mulberry32(seed);

  const bios = [
    "Full-time degen. Tracking my calls publicly.",
    "Charts don't lie. Neither does paste.trade.",
    "Crypto & equities. Every call on-chain.",
    "Risk it for the biscuit. All trades tracked.",
    "Making money one spreadsheet at a time.",
    "NFA but here's my track record.",
  ];

  return {
    avatarUrl: null as string | null,
    bannerUrl: null as string | null,
    displayName: handle.replace(/([A-Z])/g, " $1").trim(),
    bio: bios[Math.floor(rand() * bios.length)]!,
    location: null as string | null,
    website: null as string | null,
    verified: rand() > 0.7,
    followers: Math.floor(500 + rand() * 50000),
    following: Math.floor(100 + rand() * 3000),
    tweetCount: Math.floor(1000 + rand() * 80000),
    joinedAt: new Date(2018 + Math.floor(rand() * 6), Math.floor(rand() * 12), 1).toISOString(),
  };
}
