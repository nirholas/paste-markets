import { NextResponse } from "next/server";
import type { PredictionTrade, PredictionLeaderboardRow } from "@/lib/types";

// Mock prediction trades — replace with real API calls when available
const MOCK_PREDICTIONS: PredictionTrade[] = [
  {
    id: "pm-1",
    handle: "GCRClassic",
    event_title: "Will Bitcoin exceed $150k by end of 2026?",
    market_url: "https://polymarket.com/event/btc-150k-2026",
    direction: "yes",
    entry_probability: 0.32,
    current_probability: 0.41,
    resolved: false,
    resolution: null,
    pnl_pct: 28.1,
    posted_at: "2026-02-15T10:30:00Z",
  },
  {
    id: "pm-2",
    handle: "DegenSpartan",
    event_title: "Will the Fed cut rates in March 2026?",
    market_url: "https://polymarket.com/event/fed-rate-cut-march-2026",
    direction: "no",
    entry_probability: 0.72,
    current_probability: 0.25,
    resolved: true,
    resolution: "no",
    pnl_pct: 65.7,
    posted_at: "2026-01-20T14:00:00Z",
  },
  {
    id: "pm-3",
    handle: "cobie",
    event_title: "Will ETH flip BTC by market cap in 2026?",
    market_url: "https://polymarket.com/event/eth-flip-btc-2026",
    direction: "yes",
    entry_probability: 0.08,
    current_probability: 0.05,
    resolved: false,
    resolution: null,
    pnl_pct: -37.5,
    posted_at: "2026-03-01T09:15:00Z",
  },
  {
    id: "pm-4",
    handle: "hsaka",
    event_title: "Will Solana ETF be approved in 2026?",
    market_url: "https://polymarket.com/event/solana-etf-2026",
    direction: "yes",
    entry_probability: 0.45,
    current_probability: 0.62,
    resolved: false,
    resolution: null,
    pnl_pct: 37.8,
    posted_at: "2026-02-28T16:45:00Z",
  },
  {
    id: "pm-5",
    handle: "CryptoKaleo",
    event_title: "Will Trump win 2026 midterms?",
    market_url: "https://polymarket.com/event/trump-midterms-2026",
    direction: "yes",
    entry_probability: 0.55,
    current_probability: 0.58,
    resolved: false,
    resolution: null,
    pnl_pct: 5.5,
    posted_at: "2026-03-10T11:20:00Z",
  },
  {
    id: "pm-6",
    handle: "GCRClassic",
    event_title: "Will US GDP growth exceed 3% in Q1 2026?",
    market_url: "https://polymarket.com/event/us-gdp-q1-2026",
    direction: "no",
    entry_probability: 0.6,
    current_probability: 0.55,
    resolved: true,
    resolution: "no",
    pnl_pct: 12.5,
    posted_at: "2026-01-05T08:00:00Z",
  },
  {
    id: "pm-7",
    handle: "DegenSpartan",
    event_title: "Will a major crypto exchange collapse in 2026?",
    market_url: "https://polymarket.com/event/exchange-collapse-2026",
    direction: "no",
    entry_probability: 0.15,
    current_probability: 0.08,
    resolved: false,
    resolution: null,
    pnl_pct: 8.2,
    posted_at: "2026-03-05T13:30:00Z",
  },
  {
    id: "pm-8",
    handle: "frankdegods",
    event_title: "Will NFT market cap reach $50B in 2026?",
    market_url: "https://polymarket.com/event/nft-50b-2026",
    direction: "yes",
    entry_probability: 0.2,
    current_probability: 0.12,
    resolved: true,
    resolution: "no",
    pnl_pct: -100,
    posted_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "pm-9",
    handle: "hsaka",
    event_title: "Will Apple announce crypto integration in 2026?",
    market_url: "https://polymarket.com/event/apple-crypto-2026",
    direction: "yes",
    entry_probability: 0.12,
    current_probability: 0.18,
    resolved: false,
    resolution: null,
    pnl_pct: 50.0,
    posted_at: "2026-02-20T15:00:00Z",
  },
  {
    id: "pm-10",
    handle: "cobie",
    event_title: "Will Ethereum staking yield drop below 3%?",
    market_url: "https://polymarket.com/event/eth-staking-yield-2026",
    direction: "yes",
    entry_probability: 0.4,
    current_probability: 0.52,
    resolved: true,
    resolution: "yes",
    pnl_pct: 30.0,
    posted_at: "2026-01-10T12:00:00Z",
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all"; // "all" | "active" | "resolved"
  const handle = searchParams.get("handle");

  let trades = [...MOCK_PREDICTIONS];

  if (handle) {
    trades = trades.filter((t) => t.handle.toLowerCase() === handle.toLowerCase());
  }

  if (filter === "active") {
    trades = trades.filter((t) => !t.resolved);
  } else if (filter === "resolved") {
    trades = trades.filter((t) => t.resolved);
  }

  // Compute stats
  const resolved = MOCK_PREDICTIONS.filter((t) => t.resolved);
  const correct = resolved.filter(
    (t) => t.resolution === t.direction,
  );
  const totalBets = MOCK_PREDICTIONS.length;
  const avgAccuracy = resolved.length > 0
    ? Math.round((correct.length / resolved.length) * 100)
    : 0;

  return NextResponse.json(
    {
      trades,
      stats: {
        totalBets,
        avgAccuracy,
        activeBets: MOCK_PREDICTIONS.filter((t) => !t.resolved).length,
        resolvedBets: resolved.length,
      },
    },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
      },
    },
  );
}

// Leaderboard endpoint
export async function POST(request: Request) {
  // Build leaderboard from mock data
  const byHandle = new Map<string, PredictionTrade[]>();
  for (const trade of MOCK_PREDICTIONS) {
    const existing = byHandle.get(trade.handle) ?? [];
    existing.push(trade);
    byHandle.set(trade.handle, existing);
  }

  const rows: PredictionLeaderboardRow[] = [];
  let rank = 0;

  for (const [handle, trades] of byHandle) {
    const resolved = trades.filter((t) => t.resolved);
    const correct = resolved.filter((t) => t.resolution === t.direction);
    const accuracy = resolved.length > 0
      ? Math.round((correct.length / resolved.length) * 100)
      : 0;
    const avgPnl = trades.length > 0
      ? parseFloat((trades.reduce((sum, t) => sum + t.pnl_pct, 0) / trades.length).toFixed(1))
      : 0;
    const activeBets = trades.filter((t) => !t.resolved).length;

    rows.push({
      rank: 0,
      handle,
      accuracy,
      avgPnl,
      totalPredictions: trades.length,
      activeBets,
    });
  }

  // Sort by accuracy (min 1 resolved for demo), then by avgPnl
  rows.sort((a, b) => b.accuracy - a.accuracy || b.avgPnl - a.avgPnl);
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  return NextResponse.json(
    { entries: rows },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
      },
    },
  );
}
