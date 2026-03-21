/**
 * Telegram message formatting utilities.
 * Uses Telegram MarkdownV2 format for rich bot messages.
 */

// Escape special characters for Telegram MarkdownV2
function esc(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

export interface TradeAlert {
  author_handle: string;
  ticker: string;
  direction: string;
  entry_price?: number;
  pnl_pct?: number;
  platform?: string;
}

export interface CallerStats {
  handle: string;
  total_trades: number;
  win_rate: number;
  avg_pnl: number;
  streak: number;
  best_ticker?: string;
}

export interface LeaderboardRow {
  rank: number;
  handle: string;
  win_rate: number;
  avg_pnl: number;
  total_trades: number;
}

export function formatTradeAlert(trade: TradeAlert): string {
  const arrow = trade.direction === "long" || trade.direction === "yes" ? "LONG" : "SHORT";
  const emoji = arrow === "LONG" ? "\\u{1F7E2}" : "\\u{1F534}";

  const lines = [
    `${emoji} *NEW CALL*`,
    `@${esc(trade.author_handle)} → ${esc(arrow)} $${esc(trade.ticker)}`,
  ];

  if (trade.entry_price != null) {
    lines.push(`Entry: $${esc(trade.entry_price.toFixed(2))}`);
  }
  if (trade.platform) {
    lines.push(`Platform: ${esc(trade.platform)}`);
  }
  if (trade.pnl_pct != null) {
    const sign = trade.pnl_pct >= 0 ? "+" : "";
    lines.push(`P&L: ${esc(sign + trade.pnl_pct.toFixed(1) + "%")}`);
  }

  lines.push("");
  lines.push(`Track it → [paste\\.markets/${esc(trade.author_handle)}](https://paste.markets/${esc(trade.author_handle)})`);

  return lines.join("\n");
}

export function formatCallerStats(stats: CallerStats): string {
  const winBar = buildWinBar(stats.win_rate);
  const sign = stats.avg_pnl >= 0 ? "+" : "";

  const lines = [
    `*@${esc(stats.handle)}*`,
    "",
    `Trades: ${stats.total_trades}`,
    `Win Rate: ${esc((stats.win_rate * 100).toFixed(0) + "%")} ${esc(winBar)}`,
    `Avg P&L: ${esc(sign + stats.avg_pnl.toFixed(1) + "%")}`,
    `Streak: ${stats.streak >= 0 ? esc("+" + stats.streak) : esc(String(stats.streak))}`,
  ];

  if (stats.best_ticker) {
    lines.push(`Best Asset: $${esc(stats.best_ticker)}`);
  }

  lines.push("");
  lines.push(`[View Profile](https://paste.markets/${esc(stats.handle)})`);

  return lines.join("\n");
}

export function formatLeaderboard(rows: LeaderboardRow[], timeframe: string): string {
  const header = `*Leaderboard — ${esc(timeframe)}*\n`;
  const tableRows = rows.map((r) => {
    const sign = r.avg_pnl >= 0 ? "+" : "";
    return `${esc(String(r.rank))}\\. @${esc(r.handle)}  ${esc((r.win_rate * 100).toFixed(0) + "%")} WR  ${esc(sign + r.avg_pnl.toFixed(1) + "%")} avg  \\(${r.total_trades} trades\\)`;
  });

  return header + tableRows.join("\n");
}

export function formatWelcome(): string {
  return [
    "*Welcome to paste\\.markets\\!*",
    "",
    "Real\\-time trade tracking for CT callers\\.",
    "",
    "*Commands:*",
    "/caller \\{handle\\} — Caller stats",
    "/ticker \\{symbol\\} — Ticker stats",
    "/top \\{timeframe\\} — Leaderboard \\(7d, 30d, 90d\\)",
    "/subscribe \\{handle\\} — Get alerts for a caller",
    "/help — Show this message",
    "",
    "[Visit paste\\.markets](https://paste.markets)",
  ].join("\n");
}

export function formatHelp(): string {
  return formatWelcome();
}

function buildWinBar(rate: number, len = 10): string {
  const filled = Math.round(rate * len);
  return "\u2588".repeat(filled) + "\u2591".repeat(len - filled);
}
