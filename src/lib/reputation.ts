/**
 * Caller Reputation Score — composite quality metric (0–100).
 *
 * Five components:
 *   1. Accuracy        (40 pts) — win rate on qualifying calls, credibility-weighted
 *   2. Return Quality  (25 pts) — median winning PnL, penalized for big losers
 *   3. Consistency     (20 pts) — low PnL std dev beats "sometimes moon, often rug"
 *   4. Integrity       (10 pts) — % of calls submitted within 1h of tweet
 *   5. Breadth          (5 pts) — variety of assets called
 *
 * Qualifying calls = integrity "live" (< 1h) or "late" (< 24h = "same day").
 * Minimum 5 qualifying calls to receive a score; below that: "New" or "Unranked".
 */

import { classifyIntegrity, type IntegrityClass } from "./integrity";

// ─── Public types ────────────────────────────────────────────────────────────

export interface RepTradeInput {
  ticker: string;
  pnl_pct: number | null;
  /** Pre-computed integrity class (from DB). If absent, computed from timestamps. */
  integrity?: IntegrityClass;
  /** Tweet creation time (author_date from paste.trade) */
  author_date?: string | null;
  /** Submission time (posted_at from paste.trade) */
  posted_at?: string | null;
}

export type ReputationTier =
  | "Oracle"
  | "Alpha"
  | "Reliable"
  | "Developing"
  | "Mixed"
  | "New"
  | "Unranked";

export interface ScoreComponent {
  score: number;
  maxScore: number;
  detail: string;
}

export interface ScoreBreakdown {
  accuracy: ScoreComponent;
  returnQuality: ScoreComponent;
  consistency: ScoreComponent;
  integrity: ScoreComponent;
  breadth: ScoreComponent;
}

export interface ReputationScore {
  score: number;
  tier: ReputationTier;
  breakdown: ScoreBreakdown;
  qualifyingCalls: number;
  totalCalls: number;
  lastCalculatedAt: string;
}

// ─── In-memory cache (30-min TTL) ────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000;
const scoreCache = new Map<string, { score: ReputationScore; expiresAt: number }>();

export function getCachedScore(handle: string): ReputationScore | null {
  const entry = scoreCache.get(handle);
  if (!entry || Date.now() > entry.expiresAt) {
    scoreCache.delete(handle);
    return null;
  }
  return entry.score;
}

