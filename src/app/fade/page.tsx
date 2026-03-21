import type { Metadata } from "next";
import Link from "next/link";
import type { FadeResponse, FadeCaller } from "@/app/api/fade/route";

const baseUrl = () => process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Best Callers to Fade | paste.markets",
  description: "CT's worst-performing traders ranked by fade profitability. The worse they call, the better you trade.",
  openGraph: {
    title: "Best Callers to Fade — paste.markets",
    description: "Ranked by fade profitability. The worse they call, the better you trade.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Callers to Fade — paste.markets",
    description: "Ranked by fade profitability. The worse they call, the better you trade.",
  },
};

async function fetchFadeData(): Promise<FadeResponse | null> {
  try {
    const res = await fetch(`${baseUrl()}/api/fade`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
}

function ratingBadge(rating: string) {
  const colors: Record<string, string> = {
    S: "border-[#f39c12] text-[#f39c12] bg-[#f39c12]/10",
    A: "border-win text-win bg-win/10",
    B: "border-accent text-accent bg-accent/10",
    C: "border-text-secondary text-text-secondary bg-text-secondary/10",
    D: "border-text-muted text-text-muted bg-text-muted/10",
    F: "border-text-muted text-text-muted bg-text-muted/5",
  };
  return (
    <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${colors[rating] ?? colors["F"]}`}>
      {rating}
    </span>
  );
}

function FadeRow({ caller }: { caller: FadeCaller }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
      {/* Rank */}
      <td className="px-4 py-3 text-text-muted text-[11px] text-right w-10">
        #{caller.rank}
      </td>
      {/* Handle */}
      <td className="px-4 py-3">
        <Link
          href={`/${caller.handle}`}
          className="text-sm font-bold text-text-primary hover:text-accent transition-colors"
        >
          @{caller.handle}
        </Link>
        {caller.isProfitableFade && (
          <span className="ml-2 text-[9px] font-mono font-bold uppercase tracking-widest border border-loss text-loss bg-loss/10 px-1.5 py-0.5 rounded">
            PROFITABLE FADE
          </span>
        )}
      </td>
      {/* Their Win Rate */}
      <td className={`px-4 py-3 text-right text-sm font-bold ${caller.winRate >= 50 ? "text-win" : "text-loss"}`}>
        {Math.round(caller.winRate)}%
      </td>
      {/* Fade Win Rate — colors inverted: high = good for you */}
      <td className={`px-4 py-3 text-right text-sm font-bold ${caller.fadeWinRate >= 50 ? "text-win" : "text-loss"}`}>
        {Math.round(caller.fadeWinRate)}%
      </td>
      {/* Fade Avg P&L */}
      <td className={`px-4 py-3 text-right text-sm font-bold ${caller.fadeAvgPnl >= 0 ? "text-win" : "text-loss"}`}>
        {formatPnl(caller.fadeAvgPnl)}
      </td>
      {/* Trades */}
      <td className="px-4 py-3 text-right text-sm text-text-secondary">
        {caller.totalTrades}
      </td>
      {/* Rating */}
      <td className="px-4 py-3 text-center">
        {ratingBadge(caller.fadeRating)}
      </td>
      {/* Latest fade play */}
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        {caller.fadeTicker ? (
          <span className="text-xs text-text-secondary">
            {caller.fadeTicker}{" "}
            <span className={`font-bold ${
              caller.fadeDirection === "long" || caller.fadeDirection === "yes"
                ? "text-loss" // their long = fade short
                : "text-win"  // their short = fade long
            }`}>
              {caller.fadeDirection === "long" || caller.fadeDirection === "yes" ? "SHORT" : "LONG"}
            </span>
          </span>
        ) : (
          <span className="text-text-muted text-xs">--</span>
        )}
      </td>
    </tr>
  );
}

export default async function FadePage() {
  const data = await fetchFadeData();
  const callers = data?.callers ?? [];
  const updatedAt = data?.updatedAt;

  return (
    <main className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-text-muted text-xs hover:text-accent transition-colors"
            >
              paste.markets
            </Link>
            <h1 className="text-[28px] font-bold text-text-primary mt-1 flex items-center gap-3">
              BEST CALLERS TO FADE
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-loss text-loss tracking-widest">
                FADE MODE
              </span>
            </h1>
            <p className="text-sm mt-1 text-text-muted">
              Ranked by fade profitability — the worse they call, the better you trade
            </p>
          </div>
          {updatedAt && (
            <span className="text-text-muted text-[11px] uppercase tracking-widest hidden sm:block">
              30d ·{" "}
              {new Date(updatedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg px-4 py-3 mb-6 text-[11px] bg-surface border border-border text-text-muted">
        Not financial advice. Past underperformance does not guarantee future underperformance.
        Fade analysis is based on historical P&L data from paste.trade.
      </div>

      {callers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-text-muted">
            Not enough data yet — callers need 5+ tracked trades to appear here.
          </p>
          <Link
            href="/leaderboard"
            className="inline-block mt-4 text-sm px-4 py-2 rounded-lg transition-colors border border-border text-text-secondary hover:border-accent hover:text-text-primary"
          >
            &larr; Leaderboard
          </Link>
        </div>
      ) : (
        <div className="border border-loss/30 rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-normal px-4 py-2.5 w-10">
                  #
                </th>
                <th className="text-left text-[10px] uppercase tracking-widest text-text-muted font-normal px-4 py-2.5">
                  Handle
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-normal px-4 py-2.5">
                  Their WR
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-loss font-normal px-4 py-2.5">
                  Fade WR
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-loss font-normal px-4 py-2.5">
                  Fade Avg P&L
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-normal px-4 py-2.5">
                  Trades
                </th>
                <th className="text-center text-[10px] uppercase tracking-widest text-text-muted font-normal px-4 py-2.5">
                  Rating
                </th>
                <th className="text-right text-[10px] uppercase tracking-widest text-text-muted font-normal px-4 py-2.5 hidden lg:table-cell">
                  Fade Play
                </th>
              </tr>
            </thead>
            <tbody>
              {callers.map((caller) => (
                <FadeRow key={caller.handle} caller={caller} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-6 mt-4 border-t border-border text-sm">
        <Link
          href="/leaderboard"
          className="text-text-muted transition-colors hover:text-text-secondary"
        >
          &larr; Leaderboard
        </Link>
        <Link
          href="/leaderboard?fade=true"
          className="text-text-muted transition-colors hover:text-text-secondary"
        >
          Leaderboard Fade Mode &rarr;
        </Link>
      </div>
    </main>
  );
}
