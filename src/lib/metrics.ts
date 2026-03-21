/**
 * Shared P&L / win-rate calculation functions.
 */

export interface TradeSummary {
  ticker: string;
  direction: string;
  pnl_pct: number;
  platform?: string;
  entry_date?: string;
  posted_at?: string;
  source_url?: string;
}

export interface TopAsset {
  ticker: string;
  callCount: number;
  winRate: number;
}

export interface PnlPoint {
  date: string;
  cumulativePnl: number;
}

export interface AuthorMetrics {
  handle: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  bestTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
  worstTrade: { ticker: string; direction: string; pnl: number; date: string } | null;
  tradesByPlatform: Record<string, number>;
  recentTrades: TradeSummary[];
  streak: number;
  topAssets: TopAsset[];
  pnlHistory: PnlPoint[];
}

export function computeWinRate(trades: { pnl_pct: number }[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter((t) => t.pnl_pct > 0).length;
  return (wins / trades.length) * 100;
}

export function computeAvgPnl(trades: { pnl_pct: number }[]): number {
  if (trades.length === 0) return 0;
  const sum = trades.reduce((acc, t) => acc + t.pnl_pct, 0);
  return sum / trades.length;
}

export function computeStreak(trades: { pnl_pct: number; entry_date: string }[]): number {
  if (trades.length === 0) return 0;

  // Sort by date descending (most recent first)
  const sorted = [...trades].sort(
    (a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime(),
  );

  const firstTrade = sorted[0];
  if (!firstTrade) return 0;
  const isWinning = firstTrade.pnl_pct > 0;
  let streak = 0;

  for (const trade of sorted) {
    if ((trade.pnl_pct > 0) === isWinning) {
      streak++;
    } else {
      break;
    }
  }

  return isWinning ? streak : -streak;
}

export function computeMetrics(handle: string, trades: TradeSummary[]): AuthorMetrics {
  const withPnl = trades.filter((t) => t.pnl_pct != null);

  const winCount = withPnl.filter((t) => t.pnl_pct > 0).length;
  const lossCount = withPnl.filter((t) => t.pnl_pct <= 0).length;
  const winRate = computeWinRate(withPnl);
  const avgPnl = computeAvgPnl(withPnl);

  // Best/worst trades
  let bestTrade: AuthorMetrics["bestTrade"] = null;
  let worstTrade: AuthorMetrics["worstTrade"] = null;

  for (const t of withPnl) {
    if (!bestTrade || t.pnl_pct > bestTrade.pnl) {
      bestTrade = {
        ticker: t.ticker,
        direction: t.direction,
        pnl: t.pnl_pct,
        date: t.entry_date ?? t.posted_at ?? "",
      };
    }
    if (!worstTrade || t.pnl_pct < worstTrade.pnl) {
      worstTrade = {
        ticker: t.ticker,
        direction: t.direction,
        pnl: t.pnl_pct,
        date: t.entry_date ?? t.posted_at ?? "",
      };
    }
  }

  // Platform breakdown
  const tradesByPlatform: Record<string, number> = {};
  for (const t of trades) {
    const p = t.platform ?? "unknown";
    tradesByPlatform[p] = (tradesByPlatform[p] ?? 0) + 1;
  }

  // Streak (need entry_date)
  const withDate = withPnl
    .filter((t): t is TradeSummary & { entry_date: string } => t.entry_date != null)
    .map((t) => ({ pnl_pct: t.pnl_pct, entry_date: t.entry_date }));
  const streak = computeStreak(withDate);

  // Recent trades (sorted by date descending)
  const recentTrades = [...trades]
    .sort((a, b) => {
      const da = a.entry_date ?? a.posted_at ?? "";
      const db = b.entry_date ?? b.posted_at ?? "";
      return db.localeCompare(da);
    })
    .slice(0, 20);

  // Total PnL
  const totalPnl = withPnl.reduce((acc, t) => acc + t.pnl_pct, 0);

  // Top assets: group by ticker, compute win rate
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

  // PnL history: sorted by date, running cumulative PnL
  const withDatePnl = withPnl
    .filter((t): t is TradeSummary & { entry_date: string } => t.entry_date != null)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  let cumPnl = 0;
  const pnlHistory: PnlPoint[] = withDatePnl.map((t) => {
    cumPnl += t.pnl_pct;
    return { date: t.entry_date, cumulativePnl: parseFloat(cumPnl.toFixed(2)) };
  });

  return {
    handle,
    totalTrades: trades.length,
    winCount,
    lossCount,
    winRate,
    avgPnl,
    totalPnl,
    bestTrade,
    worstTrade,
    tradesByPlatform,
    recentTrades,
    streak,
    topAssets,
    pnlHistory,
  };
}

export interface FadeStats {
  // Original caller stats
  originalWinRate: number;
  originalAvgPnl: number;
  originalTotalPnl: number;
  // Fade stats (what you'd get trading the opposite)
  fadeWinRate: number;
  fadeAvgPnl: number;
  fadeTotalPnl: number;
  bestFade: { ticker: string; direction: string; pnl: number; date: string } | null;
  worstFade: { ticker: string; direction: string; pnl: number; date: string } | null;
  totalTrades: number;
  // Rating: S/A/B/C/D/F based on how profitable fading is
  fadeRating: "S" | "A" | "B" | "C" | "D" | "F";
  isProfitableFade: boolean; // fade win rate > 60%
}

function computeFadeRating(fadeWinRate: number, fadeAvgPnl: number): FadeStats["fadeRating"] {
  // Composite: weight win rate (60%) and avg pnl profitability (40%)
  // Higher = better to fade
  const wrScore = fadeWinRate; // 0-100
  const pnlScore = Math.min(Math.max(fadeAvgPnl + 10, 0), 30) * (100 / 30); // normalize -10..+20 → 0..100
  const composite = wrScore * 0.6 + pnlScore * 0.4;

  if (composite >= 80) return "S";
  if (composite >= 65) return "A";
  if (composite >= 50) return "B";
  if (composite >= 40) return "C";
  if (composite >= 30) return "D";
  return "F";
}

export function computeFadeScore(trades: TradeSummary[]): FadeStats {
  const withPnl = trades.filter((t) => t.pnl_pct != null);

  // Original stats
  const originalWinRate = computeWinRate(withPnl);
  const originalAvgPnl = computeAvgPnl(withPnl);
  const originalTotalPnl = withPnl.reduce((acc, t) => acc + t.pnl_pct, 0);

  // Fade stats: invert every trade
  const fadedTrades = withPnl.map((t) => ({
    ...t,
    pnl_pct: -t.pnl_pct,
    direction:
      t.direction === "long"
        ? "short"
        : t.direction === "short"
          ? "long"
          : t.direction === "yes"
            ? "no"
            : "yes",
  }));

  const fadeWinRate = computeWinRate(fadedTrades);
  const fadeAvgPnl = computeAvgPnl(fadedTrades);
  const fadeTotalPnl = fadedTrades.reduce((acc, t) => acc + t.pnl_pct, 0);

  // Best fade = their worst trade inverted (biggest fade win)
  let bestFade: FadeStats["bestFade"] = null;
  let worstFade: FadeStats["worstFade"] = null;

  for (const t of fadedTrades) {
    if (!bestFade || t.pnl_pct > bestFade.pnl) {
      bestFade = {
        ticker: t.ticker,
        direction: t.direction,
        pnl: t.pnl_pct,
        date: t.entry_date ?? t.posted_at ?? "",
      };
    }
    if (!worstFade || t.pnl_pct < worstFade.pnl) {
      worstFade = {
        ticker: t.ticker,
        direction: t.direction,
        pnl: t.pnl_pct,
        date: t.entry_date ?? t.posted_at ?? "",
      };
    }
  }

  const fadeRating = computeFadeRating(fadeWinRate, fadeAvgPnl);

  return {
    originalWinRate,
    originalAvgPnl,
    originalTotalPnl,
    fadeWinRate,
    fadeAvgPnl,
    fadeTotalPnl,
    bestFade,
    worstFade,
    totalTrades: withPnl.length,
    fadeRating,
    isProfitableFade: fadeWinRate > 60,
  };
}

export function computeFadeMetrics(handle: string, trades: TradeSummary[]): AuthorMetrics {
  const faded = trades.map((t) => ({
    ...t,
    pnl_pct: -t.pnl_pct,
    direction:
      t.direction === "long"
        ? "short"
        : t.direction === "short"
          ? "long"
          : t.direction === "yes"
            ? "no"
            : "yes",
  }));
  return computeMetrics(handle, faded);
}

export function formatPnl(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatWinRate(pct: number): string {
  return `${Math.round(pct)}%`;
}

export function winRateBar(pct: number, length = 10): string {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
