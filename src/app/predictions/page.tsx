import type { Metadata } from "next";
import { Suspense } from "react";
import { PredictionsClient } from "./client";
import type { PredictionTrade } from "@/lib/types";

export const metadata: Metadata = {
  title: "Prediction Markets -- paste.markets",
  description:
    "Track prediction market calls from CT traders. See who is calling Polymarket events right.",
  openGraph: {
    title: "Prediction Markets -- paste.markets",
    description: "Real accuracy rankings for prediction market callers on CT.",
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prediction Markets -- paste.markets",
    images: ["/api/og/leaderboard"],
  },
};

export const dynamic = "force-dynamic";

export default async function PredictionsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let initialTrades: PredictionTrade[] = [];
  let initialStats = { totalBets: 0, avgAccuracy: 0, activeBets: 0, resolvedBets: 0 };

  try {
    const res = await fetch(`${baseUrl}/api/predictions`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      initialTrades = data.trades ?? [];
      initialStats = data.stats ?? initialStats;
    }
  } catch (err) {
    console.error("[predictions/page] Failed to fetch:", err);
  }

  return (
    <Suspense fallback={null}>
      <PredictionsClient initialTrades={initialTrades} initialStats={initialStats} />
    </Suspense>
  );
}
