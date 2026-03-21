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
  return rows.map((r: { chat_id: string }) => r.chat_id);
}

export async function getSubscriptions(chatId: string): Promise<string[]> {
  const rows = await sql`
    SELECT caller_handle FROM telegram_subs WHERE chat_id = ${chatId}
  `;
  return rows.map((r: { caller_handle: string }) => r.caller_handle);
}
