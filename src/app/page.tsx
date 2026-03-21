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
      <section className="relative flex flex-col items-center justify-center px-4 pt-16 sm:pt-24 pb-12 overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99, 102, 241, 0.12), transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-[#f5f5f7] mb-4 text-center leading-[1.1] tracking-tight">
            Turn any tweet
            <br />
            <span className="bg-gradient-to-r from-[#0066FF] to-[#3385FF] bg-clip-text text-transparent">
              into a trade.
            </span>
          </h1>
          <p className="text-[#a1a1aa] text-base sm:text-lg mb-8 text-center max-w-md">
            Track calls from CT forever. Real P&amp;L. No cap.
          </p>

          <div className="w-full max-w-lg">
            <SmartInput />
          </div>

          <p className="text-[#52525b] text-sm mt-5">
            Paste a tweet, search a trader, or{" "}
            <Link
              href="/submit"
              className="text-[#0066FF] hover:text-[#3385FF] transition-colors font-medium"
            >
              submit a call
            </Link>
          </p>

          {/* Stats pills */}
          {stats && (
            <div className="mt-8 flex flex-wrap justify-center items-center gap-3">
              <div className="flex items-center gap-2 bg-[#ffffff08] border border-[#ffffff0d] rounded-lg px-4 py-2 text-sm">
                <span className="text-[#f5f5f7] font-semibold font-mono">
                  {stats.total_trades.toLocaleString()}
                </span>
                <span className="text-[#52525b]">trades</span>
              </div>
              <div className="flex items-center gap-2 bg-[#ffffff08] border border-[#ffffff0d] rounded-lg px-4 py-2 text-sm">
                <span className="text-[#f5f5f7] font-semibold font-mono">
                  {stats.total_callers.toLocaleString()}
                </span>
                <span className="text-[#52525b]">callers</span>
              </div>
              <div className="flex items-center gap-2 bg-[#ffffff08] border border-[#ffffff0d] rounded-lg px-4 py-2 text-sm">
                <span
                  className="font-semibold font-mono"
                  style={{ color: stats.avg_win_rate >= 50 ? "#22c55e" : "#ef4444" }}
                >
                  {stats.avg_win_rate.toFixed(1)}%
                </span>
                <span className="text-[#52525b]">avg WR</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Feed ────────────────────────────────────────────────────── */}
      <HomeFeed initialAssets={assets} initialCallers={callers} />

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[#ffffff0d] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center flex-wrap gap-6 mb-8 text-sm">
            <Link href="/leaderboard" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">Leaderboard</Link>
            <Link href="/callers" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">Callers</Link>
            <Link href="/feed" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">Feed</Link>
            <Link href="/alpha" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">Alpha</Link>
            <Link href="/heatmap" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">Heatmap</Link>
            <Link href="/consensus" className="text-[#52525b] hover:text-[#a1a1aa] transition-colors">Consensus</Link>
          </div>
          <div className="text-center text-[13px] text-[#52525b]">
            <p>
              Real P&amp;L data from{" "}
              <a href="https://paste.trade" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">
                paste.trade
              </a>{" "}
              by{" "}
              <a href="https://x.com/frankdegods" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">
                @frankdegods
              </a>
              {" "}/{" "}
              Built by{" "}
              <a href="https://x.com/swarminged" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">
                @swarminged
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
