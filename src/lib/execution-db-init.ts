/**
 * Ensures the executed_trades table exists in the database.
 * Call this before any execution DB operations.
 */

import { sql } from "./db";

let tableEnsured = false;

export async function ensureExecutedTradesTable(): Promise<void> {
  if (tableEnsured) return;

  await sql`
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
      closed_at TIMESTAMPTZ,
      close_price REAL,
      realized_pnl REAL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_executed_trades_wallet ON executed_trades(wallet_address)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_executed_trades_status ON executed_trades(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_executed_trades_trade ON executed_trades(trade_id)`;

  tableEnsured = true;
}
