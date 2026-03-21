/**
 * POST /api/telegram/webhook
 * Receives Telegram Bot API webhook updates and responds to commands.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  formatWelcome,
  formatHelp,
  formatCallerStats,
  formatLeaderboard,
  type CallerStats,
  type LeaderboardRow,
} from "@/lib/telegram-format";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const WEBHOOK_SECRET = process.env["TELEGRAM_WEBHOOK_SECRET"] ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ---------- Telegram helpers ----------

async function sendMessage(chatId: number | string, text: string, parseMode = "MarkdownV2") {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

// ---------- Data fetchers (call own API routes) ----------

const BASE = process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";

async function fetchCallerStats(handle: string): Promise<CallerStats | null> {
  try {
    const res = await fetch(`${BASE}/api/author/${encodeURIComponent(handle)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      handle: data.handle ?? handle,
      total_trades: data.totalTrades ?? data.total_trades ?? 0,
      win_rate: data.winRate ?? data.win_rate ?? 0,
      avg_pnl: data.avgPnl ?? data.avg_pnl ?? 0,
      streak: data.streak ?? 0,
      best_ticker: data.bestTrade?.ticker ?? data.best_ticker ?? undefined,
    };
  } catch {
    return null;
  }
}

async function fetchLeaderboardData(timeframe: string): Promise<LeaderboardRow[]> {
  try {
    const res = await fetch(`${BASE}/api/leaderboard?timeframe=${encodeURIComponent(timeframe)}&limit=10`);
    if (!res.ok) return [];
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.rows ?? data.entries ?? [];
    return rows.slice(0, 10).map((r: Record<string, unknown>, i: number) => ({
      rank: (r.rank as number) ?? i + 1,
      handle: (r.handle as string) ?? "",
      win_rate: (r.win_rate as number) ?? (r.winRate as number) ?? 0,
      avg_pnl: (r.avg_pnl as number) ?? (r.avgPnl as number) ?? 0,
      total_trades: (r.total_trades as number) ?? (r.totalTrades as number) ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchTickerStats(ticker: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/ticker/${encodeURIComponent(ticker.toUpperCase())}`);
    if (!res.ok) return null;
    const data = await res.json();
    const trades = data.trades ?? data.recentTrades ?? [];
    const total = trades.length;
    if (total === 0) return null;
    const wins = trades.filter((t: Record<string, unknown>) => ((t.pnl_pct as number) ?? 0) > 0).length;
    const wr = total > 0 ? ((wins / total) * 100).toFixed(0) : "0";
    return `*$${ticker.toUpperCase()}*\n\nTotal Calls: ${total}\nWin Rate: ${wr}%\n\n[View on paste\\.markets](https://paste.markets/ticker/${ticker.toUpperCase()})`;
  } catch {
    return null;
  }
}

// ---------- Subscription management ----------

async function handleSubscribe(chatId: number | string, handle: string) {
  try {
    const { addTelegramSub } = await import("@/lib/telegram-db");
    const clean = handle.toLowerCase().replace(/^@/, "");
    await addTelegramSub(String(chatId), clean);
    await sendMessage(chatId, `Subscribed to alerts for *@${clean}*\\. You'll get notified on new calls\\.`);
  } catch {
    await sendMessage(chatId, "Failed to subscribe\\. Try again later\\.");
  }
}

async function handleUnsubscribe(chatId: number | string, handle: string) {
  try {
    const { removeTelegramSub } = await import("@/lib/telegram-db");
    const clean = handle.toLowerCase().replace(/^@/, "");
    await removeTelegramSub(String(chatId), clean);
    await sendMessage(chatId, `Unsubscribed from *@${clean}*\\.`);
  } catch {
    await sendMessage(chatId, "Failed to unsubscribe\\. Try again later\\.");
  }
}

async function handleMySubs(chatId: number | string) {
  try {
    const { getSubscriptions } = await import("@/lib/telegram-db");
    const subs = await getSubscriptions(String(chatId));
    if (subs.length === 0) {
      await sendMessage(chatId, "You have no active subscriptions\\. Use /subscribe \\{handle\\} to add one\\.");
      return;
    }
    const list = subs.map((h) => `• @${h.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1")}`).join("\n");
    await sendMessage(chatId, `*Your subscriptions:*\n\n${list}`);
  } catch {
    await sendMessage(chatId, "Failed to fetch subscriptions\\. Try again later\\.");
  }
}

// ---------- Command router ----------

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

function parseCommand(text: string): { cmd: string; args: string } {
  const trimmed = text.trim();
  // Handle /command@botname format
  const match = trimmed.match(/^\/(\w+)(?:@\w+)?\s*(.*)/s);
  if (!match) return { cmd: "", args: "" };
  return { cmd: match[1].toLowerCase(), args: match[2].trim() };
}

async function handleUpdate(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const { cmd, args } = parseCommand(msg.text);

  switch (cmd) {
    case "start": {
      await sendMessage(chatId, formatWelcome());
      break;
    }

    case "help": {
      await sendMessage(chatId, formatHelp());
      break;
    }

    case "caller": {
      if (!args) {
        await sendMessage(chatId, "Usage: `/caller handle`", "MarkdownV2");
        return;
      }
      const handle = args.replace(/^@/, "");
      const stats = await fetchCallerStats(handle);
      if (!stats) {
        await sendMessage(chatId, `Caller *@${handle}* not found\\.`, "MarkdownV2");
        return;
      }
      await sendMessage(chatId, formatCallerStats(stats));
      break;
    }

    case "ticker": {
      if (!args) {
        await sendMessage(chatId, "Usage: `/ticker SYMBOL`", "MarkdownV2");
        return;
      }
      const symbol = args.replace(/^\$/, "").toUpperCase();
      const result = await fetchTickerStats(symbol);
      if (!result) {
        await sendMessage(chatId, `No data for *$${symbol}*\\.`, "MarkdownV2");
        return;
      }
      await sendMessage(chatId, result);
      break;
    }

    case "top": {
      const tf = args || "7d";
      const validTimeframes = ["7d", "30d", "90d", "all"];
      if (!validTimeframes.includes(tf)) {
        await sendMessage(chatId, "Timeframe must be one of: 7d, 30d, 90d, all", "MarkdownV2");
        return;
      }
      const rows = await fetchLeaderboardData(tf);
      if (rows.length === 0) {
        await sendMessage(chatId, "No leaderboard data available\\.", "MarkdownV2");
        return;
      }
      await sendMessage(chatId, formatLeaderboard(rows, tf));
      break;
    }

    case "subscribe": {
      if (!args) {
        await sendMessage(chatId, "Usage: `/subscribe handle`", "MarkdownV2");
        return;
      }
      await handleSubscribe(chatId, args);
      break;
    }

    default: {
      await sendMessage(chatId, "Unknown command\\. Type /help for available commands\\.");
      break;
    }
  }
}

// ---------- Route handler ----------

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  // Validate the secret token set when registering the webhook via setWebhook({ secret_token })
  if (WEBHOOK_SECRET) {
    const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const update: TelegramUpdate = await req.json();
    // Process in background — Telegram expects a quick 200
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
