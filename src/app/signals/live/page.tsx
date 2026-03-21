import type { Metadata } from "next";
import { SignalsClient } from "@/components/signals-client";

export const metadata: Metadata = {
  title: "Live Signals — paste.markets",
  description: "High-confidence live trade signals detected from CT callers in real-time.",
  openGraph: {
    title: "Live Signals — paste.markets",
    description: "Real-time trade call detections from monitored CT callers.",
    images: [{ url: "/api/og/feed", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Signals — paste.markets",
    images: ["/api/og/feed"],
  },
};

export default function LiveSignalsPage() {
  return (
    <main className="min-h-screen">
      <section className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <SignalsClient />
      </section>
    </main>
  );
}
