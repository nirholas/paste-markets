import type { Metadata } from "next";
import { TradeFinder } from "@/components/trade-finder";

export const metadata: Metadata = {
  title: "Submit a Trade — paste.markets",
  description:
    "Paste a tweet. We extract the thesis, lock the price, and post it to paste.trade for live P&L tracking.",
  openGraph: {
    title: "Submit a Trade — paste.markets",
    description:
      "Paste a tweet. We extract the thesis, lock the price, and post it to paste.trade for live P&L tracking.",
    images: [{ url: "/api/og/trade", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Submit a Trade — paste.markets",
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
