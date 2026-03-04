#!/usr/bin/env bun
/**
 * Consolidated trade assessment tool.
 *
 * Takes a ticker, direction, and optional source date + capital.
 * Returns pre-computed dollar P&L for every available instrument form
 * across Robinhood and Hyperliquid.
 *
 * Two sections per instrument:
 *   1. "since_published" — what P&L would be if you copied the trade on source date
 *   2. "from_here" — what P&L would be at standard future moves (10%, 20%, 50%)
 *
 * All numbers in dollars. No percentages as primary output. No judgment.
 * The tool does the math. The agent tells the story.
 *
 * Usage:
 *   bun run skill/adapters/assess.ts DASH short
 *   bun run skill/adapters/assess.ts DASH short --source-date 2026-02-22
 *   bun run skill/adapters/assess.ts DASH short --source-date 2026-02-22 --capital 50000
 *   bun run skill/adapters/assess.ts DASH short --horizon "Q3 2026"
 *   bun run skill/adapters/assess.ts MA short --source-date 2026-02-22 --horizon "Q1 2027"
 *   bun run skill/adapters/assess.ts "NVDA,AAPL" long --capital 100000
 *   bun run skill/adapters/assess.ts XAI long --subject-kind company
 */

import YahooFinance from "yahoo-finance2";
import { applyRunId, extractRunIdArg } from "./board/run-id";
import {
  buildHlUniverse,
  resolveTicker,
  searchInstruments,
  summarizeUniverseDegradation,
} from "./hyperliquid/universe";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const PASTE_TRADE_API = process.env.PASTE_TRADE_URL || "https://paste.trade";
const HYPERLIQUID_API = "https://api.hyperliquid.xyz/info";
const DEFAULT_CAPITAL = 100_000;
const STANDARD_MOVES = [0.10, 0.20, 0.50]; // 10%, 20%, 50%
const LEVERAGE_LEVELS = [3, 5, 10];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PnlScenario {
  move_pct: number;
  price: number;
  pnl_dollars: number;
  return_pct: number;
  note?: string; // e.g., "liquidated"
}

interface CandidatePerp {
  full_symbol: string;
  base_symbol: string;
  dex: string;
  confidence: number;
  why: string;
  asset_class?: string;
  theme_tags?: string[];
  instrument_description?: string;
}

interface HlTickerData {
  available: boolean;
  unavailable_reason?: string;
  full_symbol?: string;
  base_symbol?: string;
  dex?: string;
  api_name?: string;
  mark_price?: number;
  funding_hourly?: number;
  funding_ann_pct?: number;
  max_leverage?: number;
  volume_24h?: number;
  oi_usd?: number;
  liquidity?: string;
  match_kind?: "exact" | "prefixed" | "alias" | "query";
  confidence?: number;
  selection_reason?: string;
  asset_class?: string;
  theme_tags?: string[];
  instrument_description?: string;
  pricing_note?: string;
  candidate_perps?: CandidatePerp[];
}

interface PerpAssessment {
  form: "perp";
  platform: "hyperliquid";
  available: boolean;
  hl_status?: "ok" | "not_listed" | "unavailable";
  hl_ticker?: string;            // resolved HL executable symbol (e.g., "xyz:NVDA")
  entry_price?: number;
  funding_direction?: "longs_pay" | "shorts_pay" | "neutral";
  funding_income_30d_dollars?: Record<string, number>; // by leverage
  liquidation_price?: Record<string, number>; // by leverage
  liquidation_move_pct?: Record<string, number>; // by leverage
  from_here?: Record<string, PnlScenario[]>; // by leverage
  since_published?: Record<string, { pnl_dollars: number; return_pct: number }>; // by leverage
  max_leverage?: number;
  volume_24h?: number;
  liquidity?: string;
  asset_class?: string;
  theme_tags?: string[];
  instrument_description?: string;
  pricing_note?: string;
  candidate_perps?: CandidatePerp[];
  note?: string;
}

interface HlFetchResult {
  data: Map<string, HlTickerData>;
  degraded: boolean;
  degraded_summary?: string;
}

interface SharesAssessment {
  form: "shares";
  platform: "robinhood";
  available: boolean;
  entry_price?: number;
  shares_affordable?: number;
  from_here?: PnlScenario[];
  since_published?: { pnl_dollars: number; return_pct: number };
  note?: string; // e.g., "for short, you'd need to short sell on margin or use puts"
}

