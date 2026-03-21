/**
 * Badge / achievement definitions for caller profiles.
 */

export interface CallerStats {
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  streak: number;
  maxWinStreak: number;
  bestTradePnl: number;
  maxTradesIn24h: number;
  avgHoldDays: number;
  hasPerfectWeek: boolean;
  consecutivePositiveWeeks: number;
  leaderboardTop3Days: number;
}

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  condition: (stats: CallerStats) => boolean;
}

export interface EarnedBadge {
  badge: Badge;
  earnedAt: string; // ISO date
}

export const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#f39c12",
  diamond: "#3b82f6",
};

export const BADGE_CATALOG: Badge[] = [
  {
    id: "hot-streak",
    name: "Hot Streak",
    description: "3 wins in a row",
    icon: "🔥",
    tier: "bronze",
    condition: (s) => s.maxWinStreak >= 3,
  },
  {
    id: "on-fire",
    name: "On Fire",
    description: "5 wins in a row",
    icon: "💥",
    tier: "silver",
    condition: (s) => s.maxWinStreak >= 5,
  },
  {
    id: "untouchable",
    name: "Untouchable",
    description: "10 wins in a row",
    icon: "👑",
    tier: "gold",
    condition: (s) => s.maxWinStreak >= 10,
  },
  {
    id: "perfect-week",
    name: "Perfect Week",
    description: "100% win rate with 5+ trades in 7 days",
    icon: "🏆",
    tier: "gold",
    condition: (s) => s.hasPerfectWeek,
  },
  {
    id: "volume-king",
    name: "Volume King",
    description: "50+ trades placed",
    icon: "📊",
    tier: "silver",
    condition: (s) => s.totalTrades >= 50,
  },
  {
    id: "sharp-shooter",
    name: "Sharp Shooter",
    description: "70%+ win rate with 20+ trades",
    icon: "🎯",
    tier: "gold",
    condition: (s) => s.winRate >= 70 && s.totalTrades >= 20,
  },
  {
    id: "diamond-hands",
    name: "Diamond Hands",
    description: "Avg hold > 7 days with positive P&L",
    icon: "💎",
    tier: "silver",
    condition: (s) => s.avgHoldDays > 7 && s.totalPnl > 0,
  },
  {
    id: "degen",
    name: "Degen",
    description: "10+ trades in 24 hours",
    icon: "🎰",
    tier: "bronze",
    condition: (s) => s.maxTradesIn24h >= 10,
  },
  {
    id: "whale",
    name: "Whale",
    description: "Single trade P&L > 50%",
    icon: "🐋",
    tier: "gold",
    condition: (s) => s.bestTradePnl > 50,
  },
  {
    id: "early-bird",
    name: "Early Bird",
    description: "10+ trades — always on time",
    icon: "🐦",
    tier: "bronze",
    condition: (s) => s.totalTrades >= 10,
  },
  {
    id: "consistency",
    name: "Consistency",
    description: "Positive P&L 4 weeks running",
    icon: "📈",
    tier: "diamond",
    condition: (s) => s.consecutivePositiveWeeks >= 4,
  },
  {
    id: "ct-legend",
    name: "CT Legend",
    description: "Top 3 on leaderboard for 30 days",
    icon: "🏅",
    tier: "diamond",
    condition: (s) => s.leaderboardTop3Days >= 30,
  },
];
