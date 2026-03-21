/**
 * Alert Matcher — match incoming trades against all active alert rules,
 * then dispatch notifications via browser, Telegram, or webhook.
 */

import { randomUUID } from "node:crypto";
import type { DetectedTrade, MatchedAlert, AlertChannel } from "./alert-rules";
import { evaluateRule } from "./alert-rules";
import {
  getAllEnabledAlertRules,
  incrementAlertRuleMatch,
  insertAlertNotification,
} from "./db";

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Match a detected trade against all enabled alert rules.
 * Returns the list of rules that matched, along with their channels.
 */
export function matchAlerts(trade: DetectedTrade): MatchedAlert[] {
  const rules = getAllEnabledAlertRules();
  const matches: MatchedAlert[] = [];

  for (const rule of rules) {
    if (evaluateRule(rule, trade)) {
      matches.push({
        rule,
        trade,
        channels: rule.channels,
      });
    }
  }

  return matches;
}

// ── Message Formatting ───────────────────────────────────────────────────────

function formatAlertMessage(match: MatchedAlert): string {
  const { trade, rule } = match;
  const arrow = trade.direction === "long" || trade.direction === "yes" ? "LONG" : "SHORT";
  const conf = trade.confidence != null ? ` (${Math.round(trade.confidence * 100)}% confidence)` : "";
  return `@${trade.callerHandle} called ${arrow} $${trade.ticker}${conf} — matched rule "${rule.name}"`;
}

function formatTelegramMessage(match: MatchedAlert): string {
  const { trade, rule } = match;
  const arrow = trade.direction === "long" || trade.direction === "yes" ? "LONG" : "SHORT";
  const emoji = arrow === "LONG" ? "\u{1F7E2}" : "\u{1F534}";
  const conf = trade.confidence != null ? `\nConfidence: ${Math.round(trade.confidence * 100)}%` : "";
  const tier = trade.tier ? ` [${trade.tier}-tier]` : "";

  const lines = [
    `${emoji} *SIGNAL ALERT*`,
    `Rule: ${escTg(rule.name)}`,
    `@${escTg(trade.callerHandle)}${escTg(tier)} → ${escTg(arrow)} $${escTg(trade.ticker)}`,
  ];
  if (conf) lines.push(escTg(conf.trim()));
  if (trade.entryPrice != null) lines.push(`Entry: $${escTg(trade.entryPrice.toFixed(2))}`);
  lines.push("");
  lines.push(`[View on paste\\.markets](https://paste.markets/${escTg(trade.callerHandle)})`);

  return lines.join("\n");
}

function escTg(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Dispatch all matched alerts to their respective channels.
 */
export async function dispatchAlerts(matches: MatchedAlert[]): Promise<void> {
  for (const match of matches) {
    // Update match count on the rule
    incrementAlertRuleMatch(match.rule.id);

    const message = formatAlertMessage(match);

    for (const channel of match.channels) {
      const notifId = randomUUID();

      // Always store browser notifications in DB
      if (channel.type === "browser") {
        insertAlertNotification({
          id: notifId,
          ruleId: match.rule.id,
          tradeId: match.trade.id,
          callerHandle: match.trade.callerHandle,
          ticker: match.trade.ticker,
          direction: match.trade.direction,
          message,
          channel: "browser",
          delivered: true,
        });
      }

      if (channel.type === "telegram") {
        const chatId = channel.config.chatId;
        if (chatId) {
          await sendTelegramAlert(chatId, formatTelegramMessage(match));
        }
        insertAlertNotification({
          id: notifId,
          ruleId: match.rule.id,
          tradeId: match.trade.id,
          callerHandle: match.trade.callerHandle,
          ticker: match.trade.ticker,
          direction: match.trade.direction,
          message,
          channel: "telegram",
          delivered: true,
        });
      }

      if (channel.type === "webhook") {
        const url = channel.config.webhookUrl;
        if (url) {
          await sendWebhookAlert(url, match);
        }
        insertAlertNotification({
          id: notifId,
          ruleId: match.rule.id,
          tradeId: match.trade.id,
          callerHandle: match.trade.callerHandle,
          ticker: match.trade.ticker,
          direction: match.trade.direction,
          message,
          channel: "webhook",
          delivered: true,
        });
      }
    }
  }
}

// ── Channel Implementations ──────────────────────────────────────────────────

async function sendTelegramAlert(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[alert-matcher] TELEGRAM_BOT_TOKEN not set, skipping Telegram dispatch");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[alert-matcher] Telegram dispatch failed:", err);
  }
}

async function sendWebhookAlert(url: string, match: MatchedAlert): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "trade_signal",
        rule: {
          id: match.rule.id,
          name: match.rule.name,
        },
        trade: {
          caller: match.trade.callerHandle,
          ticker: match.trade.ticker,
          direction: match.trade.direction,
          platform: match.trade.platform,
          confidence: match.trade.confidence,
          tier: match.trade.tier,
          entryPrice: match.trade.entryPrice,
          tweetUrl: match.trade.tweetUrl,
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[alert-matcher] Webhook dispatch failed:", err);
  }
}

// ── Convenience: match + dispatch in one call ────────────────────────────────

export async function processTradeSignal(trade: DetectedTrade): Promise<number> {
  const matches = matchAlerts(trade);
  if (matches.length > 0) {
    await dispatchAlerts(matches);
  }
  return matches.length;
}
