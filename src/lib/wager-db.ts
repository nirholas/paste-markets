/**
 * Wagering database layer.
 * All wager state lives in trade_wager_config + wagers tables.
 */

import { db } from "./db";

export interface TradeWagerConfig {
  trade_card_id: string;
  author_handle: string;
  ticker: string;
  direction: string;
  entry_price: number | null;
  wager_deadline: string;
  settlement_date: string;
  caller_tip_bps: number;
  total_wagered: number;
  wager_count: number;
  wager_vault_address: string | null;
  status: "active" | "settled" | "cancelled";
  settled_at: string | null;
  caller_tip_earned: number | null;
  created_at: string;
}

export interface Wager {
  id: string;
  trade_card_id: string;
  wallet_address: string;
  handle: string | null;
  amount: number;
  currency: string;
  status: "active" | "won" | "lost" | "refunded";
  wagered_at: string;
  settled_at: string | null;
  pnl_amount: number | null;
  tx_signature: string;
}

export interface WagerStats {
  trade_card_id: string;
  total_wagered: number;
  wager_count: number;
  wager_deadline: string;
  settlement_date: string;
  status: "active" | "settled" | "cancelled";
  caller_tip_earned: number | null;
  is_deadline_passed: boolean;
  is_settled: boolean;
}

const MAX_WAGER_PER_USER = 500; // USDC

// ─── vault address ────────────────────────────────────────────────────────────

/**
 * Deterministic vault identifier based on trade card ID.
 * In production this would be a Solana PDA derived from ["wager-vault", tradeCardId].
 * For now we return a placeholder string that communicates the pattern.
 */
export function deriveVaultAddress(tradeCardId: string): string {
  // Truncate + encode for a human-readable placeholder
  const slug = tradeCardId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  return `wagerVault_${slug}`;
}

// ─── config ───────────────────────────────────────────────────────────────────

const stmts = {
  getConfig: db.prepare<[string], TradeWagerConfig>(
    "SELECT * FROM trade_wager_config WHERE trade_card_id = ?",
  ),

  insertConfig: db.prepare(`
    INSERT OR IGNORE INTO trade_wager_config
      (trade_card_id, author_handle, ticker, direction, entry_price,
       wager_deadline, settlement_date, caller_tip_bps, wager_vault_address)
    VALUES
      (@trade_card_id, @author_handle, @ticker, @direction, @entry_price,
       @wager_deadline, @settlement_date, @caller_tip_bps, @wager_vault_address)
  `),

  incrementTotals: db.prepare(`
    UPDATE trade_wager_config
    SET total_wagered = total_wagered + @amount,
        wager_count   = wager_count + 1
    WHERE trade_card_id = @trade_card_id
  `),

  settleConfig: db.prepare(`
    UPDATE trade_wager_config
    SET status           = 'settled',
        settled_at       = datetime('now'),
        caller_tip_earned = @caller_tip_earned
    WHERE trade_card_id = @trade_card_id
  `),

  getConfigsByAuthor: db.prepare<[string], TradeWagerConfig>(
    "SELECT * FROM trade_wager_config WHERE author_handle = ? ORDER BY created_at DESC",
  ),

  sumTipsEarned: db.prepare<[string], { total: number | null }>(
    "SELECT SUM(caller_tip_earned) as total FROM trade_wager_config WHERE author_handle = ? AND status = 'settled' AND caller_tip_earned > 0",
  ),
};

const wagerStmts = {
  insert: db.prepare(`
    INSERT INTO wagers
      (id, trade_card_id, wallet_address, handle, amount, currency, tx_signature)
    VALUES
      (@id, @trade_card_id, @wallet_address, @handle, @amount, @currency, @tx_signature)
  `),

  getByTrade: db.prepare<[string], Wager>(
    "SELECT * FROM wagers WHERE trade_card_id = ? ORDER BY wagered_at ASC",
  ),

  getByWallet: db.prepare<[string, string], Wager>(
    "SELECT * FROM wagers WHERE trade_card_id = ? AND wallet_address = ?",
  ),

  settleWager: db.prepare(`
    UPDATE wagers
    SET status     = @status,
        settled_at = datetime('now'),
        pnl_amount = @pnl_amount
    WHERE trade_card_id = @trade_card_id AND wallet_address = @wallet_address
  `),

  settleAll: db.prepare(`
    UPDATE wagers SET status = @status, settled_at = datetime('now')
    WHERE trade_card_id = @trade_card_id AND status = 'active'
  `),

  sumByAuthor: db.prepare<[string], { total_earned: number | null }>(`
    SELECT SUM(w.pnl_amount) as total_earned
    FROM wagers w
    JOIN trade_wager_config c ON c.trade_card_id = w.trade_card_id
    WHERE c.author_handle = ? AND w.status = 'won'
  `),
};

