import type { Metadata } from "next";
import { BacktestClient } from "@/components/backtest-client";

export const metadata: Metadata = {
  title: "Backtest a Caller — paste.markets",
  description:
    "Full backtest of any Twitter account's trade calls. Every call tracked, no cherry-picking. Follow vs Fade analysis with Jim Cramer detection.",
  openGraph: {
    title: "Backtest Any CT Caller — paste.markets",
    description:
      "Exhaustive scan of any Twitter account. Grade every trade call with real P&L. Follow vs Fade comparison.",
    images: [{ url: "/api/og/scan", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backtest Any CT Caller — paste.markets",
    images: ["/api/og/scan"],
  },
};

export default function BacktestIndexPage() {
  return (
    <main className="min-h-screen">
      <BacktestClient />
    </main>
  );
}
