import type { Metadata } from "next";
import { TradeFinder } from "@/components/trade-finder";

export const metadata: Metadata = {
  title: "What's The Trade? — paste.markets",
  description:
    "Paste any URL — tweets, threads, articles, YouTube videos — and extract every tradeable thesis. Track them all on paste.trade.",
  openGraph: {
    title: "What's The Trade? — paste.markets",
    description:
      "Paste any URL and extract every tradeable thesis. AI finds the trades, paste.trade tracks the P&L.",
    images: [{ url: "/api/og/trade", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "What's The Trade? — paste.markets",
    images: ["/api/og/trade"],
  },
};

export default function TradePage() {
  return (
    <main className="min-h-screen">
      <TradeFinder />
    </main>
  );
}
