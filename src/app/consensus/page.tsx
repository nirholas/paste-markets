import type { Metadata } from "next";
import ConsensusPlays from "@/components/consensus-plays";
import type { ConsensusResponse } from "@/app/api/consensus/route";

export const metadata: Metadata = {
  title: "Consensus Plays — paste.markets",
  description:
    "When 3+ top CT callers agree on the same trade. Weighted by real win rate.",
  openGraph: {
    title: "Consensus Plays — paste.markets",
    description: "When 3+ top CT callers agree on the same trade. Weighted by real win rate.",
    images: [{ url: "/api/og/consensus", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Consensus Plays — paste.markets",
    images: ["/api/og/consensus"],
  },
};

async function getConsensusData(): Promise<ConsensusResponse> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/consensus`, {
      next: { revalidate: 600 }, // 10 minutes
    });
    if (!res.ok) throw new Error(`Consensus fetch failed: ${res.status}`);
    return res.json();
  } catch {
    return { plays: [], timeframe: "30d", updatedAt: new Date().toISOString() };
  }
}

export default async function ConsensusPage() {
  const data = await getConsensusData();

  return (
    <main className="min-h-screen pt-12">
      <ConsensusPlays plays={data.plays} updatedAt={data.updatedAt} />
    </main>
  );
}
