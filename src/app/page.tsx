import type { Metadata } from "next";
import Link from "next/link";
import { SmartInput } from "@/components/smart-input";
import { HomeFeed } from "@/components/home-feed";
import { DailyTopCallers } from "@/components/daily-top-callers";
import type { AssetSummary } from "@/lib/data";
import type { SiteStats } from "@/app/api/stats/route";

export const metadata: Metadata = {
  title: "paste.markets — Turn any tweet into a trade",
  description:
    "Financialized doomscrolling. Track calls from Crypto Twitter forever. Real P&L, no cap.",
  openGraph: {
    title: "paste.markets — Turn any tweet into a trade",
    description: "Track calls from CT. Real P&L. No cap.",
    images: [{ url: "/api/og/home", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "paste.markets — Turn any tweet into a trade",
    images: ["/api/og/home"],
  },
};

interface TopCallerRow {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  winRate: number;
  alphaScore: number;
  tier: "S" | "A" | "B" | "C";
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://paste.markets";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "paste.markets",
  url: BASE_URL,
  description: "Real P&L rankings for Crypto Twitter traders.",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/{search_term_string}` },
    "query-input": "required name=search_term_string",
  },
};

async function getSiteStats(): Promise<SiteStats | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/stats`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json() as Promise<SiteStats>;
  } catch {
    return null;
  }
}

async function getInitialAssets(): Promise<AssetSummary[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/assets`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json() as { assets?: AssetSummary[] };
    return (data.assets ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

async function getTopCallers(): Promise<TopCallerRow[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/callers?sort=win_rate&limit=5`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { callers?: TopCallerRow[] };
    return data.callers ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [stats, assets, callers] = await Promise.all([
    getSiteStats(),
    getInitialAssets(),
    getTopCallers(),
  ]);

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center px-4 pt-20 pb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-[#f0f0f0] mb-2 text-center">
          Turn any tweet into a trade.
        </h1>
        <p className="text-[#555568] text-sm mb-6 text-center">
          Track your calls forever. Real P&amp;L. No cap.
        </p>

        <div className="w-full max-w-xl">
          <SmartInput />
        </div>

        <p className="text-[#555568] text-xs mt-3">
          Paste a tweet URL, YouTube link, or article →{" "}
          <Link
            href="/submit"
            className="text-[#3b82f6] hover:text-[#3b82f6]/70 transition-colors"
          >
            Submit a trade
          </Link>
        </p>

        {/* Global stats bar */}
        {stats && (
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-6 gap-y-1 text-xs font-mono text-[#555568]">
            <span>
              <span className="text-[#c8c8d0] font-bold">
                {stats.total_trades.toLocaleString()}
              </span>{" "}
              trades tracked
            </span>
            <span className="hidden sm:inline text-[#1a1a2e]">·</span>
            <span>
              <span className="text-[#c8c8d0] font-bold">
                {stats.total_callers.toLocaleString()}
              </span>{" "}
              callers
            </span>
            <span className="hidden sm:inline text-[#1a1a2e]">·</span>
            <span>
              <span
                className="font-bold"
                style={{ color: stats.avg_win_rate >= 50 ? "#2ecc71" : "#e74c3c" }}
              >
                {stats.avg_win_rate.toFixed(1)}%
              </span>{" "}
              avg win rate this month
            </span>
          </div>
        )}
      </section>

      {/* ── Today's Top Callers ──────────────────────────────────────── */}
      <DailyTopCallers />

      {/* ── Smart Feed ───────────────────────────────────────────────── */}
      <HomeFeed initialAssets={assets} initialCallers={callers} />

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1a2e] py-8 px-4 text-center text-xs text-[#555568]">
        <p>
          paste.markets — Real P&amp;L data from{" "}
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#3b82f6] transition-colors"
          >
            paste.trade
          </a>{" "}
          by{" "}
          <a
            href="https://x.com/frankdegods"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#3b82f6] transition-colors"
          >
            @frankdegods
          </a>
        </p>
        <p className="mt-1">
          Built by{" "}
          <a
            href="https://x.com/swarminged"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#3b82f6] transition-colors"
          >
            @swarminged
          </a>
        </p>
        <div className="mt-4 flex justify-center flex-wrap gap-4">
          <Link href="/leaderboard" className="hover:text-[#c8c8d0] transition-colors">Leaderboard</Link>
          <Link href="/callers" className="hover:text-[#c8c8d0] transition-colors">Callers</Link>
          <Link href="/feed" className="hover:text-[#c8c8d0] transition-colors">Feed</Link>
          <Link href="/alpha" className="hover:text-[#c8c8d0] transition-colors">Alpha</Link>
          <Link href="/heatmap" className="hover:text-[#c8c8d0] transition-colors">Heatmap</Link>
          <Link href="/consensus" className="hover:text-[#c8c8d0] transition-colors">Consensus</Link>
        </div>
      </footer>
    </main>
  );
}
