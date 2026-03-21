import type { Metadata } from "next";
import { ScannerClient } from "@/components/scanner-client";
import { getRecentScans } from "@/lib/scan-db";
import type { ScanJob } from "@/lib/scan-db";
import type { ScanResult } from "@/lib/scan-processor";

export const metadata: Metadata = {
  title: "Scan a Caller — paste.markets",
  description:
    "Paste any Twitter handle and get an instant performance report on every trade call they've ever made. Win rate, P&L, Jim Cramer score.",
  openGraph: {
    title: "Scan Any CT Caller — paste.markets",
    description:
      "Retroactively score every trade call from any Twitter account. Win rate, P&L, Jim Cramer score.",
    images: [{ url: "/api/og/scan", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scan Any CT Caller — paste.markets",
    images: ["/api/og/scan"],
  },
};

interface RecentScan {
  jobId: string;
  handle: string;
  callsFound: number;
  winRate: number | null;
}

function parseRecentScans(jobs: ScanJob[]): RecentScan[] {
  return jobs.flatMap((job) => {
    if (!job.result_json) return [];
    try {
      const result = JSON.parse(job.result_json) as ScanResult;
      return [
        {
          jobId: job.id,
          handle: job.handle,
          callsFound: result.callsFound,
          winRate: result.stats.winRate,
        },
      ];
    } catch {
      return [];
    }
  });
}

export default async function ScanPage() {
  const recentJobs = await getRecentScans();
  const recentScans = parseRecentScans(recentJobs);

  return (
    <main className="min-h-screen">
      <ScannerClient recentScans={recentScans} />
    </main>
  );
}
