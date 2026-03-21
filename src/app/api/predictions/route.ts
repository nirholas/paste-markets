import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { PredictionTrade, PredictionLeaderboardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PredictionRow {
  id: number;
  author_handle: string;
  ticker: string;
  direction: string;
  pnl_pct: number | null;
  source_url: string | null;
  posted_at: string | null;
  price_at_tweet_time: number | null;
}

interface LiveTradeData {
  market_question: string | null;
  entry_price: number | null;
  current_price: number | null;
  source_url: string | null;
  polymarket_url: string | null;
}

/**
 * Fetch live polymarket trades from paste.trade API and build a lookup map
 * for enriching DB rows with market_question, entry/current prices, etc.
 */
async function fetchLiveEnrichmentMap(): Promise<Map<string, LiveTradeData>> {
  const map = new Map<string, LiveTradeData>();
  const apiKey = process.env["PASTE_TRADE_KEY"];
  if (!apiKey) return map;

  try {
    const res = await fetch(
      "https://paste.trade/api/trades?platform=polymarket&limit=200",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) return map;

    const body = await res.json();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    for (const raw of rawItems) {
      const handle = String(raw["author_handle"] ?? "").toLowerCase();
      const ticker = String(raw["ticker"] ?? "").toLowerCase();
      if (!handle || !ticker) continue;

      const key = `${handle}::${ticker}`;
      const sourceUrl = raw["source_url"] != null ? String(raw["source_url"]) : null;
      const polymarketUrl =
        sourceUrl?.includes("polymarket.com") ? sourceUrl :
        raw["polymarket_url"] != null ? String(raw["polymarket_url"]) : null;

      map.set(key, {
        market_question: raw["market_question"] != null ? String(raw["market_question"]) : null,
        entry_price: raw["entry_price"] != null ? Number(raw["entry_price"]) :
                     raw["entryPrice"] != null ? Number(raw["entryPrice"]) : null,
        current_price: raw["current_price"] != null ? Number(raw["current_price"]) :
                       raw["currentPrice"] != null ? Number(raw["currentPrice"]) : null,
        source_url: sourceUrl,
        polymarket_url: polymarketUrl,
      });
    }
  } catch (err) {
    console.error("[api/predictions] Live enrichment fetch failed:", err);
  }

  return map;
}

function rowToPredictionTrade(
  row: PredictionRow,
  liveData?: LiveTradeData,
): PredictionTrade {
  // Use live entry/current prices when available, fall back to DB values
  const entryProb = liveData?.entry_price ?? row.price_at_tweet_time ?? 0.5;
  const pnl = row.pnl_pct ?? 0;

  let currentProb: number;
  if (liveData?.current_price != null) {
    currentProb = liveData.current_price;
  } else {
    // Estimate from pnl: current = entry * (1 + pnl/100)
    currentProb = Math.min(1, Math.max(0, entryProb * (1 + pnl / 100)));
  }

  // Resolution: PnL of exactly +100 or -100 means fully resolved,
  // or current price at extreme (>= 0.99 or <= 0.01)
  const resolved =
    pnl === 100 || pnl === -100 ||
    currentProb >= 0.99 || currentProb <= 0.01;

  let resolution: "yes" | "no" | null = null;
  if (resolved) {
    resolution = currentProb >= 0.5 ? "yes" : "no";
  }

  // Normalize direction: paste.trade uses long/short for polymarket
  const dir = row.direction === "short" || row.direction === "no" ? "no" : "yes";

  // Use market_question for event title, fall back to ticker
  const eventTitle = liveData?.market_question || row.ticker;

  // Best available URL
  const marketUrl =
    liveData?.polymarket_url ?? liveData?.source_url ?? row.source_url ?? "";

  return {
    id: String(row.id),
    handle: row.author_handle,
    event_title: eventTitle,
    market_url: marketUrl,
    direction: dir as "yes" | "no",
    entry_probability: entryProb,
    current_probability: currentProb,
    resolved,
    resolution,
    pnl_pct: pnl,
    posted_at: row.posted_at ?? new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all";
  const handle = searchParams.get("handle");

  // Fetch DB rows and live enrichment data in parallel
  const [rows, liveMap] = await Promise.all([
    (handle
      ? sql`
          SELECT id, author_handle, ticker, direction, pnl_pct, source_url, posted_at, price_at_tweet_time
          FROM trades
          WHERE platform = 'polymarket'
            AND LOWER(author_handle) = LOWER(${handle})
          ORDER BY posted_at DESC
          LIMIT 100
        `
      : sql`
          SELECT id, author_handle, ticker, direction, pnl_pct, source_url, posted_at, price_at_tweet_time
          FROM trades
          WHERE platform = 'polymarket'
          ORDER BY posted_at DESC
          LIMIT 200
        `
    ) as unknown as Promise<PredictionRow[]>,
    fetchLiveEnrichmentMap(),
  ]);

  const trades = (rows as PredictionRow[]).map((row) => {
    const key = `${row.author_handle.toLowerCase()}::${row.ticker.toLowerCase()}`;
    return rowToPredictionTrade(row, liveMap.get(key));
  });

  let filtered = trades;
  if (filter === "active") {
    filtered = trades.filter((t) => !t.resolved);
  } else if (filter === "resolved") {
    filtered = trades.filter((t) => t.resolved);
  }

  const resolved = trades.filter((t) => t.resolved);
  const correct = resolved.filter((t) => t.resolution === t.direction);

  return NextResponse.json(
    {
      trades: filtered,
      stats: {
        totalBets: trades.length,
        avgAccuracy: resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0,
        activeBets: trades.filter((t) => !t.resolved).length,
        resolvedBets: resolved.length,
      },
    },
    {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    },
  );
}

// Leaderboard
export async function POST() {
  const [rows, liveMap] = await Promise.all([
    sql`
      SELECT id, author_handle, ticker, direction, pnl_pct, source_url, posted_at, price_at_tweet_time
      FROM trades
      WHERE platform = 'polymarket'
      ORDER BY posted_at DESC
      LIMIT 500
    ` as unknown as Promise<PredictionRow[]>,
    fetchLiveEnrichmentMap(),
  ]);

  const byHandle = new Map<string, PredictionTrade[]>();
  for (const row of (rows as PredictionRow[])) {
    const key = `${row.author_handle.toLowerCase()}::${row.ticker.toLowerCase()}`;
    const trade = rowToPredictionTrade(row, liveMap.get(key));
    const existing = byHandle.get(row.author_handle) ?? [];
    existing.push(trade);
    byHandle.set(row.author_handle, existing);
  }

  const entries: PredictionLeaderboardRow[] = [];

  for (const [handle, trades] of byHandle) {
    const resolved = trades.filter((t) => t.resolved);
    const correct = resolved.filter((t) => t.resolution === t.direction);
    const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0;
    const avgPnl = trades.length > 0
      ? parseFloat((trades.reduce((s, t) => s + t.pnl_pct, 0) / trades.length).toFixed(1))
      : 0;

    entries.push({
      rank: 0,
      handle,
      accuracy,
      avgPnl,
      totalPredictions: trades.length,
      activeBets: trades.filter((t) => !t.resolved).length,
    });
  }

  entries.sort((a, b) => b.accuracy - a.accuracy || b.avgPnl - a.avgPnl);
  entries.forEach((r, i) => { r.rank = i + 1; });

  return NextResponse.json(
    { entries },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } },
  );
}
