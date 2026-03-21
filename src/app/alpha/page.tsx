import type { Metadata } from "next";
import { AlphaStream } from "@/components/alpha-stream";

export const metadata: Metadata = {
  title: "Alpha Stream — paste.markets",
  description:
    "Quality-filtered trade signals from proven CT callers. Sorted by Expected Value (EV = win_rate × avg_pnl). Only validated track records.",
  openGraph: {
    title: "Alpha Stream — paste.markets",
    description:
      "Only the smartest signals. EV-sorted. Validated by real P&L track records.",
    images: [{ url: "/api/og/alpha", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Alpha Stream — paste.markets",
    images: ["/api/og/alpha"],
  },
};

export default function AlphaPage() {
  return (
    <main className="min-h-screen">
      <section className="max-w-2xl mx-auto px-4 pt-12 pb-20">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-[#555568] font-mono mb-2">
            ALPHA STREAM
          </p>
          <h1 className="text-2xl font-bold text-[#f0f0f0] font-mono">
            Quality-filtered signals
          </h1>
          <p className="text-[#555568] text-sm font-mono mt-2 leading-relaxed">
            Only callers with validated track records. Sorted by{" "}
            <span className="text-[#f0f0f0]">EV = (win rate × avg P&amp;L)</span>
            . The higher the EV, the more each call is historically worth following.
          </p>
        </div>

        {/* EV legend */}
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded p-4 mb-8 font-mono text-[11px]">
          <div className="text-[#555568] uppercase tracking-widest mb-3 text-[10px]">EV TIERS</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[#2ecc71] font-bold">+10.0+</span>
              <span className="text-[#555568] ml-2">exceptional</span>
            </div>
            <div>
              <span className="text-[#f39c12] font-bold">+5.0–9.9</span>
              <span className="text-[#555568] ml-2">strong</span>
            </div>
            <div>
              <span className="text-[#3b82f6] font-bold">+2.0–4.9</span>
              <span className="text-[#555568] ml-2">good</span>
            </div>
            <div>
              <span className="text-[#555568] font-bold">&lt;2.0</span>
              <span className="text-[#555568] ml-2">tracked</span>
            </div>
          </div>
        </div>

        <AlphaStream />
      </section>
    </main>
  );
}
