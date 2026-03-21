import { NextRequest, NextResponse } from "next/server";
import { syncAuthor, isStale, getOrCreateAuthor, getAuthorMetrics, recordView } from "@/lib/data";
import type { TradeSummary } from "@/lib/metrics";
import { determinePersonality } from "@/lib/personalities";

export const dynamic = "force-dynamic";

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

type Grade = "S" | "A" | "B" | "C" | "D" | "F";

function gradeFromPercentile(value: number, thresholds: number[]): Grade {
  // thresholds: [S, A, B, C, D] — value must be >= threshold to earn that grade
  if (value >= thresholds[0]!) return "S";
  if (value >= thresholds[1]!) return "A";
  if (value >= thresholds[2]!) return "B";
  if (value >= thresholds[3]!) return "C";
  if (value >= thresholds[4]!) return "D";
  return "F";
}

function computeTimingGrade(winRate: number): Grade {
  return gradeFromPercentile(winRate, [80, 65, 50, 40, 30]);
}

function computeConvictionGrade(trades: TradeSummary[]): Grade {
  if (trades.length === 0) return "F";

  // Measure directional consistency — how often do they stick to one direction?
  const directionCounts: Record<string, number> = {};
  for (const t of trades) {
    directionCounts[t.direction] = (directionCounts[t.direction] ?? 0) + 1;
  }
  const maxDirection = Math.max(...Object.values(directionCounts));
  const consistency = (maxDirection / trades.length) * 100;

  // Also factor in number of trades (more trades = more conviction)
  const volumeBonus = Math.min(trades.length / 30, 1) * 20;
  const score = consistency + volumeBonus;

  return gradeFromPercentile(score, [90, 75, 60, 45, 30]);
}

function computeConsistencyGrade(trades: TradeSummary[]): Grade {
  if (trades.length < 3) return "F";

  // Standard deviation of P&L — lower = more consistent
  const pnls = trades.filter((t) => t.pnl_pct != null).map((t) => t.pnl_pct);
  if (pnls.length < 3) return "F";

  const mean = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const variance = pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / pnls.length;
  const stdDev = Math.sqrt(variance);

  // Lower std dev = higher grade (inverted scale)
  // Typical ranges: <10 is very consistent, >50 is wild
  if (stdDev < 8) return "S";
  if (stdDev < 15) return "A";
  if (stdDev < 25) return "B";
  if (stdDev < 40) return "C";
  if (stdDev < 60) return "D";
  return "F";
}

function computeRiskManagementGrade(trades: TradeSummary[]): Grade {
  const withPnl = trades.filter((t) => t.pnl_pct != null);
  if (withPnl.length < 3) return "F";

  const wins = withPnl.filter((t) => t.pnl_pct > 0);
  const losses = withPnl.filter((t) => t.pnl_pct <= 0);

  if (losses.length === 0) return "S"; // No losses = perfect risk mgmt

  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + t.pnl_pct, 0) / wins.length
    : 0;
  const avgLoss = Math.abs(
    losses.reduce((s, t) => s + t.pnl_pct, 0) / losses.length,
  );

  // Win/loss ratio — higher is better
  const ratio = avgLoss > 0 ? avgWin / avgLoss : 10;

  // Also factor in worst drawdown
  const worstLoss = Math.abs(Math.min(...withPnl.map((t) => t.pnl_pct)));
  const drawdownPenalty = worstLoss > 50 ? -1 : worstLoss > 30 ? -0.5 : 0;

  const score = ratio + drawdownPenalty;

  if (score >= 3) return "S";
  if (score >= 2) return "A";
  if (score >= 1.2) return "B";
  if (score >= 0.8) return "C";
  if (score >= 0.5) return "D";
  return "F";
}

