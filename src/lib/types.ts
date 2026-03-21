/** Prediction market trade (Polymarket, etc.) */
export interface PredictionTrade {
  id: string;
  handle: string;
  event_title: string;
  market_url: string;
  direction: "yes" | "no";
  entry_probability: number;   // 0.65 = 65%
  current_probability: number;
  exit_probability?: number;
  resolved: boolean;
  resolution: "yes" | "no" | null;
  pnl_pct: number;
  posted_at: string;
}

/** Prediction caller stats for profile pages */
export interface PredictionCallerStats {
  handle: string;
  totalPredictions: number;
  resolvedCount: number;
  correctCount: number;
  accuracy: number;            // 0-100%
  avgEntryVsResolutionDelta: number;
  bestPrediction: PredictionTrade | null;
  activePredictions: number;
}

/** Prediction leaderboard row */
export interface PredictionLeaderboardRow {
  rank: number;
  handle: string;
  accuracy: number;
  avgPnl: number;
  totalPredictions: number;
  activeBets: number;
  avatarUrl?: string | null;
}

/** Event market categories */
export type EventCategory = "sports" | "politics" | "crypto" | "entertainment" | "science" | "economics";

/** Event market from Polymarket */
export interface EventMarket {
  id: string;
  polymarket_id: string | null;
  title: string;
  category: EventCategory;
  subcategory: string | null;
  description: string | null;
  current_probability: number;
  probability_24h_ago: number | null;
  volume: number;
  settlement_date: string | null;
  settled: boolean;
  outcome: "YES" | "NO" | null;
  caller_count: number;
  market_url: string | null;
  last_updated: string;
}

/** Caller position on an event market */
export interface EventMarketCall {
  id: string;
  market_id: string;
  handle: string;
  direction: "yes" | "no";
  entry_probability: number;
  called_at: string;
}

/** Event market with caller details for detail page */
export interface EventMarketDetail extends EventMarket {
  callers: EventMarketCaller[];
}

/** Caller info for market detail view */
export interface EventMarketCaller {
  handle: string;
  direction: "yes" | "no";
  entry_probability: number;
  called_at: string;
  pnl_pct: number;
  is_correct: boolean | null; // null if not settled
}

/** Sports leaderboard row */
export interface SportsLeaderboardRow {
  rank: number;
  handle: string;
  wins: number;
  losses: number;
  win_pct: number;
  avg_pnl: number;
  streak: number;
  streak_type: "W" | "L" | null;
}
