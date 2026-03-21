/**
 * Position tracking and management.
 * Aggregates positions from venue APIs and local executed_trades DB.
 */

import {
  getOpenTradesByWallet,
  getClosedTradesByWallet,
  closeExecutedTrade,
  type ExecutedTrade,
} from "../execution-db";
import {
  getCurrentPrice as getHLPrice,
} from "./hyperliquid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Position {
  id: string;
  tradeId: string | null;
  venue: "hyperliquid" | "polymarket";
  asset: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  status: "open" | "closed" | "liquidated";
  openedAt: string;
  closedAt?: string;
  closePnl?: number;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  fillPrice?: number;
  fillSize?: number;
  fees?: number;
  error?: string;
  txHash?: string;
}

// ---------------------------------------------------------------------------
// Fetch positions
// ---------------------------------------------------------------------------

export async function getPositions(
  walletAddress: string
): Promise<Position[]> {
  const positions: Position[] = [];

  const dbTrades = await getOpenTradesByWallet(walletAddress);

  for (const trade of dbTrades) {
    if (trade.status === "filled" || trade.status === "partial") {
      const currentPrice = await safeGetPrice(trade.asset, trade.venue);
      const entryPrice = trade.fill_price ?? trade.entry_price ?? 0;

      let unrealizedPnl = 0;
      let unrealizedPnlPercent = 0;

      if (entryPrice > 0 && currentPrice > 0) {
        const isLong = trade.direction === "long" || trade.direction === "yes";
        const priceDiff = isLong
          ? currentPrice - entryPrice
          : entryPrice - currentPrice;
        unrealizedPnlPercent = (priceDiff / entryPrice) * 100;
        unrealizedPnl =
          (trade.fill_size ?? trade.size_usd / entryPrice) *
          priceDiff *
          (trade.leverage ?? 1);
      }

      positions.push({
        id: trade.id,
        tradeId: trade.trade_id,
        venue: trade.venue as "hyperliquid" | "polymarket",
        asset: trade.asset,
        direction: trade.direction,
        entryPrice,
        currentPrice,
        size: trade.size_usd,
        leverage: trade.leverage ?? 1,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        unrealizedPnlPercent: Math.round(unrealizedPnlPercent * 100) / 100,
        status: "open",
        openedAt: trade.created_at,
      });
    }
  }

  return positions;
}

export async function getClosedPositions(
  walletAddress: string
): Promise<Position[]> {
  const dbTrades = await getClosedTradesByWallet(walletAddress);

  return dbTrades
    .filter((t) => t.status === "closed" || t.status === "liquidated")
    .map((trade) => ({
      id: trade.id,
      tradeId: trade.trade_id,
      venue: trade.venue as "hyperliquid" | "polymarket",
      asset: trade.asset,
      direction: trade.direction,
      entryPrice: trade.fill_price ?? trade.entry_price ?? 0,
      currentPrice: trade.close_price ?? 0,
      size: trade.size_usd,
      leverage: trade.leverage ?? 1,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      status: trade.status as "closed" | "liquidated",
      openedAt: trade.created_at,
      closedAt: trade.closed_at ?? undefined,
      closePnl: trade.realized_pnl ?? undefined,
    }));
}

// ---------------------------------------------------------------------------
// Close position
// ---------------------------------------------------------------------------

export async function closePosition(
  positionId: string,
  walletAddress: string
): Promise<ExecutionResult> {
  const dbTrades = await getOpenTradesByWallet(walletAddress);
  const trade = dbTrades.find((t) => t.id === positionId);

  if (!trade) {
    return { success: false, error: "Position not found" };
  }

  try {
    const entryPrice = trade.fill_price ?? trade.entry_price ?? 0;
    let closePrice = 0;

    if (trade.venue === "hyperliquid") {
      closePrice = await safeGetPrice(trade.asset, trade.venue);
    }

    if (closePrice === 0) closePrice = entryPrice;

    const isLong = trade.direction === "long" || trade.direction === "yes";
    const priceDiff = isLong
      ? closePrice - entryPrice
      : entryPrice - closePrice;
    const pnlPct = entryPrice > 0 ? (priceDiff / entryPrice) * 100 : 0;
    const realizedPnl = trade.size_usd * (pnlPct / 100) * (trade.leverage ?? 1);

    await closeExecutedTrade(
      positionId,
      closePrice,
      Math.round(realizedPnl * 100) / 100
    );

    return {
      success: true,
      fillPrice: closePrice,
      fillSize: trade.fill_size ?? undefined,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeGetPrice(asset: string, venue: string): Promise<number> {
  try {
    if (venue === "hyperliquid") {
      return await getHLPrice(asset);
    }
    return 0;
  } catch {
    return 0;
  }
}