interface TickerAssessment {
  ticker: string;
  direction: "long" | "short";
  capital: number;
  current_price: number;
  source_date_price?: number;
  source_date?: string;
  since_published_move_pct?: number;
  earnings?: { date: string; days_away: number };
  trailing_perf?: Record<string, number>;
  // Company context (from Yahoo Finance assetProfile + quote)
  company_name?: string;
  sector?: string | null;
  market_cap_fmt?: string;
  business_summary?: string;
  instruments: {
    perps?: PerpAssessment;
    shares?: SharesAssessment;
  };
}

type SubjectKind = "asset" | "company" | "event";

// ---------------------------------------------------------------------------
// paste.trade price API (centralized, cached, multi-provider with fallback)
// ---------------------------------------------------------------------------

async function fetchPasteTradePrice(ticker: string, platform: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${PASTE_TRADE_API}/api/price?ticker=${encodeURIComponent(ticker)}&platform=${platform}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { price?: number };
    return data.price ?? null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Yahoo Finance helpers (metadata — price comes from paste.trade when available)
// ---------------------------------------------------------------------------

async function fetchQuote(ticker: string) {
  // Price from paste.trade (cached, with Finnhub fallback). Metadata from Yahoo.
  const [ptPrice, q] = await Promise.all([
    fetchPasteTradePrice(ticker, "robinhood"),
    yahooFinance.quote(ticker).catch(() => null),
  ]);

  const price = ptPrice ?? q?.regularMarketPrice;
  if (!price) return null;

  return {
    price,
    name: q?.shortName || q?.longName || ticker,
    marketCap: q?.marketCap ?? null,
    volume: q?.regularMarketVolume ?? 0,
    fiftyTwoWeekHigh: q?.fiftyTwoWeekHigh ?? price * 1.2,
    fiftyTwoWeekLow: q?.fiftyTwoWeekLow ?? price * 0.8,
    quoteType: q?.quoteType ?? "EQUITY",
  };
}

async function fetchEarningsAndProfile(ticker: string) {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ["calendarEvents", "assetProfile"] });

    // Earnings
    let earnings: { date: string; days_away: number } | null = null;
    const dates = summary.calendarEvents?.earnings?.earningsDate;
    if (dates?.length) {
      const now = new Date();
      const upcoming = dates.map(d => new Date(d)).filter(d => d > now).sort((a, b) => a.getTime() - b.getTime());
      if (upcoming.length) {
        const next = upcoming[0]!;
        earnings = {
          date: next.toISOString().split("T")[0]!,
          days_away: Math.round((next.getTime() - now.getTime()) / 86400000),
        };
      }
    }

    // Asset profile
    const profile = summary.assetProfile ?? null;

    return { earnings, profile };
  } catch { return { earnings: null, profile: null }; }
}

/**
 * Fetch historical price for a ticker at a given date or datetime.
 * - ISO 8601 datetime (has "T"): tries intraday (1m within 7d, 5m within 60d), falls back to daily
 * - Date only (YYYY-MM-DD): uses daily candle (original behavior)
 */
