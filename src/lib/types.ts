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