function computeOverallGrade(grades: Record<string, Grade>): Grade {
  const gradeValues: Record<Grade, number> = {
    S: 6,
    A: 5,
    B: 4,
    C: 3,
    D: 2,
    F: 1,
  };
  const weights = {
    timing: 0.3,
    conviction: 0.15,
    consistency: 0.25,
    riskManagement: 0.3,
  };

  let weighted = 0;
  weighted += gradeValues[grades.timing as Grade]! * weights.timing;
  weighted += gradeValues[grades.conviction as Grade]! * weights.conviction;
  weighted += gradeValues[grades.consistency as Grade]! * weights.consistency;
  weighted += gradeValues[grades.riskManagement as Grade]! * weights.riskManagement;

  if (weighted >= 5.5) return "S";
  if (weighted >= 4.5) return "A";
  if (weighted >= 3.5) return "B";
  if (weighted >= 2.5) return "C";
  if (weighted >= 1.5) return "D";
  return "F";
}

// Personality determination now uses src/lib/personalities.ts

function generateFunFacts(metrics: AuthorMetrics): string[] {
  const facts: string[] = [];
  const { recentTrades, winRate, bestTrade, worstTrade, streak } = metrics;

  // Most traded ticker
  const tickerCounts: Record<string, number> = {};
  for (const t of recentTrades) {
    tickerCounts[t.ticker] = (tickerCounts[t.ticker] ?? 0) + 1;
  }
  const sortedTickers = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1]);
  if (sortedTickers[0] && sortedTickers[0][1] > 2) {
    const dir = recentTrades.find((t) => t.ticker === sortedTickers[0]![0])?.direction ?? "trading";
    facts.push(
      `You love ${dir === "short" ? "shorting" : dir === "long" ? "longing" : "trading"} $${sortedTickers[0][0]} — ${sortedTickers[0][1]} trades and counting`,
    );
  }

  // Best trade fact
  if (bestTrade && bestTrade.pnl > 0) {
    facts.push(
      `Your best call was $${bestTrade.ticker} at +${bestTrade.pnl.toFixed(1)}%. chef's kiss`,
    );
  }

  // Worst trade fact
  if (worstTrade && worstTrade.pnl < -20) {
    facts.push(
      `$${worstTrade.ticker} at ${worstTrade.pnl.toFixed(1)}%. We don't talk about that one.`,
    );
  }

  // Direction bias
  const longs = recentTrades.filter((t) => t.direction === "long").length;
  const shorts = recentTrades.filter((t) => t.direction === "short").length;
  if (shorts === 0 && longs > 3) {
    facts.push("You've never shorted anything. Ever.");
  } else if (longs === 0 && shorts > 3) {
    facts.push("You've never gone long. Perma-bear confirmed.");
  } else if (longs > 0 && shorts > 0) {
    const ratio = longs / shorts;
    if (ratio > 4) facts.push(`${longs} longs vs ${shorts} shorts. Bullish by nature.`);
    if (ratio < 0.25) facts.push(`${shorts} shorts vs ${longs} longs. You really hate pumps.`);
  }

  // Streak
  if (streak > 3) {
    facts.push(`You're on a ${streak}-trade win streak right now. Don't jinx it.`);
  } else if (streak < -3) {
    facts.push(`${Math.abs(streak)} losses in a row. Maybe touch grass?`);
  }

  // Win rate commentary
  if (winRate > 80) {
    facts.push(`${winRate.toFixed(0)}% win rate. At this point, just post your trades for alpha.`);
  } else if (winRate < 25 && recentTrades.length > 5) {
    facts.push(`${winRate.toFixed(0)}% win rate. You might be the best fade signal on CT.`);
  }

  // Platform diversity
  const platforms = new Set(recentTrades.map((t) => t.platform).filter(Boolean));
  if (platforms.size > 3) {
    facts.push(`Trading on ${platforms.size} different platforms. You get around.`);
  }

  // Return 3-5 facts
  return facts.slice(0, 5);
}

