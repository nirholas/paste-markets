/**
 * Telegram subscription database operations.
 * Uses Neon serverless Postgres via the shared sql connection.
 */

import { sql } from "./db";

export async function addTelegramSub(chatId: string, callerHandle: string): Promise<void> {
  await sql`
    INSERT INTO telegram_subs (chat_id, caller_handle)
    VALUES (${chatId}, ${callerHandle})
    ON CONFLICT DO NOTHING
  `;
}

export async function removeTelegramSub(chatId: string, callerHandle: string): Promise<void> {
  await sql`
    DELETE FROM telegram_subs
    WHERE chat_id = ${chatId} AND caller_handle = ${callerHandle}
  `;
}

export async function getSubscribers(callerHandle: string): Promise<string[]> {
  const rows = await sql`
    SELECT chat_id FROM telegram_subs WHERE caller_handle = ${callerHandle}
  `;
  return rows.map((r) => String(r.chat_id));
}

export async function getSubscriptions(chatId: string): Promise<string[]> {
  const rows = await sql`
    SELECT caller_handle FROM telegram_subs WHERE chat_id = ${chatId}
  `;
  return rows.map((r) => String(r.caller_handle));
}

// ── Alert tracking ──────────────────────────────────────────────────────────

export async function ensureAlertsTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS telegram_alerts_sent (
      id SERIAL PRIMARY KEY,
      signal_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(signal_id, chat_id)
    )
  `;
}

/**
 * Get signals that have not been broadcast to Telegram yet.
 * Only looks at signals from the last 2 hours to limit scan range.
 */
export async function getUnsentSignals(): Promise<
  Array<{
    id: number;
    handle: string;
    ticker: string;
    direction: string;
    platform: string | null;
    entry_price: number | null;
    confidence: number;
    tweet_url: string;
    detected_at: string;
  }>
> {
  const rows = await sql`
    SELECT ls.id, ls.handle, ls.ticker, ls.direction, ls.platform,
           ls.entry_price, ls.confidence, ls.tweet_url, ls.detected_at
    FROM live_signals ls
    WHERE ls.detected_at >= NOW() - INTERVAL '2 hours'
      AND ls.confidence >= 0.6
      AND NOT EXISTS (
        SELECT 1 FROM telegram_alerts_sent ta
        WHERE ta.signal_id = ls.id AND ta.chat_id = '__channel__'
      )
    ORDER BY ls.detected_at ASC
  `;
  return rows as Array<{
    id: number;
    handle: string;
    ticker: string;
    direction: string;
    platform: string | null;
    entry_price: number | null;
    confidence: number;
    tweet_url: string;
    detected_at: string;
  }>;
}

/**
 * Get subscriber chat_ids that haven't received a specific signal yet.
 */
export async function getUnnotifiedSubscribers(
  signalId: number,
  callerHandle: string,
): Promise<string[]> {
  const rows = await sql`
    SELECT ts.chat_id
    FROM telegram_subs ts
    WHERE ts.caller_handle = ${callerHandle}
      AND NOT EXISTS (
        SELECT 1 FROM telegram_alerts_sent ta
        WHERE ta.signal_id = ${signalId} AND ta.chat_id = ts.chat_id
      )
  `;
  return rows.map((r) => String(r.chat_id));
}

/**
 * Mark a signal as sent to a specific chat_id (or '__channel__' for channel posts).
 */
export async function markAlertSent(signalId: number, chatId: string): Promise<void> {
  await sql`
    INSERT INTO telegram_alerts_sent (signal_id, chat_id)
    VALUES (${signalId}, ${chatId})
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Batch-mark signals as sent to channel.
 */
export async function markAlertsSentBatch(
  entries: Array<{ signalId: number; chatId: string }>,
): Promise<void> {
  for (const entry of entries) {
    await sql`
      INSERT INTO telegram_alerts_sent (signal_id, chat_id)
      VALUES (${entry.signalId}, ${entry.chatId})
      ON CONFLICT DO NOTHING
    `;
  }
}