// ─── public API ───────────────────────────────────────────────────────────────

export function getWagerConfig(tradeCardId: string): TradeWagerConfig | undefined {
  return stmts.getConfig.get(tradeCardId) ?? undefined;
}

export interface EnableWagerParams {
  tradeCardId: string;
  authorHandle: string;
  ticker: string;
  direction: string;
  entryPrice?: number;
  /** Hours until no new wagers accepted. Default: 24 */
  wagerWindowHours?: number;
  /** Days from now until settlement. Default: 7 */
  settlementDays?: number;
  callerTipBps?: number;
}

export function enableWager(p: EnableWagerParams): TradeWagerConfig {
  const windowH = p.wagerWindowHours ?? 24;
  const settleDays = p.settlementDays ?? 7;

  const deadline = new Date(Date.now() + windowH * 3_600_000).toISOString();
  const settlement = new Date(Date.now() + settleDays * 86_400_000).toISOString();
  const vault = deriveVaultAddress(p.tradeCardId);

  stmts.insertConfig.run({
    trade_card_id: p.tradeCardId,
    author_handle: p.authorHandle,
    ticker: p.ticker,
    direction: p.direction,
    entry_price: p.entryPrice ?? null,
    wager_deadline: deadline,
    settlement_date: settlement,
    caller_tip_bps: p.callerTipBps ?? 1000,
    wager_vault_address: vault,
  });

  return stmts.getConfig.get(p.tradeCardId) as TradeWagerConfig;
}

export interface SubmitWagerParams {
  id: string;
  tradeCardId: string;
  walletAddress: string;
  handle?: string;
  amount: number;
  currency?: string;
  txSignature: string;
}

export type SubmitWagerResult =
  | { ok: true; wager: Wager }
  | { ok: false; error: string };

export function submitWager(p: SubmitWagerParams): SubmitWagerResult {
  const config = stmts.getConfig.get(p.tradeCardId);
  if (!config) return { ok: false, error: "Trade not found or wagering not enabled" };
  if (config.status !== "active") return { ok: false, error: "Wagering is closed for this call" };

  const now = new Date();
  const deadline = new Date(config.wager_deadline);
  if (now > deadline) return { ok: false, error: "Wager deadline has passed" };

  if (p.amount <= 0) return { ok: false, error: "Amount must be greater than 0" };
  if (p.amount > MAX_WAGER_PER_USER) {
    return { ok: false, error: `Maximum wager per user is ${MAX_WAGER_PER_USER} USDC` };
  }

  // Prevent caller self-wagering
  if (p.handle && p.handle.replace(/^@/, "").toLowerCase() === config.author_handle.toLowerCase()) {
    return { ok: false, error: "Callers cannot wager on their own calls" };
  }

  // Check if wallet already wagered
  const existing = wagerStmts.getByWallet.get(p.tradeCardId, p.walletAddress);
  if (existing) return { ok: false, error: "This wallet has already wagered on this call" };

  const insertAndIncrement = db.transaction(() => {
    wagerStmts.insert.run({
      id: p.id,
      trade_card_id: p.tradeCardId,
      wallet_address: p.walletAddress,
      handle: p.handle ?? null,
      amount: p.amount,
      currency: p.currency ?? "USDC",
      tx_signature: p.txSignature,
    });
    stmts.incrementTotals.run({ amount: p.amount, trade_card_id: p.tradeCardId });
  });

  insertAndIncrement();

  const wager = wagerStmts.getByWallet.get(p.tradeCardId, p.walletAddress) as Wager;
  return { ok: true, wager };
}

export function getWagersByTrade(tradeCardId: string): Wager[] {
  return wagerStmts.getByTrade.all(tradeCardId);
}

export function getWagerStats(tradeCardId: string): WagerStats | null {
  const config = stmts.getConfig.get(tradeCardId);
  if (!config) return null;

  const now = new Date();
  return {
    trade_card_id: config.trade_card_id,
    total_wagered: config.total_wagered,
    wager_count: config.wager_count,
    wager_deadline: config.wager_deadline,
    settlement_date: config.settlement_date,
    status: config.status,
    caller_tip_earned: config.caller_tip_earned,
    is_deadline_passed: now > new Date(config.wager_deadline),
    is_settled: config.status === "settled",
  };
}

// ─── settlement ───────────────────────────────────────────────────────────────

