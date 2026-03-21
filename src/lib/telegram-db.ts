/**
 * Telegram subscription database operations.
 * Uses the same SQLite instance as the rest of the app.
 */

import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/db.sqlite");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");

    _db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_subs (
        chat_id TEXT NOT NULL,
        caller_handle TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (chat_id, caller_handle)
      )
    `);

    _db.exec(`CREATE INDEX IF NOT EXISTS idx_telegram_subs_handle ON telegram_subs(caller_handle)`);
  }
  return _db;
}

export function addTelegramSub(chatId: string, callerHandle: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO telegram_subs (chat_id, caller_handle) VALUES (?, ?)")
    .run(chatId, callerHandle);
}

export function removeTelegramSub(chatId: string, callerHandle: string): void {
  getDb()
    .prepare("DELETE FROM telegram_subs WHERE chat_id = ? AND caller_handle = ?")
    .run(chatId, callerHandle);
}

export function getSubscribers(callerHandle: string): string[] {
  const rows = getDb()
    .prepare("SELECT chat_id FROM telegram_subs WHERE caller_handle = ?")
    .all(callerHandle) as Array<{ chat_id: string }>;
  return rows.map((r) => r.chat_id);
}

export function getSubscriptions(chatId: string): string[] {
  const rows = getDb()
    .prepare("SELECT caller_handle FROM telegram_subs WHERE chat_id = ?")
    .all(chatId) as Array<{ caller_handle: string }>;
  return rows.map((r) => r.caller_handle);
}
