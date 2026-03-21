import type { AuthorMetrics } from "./metrics";

export interface Personality {
  id: string;
  label: string;
  description: string;
  color: string;        // primary color hex
  gradient: string;     // tailwind gradient classes
  ogGradient: [string, string]; // hex pair for OG images
  triggers: string[];   // human-readable stat triggers
}

const PERSONALITIES: Record<string, Omit<Personality, "id">> = {
  sniper: {
    label: "The Sniper",
    description: "High accuracy, high damage. Surgical precision on every entry.",
    color: "#c9a227",
    gradient: "from-[#1a1a3a] via-[#1a2040] to-[#2a1f00]",
    ogGradient: ["#0d0d2a", "#2a1f00"],
    triggers: ["Win rate > 70%", "Avg P&L > 15%", "Precise entries"],
  },
  degen: {
    label: "The Degen",
    description: "High frequency, loves the action. Mostly wrong, but when right — REALLY right.",
    color: "#39ff14",
    gradient: "from-[#0a1a0a] via-[#0a0a1a] to-[#0d2a0d]",
    ogGradient: ["#0a0a1a", "#0d2a0d"],
    triggers: ["Many trades", "High frequency", "Has 100%+ winners"],
  },
  diamond_hands: {
    label: "Diamond Hands",
    description: "Never sells early. Holds through the chaos with unshakeable conviction.",
    color: "#60a5fa",
    gradient: "from-[#0a0a2a] via-[#0a1530] to-[#1a2540]",
    ogGradient: ["#0a0a2a", "#1a2540"],
    triggers: ["High conviction grade", "Low trade count", "Strong directional bias"],
  },
  flipper: {
    label: "The Flipper",
    description: "Quick in, quick out. Captures moves before anyone notices they happened.",
    color: "#f472b6",
    gradient: "from-[#1a0a1a] via-[#0a0a1a] to-[#2a0a20]",
    ogGradient: ["#0a0a1a", "#2a0a20"],
    triggers: ["Many trades", "Short hold times", "Quick exits"],
  },
  contrarian: {
    label: "The Contrarian",
    description: "Fades everything. Sees tops before they happen and shorts the hype.",
    color: "#a78bfa",
    gradient: "from-[#1a0a2a] via-[#0a0a1a] to-[#200a30]",
    ogGradient: ["#0a0a1a", "#200a30"],
    triggers: ["Majority short positions", "Fades consensus", "Bearish bias"],
  },
  whale: {
    label: "The Whale",
    description: "Biggest P&L swings on CT. High conviction, massive position sizing.",
    color: "#f39c12",
    gradient: "from-[#1a1500] via-[#0a0a1a] to-[#2a2000]",
    ogGradient: ["#0a0a1a", "#2a2000"],
    triggers: ["High P&L variance", "Large wins & losses", "High conviction"],
  },
  grinder: {
    label: "The Grinder",
    description: "Consistent small wins, low variance. The tortoise that wins the race.",
    color: "#2ecc71",
    gradient: "from-[#0a1a10] via-[#0a0a1a] to-[#0a2015]",
    ogGradient: ["#0a0a1a", "#0a2015"],
    triggers: ["Win rate > 60%", "Low P&L variance", "Many trades"],
  },
  yolo: {
    label: "The YOLO",
    description: "Concentrated bets, all-or-nothing. Goes big or goes home.",
    color: "#ef4444",
    gradient: "from-[#1a0a0a] via-[#0a0a1a] to-[#2a0a0a]",
    ogGradient: ["#0a0a1a", "#2a0a0a"],
    triggers: ["Few trades", "High avg P&L magnitude", "Concentrated positions"],
  },
  analyst: {
    label: "The Analyst",
    description: "Trades across all venues and tickers. Diversified, data-driven, disciplined.",
    color: "#3b82f6",
    gradient: "from-[#0a0a2a] via-[#0a0a1a] to-[#0a1530]",
    ogGradient: ["#0a0a1a", "#0a1530"],
    triggers: ["Multiple platforms", "Diversified tickers", "Balanced directions"],
  },
  faded: {
    label: "The Faded",
    description: "Consistently wrong. Valuable as a fade signal — just do the opposite.",
    color: "#6b7280",
    gradient: "from-[#0a0a10] via-[#0a0a1a] to-[#10101a]",
    ogGradient: ["#0a0a1a", "#10101a"],
    triggers: ["Win rate < 30%", "Negative avg P&L", "Reliable fade signal"],
  },
};

