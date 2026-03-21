import type { Metadata } from "next";
import { FeedClient } from "@/components/feed-client";

export const metadata: Metadata = {
  title: "Live Feed — paste.markets",
  description: "Real-time trade calls from CT. Filter by ticker and platform.",
  openGraph: {
    title: "Live Feed — paste.markets",
    description: "Real-time trade calls from CT. Real P&L, no cap.",
    images: [{ url: "/api/og/feed", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Feed — paste.markets",
    images: ["/api/og/feed"],
  },
};

export default function FeedPage() {
  return (
    <main className="min-h-screen">
      <section className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <FeedClient />
      </section>
    </main>
  );
}
