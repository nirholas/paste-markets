import { NextRequest, NextResponse } from "next/server";
import {
  ensureAlertsTable,
  getUnsentSignals,
  getUnnotifiedSubscribers,
  markAlertSent,
} from "@/lib/telegram-db";
import {
  formatChannelAlert,
  formatTradeAlert,
  type ChannelTradeAlert,
} from "@/lib/telegram-format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
const CHANNEL_ID = process.env["TELEGRAM_CHANNEL_ID"] ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Sentinel value used in telegram_alerts_sent to track channel broadcasts
const CHANNEL_SENTINEL = "__channel__";

async function sendTelegram(
  chatId: string,
  text: string,
  parseMode = "MarkdownV2",
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[telegram-alerts] Failed to send to ${chatId}: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram-alerts] Send error for ${chatId}:`, err);
    return false;
  }
}

/**
 * GET /api/cron/telegram-alerts
 *
 * Polls live_signals for new high-confidence trade signals and:
 * 1. Posts them to the public Telegram channel (if TELEGRAM_CHANNEL_ID is set)
 * 2. Sends DM alerts to individual subscribers of those callers
 *
 * Designed for Vercel Cron — run every 1-2 minutes.
 * Cron schedule: every 2 minutes (vercel.json crons config)
 */
export async function GET(req: NextRequest) {
  // Auth check
  const cronSecret = process.env["CRON_SECRET"];
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 503 });
  }

  await ensureAlertsTable();

  const signals = await getUnsentSignals();

  if (signals.length === 0) {
    return NextResponse.json({ sent: 0, signals: 0, subscribers_notified: 0 });
  }

  let channelSent = 0;
  let subscribersSent = 0;

  for (const signal of signals) {
    const alertData: ChannelTradeAlert = {
      author_handle: signal.handle,
      ticker: signal.ticker,
      direction: signal.direction,
      platform: signal.platform,
      entry_price: signal.entry_price,
      confidence: signal.confidence,
      tweet_url: signal.tweet_url,
    };

    // 1. Post to public channel
    if (CHANNEL_ID) {
      const channelMsg = formatChannelAlert(alertData);
      const ok = await sendTelegram(CHANNEL_ID, channelMsg);
      if (ok) {
        await markAlertSent(signal.id, CHANNEL_SENTINEL);
        channelSent++;
      }
    } else {
      // No channel configured — still mark as "sent" so we don't reprocess
      await markAlertSent(signal.id, CHANNEL_SENTINEL);
    }

    // 2. DM individual subscribers
    const subscribers = await getUnnotifiedSubscribers(signal.id, signal.handle);
    for (const chatId of subscribers) {
      const dmMsg = formatTradeAlert({
        author_handle: signal.handle,
        ticker: signal.ticker,
        direction: signal.direction,
        entry_price: signal.entry_price ?? undefined,
        platform: signal.platform ?? undefined,
      });
      const ok = await sendTelegram(chatId, dmMsg);
      if (ok) {
        await markAlertSent(signal.id, chatId);
        subscribersSent++;
      }
    }

    // Throttle between signals to avoid Telegram rate limits (30 msgs/sec for bots)
    if (signals.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return NextResponse.json({
    signals: signals.length,
    channel_sent: channelSent,
    subscribers_notified: subscribersSent,
  });
}
