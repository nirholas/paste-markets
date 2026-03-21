import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { PredictionTrade, PredictionLeaderboardRow } from "@/lib/types";

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

function rowToPredictionTrade(row: PredictionRow): PredictionTrade {
  const entryProb = row.price_at_tweet_time ?? 0.5;
  const pnl = row.pnl_pct ?? 0;
  // Estimate current probability from pnl: current = entry * (1 + pnl/100)
  const estimatedCurrent = Math.min(1, Math.max(0, entryProb * (1 + pnl / 100)));

  // Infer resolution: binary contracts resolve to ~0 or ~1
  const resolved = estimatedCurrent >= 0.99 || estimatedCurrent <= 0.01;
  let resolution: "yes" | "no" | null = null;
  if (resolved) {
    resolution = estimatedCurrent >= 0.99 ? "yes" : "no";
  }

  // Normalize direction: paste.trade uses long/short for polymarket; direction field may be yes/no
  const dir = row.direction === "short" ? "no" : "yes";

  return {
    id: String(row.id),
    handle: row.author_handle,
    event_title: row.ticker,
    market_url: row.source_url ?? "",
    direction: dir as "yes" | "no",
    entry_probability: entryProb,
    current_probability: estimatedCurrent,
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

  let rows: PredictionRow[];

  if (handle) {
    rows = await sql`
      SELECT id, author_handle, ticker, direction, pnl_pct, source_url, posted_at, price_at_tweet_time
      FROM trades
      WHERE platform = 'polymarket'
        AND LOWER(author_handle) = LOWER(${handle})
      ORDER BY posted_at DESC
      LIMIT 100
    ` as PredictionRow[];
  } else {
    rows = await sql`
      SELECT id, author_handle, ticker, direction, pnl_pct, source_url, posted_at, price_at_tweet_time
      FROM trades
      WHERE platform = 'polymarket'
      ORDER BY posted_at DESC
      LIMIT 200
    ` as PredictionRow[];
  }

  const trades = rows.map(rowToPredictionTrade);

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
  const rows = await sql`
    SELECT id, author_handle, ticker, direction, pnl_pct, source_url, posted_at, price_at_tweet_time
    FROM trades
    WHERE platform = 'polymarket'
    ORDER BY posted_at DESC
    LIMIT 500
  ` as PredictionRow[];

  const byHandle = new Map<string, PredictionTrade[]>();
  for (const row of rows) {
    const trade = rowToPredictionTrade(row);
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
