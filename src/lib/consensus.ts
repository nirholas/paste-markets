/**
 * Consensus aggregation logic.
 *
 * Groups trades by ticker, counts long vs short callers,
 * weights by caller quality (win rate), and classifies consensus.
 */

export interface ConsensusCallerDetail {
  handle: string;
  direction: "long" | "short";
  winRate: number;
  avgPnl: number;
  pnl: number | null;
}

export interface ConsensusPlay {
  ticker: string;
  platform: string;
  long_count: number;
  short_count: number;
  callers_long: string[];
  callers_short: string[];
  avg_pnl_long: number;
  avg_pnl_short: number;
  consensus: "strong_long" | "strong_short" | "contested" | "mixed";
  conviction_score: number; // 0-100
  callers: ConsensusCallerDetail[];
}

interface TradeInput {
  ticker: string;
  direction: string;
  handle: string;
  pnl: number | null;
  platform: string | null;
}

interface CallerStats {
  winRate: number;
  avgPnl: number;
}

function isLong(direction: string): boolean {
  return direction === "long" || direction === "yes";
}

function classifyConsensus(
  longCount: number,
  shortCount: number,
): ConsensusPlay["consensus"] {
  const total = longCount + shortCount;
  if (total === 0) return "mixed";
  const longPct = longCount / total;
  if (longPct >= 0.8) return "strong_long";
  if (longPct <= 0.2) return "strong_short";
  if (longPct >= 0.4 && longPct <= 0.6) return "contested";
  return "mixed";
}

/**
 * Conviction score: 0-100
 * - Agreement factor: how aligned callers are (100% one direction = 1.0, 50/50 = 0.0)
 * - Quality factor: avg win rate of callers (weighted)
 * - Volume factor: more callers = more conviction (log scale, caps at ~10)
 */
function computeConviction(
  longCount: number,
  shortCount: number,
  callers: ConsensusCallerDetail[],
): number {
  const total = longCount + shortCount;
  if (total === 0) return 0;

  // Agreement: 0 at 50/50, 1 at 100/0
  const majorityPct = Math.max(longCount, shortCount) / total;
  const agreement = (majorityPct - 0.5) * 2; // 0-1

  // Quality: weighted avg win rate of callers (0-1)
  const avgWR =
    callers.reduce((s, c) => s + c.winRate, 0) / callers.length / 100;
  const quality = Math.min(avgWR, 1);

  // Volume: log scale, 3 callers = ~0.5, 10+ = ~1.0
  const volume = Math.min(Math.log2(total) / Math.log2(10), 1);

  const raw = agreement * 40 + quality * 35 + volume * 25;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

export function aggregateConsensus(
  trades: TradeInput[],
  callerStatsMap: Map<string, CallerStats>,
  minCallers = 3,
): ConsensusPlay[] {
  // Group by ticker, deduplicate by handle (take latest direction per handle per ticker)
  const byTicker = new Map<
    string,
    Map<string, { direction: string; pnl: number | null; platform: string | null }>
  >();

  for (const trade of trades) {
    if (!trade.ticker || !trade.handle) continue;
    const ticker = trade.ticker.toUpperCase();
    if (!byTicker.has(ticker)) byTicker.set(ticker, new Map());
    const handleMap = byTicker.get(ticker)!;
    // Keep latest trade per handle per ticker
    if (!handleMap.has(trade.handle)) {
      handleMap.set(trade.handle, {
        direction: trade.direction,
        pnl: trade.pnl,
        platform: trade.platform,
      });
    }
  }

  const plays: ConsensusPlay[] = [];

  for (const [ticker, handleMap] of byTicker) {
    if (handleMap.size < minCallers) continue;

    const callers: ConsensusCallerDetail[] = [];
    const longHandles: string[] = [];
    const shortHandles: string[] = [];
    const longPnls: number[] = [];
    const shortPnls: number[] = [];
    let platform = "mixed";
    const platforms = new Set<string>();

    for (const [handle, data] of handleMap) {
      const stats = callerStatsMap.get(handle) ?? { winRate: 0, avgPnl: 0 };
      const dir = isLong(data.direction) ? "long" : "short";

      callers.push({
        handle,
        direction: dir as "long" | "short",
        winRate: stats.winRate,
        avgPnl: stats.avgPnl,
        pnl: data.pnl,
      });

      if (dir === "long") {
        longHandles.push(handle);
        if (data.pnl != null) longPnls.push(data.pnl);
      } else {
        shortHandles.push(handle);
        if (data.pnl != null) shortPnls.push(data.pnl);
      }

      if (data.platform) platforms.add(data.platform.toLowerCase());
    }

    if (platforms.size === 1) platform = [...platforms][0];

    const longCount = longHandles.length;
    const shortCount = shortHandles.length;
    const avgPnlLong =
      longPnls.length > 0
        ? longPnls.reduce((s, v) => s + v, 0) / longPnls.length
        : 0;
    const avgPnlShort =
      shortPnls.length > 0
        ? shortPnls.reduce((s, v) => s + v, 0) / shortPnls.length
        : 0;

    // Sort callers: higher win rate first
    callers.sort((a, b) => b.winRate - a.winRate);

    plays.push({
      ticker,
      platform,
      long_count: longCount,
      short_count: shortCount,
      callers_long: longHandles,
      callers_short: shortHandles,
      avg_pnl_long: parseFloat(avgPnlLong.toFixed(2)),
      avg_pnl_short: parseFloat(avgPnlShort.toFixed(2)),
      consensus: classifyConsensus(longCount, shortCount),
      conviction_score: computeConviction(longCount, shortCount, callers),
      callers,
    });
  }

  // Sort by conviction score descending
  plays.sort((a, b) => b.conviction_score - a.conviction_score);

  return plays;
}
