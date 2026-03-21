import type { Metadata } from "next";
import { Suspense } from "react";
import { RecapClient } from "./client";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://paste.markets";

export const metadata: Metadata = {
  title: "Today on CT -- paste.markets",
  description:
    "Daily recap of all trading activity on paste.markets. See today's top calls, biggest wins, hot streaks, and more.",
  openGraph: {
    title: "Today on CT -- paste.markets",
    description: "Daily trading recap for Crypto Twitter.",
    images: [{ url: "/api/og/recap", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Today on CT -- paste.markets",
    images: ["/api/og/recap"],
  },
};

export const dynamic = "force-dynamic";

export default function TodayPage() {
  return (
    <Suspense fallback={<RecapSkeleton />}>
      <RecapClient />
    </Suspense>
  );
}

function RecapSkeleton() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="h-8 w-64 bg-[#0f0f22] rounded animate-pulse mb-4" />
      <div className="h-16 w-48 bg-[#0f0f22] rounded animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-[#0f0f22] rounded-lg border border-[#1a1a2e] animate-pulse" />
        ))}
      </div>
    </main>
  );
}
