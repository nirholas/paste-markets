/**
 * Wagering database layer.
 * All wager state lives in trade_wager_config + wagers tables.
 * Uses @neondatabase/serverless via the shared `sql` tagged-template client.
 */

import { sql } from "./db";
import { deriveVaultPDA } from "./solana";

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
 * Returns the on-chain Solana vault PDA for a trade card.
 * Requires SOLANA_PROGRAM_ID env var. Returns null until a program is deployed.
 */
export function deriveVaultAddress(tradeCardId: string): string | null {
  const { deriveVaultPDA } = require("./solana");
  const result = deriveVaultPDA(tradeCardId);
  return result?.address ?? null;
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function getWagerConfig(tradeCardId: string): Promise<TradeWagerConfig | undefined> {
  const rows = await sql`SELECT * FROM trade_wager_config WHERE trade_card_id = ${tradeCardId}`;
  return (rows[0] as TradeWagerConfig) ?? undefined;
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

export async function enableWager(p: EnableWagerParams): Promise<TradeWagerConfig> {
  const windowH = p.wagerWindowHours ?? 24;
  const settleDays = p.settlementDays ?? 7;

  const deadline = new Date(Date.now() + windowH * 3_600_000).toISOString();
  const settlement = new Date(Date.now() + settleDays * 86_400_000).toISOString();
  const vault = deriveVaultAddress(p.tradeCardId);

  const entryPrice = p.entryPrice ?? null;
  const callerTipBps = p.callerTipBps ?? 1000;

  await sql`
    INSERT INTO trade_wager_config
      (trade_card_id, author_handle, ticker, direction, entry_price,
       wager_deadline, settlement_date, caller_tip_bps, wager_vault_address)
    VALUES
      (${p.tradeCardId}, ${p.authorHandle}, ${p.ticker}, ${p.direction}, ${entryPrice},
       ${deadline}, ${settlement}, ${callerTipBps}, ${vault})
    ON CONFLICT DO NOTHING
  `;

  const rows = await sql`SELECT * FROM trade_wager_config WHERE trade_card_id = ${p.tradeCardId}`;
  return rows[0] as TradeWagerConfig;
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

export async function submitWager(p: SubmitWagerParams): Promise<SubmitWagerResult> {
  const configRows = await sql`SELECT * FROM trade_wager_config WHERE trade_card_id = ${p.tradeCardId}`;
  const config = configRows[0] as TradeWagerConfig | undefined;
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
  const existingRows = await sql`SELECT * FROM wagers WHERE trade_card_id = ${p.tradeCardId} AND wallet_address = ${p.walletAddress}`;
  if (existingRows.length > 0) return { ok: false, error: "This wallet has already wagered on this call" };

  const handle = p.handle ?? null;
  const currency = p.currency ?? "USDC";

  // Sequential awaits instead of transaction
  await sql`
    INSERT INTO wagers
      (id, trade_card_id, wallet_address, handle, amount, currency, tx_signature)
    VALUES
      (${p.id}, ${p.tradeCardId}, ${p.walletAddress}, ${handle}, ${p.amount}, ${currency}, ${p.txSignature})
  `;

  await sql`
    UPDATE trade_wager_config
    SET total_wagered = total_wagered + ${p.amount},
        wager_count   = wager_count + 1
    WHERE trade_card_id = ${p.tradeCardId}
  `;

  const wagerRows = await sql`SELECT * FROM wagers WHERE trade_card_id = ${p.tradeCardId} AND wallet_address = ${p.walletAddress}`;
  const wager = wagerRows[0] as Wager;
  return { ok: true, wager };
}

export async function getWagersByTrade(tradeCardId: string): Promise<Wager[]> {
  const rows = await sql`SELECT * FROM wagers WHERE trade_card_id = ${tradeCardId} ORDER BY wagered_at ASC`;
  return rows as Wager[];
}

export async function getWagerStats(tradeCardId: string): Promise<WagerStats | null> {
  const configRows = await sql`SELECT * FROM trade_wager_config WHERE trade_card_id = ${tradeCardId}`;
  const config = configRows[0] as TradeWagerConfig | undefined;
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

export async function settleWagers(p: SettleParams): Promise<SettlementResult | { error: string }> {
  const configRows = await sql`SELECT * FROM trade_wager_config WHERE trade_card_id = ${p.tradeCardId}`;
  const config = configRows[0] as TradeWagerConfig | undefined;
  if (!config) return { error: "Trade wager config not found" };
  if (config.status !== "active") return { error: "Already settled or cancelled" };

  const allWagers = await sql`SELECT * FROM wagers WHERE trade_card_id = ${p.tradeCardId} ORDER BY wagered_at ASC`;
  const wagers = (allWagers as Wager[]).filter((w) => w.status === "active");

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

  // Sequential awaits instead of transaction
  for (const w of wagers) {
    const share = totalWagered > 0 ? w.amount / totalWagered : 0;
    const wagerPnl = isProfit
      ? share * netToWagerers       // proportional profit share
      : share * Math.abs(netToWagerers) * -1; // proportional loss
    const status: "won" | "lost" = wagerPnl >= 0 ? "won" : "lost";
    const pnlAmount = parseFloat(wagerPnl.toFixed(6));

    await sql`
      UPDATE wagers
      SET status     = ${status},
          settled_at = NOW(),
          pnl_amount = ${pnlAmount}
      WHERE trade_card_id = ${p.tradeCardId} AND wallet_address = ${w.wallet_address}
    `;

    wagererResults.push({
      walletAddress: w.wallet_address,
      handle: w.handle,
      principal: w.amount,
      pnl: pnlAmount,
      status,
    });
  }

  const callerTipEarned = parseFloat(callerTip.toFixed(6));
  await sql`
    UPDATE trade_wager_config
    SET status           = 'settled',
        settled_at       = NOW(),
        caller_tip_earned = ${callerTipEarned}
    WHERE trade_card_id = ${p.tradeCardId}
  `;

  return {
    callerTip: parseFloat(callerTip.toFixed(6)),
    totalWagered,
    grossProfit: parseFloat(grossProfit.toFixed(6)),
    netToWagerers: parseFloat(netToWagerers.toFixed(6)),
    wagererResults,
  };
}

// ─── caller stats ─────────────────────────────────────────────────────────────

export async function getCallerTipsEarned(authorHandle: string): Promise<number> {
  const rows = await sql`
    SELECT SUM(caller_tip_earned) as total FROM trade_wager_config
    WHERE author_handle = ${authorHandle} AND status = 'settled' AND caller_tip_earned > 0
  `;
  return (rows[0] as { total: number | null })?.total ?? 0;
}

export async function getCallerWagerHistory(authorHandle: string): Promise<TradeWagerConfig[]> {
  const rows = await sql`
    SELECT * FROM trade_wager_config WHERE author_handle = ${authorHandle} ORDER BY created_at DESC
  `;
  return rows as TradeWagerConfig[];
}

// ─── cron helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all active wager configs whose settlement_date has passed and have
 * at least one wager -- ready for cron-triggered settlement.
 */
export async function getExpiredUnsettledConfigs(): Promise<TradeWagerConfig[]> {
  const rows = await sql`
    SELECT * FROM trade_wager_config
    WHERE status = 'active'
      AND settlement_date <= NOW()
      AND wager_count > 0
  `;
  return rows as TradeWagerConfig[];
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

export async function getBackersByTrade(tradeCardId: string): Promise<BackerInfo[]> {
  const rows = await sql`
    SELECT handle, backer_avatar_url, amount, wagered_at
    FROM wagers WHERE trade_card_id = ${tradeCardId} ORDER BY amount DESC
  `;
  return rows as BackerInfo[];
}

export async function getTopBacker(tradeCardId: string): Promise<BackerInfo | undefined> {
  const rows = await sql`
    SELECT handle, backer_avatar_url, amount, wagered_at
    FROM wagers WHERE trade_card_id = ${tradeCardId} ORDER BY amount DESC LIMIT 1
  `;
  return (rows[0] as BackerInfo) ?? undefined;
}

export async function insertWagerEvent(event: {
  id: string;
  type: string;
  tradeId: string;
  callerHandle: string;
  backerHandle?: string;
  amount?: number;
  pnlPercent?: number;
  tipAmount?: number;
}): Promise<void> {
  const backerHandle = event.backerHandle ?? null;
  const amount = event.amount ?? null;
  const pnlPercent = event.pnlPercent ?? null;
  const tipAmount = event.tipAmount ?? null;

  await sql`
    INSERT INTO wager_events (id, type, trade_id, caller_handle, backer_handle, amount, pnl_percent, tip_amount)
    VALUES (${event.id}, ${event.type}, ${event.tradeId}, ${event.callerHandle}, ${backerHandle}, ${amount}, ${pnlPercent}, ${tipAmount})
  `;
}

export async function getWagerEvents(): Promise<WagerEventRow[]> {
  const rows = await sql`SELECT * FROM wager_events ORDER BY created_at DESC LIMIT 100`;
  return rows as WagerEventRow[];
}

export async function getWagerEventsByTrade(tradeId: string): Promise<WagerEventRow[]> {
  const rows = await sql`SELECT * FROM wager_events WHERE trade_id = ${tradeId} ORDER BY created_at DESC`;
  return rows as WagerEventRow[];
}

export async function getActiveWagerConfigs(): Promise<TradeWagerConfig[]> {
  const rows = await sql`SELECT * FROM trade_wager_config WHERE status = 'active' ORDER BY total_wagered DESC`;
  return rows as TradeWagerConfig[];
}

export async function getSettledWagerConfigs(): Promise<TradeWagerConfig[]> {
  const rows = await sql`SELECT * FROM trade_wager_config WHERE status = 'settled' ORDER BY settled_at DESC`;
  return rows as TradeWagerConfig[];
}

export async function getAllWagerConfigs(): Promise<TradeWagerConfig[]> {
  const rows = await sql`SELECT * FROM trade_wager_config ORDER BY created_at DESC`;
  return rows as TradeWagerConfig[];
}

export async function getWagersByWallet(walletAddress: string): Promise<(Wager & { author_handle: string; ticker: string; direction: string })[]> {
  const rows = await sql`
    SELECT w.*, c.author_handle, c.ticker, c.direction
    FROM wagers w
    JOIN trade_wager_config c ON c.trade_card_id = w.trade_card_id
    WHERE w.wallet_address = ${walletAddress}
    ORDER BY w.wagered_at DESC
  `;
  return rows as (Wager & { author_handle: string; ticker: string; direction: string })[];
}

export async function getCallerEarningsLeaderboard(): Promise<CallerEarnings[]> {
  const rows = await sql`
    SELECT
      author_handle,
      SUM(caller_tip_earned) as total_tips,
      COUNT(*) as backed_trade_count
    FROM trade_wager_config
    WHERE status = 'settled' AND caller_tip_earned > 0
    GROUP BY author_handle
    ORDER BY total_tips DESC
    LIMIT 50
  `;
  return rows as CallerEarnings[];
}
