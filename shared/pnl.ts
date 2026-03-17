/**
 * Canonical P&L calculation — single source of truth.
 *
 * Two lenses:
 *   - computeAuthorPnl:  base = author_price  (measures author's skill)
 *   - computePostedPnl:  base = posted_price   (measures platform value)
 *
 * Both use the same math. The only difference is which cached price is the base.
 */

/**
 * Derive PM outcome (yes/no) from trade_data blob fields.
 * Centralizes the fallback logic: outcome → pm_side → infer from direction → null.
 * Used by db-helpers (unpackRow), feed-ranking (fetchRankableTrades), leaderboard-refresh.
 */
export function derivePmOutcome(
  tradeData: Record<string, any>,
  direction: string,
  platform?: string | null,
): "yes" | "no" | null {
  if (tradeData.outcome) return tradeData.outcome;
  if (tradeData.pm_side) return tradeData.pm_side;
  // Infer from direction for legacy PM trades when the caller already knows it's PM.
  if (platform === "polymarket" || tradeData.platform === "polymarket" || tradeData.condition_id || tradeData.market_slug) {
    return direction === "short" ? "no" : "yes";
  }
  return null;
}

/** @deprecated Use derivePmOutcome instead. Kept for backward compat. */
export const derivePmSide = derivePmOutcome;

/** Minimal trade shape required for P&L calculation. */
export interface PnlTrade {
  author_price: number;
  direction: string;
  posted_price?: number | null;
  instrument?: string | null;
  platform?: string | null;
  pm_side?: "yes" | "no" | string | null;
}

export type PnlLens = "author" | "platform";

/** Whether a trade is a Hyperliquid perpetual (eligible for leverage multiplication). */
export function isHlPerp(trade: { instrument?: string | null; platform?: string | null }): boolean {
  return trade.instrument === 'perps' || (trade.platform === 'hyperliquid' && trade.instrument !== 'polymarket');
}

function isPmTrade(trade: { instrument?: string | null; platform?: string | null }): boolean {
  return trade.instrument === "polymarket" || trade.platform === "polymarket";
}

/**
 * Core P&L math. Shared by both lenses.
 *
 * "Track what you hold" convention:
 *   - basePrice and currentPrice are always the HELD-SIDE price.
 *   - For stocks/crypto: held side = the asset itself.
 *   - For Polymarket: held side = the token you bought (YES or NO).
 *     Both YES and NO tokens profit when their price rises,
 *     so PM always uses long-style math regardless of direction.
 *
 * For stocks/crypto/perps: direction determines the formula.
 *   long  = profit when price rises
 *   short = profit when price falls
 */
export function computePnlFromBase(currentPrice: number, basePrice: number, trade: PnlTrade): number | null {
  if (!basePrice || !currentPrice || basePrice <= 0 || currentPrice <= 0) return null;

  // Polymarket: prices are the held token cost. Profit = price increase.
  if (isPmTrade(trade)) {
    return ((currentPrice - basePrice) / basePrice) * 100;
  }

  // Stocks / crypto / perps
  if (trade.direction === "short") {
    return ((basePrice - currentPrice) / basePrice) * 100;
  }
  return ((currentPrice - basePrice) / basePrice) * 100;
}

/**
 * Author P&L — "was this person right?"
 * Base = author_price (price when the author originally said it).
 */
export function computeAuthorPnl(currentPrice: number, trade: PnlTrade): number | null {
  return computePnlFromBase(currentPrice, trade.author_price, trade);
}

/**
 * Platform P&L — "could you have made money since it was posted?"
 * Base = posted_price (price when posted to paste.trade).
 * Returns null if posted_price is missing.
 */
export function computePostedPnl(currentPrice: number, trade: PnlTrade): number | null {
  if (!trade.posted_price) return null;
  return computePnlFromBase(currentPrice, trade.posted_price, trade);
}

/** Resolve P&L for the active lens.
 *  Platform lens falls back to author lens when posted_price is unavailable. */
export function computePnlForLens(
  currentPrice: number,
  trade: PnlTrade,
  lens: PnlLens,
): number | null {
  if (lens === "platform") {
    return computePostedPnl(currentPrice, trade) ?? computeAuthorPnl(currentPrice, trade);
  }
  return computeAuthorPnl(currentPrice, trade);
}

/**
 * Format P&L percentage for display.
 * Examples: "+2.3%", "-0.5%", "+12.1K%" (for extreme values), "--" (for null)
 */
export function formatPnlPct(pct: number | null | undefined, precision = 1): string {
  if (pct == null || !isFinite(pct)) return "--";
  const sign = pct >= 0 ? "+" : "";
  if (Math.abs(pct) >= 10000) return `${sign}${(pct / 1000).toFixed(precision)}K%`;
  return `${sign}${pct.toFixed(precision)}%`;
}
