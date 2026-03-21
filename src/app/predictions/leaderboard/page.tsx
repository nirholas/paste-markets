import type { Metadata } from "next";
import { Suspense } from "react";
import { PredictionLeaderboardClient } from "./client";
import type { PredictionLeaderboardRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Prediction Leaderboard -- paste.markets",
  description:
    "Top prediction market callers ranked by accuracy. See who is calling Polymarket events right.",
  openGraph: {
    title: "Prediction Leaderboard -- paste.markets",
    description: "Accuracy rankings for prediction market callers on CT.",
    images: [{ url: "/api/og/leaderboard", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prediction Leaderboard -- paste.markets",
    images: ["/api/og/leaderboard"],
  },
};

export const dynamic = "force-dynamic";

export default async function PredictionLeaderboardPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let initialEntries: PredictionLeaderboardRow[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/predictions`, {
      method: "POST",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      initialEntries = data.entries ?? [];
    }
  } catch (err) {
    console.error("[predictions/leaderboard] Failed to fetch:", err);
  }

  return (
    <Suspense fallback={null}>
      <PredictionLeaderboardClient initialEntries={initialEntries} />
    </Suspense>
  );
}