export function setCachedScore(handle: string, score: ReputationScore): void {
  scoreCache.set(handle, { score, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCachedScore(handle: string): void {
  scoreCache.delete(handle);
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

export function scoreTier(score: number, qualifyingCalls: number): ReputationTier {
  if (qualifyingCalls < 5) return qualifyingCalls > 0 ? "New" : "Unranked";
  if (score >= 90) return "Oracle";
  if (score >= 75) return "Alpha";
  if (score >= 60) return "Reliable";
  if (score >= 45) return "Developing";
  if (score >= 30) return "Mixed";
  return "Unranked";
}

export function tierEmoji(tier: ReputationTier): string {
  switch (tier) {
    case "Oracle":     return "🔮";
    case "Alpha":      return "⚡";
    case "Reliable":   return "✅";
    case "Developing": return "📊";
    case "Mixed":      return "⚠️";
    case "New":        return "🆕";
    default:           return "";
  }
}

export function tierColor(tier: ReputationTier): string {
  switch (tier) {
    case "Oracle":     return "#f39c12"; // gold
    case "Alpha":      return "#2ecc71"; // green
    case "Reliable":   return "#3b82f6"; // blue
    case "Developing": return "#8b5cf6"; // purple
    case "Mixed":      return "#f39c12"; // amber
    case "New":        return "#555568"; // muted
    default:           return "#555568";
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveIntegrity(t: RepTradeInput): IntegrityClass {
  if (t.integrity) return t.integrity;
  if (t.author_date && t.posted_at) {
    return classifyIntegrity(t.author_date, t.posted_at).integrity;
  }
  return "unknown";
}

function medianOf(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function populationStdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// ─── Component scorers ────────────────────────────────────────────────────────

function scoreAccuracy(qualifying: RepTradeInput[]): ScoreComponent {
  const MAX = 40;
  const withPnl = qualifying.filter((t) => t.pnl_pct != null);
  if (withPnl.length === 0) {
    return { score: 0, maxScore: MAX, detail: "No P&L data on qualifying calls" };
  }

  const wins = withPnl.filter((t) => t.pnl_pct! > 0).length;
  const winRate = (wins / withPnl.length) * 100;

  // Score based on win rate thresholds with linear interpolation
  let base: number;
  if (winRate >= 80)      base = MAX;
  else if (winRate >= 60) base = 20 + ((winRate - 60) / 20) * 20;
  else if (winRate >= 50) base = 10 + ((winRate - 50) / 10) * 10;
  else                    base = (winRate / 50) * 10;

  // Credibility: 0.3 at 5 calls → 1.0 at 50 calls
  const credibility = 0.3 + 0.7 * Math.min(withPnl.length, 50) / 50;
  const score = Math.min(MAX, Math.round(base * credibility));

  return {
    score,
    maxScore: MAX,
    detail: `${Math.round(winRate)}% win rate on ${withPnl.length} qualifying calls`,
  };
}

function scoreReturnQuality(qualifying: RepTradeInput[]): ScoreComponent {
  const MAX = 25;
  const withPnl = qualifying.filter((t) => t.pnl_pct != null);
  const winPnls  = withPnl.filter((t) => t.pnl_pct! > 0).map((t) => t.pnl_pct!);
  const lossPnls = withPnl.filter((t) => t.pnl_pct! < 0).map((t) => t.pnl_pct!);

  if (winPnls.length === 0) {
    return { score: 0, maxScore: MAX, detail: "No winning calls" };
  }

  const medianWin = medianOf(winPnls);

  let score: number;
  if (medianWin >= 30)      score = MAX;
  else if (medianWin >= 15) score = 15 + ((medianWin - 15) / 15) * 10;
  else if (medianWin >= 5)  score = 8  + ((medianWin - 5)  / 10) * 7;
  else if (medianWin > 0)   score = (medianWin / 5) * 8;
  else                      score = 0;

  // Penalize heavy avg losses (-30%+)
  if (lossPnls.length > 0) {
    const avgLoss = lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length;
    if (avgLoss < -30) score *= 0.7;
  }

  return {
    score: Math.min(MAX, Math.round(score)),
    maxScore: MAX,
    detail: `Median win: +${medianWin.toFixed(1)}%`,
  };
}

function scoreConsistency(qualifying: RepTradeInput[]): ScoreComponent {
  const MAX = 20;
  const pnls = qualifying.filter((t) => t.pnl_pct != null).map((t) => t.pnl_pct!);

  if (pnls.length < 3) {
    return { score: 10, maxScore: MAX, detail: "Too few calls for consistency" };
  }

  const sd = populationStdDev(pnls);

  let score: number;
  if (sd < 20)      score = MAX;
  else if (sd < 40) score = 10 + ((40 - sd) / 20) * 10;
  else              score = Math.max(0, 10 - ((sd - 40) / 40) * 10);

  return {
    score: Math.min(MAX, Math.round(score)),
    maxScore: MAX,
    detail: `P&L std dev: ${sd.toFixed(1)}%`,
  };
}

function scoreIntegrity(allTrades: RepTradeInput[]): ScoreComponent {
  const MAX = 10;
  if (allTrades.length === 0) {
    return { score: 5, maxScore: MAX, detail: "No integrity data" };
  }

  const classes = allTrades.map(resolveIntegrity);
  const known = classes.filter((c) => c !== "unknown").length;

  if (known === 0) {
    return { score: 5, maxScore: MAX, detail: "No integrity data" };
  }

  const liveCount = classes.filter((c) => c === "live").length;
  const pctLive = (liveCount / allTrades.length) * 100;

  let score: number;
  if (pctLive >= 90)      score = MAX;
  else if (pctLive >= 70) score = 6 + ((pctLive - 70) / 20) * 4;
  else if (pctLive >= 50) score = 3 + ((pctLive - 50) / 20) * 3;
  else                    score = (pctLive / 50) * 3;

  return {
    score: Math.min(MAX, Math.round(score)),
    maxScore: MAX,
    detail: `${Math.round(pctLive)}% of calls live (< 1h after tweet)`,
  };
}

function scoreBreadth(allTrades: RepTradeInput[]): ScoreComponent {
  const MAX = 5;
  const unique = new Set(allTrades.map((t) => t.ticker)).size;

  let score: number;
  if (unique >= 5)      score = MAX;
  else if (unique >= 3) score = 3;
  else if (unique >= 2) score = 1;
  else                  score = 0;

  return {
    score,
    maxScore: MAX,
    detail: `${unique} unique ticker${unique !== 1 ? "s" : ""}`,
  };
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

/**
 * Full reputation score from per-trade data.
 * Requires at least 5 qualifying (live or late) calls.
 */
export function calculateReputationScore(
  _handle: string,
  trades: RepTradeInput[],
): ReputationScore {
  const totalCalls = trades.length;

  // Qualifying = live or same-day (late) calls — excludes retroactive cherry-picks
  const qualifying = trades.filter((t) => {
    const cls = resolveIntegrity(t);
    return cls === "live" || cls === "late";
  });
  const qualifyingCalls = qualifying.length;

  if (qualifyingCalls < 5) {
    const empty: ScoreComponent = {
      score: 0,
      maxScore: 0,
      detail: qualifyingCalls === 0
        ? "No qualifying calls"
        : `Only ${qualifyingCalls} qualifying call${qualifyingCalls !== 1 ? "s" : ""} (need 5)`,
    };
    return {
      score: 0,
      tier: scoreTier(0, qualifyingCalls),
      breakdown: {
        accuracy:      { ...empty, maxScore: 40 },
        returnQuality: { ...empty, maxScore: 25 },
        consistency:   { ...empty, maxScore: 20 },
        integrity:     { ...empty, maxScore: 10 },
        breadth:       { ...empty, maxScore: 5 },
      },
      qualifyingCalls,
      totalCalls,
      lastCalculatedAt: new Date().toISOString(),
    };
  }

  const accuracy      = scoreAccuracy(qualifying);
  const returnQuality = scoreReturnQuality(qualifying);
  const consistency   = scoreConsistency(qualifying);
  const integrity     = scoreIntegrity(allTrades(trades));     // all trades for integrity %
  const breadth       = scoreBreadth(allTrades(trades));       // all trades for breadth

  const total = accuracy.score + returnQuality.score + consistency.score
    + integrity.score + breadth.score;
  const score = Math.min(100, Math.max(0, Math.round(total)));

  return {
    score,
    tier: scoreTier(score, qualifyingCalls),
    breakdown: { accuracy, returnQuality, consistency, integrity, breadth },
    qualifyingCalls,
    totalCalls,
    lastCalculatedAt: new Date().toISOString(),
  };
}

function allTrades(trades: RepTradeInput[]): RepTradeInput[] {
  return trades;
}

/**
 * Lightweight estimate from aggregated stats only (no per-trade data).
 * Used in list endpoints where we only have win_rate, avg_pnl, trade_count.
 * Returns a rough score ±10 pts of what the full calculation would give.
 */
export function estimateReputationScore(
  winRate: number,   // 0–100
  avgPnl: number,    // percentage
  totalTrades: number,
): Pick<ReputationScore, "score" | "tier"> {
  // Accuracy: win rate + credibility
  const credibility = 0.3 + 0.7 * Math.min(totalTrades, 50) / 50;
  let accBase: number;
  if (winRate >= 80)      accBase = 40;
  else if (winRate >= 60) accBase = 20 + ((winRate - 60) / 20) * 20;
  else if (winRate >= 50) accBase = 10 + ((winRate - 50) / 10) * 10;
  else                    accBase = (winRate / 50) * 10;
  const acc = Math.min(40, Math.round(accBase * credibility));

  // Return Quality: avg_pnl as proxy for median win
  let ret: number;
  if (avgPnl >= 30)      ret = 25;
  else if (avgPnl >= 15) ret = 15 + ((avgPnl - 15) / 15) * 10;
  else if (avgPnl >= 5)  ret = 8  + ((avgPnl - 5)  / 10) * 7;
  else if (avgPnl > 0)   ret = (avgPnl / 5) * 8;
  else                   ret = 0;
  ret = Math.min(25, Math.round(Math.max(0, ret)));

  // Consistency: neutral mid-point (can't compute without per-trade std dev)
  const con = 10;

  // Integrity: neutral mid-point (no timestamp data in aggregate)
  const integ = 5;

  // Breadth: assume some variety
  const bre = 3;

  const score = Math.min(100, Math.max(0, acc + ret + con + integ + bre));
  const qualifyingCalls = totalTrades >= 5 ? 5 : totalTrades; // conservative
  return { score, tier: scoreTier(score, qualifyingCalls) };
}
