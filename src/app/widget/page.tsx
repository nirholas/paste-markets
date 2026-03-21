import type { Metadata } from "next";
import WidgetGenerator from "./WidgetGenerator";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://paste.markets";

export const metadata: Metadata = {
  title: "Embed Your Scorecard · paste.markets",
  description:
    "Generate an embeddable live trade scorecard widget for your website, GitHub README, or Twitter/X bio. Shows win rate, avg P&L, and streak — updated hourly.",
  openGraph: {
    title: "Embed Your Trade Scorecard · paste.markets",
    description:
      "Live scorecard widgets for CT traders. Drop your stats anywhere with a single <img> tag.",
    url: `${BASE}/widget`,
    siteName: "paste.markets",
    images: [
      {
        url: `${BASE}/api/og/home`,
        width: 1200,
        height: 630,
        alt: "paste.markets — embed your trade scorecard",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Embed Your Trade Scorecard · paste.markets",
    description:
      "Live scorecard widgets for CT traders. Drop your stats anywhere with a single <img> tag.",
    images: [`${BASE}/api/og/home`],
  },
};

export default function WidgetPage() {
  return (
    <main className="min-h-screen bg-[#0a0a1a] text-[#f0f0f0] font-mono">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[#555568] text-xs uppercase tracking-widest">
            paste.markets
          </p>
          <h1 className="text-3xl font-bold text-[#f0f0f0] leading-tight">
            Embed Your Scorecard
          </h1>
          <p className="text-[#c8c8d0] text-base leading-relaxed max-w-xl">
            Put your live trade stats anywhere — Twitter/X bio links, GitHub
            READMEs, Linktree, Notion. One{" "}
            <code className="text-[#3b82f6] bg-[#0f0f22] px-1.5 py-0.5 rounded text-sm">
              &lt;img&gt;
            </code>{" "}
            tag, updates every hour.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-[#1a1a2e]" />

        {/* Generator */}
        <WidgetGenerator />
      </div>
    </main>
  );
}
