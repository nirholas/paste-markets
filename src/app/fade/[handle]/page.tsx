import type { Metadata } from "next";
import Link from "next/link";
import { getOrCreateAuthor, getAuthorMetrics, syncAuthor, isStale } from "@/lib/data";
import { computeFadeScore } from "@/lib/metrics";

interface PageProps {
  params: Promise<{ handle: string }>;
}

function cleanHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@/, "").toLowerCase().trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  const metrics = await getAuthorMetrics(handle);
  const fadeStats = metrics ? computeFadeScore(metrics.recentTrades) : null;

  const description = fadeStats
    ? `Fade @${handle} for profit: ${Math.round(fadeStats.fadeWinRate)}% win rate, ${fadeStats.fadeAvgPnl >= 0 ? "+" : ""}${fadeStats.fadeAvgPnl.toFixed(1)}% avg P&L. Rating: ${fadeStats.fadeRating}`
    : `Fade analysis for @${handle} on paste.markets`;

  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  return {
    title: `Fade @${handle} | paste.markets`,
    description,
    openGraph: {
      title: `Fade @${handle} for profit`,
      description,
      images: [
        { url: `${baseUrl}/api/og/fade/${handle}`, width: 1200, height: 630 },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Fade @${handle} for profit`,
      description,
      images: [`${baseUrl}/api/og/fade/${handle}`],
    },
  };
}

function formatPnl(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function pnlColor(pct: number): string {
  return pct >= 0 ? "text-win" : "text-loss";
}

function winRateColor(pct: number): string {
  if (pct >= 65) return "text-win";
  if (pct >= 50) return "text-amber";
  return "text-loss";
}

function ratingStyle(rating: string): string {
  if (rating === "S") return "border-[#f39c12] text-[#f39c12] bg-[#f39c12]/10";
  if (rating === "A") return "border-win text-win bg-win/10";
  if (rating === "B") return "border-accent text-accent bg-accent/10";
  if (rating === "C") return "border-text-secondary text-text-secondary bg-text-secondary/10";
  return "border-text-muted text-text-muted bg-text-muted/10";
}

export default async function FadeHandlePage({ params }: PageProps) {
  const { handle: rawHandle } = await params;
  const handle = cleanHandle(rawHandle);

  const author = await getOrCreateAuthor(handle);
  if (isStale(author.last_fetched)) {
    try { await syncAuthor(handle); } catch { /* continue */ }
  }

  const metrics = await getAuthorMetrics(handle);

  if (!metrics || metrics.totalTrades === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Fade @{handle}
          </h1>
          <p className="text-text-secondary mb-1">No data yet.</p>
          <Link
            href="/fade"
            className="inline-block border border-border hover:border-loss text-text-secondary hover:text-loss px-4 py-2 rounded-lg text-sm transition-colors mt-4"
          >
            &larr; Fade Leaderboard
          </Link>
        </div>
      </main>
    );
  }

  const fadeStats = computeFadeScore(metrics.recentTrades);

  return (
    <main className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/fade"
            className="text-text-muted text-xs hover:text-loss transition-colors"
          >
            &larr; Fade Leaderboard
          </Link>
          <h1 className="text-[28px] font-bold text-text-primary mt-2 flex items-center gap-3">
            Fade @{handle}
            <span className={`text-sm font-mono font-bold uppercase tracking-widest border px-2 py-0.5 rounded ${ratingStyle(fadeStats.fadeRating)}`}>
              {fadeStats.fadeRating}
            </span>
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {fadeStats.isProfitableFade
              ? "This caller is a profitable fade — trade the opposite"
              : "Fade analysis based on historical P&L"}
          </p>
        </div>
        {fadeStats.isProfitableFade && (
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest border border-loss text-loss bg-loss/10 px-3 py-1.5 rounded">
            PROFITABLE FADE
          </div>
        )}
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* FOLLOW */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-win" />
            Follow @{handle}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-text-muted">Win Rate</span>
              <span className={`text-xl font-bold ${winRateColor(fadeStats.originalWinRate)}`}>
                {Math.round(fadeStats.originalWinRate)}%
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-text-muted">Avg P&L</span>
              <span className={`text-xl font-bold ${pnlColor(fadeStats.originalAvgPnl)}`}>
                {formatPnl(fadeStats.originalAvgPnl)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-text-muted">Total P&L</span>
              <span className={`text-xl font-bold ${pnlColor(fadeStats.originalTotalPnl)}`}>
                {formatPnl(fadeStats.originalTotalPnl)}
              </span>
            </div>
          </div>
        </div>

        {/* FADE */}
        <div className={`bg-surface border rounded-lg p-5 ${fadeStats.isProfitableFade ? "border-loss/60" : "border-border"}`}>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-loss" />
            Fade @{handle}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-text-muted">Win Rate</span>
              <span className={`text-xl font-bold ${winRateColor(fadeStats.fadeWinRate)}`}>
                {Math.round(fadeStats.fadeWinRate)}%
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-text-muted">Avg P&L</span>
              <span className={`text-xl font-bold ${pnlColor(fadeStats.fadeAvgPnl)}`}>
                {formatPnl(fadeStats.fadeAvgPnl)}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-text-muted">Total P&L</span>
              <span className={`text-xl font-bold ${pnlColor(fadeStats.fadeTotalPnl)}`}>
                {formatPnl(fadeStats.fadeTotalPnl)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Best / Worst Fade */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-8">
        <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
          Fade Highlights
        </h2>
        <div className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-text-muted text-[13px] w-24 shrink-0">Best Fade</span>
            {fadeStats.bestFade ? (
              <span className="text-[13px] text-win">
                ${fadeStats.bestFade.ticker} {fadeStats.bestFade.direction.toUpperCase()}{" "}
                {formatPnl(fadeStats.bestFade.pnl)}
              </span>
            ) : (
              <span className="text-text-muted text-[13px]">--</span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-text-muted text-[13px] w-24 shrink-0">Worst Fade</span>
            {fadeStats.worstFade ? (
              <span className="text-[13px] text-loss">
                ${fadeStats.worstFade.ticker} {fadeStats.worstFade.direction.toUpperCase()}{" "}
                {formatPnl(fadeStats.worstFade.pnl)}
              </span>
            ) : (
              <span className="text-text-muted text-[13px]">--</span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-text-muted text-[13px] w-24 shrink-0">Trades</span>
            <span className="text-[13px] text-text-primary">{fadeStats.totalTrades}</span>
          </div>
        </div>
      </div>

      {/* Share CTA */}
      <div className="bg-surface border border-loss/30 rounded-lg p-5 text-center">
        <p className="text-xs text-text-muted mb-3">Share this fade card on X</p>
        <a
          href={`https://x.com/intent/tweet?text=${encodeURIComponent(
            `Fade @${handle} for profit:\n${Math.round(fadeStats.fadeWinRate)}% win rate | ${formatPnl(fadeStats.fadeAvgPnl)} avg P&L\nRating: ${fadeStats.fadeRating}\n\npaste.markets/fade/${handle}`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block border border-loss text-loss hover:bg-loss/10 px-4 py-2 rounded-lg text-sm font-mono transition-colors"
        >
          Share Fade Card
        </a>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-6 mt-8 border-t border-border text-sm">
        <Link
          href={`/${handle}`}
          className="text-text-muted transition-colors hover:text-text-secondary"
        >
          &larr; @{handle} Profile
        </Link>
        <Link
          href="/fade"
          className="text-text-muted transition-colors hover:text-text-secondary"
        >
          Fade Leaderboard &rarr;
        </Link>
      </div>
    </main>
  );
}
