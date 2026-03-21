/**
 * Computes earned badges from a caller's trade history and metrics.
 */

import type { AuthorMetrics, TradeSummary } from "./metrics";
import {
  BADGE_CATALOG,
  type CallerStats,
  type EarnedBadge,
} from "./badges";

/** Compute the longest win streak across all trades (sorted by date). */
function computeMaxWinStreak(trades: TradeSummary[]): number {
  const sorted = [...trades]
    .filter((t) => t.entry_date)
    .sort((a, b) => (a.entry_date ?? "").localeCompare(b.entry_date ?? ""));

  let max = 0;
  let current = 0;
  for (const t of sorted) {
    if (t.pnl_pct > 0) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/** Max trades placed in any rolling 24-hour window. */
function computeMaxTradesIn24h(trades: TradeSummary[]): number {
  const dates = trades
    .map((t) => t.entry_date ?? t.posted_at)
    .filter(Boolean)
    .map((d) => new Date(d!).getTime())
    .sort((a, b) => a - b);

  if (dates.length === 0) return 0;

  let max = 0;
  let left = 0;
  for (let right = 0; right < dates.length; right++) {
    while (dates[right]! - dates[left]! > 24 * 60 * 60 * 1000) {
      left++;
    }
    const count = right - left + 1;
    if (count > max) max = count;
  }
  return max;
}

/** Average hold time in days (entry_date to posted_at gap, or between consecutive trades). */
function computeAvgHoldDays(trades: TradeSummary[]): number {
  const withDates = trades
    .filter((t) => t.entry_date)
    .map((t) => new Date(t.entry_date!).getTime())
    .sort((a, b) => a - b);

  if (withDates.length < 2) return 0;

  let totalDiff = 0;
  for (let i = 1; i < withDates.length; i++) {
    totalDiff += withDates[i]! - withDates[i - 1]!;
  }
  return totalDiff / (withDates.length - 1) / (1000 * 60 * 60 * 24);
}

/** Check if any 7-day window has 5+ trades all winning. */
function computeHasPerfectWeek(trades: TradeSummary[]): boolean {
  const withDates = trades
    .filter((t) => t.entry_date)
    .map((t) => ({
      date: new Date(t.entry_date!).getTime(),
      win: t.pnl_pct > 0,
    }))
    .sort((a, b) => a.date - b.date);

  if (withDates.length < 5) return false;

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  let left = 0;
  for (let right = 0; right < withDates.length; right++) {
    while (withDates[right]!.date - withDates[left]!.date > SEVEN_DAYS) {
      left++;
    }
    const window = withDates.slice(left, right + 1);
    if (window.length >= 5 && window.every((t) => t.win)) {
      return true;
    }
  }
  return false;
}

/** Max consecutive weeks with positive total P&L. */
function computeConsecutivePositiveWeeks(trades: TradeSummary[]): number {
  const withDates = trades
    .filter((t) => t.entry_date && t.pnl_pct != null)
    .map((t) => ({
      date: new Date(t.entry_date!),
      pnl: t.pnl_pct,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (withDates.length === 0) return 0;

  // Group by ISO week
  const weeks = new Map<string, number>();
  for (const t of withDates) {
    const d = t.date;
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000,
    );
    const weekNum = Math.ceil((dayOfYear + jan4.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    weeks.set(key, (weeks.get(key) ?? 0) + t.pnl);
  }

  const sortedWeeks = [...weeks.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  let max = 0;
  let current = 0;
  for (const [, pnl] of sortedWeeks) {
    if (pnl > 0) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

/** Build CallerStats from metrics + full trade list. */
export function buildCallerStats(
  metrics: AuthorMetrics,
  trades: TradeSummary[],
  leaderboardTop3Days = 0,
): CallerStats {
  return {
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    avgPnl: metrics.avgPnl,
    totalPnl: metrics.totalPnl,
    streak: metrics.streak,
    maxWinStreak: computeMaxWinStreak(trades),
    bestTradePnl: metrics.bestTrade?.pnl ?? 0,
    maxTradesIn24h: computeMaxTradesIn24h(trades),
    avgHoldDays: computeAvgHoldDays(trades),
    hasPerfectWeek: computeHasPerfectWeek(trades),
    consecutivePositiveWeeks: computeConsecutivePositiveWeeks(trades),
    leaderboardTop3Days,
  };
}

/** Evaluate all badges and return the ones earned. */
export function computeBadges(
  metrics: AuthorMetrics,
  trades: TradeSummary[],
  leaderboardTop3Days = 0,
): EarnedBadge[] {
  const stats = buildCallerStats(metrics, trades, leaderboardTop3Days);
  const now = new Date().toISOString();

  return BADGE_CATALOG.filter((badge) => badge.condition(stats)).map(
    (badge) => ({
      badge,
      earnedAt: now,
    }),
  );
}