export function getPersonality(id: string): Personality {
  const p = PERSONALITIES[id];
  if (!p) {
    return {
      id: "trader",
      label: "The Trader",
      description: "A well-rounded market participant.",
      color: "#3b82f6",
      gradient: "from-[#0a0a2a] via-[#0a0a1a] to-[#0a1530]",
      ogGradient: ["#0a0a1a", "#0a1530"],
      triggers: [],
    };
  }
  return { id, ...p };
}

export function determinePersonality(metrics: AuthorMetrics): Personality {
  const { winRate, avgPnl, totalTrades, recentTrades } = metrics;

  const longCount = recentTrades.filter(
    (t) => t.direction === "long" || t.direction === "yes",
  ).length;
  const shortCount = recentTrades.filter(
    (t) => t.direction === "short" || t.direction === "no",
  ).length;

  const hasMassiveWin = recentTrades.some((t) => t.pnl_pct > 100);

  const pnls = recentTrades.filter((t) => t.pnl_pct != null).map((t) => t.pnl_pct);
  const mean = pnls.length > 0 ? pnls.reduce((s, v) => s + v, 0) / pnls.length : 0;
  const variance =
    pnls.length > 2
      ? pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / pnls.length
      : 999;
  const stdDev = Math.sqrt(variance);

  // Unique tickers and platforms
  const uniqueTickers = new Set(recentTrades.map((t) => t.ticker));
  const uniquePlatforms = new Set(recentTrades.map((t) => t.platform).filter(Boolean));

  // The Sniper — high win rate, high avg P&L, precise
  if (winRate > 70 && avgPnl > 15) return getPersonality("sniper");

  // The Faded — consistently wrong, valuable as fade signal
  if (winRate < 30 && recentTrades.length > 5) return getPersonality("faded");

  // The Degen — many trades, high frequency, has massive wins
  if (winRate < 40 && hasMassiveWin) return getPersonality("degen");

  // The YOLO — few trades, high magnitude P&L
  if (totalTrades < 10 && Math.abs(avgPnl) > 20) return getPersonality("yolo");

  // The Contrarian — majority short positions
  if (shortCount > longCount && shortCount > recentTrades.length * 0.5)
    return getPersonality("contrarian");

  // The Whale — high P&L variance, big swings
  if (stdDev > 40 && recentTrades.length > 3) return getPersonality("whale");

  // The Grinder — consistent wins, low variance
  if (winRate > 60 && totalTrades > 50) return getPersonality("grinder");

  // The Analyst — diversified tickers + platforms
  if (uniqueTickers.size > 8 && uniquePlatforms.size > 2) return getPersonality("analyst");

  // Diamond Hands — few trades, strong conviction, directional bias
  if (totalTrades < 15 && avgPnl > 15) return getPersonality("diamond_hands");

  // The Flipper — many trades, small avg P&L
  if (totalTrades > 30 && Math.abs(avgPnl) < 10) return getPersonality("flipper");

  // The Grinder fallback — decent win rate, modest gains
  if (winRate > 60 && stdDev < 12) return getPersonality("grinder");

  // Default
  return getPersonality("trader");
}

export function getAllPersonalities(): Personality[] {
  return Object.entries(PERSONALITIES).map(([id, p]) => ({ id, ...p }));
}
