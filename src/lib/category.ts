/**
 * Call category classification for prediction market trades.
 * Used to distinguish sports, politics, macro, and entertainment
 * Polymarket calls from generic crypto/stock calls.
 */

export type CallCategory =
  | "crypto_perp"     // Hyperliquid perpetuals
  | "crypto_spot"     // Robinhood crypto
  | "stock"           // Robinhood equity
  | "sports"          // Polymarket sports events
  | "politics"        // Polymarket elections/governance
  | "macro_event"     // Polymarket macro (Fed, CPI, etc.)
  | "entertainment"   // Polymarket awards, pop culture
  | "prediction";     // Generic Polymarket (unclassified)

export const CATEGORY_LABELS: Record<CallCategory, string> = {
  crypto_perp: "Crypto Perp",
  crypto_spot: "Crypto Spot",
  stock: "Stock",
  sports: "Sports",
  politics: "Politics",
  macro_event: "Macro",
  entertainment: "Entertainment",
  prediction: "Prediction",
};

const SPORTS_KEYWORDS = [
  "nba", "nfl", "nhl", "mlb", "ncaa", "super bowl", "superbowl",
  "world cup", "championship", "tournament", "league", "playoff",
  "mvp", "ufc", "mma", "boxing", "wrestling",
  "tennis", "golf", "pga", "wimbledon", "us open",
  "world series", "stanley cup", "nba finals", "nba champion",
  "will win", "to win the", "title", "cup", "bowl",
  "kentucky", "duke", "kansas", "lakers", "warriors", "celtics",
  "patriots", "eagles", "chiefs", "cowboys", "yankees", "dodgers",
  "lebron", "curry", "mahomes", "messi", "ronaldo", "federer",
  "score", "draft pick", "transfer", "relegation",
];

const POLITICS_KEYWORDS = [
  "election", "president", "senate", "congress", "vote", "candidate",
  "democrat", "republican", "gop", "party", "primary", "midterm",
  "biden", "trump", "harris", "desantis", "rfk",
  "governor", "mayor", "legislation", "bill pass",
  "supreme court", "approval rating", "impeach",
  "uk election", "french election", "european",
];

const MACRO_KEYWORDS = [
  "fed", "fomc", "federal reserve", "interest rate", "rate cut", "rate hike",
  "inflation", "cpi", "pce", "gdp", "recession", "unemployment", "jobs",
  "nonfarm", "payroll", "earnings", "ipo", "merger", "acquisition",
  "oil price", "crude", "gold price", "dollar", "dxy", "euro",
  "yield curve", "treasury", "debt ceiling", "government shutdown",
  "economic", "ecb", "bank of england", "boj",
];

const ENTERTAINMENT_KEYWORDS = [
  "oscar", "grammy", "academy award", "emmy", "golden globe", "bafta",
  "movie", "film", "box office", "streaming", "spotify",
  "celebrity", "tv show", "series", "season",
  "taylor swift", "beyonce", "drake", "kanye",
  "netflix", "disney", "marvel",
];

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/**
 * Infer call category from trade metadata.
 * For Polymarket trades, inspects ticker + thesis + market question.
 */
export function classifyCategory(trade: {
  platform?: string | null;
  ticker: string;
  direction?: string;
  thesis?: string | null;
  market_question?: string | null;
  instrument?: string | null;
}): CallCategory {
  const platform = (trade.platform ?? "").toLowerCase();

  if (platform === "hyperliquid") return "crypto_perp";

  if (platform === "robinhood") {
    // Common crypto tickers traded on Robinhood
    const CRYPTO_TICKERS = new Set([
      "BTC", "ETH", "SOL", "DOGE", "ADA", "AVAX", "DOT", "MATIC",
      "LTC", "XRP", "LINK", "UNI", "SHIB", "PEPE", "ARB",
    ]);
    return CRYPTO_TICKERS.has(trade.ticker.toUpperCase())
      ? "crypto_spot"
      : "stock";
  }

  if (platform === "polymarket") {
    const text = [
      trade.ticker,
      trade.thesis ?? "",
      trade.market_question ?? "",
      trade.instrument ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (matchesAny(text, SPORTS_KEYWORDS)) return "sports";
    if (matchesAny(text, POLITICS_KEYWORDS)) return "politics";
    if (matchesAny(text, MACRO_KEYWORDS)) return "macro_event";
    if (matchesAny(text, ENTERTAINMENT_KEYWORDS)) return "entertainment";
    return "prediction";
  }

  return "crypto_perp";
}

/**
 * Convert a probability (0–1) to American-style odds string.
 * e.g., 0.23 → "+335", 0.67 → "-203"
 */
export function probabilityToAmericanOdds(prob: number): string {
  if (prob <= 0 || prob >= 1) return "N/A";
  if (prob >= 0.5) {
    const odds = -Math.round((prob / (1 - prob)) * 100);
    return String(odds);
  }
  const odds = Math.round(((1 - prob) / prob) * 100);
  return `+${odds}`;
}

/**
 * Format a probability as a percentage string.
 * e.g., 0.234 → "23.4%"
 */
export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

/**
 * Format market volume in human-readable USDC.
 * e.g., 85000 → "$85k", 1500000 → "$1.5M"
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${Math.round(vol / 1_000)}k`;
  return `$${Math.round(vol)}`;
}

/** Group categories for leaderboard/feed tabs */
export const POLYMARKET_CATEGORIES: CallCategory[] = [
  "sports",
  "politics",
  "macro_event",
  "entertainment",
  "prediction",
];

export function isPolymarketCategory(cat: CallCategory): boolean {
  return POLYMARKET_CATEGORIES.includes(cat);
}