function getBestMonth(trades: TradeSummary[]): string {
  const monthPnl: Record<string, number> = {};
  for (const t of trades) {
    const date = t.entry_date ?? t.posted_at;
    if (!date) continue;
    const month = date.slice(0, 7); // "2026-03"
    monthPnl[month] = (monthPnl[month] ?? 0) + (t.pnl_pct ?? 0);
  }

  let bestMonth = "";
  let bestPnl = -Infinity;
  for (const [month, pnl] of Object.entries(monthPnl)) {
    if (pnl > bestPnl) {
      bestPnl = pnl;
      bestMonth = month;
    }
  }

  if (!bestMonth) return "N/A";

  // Format "2026-03" -> "March 2026"
  const [year, monthNum] = bestMonth.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[parseInt(monthNum!, 10) - 1] ?? monthNum;
  return `${monthName} ${year}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ author: string }> },
) {
  try {
    const { author: rawAuthor } = await params;
    const handle = cleanHandle(rawAuthor);

    if (!handle) {
      return NextResponse.json(
        { error: "Missing author parameter" },
        { status: 400 },
      );
    }

    const author = await getOrCreateAuthor(handle);

    if (isStale(author.last_fetched)) {
      try {
        await syncAuthor(handle);
      } catch (err) {
        console.error(`[api/wrapped] Failed to sync ${handle}:`, err);
      }
    }

    const metrics = await getAuthorMetrics(handle);
    if (!metrics || metrics.totalTrades === 0) {
      return NextResponse.json(
        { error: "Author not found or no trades", details: `No data for @${handle}` },
        { status: 404 },
      );
    }

    await recordView(handle, "wrapped");

    // Compute grades
    const timingGrade = computeTimingGrade(metrics.winRate);
    const convictionGrade = computeConvictionGrade(metrics.recentTrades);
    const consistencyGrade = computeConsistencyGrade(metrics.recentTrades);
    const riskManagementGrade = computeRiskManagementGrade(metrics.recentTrades);
    const grades = {
      timing: timingGrade,
      conviction: convictionGrade,
      consistency: consistencyGrade,
      riskManagement: riskManagementGrade,
    };
    const overallGrade = computeOverallGrade(grades);

    // Personality
    const personality = determinePersonality(metrics);

    // Highlights
    const favoriteTicker =
      Object.entries(
        metrics.recentTrades.reduce<Record<string, number>>((acc, t) => {
          acc[t.ticker] = (acc[t.ticker] ?? 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

    const directionCounts: Record<string, number> = {};
    for (const t of metrics.recentTrades) {
      const d = t.direction === "yes" ? "long" : t.direction === "no" ? "short" : t.direction;
      directionCounts[d] = (directionCounts[d] ?? 0) + 1;
    }
    const favoriteDirection =
      Object.entries(directionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "long";

    // Fun facts
    const funFacts = generateFunFacts(metrics);

    return NextResponse.json({
      handle,
      grades: {
        overall: overallGrade,
        timing: timingGrade,
        conviction: convictionGrade,
        consistency: consistencyGrade,
        riskManagement: riskManagementGrade,
      },
      personality: {
        id: personality.id,
        label: personality.label,
        description: personality.description,
        color: personality.color,
      },
      highlights: {
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        avgPnl: metrics.avgPnl,
        bestMonth: getBestMonth(metrics.recentTrades),
        favoriteTicker,
        favoriteDirection,
        longestStreak: Math.abs(metrics.streak),
        biggestWin: metrics.bestTrade
          ? { ticker: metrics.bestTrade.ticker, pnl: metrics.bestTrade.pnl }
          : { ticker: "N/A", pnl: 0 },
        biggestLoss: metrics.worstTrade
          ? { ticker: metrics.worstTrade.ticker, pnl: metrics.worstTrade.pnl }
          : { ticker: "N/A", pnl: 0 },
      },
      funFacts,
    });
  } catch (err) {
    console.error("[api/wrapped] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
