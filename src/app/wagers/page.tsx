import type { Metadata } from "next";
import Link from "next/link";
import { WagersClient } from "@/components/wagers-client";

export const metadata: Metadata = {
  title: "Wagers — paste.markets",
  description: "Active and settled wagers on CT trade calls. Back your favorite callers.",
  openGraph: {
    title: "Wagers — paste.markets",
    description: "Double down on CT trade calls. See who's backing who.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wagers — paste.markets",
  },
};

export default function WagersPage() {
  return (
    <main className="min-h-screen">
      <section className="max-w-2xl mx-auto px-4 pt-12 pb-16">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#555568] mb-2">
              SOCIAL WAGERS
            </p>
            <h1 className="text-2xl font-bold text-[#f0f0f0]">
              Double Down on CT Calls
            </h1>
            <p className="text-[#c8c8d0] text-sm mt-2">
              Back your favorite callers. Earn when they win.
            </p>
          </div>
          <Link
            href="/wagers/leaderboard"
            className="text-xs font-mono border border-[#1a1a2e] hover:border-[#3b82f6] text-[#555568] hover:text-[#3b82f6] px-3 py-1.5 rounded transition-colors mt-1"
          >
            Top Earners →
          </Link>
        </div>

        <WagersClient />
      </section>
    </main>
  );
}
