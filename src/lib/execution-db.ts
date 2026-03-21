/**
 * Database layer for executed trades (trade execution tracking).
 */

import { db } from "./db";

// ---------------------------------------------------------------------------
// Schema migration — create executed_trades table if not exists
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS executed_trades (
    id TEXT PRIMARY KEY,
    trade_id TEXT,
    wallet_address TEXT NOT NULL,
    venue TEXT NOT NULL,
    asset TEXT NOT NULL,
    direction TEXT NOT NULL,
    order_type TEXT DEFAULT 'market',
    size_usd REAL NOT NULL,
    leverage REAL DEFAULT 1,
    entry_price REAL,
    stop_loss REAL,
    take_profit REAL,
    status TEXT DEFAULT 'pending',
    fill_price REAL,
    fill_size REAL,
    fees REAL,
    tx_hash TEXT,
    venue_order_id TEXT,
    closed_at TEXT,
    close_price REAL,
    realized_pnl REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_executed_trades_wallet ON executed_trades(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_executed_trades_status ON executed_trades(status);
  CREATE INDEX IF NOT EXISTS idx_executed_trades_trade ON executed_trades(trade_id);
`);

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
// Prepared statements
// ---------------------------------------------------------------------------

const stmts = {
  insert: db.prepare(`
    INSERT INTO executed_trades
      (id, trade_id, wallet_address, venue, asset, direction, order_type,
       size_usd, leverage, entry_price, stop_loss, take_profit, status,
       fill_price, fill_size, fees, tx_hash, venue_order_id)
    VALUES
      (@id, @trade_id, @wallet_address, @venue, @asset, @direction, @order_type,
       @size_usd, @leverage, @entry_price, @stop_loss, @take_profit, @status,
       @fill_price, @fill_size, @fees, @tx_hash, @venue_order_id)
  `),

  getById: db.prepare<[string], ExecutedTrade>(
    "SELECT * FROM executed_trades WHERE id = ?"
  ),

  getByWallet: db.prepare<[string], ExecutedTrade>(
    "SELECT * FROM executed_trades WHERE wallet_address = ? ORDER BY created_at DESC"
  ),

  getOpenByWallet: db.prepare<[string], ExecutedTrade>(
    "SELECT * FROM executed_trades WHERE wallet_address = ? AND status IN ('pending', 'filled', 'partial') ORDER BY created_at DESC"
  ),

  getClosedByWallet: db.prepare<[string], ExecutedTrade>(
    "SELECT * FROM executed_trades WHERE wallet_address = ? AND status IN ('closed', 'liquidated', 'cancelled', 'failed') ORDER BY closed_at DESC"
  ),

  updateStatus: db.prepare(`
    UPDATE executed_trades
    SET status = @status,
        fill_price = COALESCE(@fill_price, fill_price),
        fill_size = COALESCE(@fill_size, fill_size),
        fees = COALESCE(@fees, fees),
        tx_hash = COALESCE(@tx_hash, tx_hash),
        venue_order_id = COALESCE(@venue_order_id, venue_order_id)
    WHERE id = @id
  `),

  closePosition: db.prepare(`
    UPDATE executed_trades
    SET status = 'closed',
        closed_at = datetime('now'),
        close_price = @close_price,
        realized_pnl = @realized_pnl
    WHERE id = @id
  `),

  getByTradeId: db.prepare<[string], ExecutedTrade>(
    "SELECT * FROM executed_trades WHERE trade_id = ? ORDER BY created_at DESC"
  ),
};

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

export function insertExecutedTrade(p: InsertExecutedTrade): ExecutedTrade {
  stmts.insert.run({
    id: p.id,
    trade_id: p.tradeId ?? null,
    wallet_address: p.walletAddress,
    venue: p.venue,
    asset: p.asset,
    direction: p.direction,
    order_type: p.orderType ?? "market",
    size_usd: p.sizeUsd,
    leverage: p.leverage ?? 1,
    entry_price: p.entryPrice ?? null,
    stop_loss: p.stopLoss ?? null,
    take_profit: p.takeProfit ?? null,
    status: p.status ?? "pending",
    fill_price: p.fillPrice ?? null,
    fill_size: p.fillSize ?? null,
    fees: p.fees ?? null,
    tx_hash: p.txHash ?? null,
    venue_order_id: p.venueOrderId ?? null,
  });

  return stmts.getById.get(p.id) as ExecutedTrade;
}

export function getExecutedTrade(id: string): ExecutedTrade | undefined {
  return stmts.getById.get(id) ?? undefined;
}

export function getExecutedTradesByWallet(wallet: string): ExecutedTrade[] {
  return stmts.getByWallet.all(wallet);
}

export function getOpenTradesByWallet(wallet: string): ExecutedTrade[] {
  return stmts.getOpenByWallet.all(wallet);
}

export function getClosedTradesByWallet(wallet: string): ExecutedTrade[] {
  return stmts.getClosedByWallet.all(wallet);
}

export function updateTradeStatus(
  id: string,
  updates: {
    status: string;
    fillPrice?: number | null;
    fillSize?: number | null;
    fees?: number | null;
    txHash?: string | null;
    venueOrderId?: string | null;
  }
): void {
  stmts.updateStatus.run({
    id,
    status: updates.status,
    fill_price: updates.fillPrice ?? null,
    fill_size: updates.fillSize ?? null,
    fees: updates.fees ?? null,
    tx_hash: updates.txHash ?? null,
    venue_order_id: updates.venueOrderId ?? null,
  });
}

export function closeExecutedTrade(
  id: string,
  closePrice: number,
  realizedPnl: number
): void {
  stmts.closePosition.run({
    id,
    close_price: closePrice,
    realized_pnl: realizedPnl,
  });
}

export function getTradesByPasteTradeId(tradeId: string): ExecutedTrade[] {
  return stmts.getByTradeId.all(tradeId);
}
