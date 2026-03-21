import type { Metadata } from "next";
import { BacktestClient } from "@/components/backtest-client";
import { getCachedBacktestReport } from "@/lib/backtest-db";
import type { BacktestReport } from "@/lib/backtest-processor";

interface Props {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const normalized = handle.toLowerCase().replace(/^@/, "");

  const job = await getCachedBacktestReport(normalized);
  let report: BacktestReport | null = null;
  if (job?.result_json) {
    try {
      report = JSON.parse(job.result_json) as BacktestReport;
    } catch {
      // ignore
    }
  }

  const title = report
    ? `@${normalized} — Grade ${report.grade} | ${report.follow.winRate.toFixed(0)}% Win Rate`
    : `Backtest @${normalized}`;
  const description = report
    ? `${report.follow.totalCalls} calls tracked. ${report.follow.winRate.toFixed(0)}% win rate, ${report.follow.avgPnlPercent >= 0 ? "+" : ""}${report.follow.avgPnlPercent.toFixed(1)}% avg P&L. ${report.jimCramerScore ? "Jim Cramer Alert: fading beats following!" : ""}`
    : `Full backtest of @${normalized}'s trade calls. Every call tracked, no cherry-picking.`;

  return {
    title: `${title} — paste.markets`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `/api/og/backtest/${normalized}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [`/api/og/backtest/${normalized}`],
    },
  };
}

export default async function BacktestPage({ params }: Props) {
  const { handle } = await params;
  const normalized = handle.toLowerCase().replace(/^@/, "");

  // Try to load cached report
  let cachedReport: BacktestReport | null = null;
  const job = await getCachedBacktestReport(normalized);
  if (job?.result_json) {
    try {
      cachedReport = JSON.parse(job.result_json) as BacktestReport;
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen">
      <BacktestClient initialHandle={normalized} cachedReport={cachedReport} />
    </main>
  );
}
