import type { Metadata } from "next";
import CallerCircleGenerator from "@/components/caller-circle-generator";

export const metadata: Metadata = {
  title: "Caller Circle — paste.markets",
  description:
    "Top 50 Crypto Twitter callers ranked by real P&L, visualized as a shareable circle. Inner ring = best performers.",
  openGraph: {
    title: "Caller Circle — paste.markets",
    description:
      "Top 50 CT callers ranked by real P&L. Inner ring = best performers. Download and share.",
    images: [{ url: "/api/og/circle", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Caller Circle — paste.markets",
    description: "Top 50 CT callers ranked by real P&L. Generate & share your circle.",
    images: ["/api/og/circle"],
  },
};

export default function CirclePage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <section className="flex flex-col items-center mb-10">
        <p className="text-xs uppercase tracking-widest text-text-muted mb-3">
          paste.markets
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-3 text-center">
          Caller Circle
        </h1>
        <p className="text-text-secondary text-sm text-center max-w-lg">
          The top 50 Crypto Twitter callers, ranked by real P&L and visualized as
          concentric rings. Inner circle = highest win rate. Hover for stats,
          click to view profiles. Download and tweet yours.
        </p>
      </section>

      <CallerCircleGenerator />
    </main>
  );
}
