import type { Metadata } from "next";
import Link from "next/link";
import { getOrCreateAuthor, getAuthorMetrics, recordView, syncAuthor, isStale } from "@/lib/data";
import { HeadToHeadCard } from "@/components/head-to-head-card";
import { MatchupForm } from "./matchup-form";
import type { AuthorMetrics } from "@/lib/metrics";

interface PageProps {
  params: Promise<{ a: string; b: string }>;
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

function determineWinner(
  aVal: number,
  bVal: number,
): "a" | "b" | "tie" {
  if (aVal > bVal) return "a";
  if (bVal > aVal) return "b";
  return "tie";
}

async function loadMetrics(handle: string): Promise<AuthorMetrics | null> {
  const author = await getOrCreateAuthor(handle);

  if (isStale(author.last_fetched)) {
    try {
      await syncAuthor(handle);
    } catch (err) {
      console.error(`[vs-page] Failed to sync ${handle}:`, err);
    }
  }

  return await getAuthorMetrics(handle);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { a: rawA, b: rawB } = await params;
  const handleA = cleanHandle(rawA);
  const handleB = cleanHandle(rawB);

  const title = `@${handleA} vs @${handleB} -- Head to Head | paste.markets`;
  const description = `Who trades better? Compare @${handleA} and @${handleB} side by side -- win rate, P&L, streaks, and more.`;

  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  return {
    title,
    description,
    openGraph: {
      title: `@${handleA} vs @${handleB} -- Head to Head`,
      description,
      images: [
        { url: `${baseUrl}/api/og/vs/${handleA}/${handleB}`, width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `@${handleA} vs @${handleB} -- Head to Head`,
      description,
      images: [`${baseUrl}/api/og/vs/${handleA}/${handleB}`],
    },
  };
}

function NotFound({ handleA, handleB }: { handleA: string; handleB: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Matchup Unavailable
        </h1>
        <p className="text-text-secondary mb-1">
          One or both traders not found.
        </p>
        <p className="text-text-muted text-sm mb-8">
          We could not load data for @{handleA} and/or @{handleB}. They may not
          have any tracked trades yet.
        </p>
        <div className="space-y-4">
          <MatchupForm />
          <Link
            href="/leaderboard"
            className="inline-block border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            &larr; Back to Leaderboard
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function VsPage({ params }: { params: Promise<{ a: string; b: string }> }) {
  const { a, b } = await params;
  const handleA = cleanHandle(a);
  const handleB = cleanHandle(b);

  // Load both traders in parallel
  const [metricsA, metricsB] = await Promise.all([
    loadMetrics(handleA),
    loadMetrics(handleB),
  ]);

  if (!metricsA || !metricsB || metricsA.totalTrades === 0 || metricsB.totalTrades === 0) {
    return <NotFound handleA={handleA} handleB={handleB} />;
  }

  // Record views
  await recordView(handleA, "h2h");
  await recordView(handleB, "h2h");

  // Build comparison
  const winRateWinner = determineWinner(metricsA.winRate, metricsB.winRate);
  const avgPnlWinner = determineWinner(metricsA.avgPnl, metricsB.avgPnl);
  const totalTradesWinner = determineWinner(metricsA.totalTrades, metricsB.totalTrades);

  const bestTradeAPnl = metricsA.bestTrade?.pnl ?? 0;
  const bestTradeBPnl = metricsB.bestTrade?.pnl ?? 0;
  const bestTradeWinner = determineWinner(bestTradeAPnl, bestTradeBPnl);

  const worstTradeAPnl = metricsA.worstTrade?.pnl ?? 0;
  const worstTradeBPnl = metricsB.worstTrade?.pnl ?? 0;
  const worstTradeWinner = determineWinner(worstTradeAPnl, worstTradeBPnl);

  const streakWinner = determineWinner(metricsA.streak, metricsB.streak);

  const dimensions = [winRateWinner, avgPnlWinner, totalTradesWinner, bestTradeWinner, worstTradeWinner, streakWinner];
  const aWins = dimensions.filter((d) => d === "a").length;
  const bWins = dimensions.filter((d) => d === "b").length;
  const overallWinner: "a" | "b" | "tie" =
    aWins > bWins ? "a" : bWins > aWins ? "b" : "tie";

  // Shared tickers
  const tickerPnlA = new Map<string, number[]>();
  for (const t of metricsA.recentTrades) {
    const arr = tickerPnlA.get(t.ticker) ?? [];
    arr.push(t.pnl_pct);
    tickerPnlA.set(t.ticker, arr);
  }

  const tickerPnlB = new Map<string, number[]>();
  for (const t of metricsB.recentTrades) {
    const arr = tickerPnlB.get(t.ticker) ?? [];
    arr.push(t.pnl_pct);
    tickerPnlB.set(t.ticker, arr);
  }

  const sharedTickers: Array<{ ticker: string; a_pnl: number; b_pnl: number }> = [];
  for (const [ticker, aPnls] of tickerPnlA) {
    const bPnls = tickerPnlB.get(ticker);
    if (bPnls) {
      const avgA = aPnls.reduce((s, v) => s + v, 0) / aPnls.length;
      const avgB = bPnls.reduce((s, v) => s + v, 0) / bPnls.length;
      sharedTickers.push({
        ticker,
        a_pnl: Math.round(avgA * 10) / 10,
        b_pnl: Math.round(avgB * 10) / 10,
      });
    }
  }
  sharedTickers.sort(
    (x, y) => Math.abs(y.a_pnl) + Math.abs(y.b_pnl) - (Math.abs(x.a_pnl) + Math.abs(x.b_pnl)),
  );

  const profileA = {
    handle: handleA,
    metrics: {
      totalTrades: metricsA.totalTrades,
      winRate: metricsA.winRate,
      avgPnl: metricsA.avgPnl,
      winCount: metricsA.winCount,
      lossCount: metricsA.lossCount,
      bestTrade: metricsA.bestTrade,
      worstTrade: metricsA.worstTrade,
      streak: metricsA.streak,
    },
  };

  const profileB = {
    handle: handleB,
    metrics: {
      totalTrades: metricsB.totalTrades,
      winRate: metricsB.winRate,
      avgPnl: metricsB.avgPnl,
      winCount: metricsB.winCount,
      lossCount: metricsB.lossCount,
      bestTrade: metricsB.bestTrade,
      worstTrade: metricsB.worstTrade,
      streak: metricsB.streak,
    },
  };

  const winnerHandle = overallWinner === "a" ? handleA : overallWinner === "b" ? handleB : null;
  const score = `${aWins}-${bWins}`;

  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/leaderboard"
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          &larr; Leaderboard
        </Link>
        <div className="text-[11px] uppercase tracking-widest text-text-muted">
          Head to Head
        </div>
      </div>

      {/* Winner banner */}
      <div className="text-center mb-10">
        {overallWinner === "tie" ? (
          <>
            <div className="text-[11px] uppercase tracking-widest text-amber mb-2">
              Draw
            </div>
            <h1 className="text-2xl font-bold text-text-primary">
              @{handleA} ties @{handleB}
            </h1>
            <p className="text-sm text-text-muted mt-2 font-mono">
              {score} -- No clear winner
            </p>
          </>
        ) : (
          <>
            <div className="text-[11px] uppercase tracking-widest text-win mb-2">
              Winner
            </div>
            <h1 className="text-2xl font-bold text-text-primary">
              @{winnerHandle} wins {score}
            </h1>
            <p className="text-sm text-text-muted mt-2 font-mono">
              across {dimensions.length} categories
            </p>
          </>
        )}
      </div>

      {/* Profile links */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link
          href={`/${handleA}`}
          className="text-center text-xs text-text-muted hover:text-accent transition-colors border border-border hover:border-accent rounded-lg py-2"
        >
          View @{handleA} profile &rarr;
        </Link>
        <Link
          href={`/${handleB}`}
          className="text-center text-xs text-text-muted hover:text-accent transition-colors border border-border hover:border-accent rounded-lg py-2"
        >
          View @{handleB} profile &rarr;
        </Link>
      </div>

      {/* Head-to-head card */}
      <HeadToHeadCard
        a={profileA}
        b={profileB}
        comparison={{
          winRateWinner,
          avgPnlWinner,
          totalTradesWinner,
          bestTradeWinner,
          overallWinner,
          sharedTickers,
        }}
      />

      {/* Matchup form */}
      <div className="mt-10">
        <MatchupForm />
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border flex justify-between text-[11px] text-text-muted">
        <span>paste.markets</span>
        <span>data from paste.trade</span>
      </div>
    </main>
  );
}
