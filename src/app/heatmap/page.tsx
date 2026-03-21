import type { Metadata } from "next";
import TickerHeatmap from "@/components/ticker-heatmap";
import type { HeatmapResponse } from "@/app/api/heatmap/route";

export const metadata: Metadata = {
  title: "Ticker Heatmap — paste.markets",
  description: "What CT is trading right now. Sized by volume, colored by sentiment.",
  openGraph: {
    title: "Ticker Heatmap — paste.markets",
    description: "What CT is trading right now. Sized by volume, colored by sentiment.",
    images: [{ url: "/api/og/heatmap", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ticker Heatmap — paste.markets",
    images: ["/api/og/heatmap"],
  },
};

async function getHeatmapData(): Promise<HeatmapResponse> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/heatmap?timeframe=7d`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Heatmap fetch failed: ${res.status}`);
    return res.json();
  } catch {
    return { tickers: [], timeframe: "7d" };
  }
}

export default async function HeatmapPage() {
  const data = await getHeatmapData();

  return (
    <main className="min-h-screen pt-12 pb-16 px-6 max-w-7xl mx-auto font-mono">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight mb-1"
          style={{ color: "#f0f0f0" }}
        >
          TICKER HEATMAP
        </h1>
        <p className="text-sm" style={{ color: "#555568" }}>
          What CT is trading right now — sized by volume, colored by sentiment
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-xs uppercase tracking-widest" style={{ color: "#555568" }}>
          Sentiment
        </span>
        {[
          { label: "Strong Bull", color: "#2ecc71" },
          { label: "Lean Bull", color: "#27ae60" },
          { label: "Neutral", color: "#555568" },
          { label: "Lean Bear", color: "#c0392b" },
          { label: "Strong Bear", color: "#e74c3c" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div
              style={{ width: "10px", height: "10px", backgroundColor: color, borderRadius: "2px" }}
            />
            <span className="text-xs" style={{ color: "#c8c8d0" }}>
              {label}
            </span>
          </div>
        ))}
        <span className="text-xs ml-4" style={{ color: "#555568" }}>
          Size = volume of calls
        </span>
      </div>

      {/* Heatmap (client component handles timeframe toggle + refetch) */}
      <TickerHeatmap initialData={data} />
    </main>
  );
}
