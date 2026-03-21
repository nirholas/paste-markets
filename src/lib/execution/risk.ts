/**
 * Risk controls and safety checks before trade execution.
 */

import type { WalletState } from "../wallet";

// ---------------------------------------------------------------------------
// Configuration (can be overridden via env or user settings)
// ---------------------------------------------------------------------------

const DEFAULT_RISK_LIMITS = {
  maxSingleTradeUsd: 5_000,
  maxLeverage: 20,
  warnBalancePct: 50, // warn if trade > 50% of wallet balance
  requireConfirmAbove: 1_000,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskCheck {
  passed: boolean;
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
}

export interface RiskInput {
  venue: "hyperliquid" | "polymarket" | "robinhood";
  asset: string;
  direction: string;
  size: number; // USD
  leverage?: number;
  stopLoss?: number;
  walletBalance?: number; // USDC balance
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

export function checkRisk(order: RiskInput, wallet: WalletState): RiskCheck {
  const warnings: string[] = [];
  let blocked = false;
  let blockReason: string | undefined;

  // 1. Wallet must be connected
  if (!wallet.connected || !wallet.address) {
    return {
      passed: false,
      warnings: [],
      blocked: true,
      blockReason: "Wallet not connected",
    };
  }

  // 2. Size must be positive
  if (order.size <= 0) {
    return {
      passed: false,
      warnings: [],
      blocked: true,
      blockReason: "Trade size must be greater than 0",
    };
  }

  // 3. Max single trade size
  if (order.size > DEFAULT_RISK_LIMITS.maxSingleTradeUsd) {
    blocked = true;
    blockReason = `Trade size $${order.size.toLocaleString()} exceeds maximum of $${DEFAULT_RISK_LIMITS.maxSingleTradeUsd.toLocaleString()}`;
  }

  // 4. Leverage limits
  const leverage = order.leverage ?? 1;
  if (leverage > DEFAULT_RISK_LIMITS.maxLeverage) {
    blocked = true;
    blockReason = `Leverage ${leverage}x exceeds maximum of ${DEFAULT_RISK_LIMITS.maxLeverage}x`;
  }

  if (leverage > 10) {
    warnings.push(`High leverage (${leverage}x) — liquidation risk is significant`);
  }

  // 5. Insufficient balance
  const balance = order.walletBalance ?? wallet.balances.usdc;
  if (balance > 0 && order.size > balance) {
    blocked = true;
    blockReason = `Insufficient balance: $${balance.toFixed(2)} USDC available, $${order.size.toLocaleString()} required`;
  }

  // 6. Large portion of balance
  if (balance > 0 && order.size > balance * (DEFAULT_RISK_LIMITS.warnBalancePct / 100)) {
    const pct = ((order.size / balance) * 100).toFixed(0);
    warnings.push(`This trade uses ${pct}% of your available balance`);
  }

  // 7. No stop loss on leveraged trades
  if (leverage > 1 && !order.stopLoss) {
    warnings.push("No stop loss set on a leveraged trade");
  }

  // 8. Large trade confirmation
  if (order.size > DEFAULT_RISK_LIMITS.requireConfirmAbove) {
    warnings.push(`Trade exceeds $${DEFAULT_RISK_LIMITS.requireConfirmAbove.toLocaleString()} — requires explicit confirmation`);
  }

  return {
    passed: !blocked,
    warnings,
    blocked,
    blockReason,
  };
}

// ---------------------------------------------------------------------------
// Estimation helpers
// ---------------------------------------------------------------------------

export function estimateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  direction: "long" | "short"
): number {
  // Simplified liquidation estimate: ~(1/leverage) move against position
  const liqPct = 1 / leverage;
  if (direction === "long") {
    return entryPrice * (1 - liqPct);
  }
  return entryPrice * (1 + liqPct);
}

export function estimateFees(
  size: number,
  venue: "hyperliquid" | "polymarket"
): number {
  // Hyperliquid: 0.05% taker, 0.02% maker
  // Polymarket: ~2% spread on average
  if (venue === "hyperliquid") {
    return size * 0.0005; // taker fee
  }
  return size * 0.02; // Polymarket spread estimate
}