export interface SettleParams {
  tradeCardId: string;
  /** Final price at settlement time */
  exitPrice: number;
  /** Optional: authoritative PnL percentage override */
  pnlPctOverride?: number;
}

export interface SettlementResult {
  callerTip: number;
  totalWagered: number;
  grossProfit: number;
  netToWagerers: number;
  wagererResults: Array<{
    walletAddress: string;
    handle: string | null;
    principal: number;
    pnl: number;
    status: "won" | "lost";
  }>;
}

export function settleWagers(p: SettleParams): SettlementResult | { error: string } {
  const config = stmts.getConfig.get(p.tradeCardId);
  if (!config) return { error: "Trade wager config not found" };
  if (config.status !== "active") return { error: "Already settled or cancelled" };

  const wagers = wagerStmts.getByTrade.all(p.tradeCardId).filter((w) => w.status === "active");

  const entryPrice = config.entry_price;
  let pnlPct: number;

  if (p.pnlPctOverride !== undefined) {
    pnlPct = p.pnlPctOverride;
  } else if (entryPrice && entryPrice > 0) {
    pnlPct = ((p.exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return { error: "No entry price set; provide pnlPctOverride" };
  }

  // Adjust pnlPct for short: profit = price went down
  const isShort = config.direction === "short" || config.direction === "no";
  const effectivePnl = isShort ? -pnlPct : pnlPct;

  const totalWagered = wagers.reduce((s, w) => s + w.amount, 0);
  const isProfit = effectivePnl > 0;

  // Gross profit = totalWagered * effectivePnl/100 (can be negative = loss)
  const grossProfit = totalWagered * (effectivePnl / 100);
  const callerTipBps = config.caller_tip_bps;

  let callerTip = 0;
  let netToWagerers = 0;

  if (isProfit) {
    callerTip = grossProfit * (callerTipBps / 10_000);
    netToWagerers = grossProfit - callerTip;
  } else {
    // Loss: wagerers lose proportional stake; caller gets nothing extra
    netToWagerers = grossProfit; // negative
  }

  const wagererResults: SettlementResult["wagererResults"] = [];

  const settle = db.transaction(() => {
    for (const w of wagers) {
      const share = totalWagered > 0 ? w.amount / totalWagered : 0;
      const wagerPnl = isProfit
        ? share * netToWagerers       // proportional profit share
        : share * Math.abs(netToWagerers) * -1; // proportional loss
      const status: "won" | "lost" = wagerPnl >= 0 ? "won" : "lost";

      wagerStmts.settleWager.run({
        status,
        pnl_amount: parseFloat(wagerPnl.toFixed(6)),
        trade_card_id: p.tradeCardId,
        wallet_address: w.wallet_address,
      });

      wagererResults.push({
        walletAddress: w.wallet_address,
        handle: w.handle,
        principal: w.amount,
        pnl: parseFloat(wagerPnl.toFixed(6)),
        status,
      });
    }

    stmts.settleConfig.run({
      caller_tip_earned: parseFloat(callerTip.toFixed(6)),
      trade_card_id: p.tradeCardId,
    });
  });

  settle();

  return {
    callerTip: parseFloat(callerTip.toFixed(6)),
    totalWagered,
    grossProfit: parseFloat(grossProfit.toFixed(6)),
    netToWagerers: parseFloat(netToWagerers.toFixed(6)),
    wagererResults,
  };
}

// ─── caller stats ─────────────────────────────────────────────────────────────

export function getCallerTipsEarned(authorHandle: string): number {
  const row = stmts.sumTipsEarned.get(authorHandle);
  return row?.total ?? 0;
}

export function getCallerWagerHistory(authorHandle: string): TradeWagerConfig[] {
  return stmts.getConfigsByAuthor.all(authorHandle);
}

// ─── cron helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all active wager configs whose settlement_date has passed and have
 * at least one wager — ready for cron-triggered settlement.
 */
export function getExpiredUnsettledConfigs(): TradeWagerConfig[] {
  return db
    .prepare<[], TradeWagerConfig>(
      `SELECT * FROM trade_wager_config
       WHERE status = 'active'
         AND settlement_date <= datetime('now')
         AND wager_count > 0`,
    )
    .all();
}

// ─── social / feed queries ───────────────────────────────────────────────────

export interface BackerInfo {
  handle: string | null;
  backer_avatar_url: string | null;
  amount: number;
  wagered_at: string;
}

export interface WagerEventRow {
  id: string;
  type: string;
  trade_id: string;
  caller_handle: string;
  backer_handle: string | null;
  amount: number | null;
  pnl_percent: number | null;
  tip_amount: number | null;
  created_at: string;
}

export interface CallerEarnings {
  author_handle: string;
  total_tips: number;
  backed_trade_count: number;
}

const socialStmts = {
  getBackersByTrade: db.prepare<[string], BackerInfo>(
    `SELECT handle, backer_avatar_url, amount, wagered_at
     FROM wagers WHERE trade_card_id = ? ORDER BY amount DESC`,
  ),

  getTopBacker: db.prepare<[string], BackerInfo>(
    `SELECT handle, backer_avatar_url, amount, wagered_at
     FROM wagers WHERE trade_card_id = ? ORDER BY amount DESC LIMIT 1`,
  ),

  insertWagerEvent: db.prepare(`
    INSERT INTO wager_events (id, type, trade_id, caller_handle, backer_handle, amount, pnl_percent, tip_amount)
    VALUES (@id, @type, @trade_id, @caller_handle, @backer_handle, @amount, @pnl_percent, @tip_amount)
  `),

  getWagerEvents: db.prepare<[], WagerEventRow>(
    `SELECT * FROM wager_events ORDER BY created_at DESC LIMIT 100`,
  ),

  getWagerEventsByTrade: db.prepare<[string], WagerEventRow>(
    `SELECT * FROM wager_events WHERE trade_id = ? ORDER BY created_at DESC`,
  ),

  // All active wager configs with stats, ordered by total wagered
  getActiveConfigs: db.prepare<[], TradeWagerConfig>(
    `SELECT * FROM trade_wager_config WHERE status = 'active' ORDER BY total_wagered DESC`,
  ),

  getSettledConfigs: db.prepare<[], TradeWagerConfig>(
    `SELECT * FROM trade_wager_config WHERE status = 'settled' ORDER BY settled_at DESC`,
  ),

  getAllConfigs: db.prepare<[], TradeWagerConfig>(
    `SELECT * FROM trade_wager_config ORDER BY created_at DESC`,
  ),

  // Wagers by wallet across all trades
  getWagersByWallet: db.prepare<[string], Wager & { author_handle: string; ticker: string; direction: string }>(
    `SELECT w.*, c.author_handle, c.ticker, c.direction
     FROM wagers w
     JOIN trade_wager_config c ON c.trade_card_id = w.trade_card_id
     WHERE w.wallet_address = ?
     ORDER BY w.wagered_at DESC`,
  ),

  // Caller earnings leaderboard
  callerEarningsLeaderboard: db.prepare<[], CallerEarnings>(
    `SELECT
       author_handle,
       SUM(caller_tip_earned) as total_tips,
       COUNT(*) as backed_trade_count
     FROM trade_wager_config
     WHERE status = 'settled' AND caller_tip_earned > 0
     GROUP BY author_handle
     ORDER BY total_tips DESC
     LIMIT 50`,
  ),
};

export function getBackersByTrade(tradeCardId: string): BackerInfo[] {
  return socialStmts.getBackersByTrade.all(tradeCardId);
}

export function getTopBacker(tradeCardId: string): BackerInfo | undefined {
  return socialStmts.getTopBacker.get(tradeCardId) ?? undefined;
}

export function insertWagerEvent(event: {
  id: string;
  type: string;
  tradeId: string;
  callerHandle: string;
  backerHandle?: string;
  amount?: number;
  pnlPercent?: number;
  tipAmount?: number;
}): void {
  socialStmts.insertWagerEvent.run({
    id: event.id,
    type: event.type,
    trade_id: event.tradeId,
    caller_handle: event.callerHandle,
    backer_handle: event.backerHandle ?? null,
    amount: event.amount ?? null,
    pnl_percent: event.pnlPercent ?? null,
    tip_amount: event.tipAmount ?? null,
  });
}

export function getWagerEvents(): WagerEventRow[] {
  return socialStmts.getWagerEvents.all();
}

export function getWagerEventsByTrade(tradeId: string): WagerEventRow[] {
  return socialStmts.getWagerEventsByTrade.all(tradeId);
}

export function getActiveWagerConfigs(): TradeWagerConfig[] {
  return socialStmts.getActiveConfigs.all();
}

export function getSettledWagerConfigs(): TradeWagerConfig[] {
  return socialStmts.getSettledConfigs.all();
}

export function getAllWagerConfigs(): TradeWagerConfig[] {
  return socialStmts.getAllConfigs.all();
}

export function getWagersByWallet(walletAddress: string) {
  return socialStmts.getWagersByWallet.all(walletAddress);
}

export function getCallerEarningsLeaderboard(): CallerEarnings[] {
  return socialStmts.callerEarningsLeaderboard.all();
}
