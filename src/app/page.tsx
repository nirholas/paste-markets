import type { Metadata } from "next";
import Link from "next/link";
import { SmartInput } from "@/components/smart-input";
import { HomeFeed } from "@/components/home-feed";
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
      <section className="hero-glow relative flex flex-col items-center justify-center px-4 pt-24 pb-10 overflow-hidden">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#3b82f6] mb-4 font-mono">
          Financialized Doomscrolling
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-[#f0f0f0] mb-3 text-center leading-tight relative z-10">
          Turn any tweet into a trade.
        </h1>
        <p className="text-[#555568] text-sm mb-8 text-center max-w-md relative z-10">
          Track your calls forever. Real P&amp;L. No cap.
        </p>

        <div className="w-full max-w-xl relative z-10">
          <SmartInput />
        </div>

        <p className="text-[#555568] text-xs mt-4 relative z-10">
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
          <div className="mt-8 flex flex-wrap justify-center items-center gap-x-1 gap-y-2 text-xs font-mono relative z-10">
            <div className="flex items-center gap-2 bg-[#0f0f22]/80 border border-[#1a1a2e] rounded-full px-4 py-1.5">
              <span className="text-[#c8c8d0] font-bold">
                {stats.total_trades.toLocaleString()}
              </span>
              <span className="text-[#555568]">trades</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0f0f22]/80 border border-[#1a1a2e] rounded-full px-4 py-1.5">
              <span className="text-[#c8c8d0] font-bold">
                {stats.total_callers.toLocaleString()}
              </span>
              <span className="text-[#555568]">callers</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0f0f22]/80 border border-[#1a1a2e] rounded-full px-4 py-1.5">
              <span
                className="font-bold"
                style={{ color: stats.avg_win_rate >= 50 ? "#2ecc71" : "#e74c3c" }}
              >
                {stats.avg_win_rate.toFixed(1)}%
              </span>
              <span className="text-[#555568]">avg WR</span>
            </div>
          </div>
        )}
      </section>

      {/* ── Smart Feed ───────────────────────────────────────────────── */}
      <HomeFeed initialAssets={assets} initialCallers={callers} />

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1a1a2e] py-12 px-4 text-center text-xs text-[#555568]">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center flex-wrap gap-6 mb-8">
            <Link href="/leaderboard" className="hover:text-[#c8c8d0] transition-colors">Leaderboard</Link>
            <Link href="/callers" className="hover:text-[#c8c8d0] transition-colors">Callers</Link>
            <Link href="/feed" className="hover:text-[#c8c8d0] transition-colors">Feed</Link>
            <Link href="/alpha" className="hover:text-[#c8c8d0] transition-colors">Alpha</Link>
            <Link href="/heatmap" className="hover:text-[#c8c8d0] transition-colors">Heatmap</Link>
            <Link href="/consensus" className="hover:text-[#c8c8d0] transition-colors">Consensus</Link>
          </div>
          <div className="h-px w-16 mx-auto bg-[#1a1a2e] mb-6" />
          <p>
            paste<span className="text-[#3b82f6]">.</span>markets — Real P&amp;L data from{" "}
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
        </div>
      </footer>
    </main>
  );
}
