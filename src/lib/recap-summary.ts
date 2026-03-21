/**
 * Generates a natural-language "market brief" paragraph from daily recap data.
 */

export interface RecapData {
  date: string;
  total_trades: number;
  total_callers_active: number;
  most_called_ticker: { ticker: string; count: number } | null;
  biggest_win: { handle: string; ticker: string; pnl: number } | null;
  biggest_loss: { handle: string; ticker: string; pnl: number } | null;
  hot_streak: { handle: string; streak: number } | null;
  new_callers: string[];
  venue_breakdown: Record<string, number>;
  consensus_play: { ticker: string; direction: string; agreement: number } | null;
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

export function generateRecapSummary(data: RecapData): string {
  if (data.total_trades === 0) {
    return "Quiet day on CT. No calls logged.";
  }

  const parts: string[] = [];

  // Opening — activity level
  if (data.total_trades >= 40) {
    parts.push(`Busy day on CT.`);
  } else if (data.total_trades >= 20) {
    parts.push(`Active day on CT.`);
  } else if (data.total_trades >= 5) {
    parts.push(`Steady day on CT.`);
  } else {
    parts.push(`Quiet day on CT.`);
  }

  // Trades + callers
  parts.push(
    `${data.total_trades} call${data.total_trades === 1 ? "" : "s"} across ${data.total_callers_active} caller${data.total_callers_active === 1 ? "" : "s"}.`,
  );

  // Most called ticker + consensus
  if (data.most_called_ticker) {
    let tickerLine = `$${data.most_called_ticker.ticker} dominated with ${data.most_called_ticker.count} call${data.most_called_ticker.count === 1 ? "" : "s"}`;
    if (
      data.consensus_play &&
      data.consensus_play.ticker === data.most_called_ticker.ticker &&
      data.consensus_play.agreement > 60
    ) {
      tickerLine += ` (${data.consensus_play.agreement}% ${data.consensus_play.direction})`;
    }
    tickerLine += ".";
    parts.push(tickerLine);
  }

  // Hot streak
  if (data.hot_streak && data.hot_streak.streak >= 3) {
    parts.push(
      `@${data.hot_streak.handle} extended ${data.hot_streak.streak >= 5 ? "an impressive" : "a"} streak to ${data.hot_streak.streak} wins.`,
    );
  }

  // Biggest win
  if (data.biggest_win && data.biggest_win.pnl > 0) {
    parts.push(
      `Top win: @${data.biggest_win.handle} on $${data.biggest_win.ticker} at ${formatPnl(data.biggest_win.pnl)}.`,
    );
  }

  // New callers
  if (data.new_callers.length > 0) {
    if (data.new_callers.length === 1) {
      parts.push(`One new caller joined the leaderboard.`);
    } else {
      parts.push(
        `${data.new_callers.length} new callers joined the leaderboard.`,
      );
    }
  }

  return parts.join(" ");
}