async function fetchHistorical(ticker: string, dateStr: string): Promise<number | null> {
  try {
    const isDatetime = dateStr.includes("T");
    const targetTs = Math.floor(new Date(dateStr).getTime() / 1000);
    const nowTs = Math.floor(Date.now() / 1000);
    const daysAgo = (nowTs - targetTs) / 86400;

    // Try intraday pricing when we have a full datetime and it's recent enough
    if (isDatetime && daysAgo <= 60) {
      const interval = daysAgo <= 7 ? "1m" : "5m";
      const intervalSec = interval === "1m" ? 60 : 300;
      // Bracket the trading day: market open (14:30 UTC) to close (21:00 UTC)
      const dayStart = Math.floor(targetTs / 86400) * 86400 + 14 * 3600; // ~14:00 UTC (before market open)
      const dayEnd = dayStart + 8 * 3600; // ~22:00 UTC (after market close)
      const intradayUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${dayStart}&period2=${dayEnd}&interval=${interval}`;
      const intradayRes = await fetch(intradayUrl, { headers: { "User-Agent": "Mozilla/5.0", Cookie: "A3=d=x" } });
      if (intradayRes.ok) {
        const intradayData = await intradayRes.json() as any;
        const chart = intradayData.chart?.result?.[0];
        if (chart?.timestamp?.length) {
          const timestamps = chart.timestamp as number[];
          const closes = chart.indicators.quote[0].close as (number | null)[];
          // Find the bar closest to (but not after) the target timestamp
          let bestIdx = 0;
          for (let i = 0; i < timestamps.length; i++) {
            if (timestamps[i]! <= targetTs + intervalSec && closes[i] != null) {
              bestIdx = i;
            }
          }
          const price = closes[bestIdx];
          if (price != null) {
            console.error(`  [intraday] ${ticker} price at ${new Date(timestamps[bestIdx]! * 1000).toISOString()}: $${price} (${interval} bar)`);
            return price;
          }
        }
      }
      // Intraday failed, fall through to daily
    }

    // Daily candle: original behavior
    const period1 = isDatetime ? Math.floor(targetTs / 86400) * 86400 : Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
    const period2 = period1 + 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Cookie: "A3=d=x" } });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const chart = data.chart?.result?.[0];
    if (!chart?.timestamp?.length) {
      // Weekend/holiday: widen window
      const wideUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1 - 10 * 86400}&period2=${period2}&interval=1d`;
      const wideRes = await fetch(wideUrl, { headers: { "User-Agent": "Mozilla/5.0", Cookie: "A3=d=x" } });
      if (!wideRes.ok) return null;
      const wideData = await wideRes.json() as any;
      const wideChart = wideData.chart?.result?.[0];
      if (!wideChart?.timestamp?.length) return null;
      const lastIdx = wideChart.timestamp.length - 1;
      return wideChart.indicators.quote[0].close[lastIdx] ?? null;
    }
    return chart.indicators.quote[0].close[0] ?? null;
  } catch { return null; }
}

/**
 * Fetch Hyperliquid daily close for a given symbol/date.
 * Accepts full symbols like "vntl:OPENAI" and default symbols like "BTC".
 */
async function fetchHlHistorical(fullSymbol: string, dateStr: string): Promise<number | null> {
  try {
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return null;
    const dayStart = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const fetchCandles = async (startTime: number, endTime: number): Promise<number | null> => {
      const res = await fetch(HYPERLIQUID_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "candleSnapshot",
          req: {
            coin: fullSymbol,
            interval: "1d",
            startTime,
            endTime,
          },
        }),
      });
      if (!res.ok) return null;
      const candles = (await res.json()) as Array<{ t: number; c: string }>;
      if (!Array.isArray(candles) || candles.length === 0) return null;

      // Prefer candle on target day; otherwise use latest candle in window.
      const onDay = candles.filter((c) => c.t >= dayStart && c.t < dayEnd);
      const selected = (onDay.length ? onDay : candles).slice(-1)[0];
      const close = selected ? parseFloat(selected.c) : NaN;
      return Number.isFinite(close) && close > 0 ? close : null;
    };

    const exact = await fetchCandles(dayStart, dayEnd);
    if (exact != null) return exact;

    // Weekend/holiday/backfill gap fallback: look back one week.
    return fetchCandles(dayStart - 7 * 24 * 60 * 60 * 1000, dayEnd);
  } catch {
    return null;
  }
}

async function fetchTrailingPerf(ticker: string, currentPrice: number): Promise<Record<string, number>> {
  try {
    const nowTs = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${nowTs - 366 * 86400}&period2=${nowTs}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Cookie: "A3=d=x" } });
    if (!res.ok) return {};
    const data = await res.json() as any;
    const chart = data.chart?.result?.[0];
    if (!chart?.timestamp) return {};
    const timestamps = chart.timestamp as number[];
    const closes = chart.indicators.adjclose?.[0]?.adjclose ?? [];
    const targets: Record<string, number> = { "1M": nowTs - 30 * 86400, "3M": nowTs - 90 * 86400, "6M": nowTs - 180 * 86400, "1Y": nowTs - 365 * 86400 };
    const result: Record<string, number> = {};
    for (const [label, targetTs] of Object.entries(targets)) {
      let bestIdx = 0, bestDiff = Infinity;
      for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs((timestamps[i] ?? 0) - targetTs);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      }
      const hist = closes[bestIdx];
      if (hist && hist > 0) result[label] = Math.round(((currentPrice / hist) - 1) * 1000) / 10;
    }
    return result;
  } catch { return {}; }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format market cap as "$2.8T" / "$42B" / "$850M" */
