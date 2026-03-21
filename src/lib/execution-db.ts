/**
 * Database layer for executed trades (trade execution tracking).
 * Uses @neondatabase/serverless via the shared `sql` tagged-template client.
 */

import { sql } from "./db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutedTrade {
  id: string;
  trade_id: string | null;
  wallet_address: string;
  venue: string;
  asset: string;
  direction: string;
  order_type: string;
  size_usd: number;
  leverage: number;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  fill_price: number | null;
  fill_size: number | null;
  fees: number | null;
  tx_hash: string | null;
  venue_order_id: string | null;
  closed_at: string | null;
  close_price: number | null;
  realized_pnl: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InsertExecutedTrade {
  id: string;
  tradeId?: string | null;
  walletAddress: string;
  venue: string;
  asset: string;
  direction: string;
  orderType?: string;
  sizeUsd: number;
  leverage?: number;
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  status?: string;
  fillPrice?: number | null;
  fillSize?: number | null;
  fees?: number | null;
  txHash?: string | null;
  venueOrderId?: string | null;
}

export async function insertExecutedTrade(p: InsertExecutedTrade): Promise<ExecutedTrade> {
  const tradeId = p.tradeId ?? null;
  const orderType = p.orderType ?? "market";
  const leverage = p.leverage ?? 1;
  const entryPrice = p.entryPrice ?? null;
  const stopLoss = p.stopLoss ?? null;
  const takeProfit = p.takeProfit ?? null;
  const status = p.status ?? "pending";
  const fillPrice = p.fillPrice ?? null;
  const fillSize = p.fillSize ?? null;
  const fees = p.fees ?? null;
  const txHash = p.txHash ?? null;
  const venueOrderId = p.venueOrderId ?? null;

  await sql`
    INSERT INTO executed_trades
      (id, trade_id, wallet_address, venue, asset, direction, order_type,
       size_usd, leverage, entry_price, stop_loss, take_profit, status,
       fill_price, fill_size, fees, tx_hash, venue_order_id)
    VALUES
      (${p.id}, ${tradeId}, ${p.walletAddress}, ${p.venue}, ${p.asset}, ${p.direction}, ${orderType},
       ${p.sizeUsd}, ${leverage}, ${entryPrice}, ${stopLoss}, ${takeProfit}, ${status},
       ${fillPrice}, ${fillSize}, ${fees}, ${txHash}, ${venueOrderId})
  `;

  const rows = await sql`SELECT * FROM executed_trades WHERE id = ${p.id}`;
  return rows[0] as ExecutedTrade;
}

export async function getExecutedTrade(id: string): Promise<ExecutedTrade | undefined> {
  const rows = await sql`SELECT * FROM executed_trades WHERE id = ${id}`;
  return (rows[0] as ExecutedTrade) ?? undefined;
}

export async function getExecutedTradesByWallet(wallet: string): Promise<ExecutedTrade[]> {
  const rows = await sql`SELECT * FROM executed_trades WHERE wallet_address = ${wallet} ORDER BY created_at DESC`;
  return rows as ExecutedTrade[];
}

export async function getOpenTradesByWallet(wallet: string): Promise<ExecutedTrade[]> {
  const rows = await sql`
    SELECT * FROM executed_trades
    WHERE wallet_address = ${wallet} AND status IN ('pending', 'filled', 'partial')
    ORDER BY created_at DESC
  `;
  return rows as ExecutedTrade[];
}

export async function getClosedTradesByWallet(wallet: string): Promise<ExecutedTrade[]> {
  const rows = await sql`
    SELECT * FROM executed_trades
    WHERE wallet_address = ${wallet} AND status IN ('closed', 'liquidated', 'cancelled', 'failed')
    ORDER BY closed_at DESC
  `;
  return rows as ExecutedTrade[];
}

export async function updateTradeStatus(
  id: string,
  updates: {
    status: string;
    fillPrice?: number | null;
    fillSize?: number | null;
    fees?: number | null;
    txHash?: string | null;
    venueOrderId?: string | null;
  }
): Promise<void> {
  const fillPrice = updates.fillPrice ?? null;
  const fillSize = updates.fillSize ?? null;
  const fees = updates.fees ?? null;
  const txHash = updates.txHash ?? null;
  const venueOrderId = updates.venueOrderId ?? null;

  await sql`
    UPDATE executed_trades
    SET status = ${updates.status},
        fill_price = COALESCE(${fillPrice}, fill_price),
        fill_size = COALESCE(${fillSize}, fill_size),
        fees = COALESCE(${fees}, fees),
        tx_hash = COALESCE(${txHash}, tx_hash),
        venue_order_id = COALESCE(${venueOrderId}, venue_order_id)
    WHERE id = ${id}
  `;
}

export async function closeExecutedTrade(
  id: string,
  closePrice: number,
  realizedPnl: number
): Promise<void> {
  await sql`
    UPDATE executed_trades
    SET status = 'closed',
        closed_at = NOW()::text,
        close_price = ${closePrice},
        realized_pnl = ${realizedPnl}
    WHERE id = ${id}
  `;
}

export async function getTradesByPasteTradeId(tradeId: string): Promise<ExecutedTrade[]> {
  const rows = await sql`SELECT * FROM executed_trades WHERE trade_id = ${tradeId} ORDER BY created_at DESC`;
  return rows as ExecutedTrade[];
}
