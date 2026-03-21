/**
 * Alpha Score — a composite quality metric for CT callers.
 *
 * Better than raw win rate because it accounts for:
 *   - Magnitude: avg P&L (high winners aren't the same as squeaking out wins)
 *   - Sample size: more trades = more credible, floor at 0.3 credibility
 *
 * Formula: (winRate/100) × magnitudeFactor × credibilityFactor × 100
 *
 * Tiers:
 *   S — alpha ≥ 70  (elite, statistically significant, high magnitude)
 *   A — alpha ≥ 50  (strong, meaningful edge)
 *   B — alpha ≥ 30  (developing, early signal)
 *   C — alpha < 30  (insufficient data or weak edge)
 */

export type CallerTier = "S" | "A" | "B" | "C";

export function computeAlphaScore(
  winRate: number, // 0–100
  avgPnl: number, // percentage, can be negative
  tradeCount: number,
): number {
  if (tradeCount === 0) return 0;

  // Magnitude factor: avg P&L adds/subtracts from score
  // Clamped so outliers don't dominate. +200% avg → 2.0x, -50% avg → 0.75x
  const clampedPnl = Math.max(-50, Math.min(200, avgPnl));
  const magnitudeFactor = 1 + clampedPnl / 200;

  // Credibility factor: 0.3 baseline, reaches 1.0 at 50 trades
  const credibilityFactor = 0.3 + 0.7 * Math.min(tradeCount, 50) / 50;

  const score = (winRate / 100) * magnitudeFactor * credibilityFactor * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

export function callerTier(alphaScore: number): CallerTier {
  if (alphaScore >= 70) return "S";
  if (alphaScore >= 50) return "A";
  if (alphaScore >= 30) return "B";
  return "C";
}

export function tierColor(tier: CallerTier): string {
  switch (tier) {
    case "S":
      return "#f39c12"; // gold
    case "A":
      return "#2ecc71"; // green
    case "B":
      return "#3b82f6"; // blue
    case "C":
      return "#555568"; // muted
  }
}

export function tierBgColor(tier: CallerTier): string {
  switch (tier) {
    case "S":
      return "rgba(243,156,18,0.12)";
    case "A":
      return "rgba(46,204,113,0.10)";
    case "B":
      return "rgba(59,130,246,0.10)";
    case "C":
      return "rgba(85,85,104,0.10)";
  }
}