function formatMarketCap(cap: number | null | undefined): string {
  if (!cap) return "";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

/** Extract first N sentences from text. */
function firstSentences(text: string, n: number): string {
  // Split on sentence-ending punctuation followed by space or end
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text.slice(0, 200);
  return sentences.slice(0, n).join("").trim();
}

// ---------------------------------------------------------------------------
// Horizon parsing: author's timing language -> target date
// ---------------------------------------------------------------------------

function parseHorizon(horizon: string): { targetDate: Date; label: string } | null {
  const now = new Date();
  const h = horizon.trim().toLowerCase();

  // "Q1 2027", "q3 2026", etc.
  const qMatch = h.match(/q([1-4])\s*(\d{4})/);
  if (qMatch) {
    const quarter = parseInt(qMatch[1]!);
    const year = parseInt(qMatch[2]!);
    // End of quarter: Q1=Mar31, Q2=Jun30, Q3=Sep30, Q4=Dec31
    const monthEnd = quarter * 3;
    const date = new Date(year, monthEnd, 0); // last day of quarter-end month
    return { targetDate: date, label: `Q${quarter} ${year}` };
  }

  // "by 2028", "2028", "in 2028"
  const yearMatch = h.match(/(?:by|in)?\s*(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]!);
    // Mid-year as target
    return { targetDate: new Date(year, 5, 30), label: `mid-${year}` };
  }

  // "back half of 2028", "H2 2028", "second half 2028"
  const h2Match = h.match(/(?:back half|h2|second half)\s*(?:of\s*)?(\d{4})/);
  if (h2Match) {
    const year = parseInt(h2Match[1]!);
    return { targetDate: new Date(year, 9, 1), label: `H2 ${year}` }; // October
  }

  // "first half 2027", "H1 2027"
  const h1Match = h.match(/(?:first half|h1)\s*(?:of\s*)?(\d{4})/);
  if (h1Match) {
    const year = parseInt(h1Match[1]!);
    return { targetDate: new Date(year, 2, 31), label: `H1 ${year}` }; // end of March
  }

  // Relative: "6m", "12m", "18m", "6 months", "2 years"
  const relMonths = h.match(/(\d+)\s*m(?:onths?)?$/);
  if (relMonths) {
    const months = parseInt(relMonths[1]!);
    const date = new Date(now);
    date.setMonth(date.getMonth() + months);
    return { targetDate: date, label: `${months}m out` };
  }
  const relYears = h.match(/(\d+)\s*y(?:ears?)?$/);
  if (relYears) {
    const years = parseInt(relYears[1]!);
    const date = new Date(now);
    date.setFullYear(date.getFullYear() + years);
    return { targetDate: date, label: `${years}y out` };
  }

  // "next earnings" handled separately (needs earnings date)
  if (h.includes("earnings")) {
    return null; // caller uses earnings date
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hyperliquid helpers
// ---------------------------------------------------------------------------

async function fetchHLData(tickers: string[], subjectKind: SubjectKind): Promise<HlFetchResult> {
  const result = new Map<string, HlTickerData>();
  try {
    const universe = await buildHlUniverse();
    const degradedSummary = summarizeUniverseDegradation(universe) ?? undefined;
    const degraded = Boolean(degradedSummary);
    const loadedDexes = universe.diagnostics.loaded_dexes;
    const unavailableReason = degraded && loadedDexes.length === 0
      ? "Hyperliquid data temporarily unavailable (no dex data loaded)."
      : null;

    if (unavailableReason) {
      for (const ticker of tickers) {
        result.set(ticker, {
          available: false,
          unavailable_reason: unavailableReason,
        });
      }
      return { data: result, degraded, degraded_summary: degradedSummary };
    }

    for (const ticker of tickers) {
      const resolution = resolveTicker(ticker, universe, { allow_prefix_match: true });
      if (!resolution) {
        const candidate_perps = searchInstruments(universe, ticker, 3).map((candidate) => ({
          full_symbol: candidate.instrument.full_symbol,
          base_symbol: candidate.instrument.base_symbol,
          dex: candidate.instrument.dex,
          confidence: Math.round(candidate.confidence * 1000) / 1000,
          why: candidate.selection_reason,
          asset_class: candidate.instrument.asset_class,
          theme_tags: candidate.instrument.theme_tags,
          instrument_description: candidate.instrument.instrument_description,
        }));

        result.set(ticker, {
          available: false,
          unavailable_reason: degraded
            ? "Hyperliquid universe is degraded; direct listing may be unavailable in failed dexes."
            : undefined,
          candidate_perps: candidate_perps.length ? candidate_perps : undefined,
        });
        continue;
      }

      const inst = resolution.instrument;
      const priceKey = inst.dex === "default" ? inst.base_symbol : inst.full_symbol;
      const ptPrice = await fetchPasteTradePrice(priceKey, "hyperliquid");
      const markPrice = ptPrice ?? inst.mark_price ?? inst.oracle_price ?? 0;

      let mismatchCandidates: CandidatePerp[] | undefined;
      if (subjectKind === "company" && inst.asset_class === "crypto") {
        mismatchCandidates = searchInstruments(universe, `${ticker} private company`, 6)
          .filter((candidate) => candidate.instrument.full_symbol !== inst.full_symbol)
          .filter((candidate) => candidate.instrument.asset_class !== "crypto")
          .slice(0, 3)
          .map((candidate) => ({
            full_symbol: candidate.instrument.full_symbol,
            base_symbol: candidate.instrument.base_symbol,
            dex: candidate.instrument.dex,
            confidence: Math.round(candidate.confidence * 1000) / 1000,
            why: candidate.selection_reason,
            asset_class: candidate.instrument.asset_class,
            theme_tags: candidate.instrument.theme_tags,
            instrument_description: candidate.instrument.instrument_description,
          }));
      }

      result.set(ticker, {
        available: true,
        full_symbol: inst.full_symbol,
        base_symbol: inst.base_symbol,
        dex: inst.dex,
        api_name: inst.full_symbol,
        mark_price: markPrice,
        funding_hourly: inst.funding_rate_hourly ?? 0,
        funding_ann_pct: inst.funding_rate_annualized_pct ?? 0,
        max_leverage: inst.max_leverage ?? 1,
        volume_24h: inst.volume_24h_usd ?? 0,
        oi_usd: inst.open_interest_usd ?? 0,
        liquidity: inst.liquidity ?? "low",
        match_kind: resolution.match_kind,
        confidence: resolution.confidence,
        selection_reason: resolution.selection_reason,
        asset_class: inst.asset_class,
        theme_tags: inst.theme_tags,
        instrument_description: inst.instrument_description,
        pricing_note: inst.pricing_note,
        candidate_perps: mismatchCandidates?.length ? mismatchCandidates : undefined,
      });
    }

    return { data: result, degraded, degraded_summary: degradedSummary };
  } catch (e) {
    const reason = `Hyperliquid data temporarily unavailable: ${(e as Error).message}`;
    console.error("HL fetch error:", e);
    for (const ticker of tickers) {
      result.set(ticker, {
        available: false,
        unavailable_reason: reason,
      });
    }
    return { data: result, degraded: true, degraded_summary: reason };
  }
}

// ---------------------------------------------------------------------------
// P&L computation (pure math)
// ---------------------------------------------------------------------------

function computePerpPnl(
  entryPrice: number,
  direction: "long" | "short",
  leverage: number,
  capital: number,
  movePct: number,
): PnlScenario {
  const dirMult = direction === "long" ? 1 : -1;
  const exitPrice = entryPrice * (1 + movePct);
  const pricePnlPct = dirMult * ((exitPrice - entryPrice) / entryPrice);
  const returnPct = pricePnlPct * leverage;
  const liquidated = returnPct <= -1;

  return {
    move_pct: Math.round(movePct * 1000) / 10,
    price: Math.round(exitPrice * 100) / 100,
    pnl_dollars: liquidated ? -capital : Math.round(returnPct * capital),
    return_pct: liquidated ? -100 : Math.round(returnPct * 10000) / 100,
    ...(liquidated ? { note: "liquidated" } : {}),
  };
}

function computeSharePnl(
  entryPrice: number,
  direction: "long" | "short",
  shares: number,
  movePct: number,
): PnlScenario {
  const dirMult = direction === "long" ? 1 : -1;
  const exitPrice = entryPrice * (1 + movePct);
  const pnlPerShare = dirMult * (exitPrice - entryPrice);
  const pnlDollars = pnlPerShare * shares;

  return {
    move_pct: Math.round(movePct * 1000) / 10,
    price: Math.round(exitPrice * 100) / 100,
    pnl_dollars: Math.round(pnlDollars),
    return_pct: Math.round((pnlDollars / (shares * entryPrice)) * 10000) / 100,
  };
}

// ---------------------------------------------------------------------------
// Main assessment per ticker
// ---------------------------------------------------------------------------

async function assessTicker(
  ticker: string,
  direction: "long" | "short",
  capital: number,
  sourceDate: string | null,
  hlData: Map<string, HlTickerData>,
  subjectKind: SubjectKind,
  horizonStr?: string | null,
): Promise<TickerAssessment> {
  console.error(`\nAssessing ${ticker} ${direction} with $${capital.toLocaleString()}...`);

  // Fetch RH data in parallel
  const [quote, earningsAndProfile, stockSourceDatePrice] = await Promise.all([
    fetchQuote(ticker),
    fetchEarningsAndProfile(ticker),
    sourceDate ? fetchHistorical(ticker, sourceDate) : Promise.resolve(null),
  ]);
  const { earnings, profile } = earningsAndProfile;
  const trailingPerf = quote ? await fetchTrailingPerf(ticker, quote.price) : {};

  // Use Robinhood quote as canonical price; fall back to HL mark price for crypto-only tokens
  const hlTicker = hlData.get(ticker);
  const hlSubjectMismatch = Boolean(
    subjectKind === "company" &&
    hlTicker?.available &&
    hlTicker.asset_class === "crypto"
  );
  const currentPrice = quote?.price ?? (hlTicker?.available ? hlTicker.mark_price : undefined);

  if (!currentPrice) {
    throw new Error(`No quote data for ${ticker} (not on Robinhood or Hyperliquid)`);
  }

  let hlSourceDatePrice: number | null = null;
  if (
    !hlSubjectMismatch &&
    !stockSourceDatePrice &&
    sourceDate &&
    hlTicker?.available &&
    (hlTicker.full_symbol || hlTicker.api_name)
  ) {
    const hlSymbol = hlTicker.full_symbol ?? hlTicker.api_name!;
    hlSourceDatePrice = await fetchHlHistorical(hlSymbol, sourceDate);
    if (hlSourceDatePrice != null) {
      console.error(`  [hl-historical] ${hlSymbol} close on ${sourceDate}: $${hlSourceDatePrice}`);
    }
  }

  const sourceDatePrice = stockSourceDatePrice ?? hlSourceDatePrice;
  const sincePublishedMovePct = sourceDatePrice
    ? Math.round(((currentPrice / sourceDatePrice) - 1) * 10000) / 100
    : undefined;

  const priceSource = quote ? "RH" : "HL";
  console.error(`  Price: $${currentPrice} (${priceSource})${sourceDatePrice ? ` (was $${sourceDatePrice} on ${sourceDate}, moved ${sincePublishedMovePct}%)` : ""}`);

  const assessment: TickerAssessment = {
    ticker,
    direction,
    capital,
    current_price: currentPrice,
    source_date_price: sourceDatePrice ?? undefined,
    source_date: sourceDate ?? undefined,
    since_published_move_pct: sincePublishedMovePct,
    earnings: earnings ?? undefined,
    trailing_perf: Object.keys(trailingPerf).length ? trailingPerf : undefined,
    // Company context
    company_name: quote?.name ?? undefined,
    sector: profile?.sector ?? null,
    market_cap_fmt: formatMarketCap(quote?.marketCap) || undefined,
    business_summary: profile?.longBusinessSummary
      ? firstSentences(profile.longBusinessSummary, 2)
      : undefined,
    instruments: {},
  };

  // Generate move scenarios (direction-aware: favorable and adverse)
  const favorableMoves = STANDARD_MOVES.map(m => direction === "long" ? m : -m);
  const adverseMoves = STANDARD_MOVES.map(m => direction === "long" ? -m : m);
  const allMoves = [...favorableMoves, ...adverseMoves].sort((a, b) => a - b);

  // --- PERPS (Hyperliquid) ---
  // hlTicker resolved above (used for price fallback). Sanity check: if we have both
  // RH and HL prices, verify they're the same entity (within 50%)
  const hlValid = Boolean(
    hlTicker?.available &&
    hlTicker.mark_price != null &&
    (!quote || Math.abs(hlTicker.mark_price / currentPrice - 1) < 0.5)
  );
  if (hlValid && !hlSubjectMismatch) {
    const hl = hlTicker!;
    const fundingDir = (hl.funding_hourly ?? 0) > 0.00001 ? "longs_pay"
      : (hl.funding_hourly ?? 0) < -0.00001 ? "shorts_pay" : "neutral";
    const resolvedSymbol = hl.full_symbol ?? hl.api_name ?? ticker;

    const perpAssessment: PerpAssessment = {
      form: "perp",
      platform: "hyperliquid",
      available: true,
      hl_status: "ok",
      hl_ticker: resolvedSymbol !== ticker || hl.dex !== "default" ? resolvedSymbol : undefined,
      entry_price: hl.mark_price,
      funding_direction: fundingDir,
      max_leverage: hl.max_leverage,
      volume_24h: hl.volume_24h,
      liquidity: hl.liquidity,
      asset_class: hl.asset_class,
      theme_tags: hl.theme_tags,
      instrument_description: hl.instrument_description,
      pricing_note: hl.pricing_note,
      funding_income_30d_dollars: {},
      liquidation_price: {},
      liquidation_move_pct: {},
      from_here: {},
      since_published: undefined,
    };

    for (const lev of LEVERAGE_LEVELS.filter(l => l <= (hl.max_leverage ?? 1))) {
      const levStr = `${lev}x`;

      // Funding income (positive = income for this direction)
      const dirMult = direction === "long" ? -1 : 1; // longs pay when funding positive
      const monthlyFundingPct = dirMult * (hl.funding_hourly ?? 0) * 24 * 30 * lev;
      perpAssessment.funding_income_30d_dollars![levStr] = Math.round(monthlyFundingPct * capital);

      // Liquidation
      const liqMovePct = 1 / lev;
      perpAssessment.liquidation_move_pct![levStr] = Math.round(liqMovePct * 10000) / 100;
      if (direction === "long") {
        perpAssessment.liquidation_price![levStr] = Math.round((hl.mark_price ?? 0) * (1 - liqMovePct) * 100) / 100;
      } else {
        perpAssessment.liquidation_price![levStr] = Math.round((hl.mark_price ?? 0) * (1 + liqMovePct) * 100) / 100;
      }

      // Forward P&L scenarios
      perpAssessment.from_here![levStr] = allMoves.map(m =>
        computePerpPnl(hl.mark_price ?? 0, direction, lev, capital, m)
      );

      // Since-published P&L
      if (sourceDatePrice && sincePublishedMovePct !== undefined) {
        const actualMove = (currentPrice / sourceDatePrice) - 1;
        const dirPnl = direction === "long" ? actualMove : -actualMove;
        const returnPct = dirPnl * lev;
        const liquidated = returnPct <= -1;
        if (!perpAssessment.since_published) perpAssessment.since_published = {};
        perpAssessment.since_published[levStr] = {
          pnl_dollars: liquidated ? -capital : Math.round(returnPct * capital),
          return_pct: liquidated ? -100 : Math.round(returnPct * 10000) / 100,
        };
      }
    }

    assessment.instruments.perps = perpAssessment;
  } else {
    const candidatePerps = hlTicker?.candidate_perps;
    const unavailableReason = hlTicker?.unavailable_reason;
    assessment.instruments.perps = {
      form: "perp",
      platform: "hyperliquid",
      available: false,
      hl_status: hlSubjectMismatch ? "unavailable" : unavailableReason ? "unavailable" : hlTicker?.available ? "ok" : "not_listed",
      candidate_perps: candidatePerps,
      note: unavailableReason
        ? unavailableReason
        : hlSubjectMismatch
        ? "Symbol collision: resolved crypto instrument for company thesis."
        : hlTicker?.available
        ? `Price mismatch: HL $${hlTicker.mark_price} vs RH $${currentPrice} (likely different asset)`
        : candidatePerps?.length
          ? "No direct Hyperliquid listing; similar candidate perps included."
          : "Not listed on Hyperliquid",
    };
  }

  // --- SHARES (Robinhood) ---
  const sharesAvailable = Boolean(quote?.price);
  const sharesAffordable = sharesAvailable ? Math.floor(capital / currentPrice) : undefined;
  const sharesNote = !sharesAvailable
    ? "Not listed on Robinhood; shares unavailable."
    : direction === "short"
    ? "Short selling requires margin account. Consider puts or inverse ETFs instead."
    : undefined;

  const sharesAssessment: SharesAssessment = {
    form: "shares",
    platform: "robinhood",
    available: sharesAvailable,
    entry_price: sharesAvailable ? currentPrice : undefined,
    shares_affordable: sharesAffordable,
    from_here: sharesAvailable && sharesAffordable !== undefined ? allMoves.map(m =>
      computeSharePnl(currentPrice, direction, sharesAffordable, m)
    ) : undefined,
    since_published: sharesAvailable && sharesAffordable !== undefined && sourceDatePrice ? {
      pnl_dollars: Math.round(
        (direction === "long" ? 1 : -1) * (currentPrice - sourceDatePrice) * sharesAffordable
      ),
      return_pct: Math.round(
        (direction === "long" ? 1 : -1) * ((currentPrice / sourceDatePrice) - 1) * 10000
      ) / 100,
    } : undefined,
    note: sharesNote,
  };

  assessment.instruments.shares = sharesAssessment;

  return assessment;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const { runId, args } = extractRunIdArg(process.argv);
  applyRunId(runId);
  if (args.length < 2) {
    console.error("Usage: bun run skill/adapters/assess.ts [--run-id <runId>] <TICKER[,TICKER]> <long|short> [options]");
    console.error("Options:");
    console.error("  --source-date YYYY-MM-DD   Price at source date for since-published P&L");
    console.error("  --capital NUMBER           Capital (default: 100000)");
    console.error('  --horizon TEXT              Author\'s timing (e.g., "Q3 2026", "by 2028", "next earnings")');
    console.error("  --subject-kind KIND         asset | company | event (default: asset)");
    console.error("Examples:");
    console.error('  bun run skill/adapters/assess.ts DASH short --source-date 2026-02-22');
    console.error('  bun run skill/adapters/assess.ts MA short --horizon "Q1 2027"');
    console.error('  bun run skill/adapters/assess.ts NVDA long --capital 50000');
    console.error('  bun run skill/adapters/assess.ts XAI long --subject-kind company');
    process.exit(1);
  }

  const tickers = args[0]!.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
  const direction = args[1]!.toLowerCase() as "long" | "short";
  if (!["long", "short"].includes(direction)) {
    console.error(`Invalid direction: "${direction}". Use "long" or "short".`);
    process.exit(1);
  }

  let sourceDate: string | null = null;
  let capital = DEFAULT_CAPITAL;
  let horizon: string | null = null;
  let subjectKind: SubjectKind = "asset";

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--source-date" && args[i + 1]) { sourceDate = args[++i]!; }
    if (args[i] === "--capital" && args[i + 1]) { capital = parseInt(args[++i]!, 10); }
    if (args[i] === "--horizon" && args[i + 1]) { horizon = args[++i]!; }
    if (args[i] === "--subject-kind" && args[i + 1]) {
      const parsed = args[++i]!.toLowerCase();
      if (parsed === "asset" || parsed === "company" || parsed === "event") {
        subjectKind = parsed;
      } else {
        console.error(`Invalid --subject-kind: "${parsed}". Use asset, company, or event.`);
        process.exit(1);
      }
    }
  }

  return { tickers, direction, sourceDate, capital, horizon, subjectKind, runId };
}

async function main() {
  const { tickers, direction, sourceDate, capital, horizon, subjectKind, runId } = parseArgs();

  console.error(`\nAssessing ${tickers.join(", ")} ${direction} | $${capital.toLocaleString()} capital${sourceDate ? ` | source: ${sourceDate}` : ""}${horizon ? ` | horizon: ${horizon}` : ""}${subjectKind !== "asset" ? ` | subject-kind: ${subjectKind}` : ""}\n`);

  // Push "Pricing..." status event if streaming context exists
  let streamCtx: { source_id: string } | null = null;
  try {
    const { getStreamContext, pushEvent } = await import("./board/stream-context");
    streamCtx = getStreamContext(runId);
    if (streamCtx) {
      await pushEvent(streamCtx.source_id, "status", {
        message: `Pricing ${tickers.join(", ")}...`,
      }, { runId });
    }
  } catch { /* streaming is optional */ }

  // Fetch HL data for all tickers in one batch
  const hlFetch = await fetchHLData(tickers, subjectKind);
  const hlData = hlFetch.data;
  if (hlFetch.degraded && hlFetch.degraded_summary) {
    console.error(`HL WARNING: ${hlFetch.degraded_summary}`);
  }

  const results: TickerAssessment[] = [];
  for (const ticker of tickers) {
    try {
      const result = await assessTicker(ticker, direction, capital, sourceDate, hlData, subjectKind, horizon);
      results.push(result);
      // Push per-ticker status so the viewer sees each one complete
      if (streamCtx) {
        try {
          const { pushEvent } = await import("./board/stream-context");
          const price = result.current_price;
          await pushEvent(streamCtx.source_id, "status", {
            message: `${ticker} at $${price?.toLocaleString() ?? "?"}`,
          }, { runId });
        } catch { /* streaming is optional */ }
      }
    } catch (e) {
      console.error(`  ERROR for ${ticker}: ${(e as Error).message}`);
    }
  }

  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
