import type { Metadata } from "next";
import Link from "next/link";
import type { FadeResponse, FadeCaller } from "@/app/api/fade/route";

export const metadata: Metadata = {
  title: "Fade the Caller | paste.markets",
  description: "CT's worst-performing traders — and their current calls. Useful for inverse plays.",
  openGraph: {
    title: "Fade the Caller — paste.markets",
    description: "CT's worst-performing traders and their active calls. Trade the opposite.",
  },
  twitter: {
    card: "summary",
    title: "Fade the Caller — paste.markets",
    description: "CT's worst-performing traders and their active calls.",
  },
};

async function fetchFadeData(): Promise<FadeResponse | null> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/fade`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function invertDirection(dir: FadeCaller["fadeDirection"]): string {
  if (dir === "long" || dir === "yes") return "SHORT";
  if (dir === "short" || dir === "no") return "LONG";
  return "–";
}

function invertColor(dir: FadeCaller["fadeDirection"]): string {
  if (dir === "long" || dir === "yes") return "#e74c3c";
  if (dir === "short" || dir === "no") return "#2ecc71";
  return "#555568";
}

function CallerRow({ caller }: { caller: FadeCaller }) {
  const hasFade = caller.fadeTicker && caller.fadeDirection;
  const fadeInvertColor = invertColor(caller.fadeDirection);

  return (
    <div className="py-4" style={{ borderBottom: "1px solid #1a1a2e" }}>
      <div className="flex items-start justify-between gap-4">
        {/* Left: rank + handle + stats */}
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[11px] w-5 text-right shrink-0" style={{ color: "#555568" }}>
              #{caller.rank}
            </span>
            <Link
              href={`/${caller.handle}`}
              className="text-sm font-bold transition-colors hover:text-[#3b82f6]"
              style={{ color: "#f0f0f0" }}
            >
              @{caller.handle}
            </Link>
          </div>
          <div className="flex items-center gap-4 pl-8 text-xs" style={{ color: "#555568" }}>
            <span>{caller.totalTrades} trades</span>
            <span>{Math.round(caller.winRate)}% WR</span>
            <span style={{ color: caller.avgPnl >= 0 ? "#2ecc71" : "#e74c3c" }}>
              {formatPnl(caller.avgPnl)} avg
            </span>
          </div>
        </div>

        {/* Right: fade play */}
        {hasFade ? (
          <div
            className="shrink-0 rounded-lg p-3 text-right"
            style={{ backgroundColor: "#0f0f22", border: `1px solid ${fadeInvertColor}22` }}
          >
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
              fade play
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-sm font-bold" style={{ color: "#f0f0f0" }}>
                {caller.fadeTicker}
              </span>
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{
                  color: fadeInvertColor,
                  border: `1px solid ${fadeInvertColor}`,
                  backgroundColor: `${fadeInvertColor}15`,
                }}
              >
                {invertDirection(caller.fadeDirection)}
              </span>
            </div>
            <div className="text-[10px] mt-1" style={{ color: "#555568" }}>
              {caller.fadePostedAt
                ? `caller posted ${formatDate(caller.fadePostedAt)}`
                : "recent call"}
            </div>
            {caller.fadePnlPct != null && (
              <div
                className="text-xs font-bold mt-1"
                style={{ color: caller.fadePnlPct >= 0 ? "#2ecc71" : "#e74c3c" }}
              >
                their P&L: {formatPnl(caller.fadePnlPct)}
              </div>
            )}
            {caller.fadeSourceUrl && (
              <a
                href={caller.fadeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] transition-colors"
                style={{ color: "#3b82f6" }}
              >
                source &rarr;
              </a>
            )}
          </div>
        ) : (
          <div className="shrink-0 text-[11px]" style={{ color: "#555568" }}>
            no recent call
          </div>
        )}
      </div>
    </div>
  );
}

export default async function FadePage() {
  const data = await fetchFadeData();
  const callers = data?.callers ?? [];
  const updatedAt = data?.updatedAt;

  return (
    <main className="min-h-screen px-4 py-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-bold" style={{ color: "#f0f0f0" }}>
            Fade the Caller
          </h1>
          {updatedAt && (
            <span className="text-[11px] uppercase tracking-widest" style={{ color: "#555568" }}>
              30d ·{" "}
              {new Date(updatedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          )}
        </div>
        <p className="text-sm mt-2 mb-8" style={{ color: "#555568" }}>
          CT&apos;s worst performers by avg P&L — and their most recent calls.
          <br />
          When the track record is this bad, the opposite trade writes itself.
        </p>
      </div>

      {/* Disclaimer */}
      <div
        className="rounded-lg px-4 py-3 mb-6 text-[11px]"
        style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e", color: "#555568" }}
      >
        Not financial advice. Past underperformance does not guarantee future underperformance.
        Fade plays shown are the caller&apos;s most recent 7-day call, inverted.
      </div>

      {callers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm" style={{ color: "#555568" }}>
            Not enough data yet — callers need 5+ tracked trades to appear here.
          </p>
          <Link
            href="/leaderboard"
            className="inline-block mt-4 text-sm px-4 py-2 rounded-lg transition-colors"
            style={{ border: "1px solid #1a1a2e", color: "#c8c8d0" }}
          >
            &larr; Leaderboard
          </Link>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid #1a1a2e" }}>
          {callers.map((caller) => (
            <CallerRow key={caller.handle} caller={caller} />
          ))}
        </div>
      )}

      {/* Footer nav */}
      <div
        className="flex items-center justify-between pt-6 mt-4 text-sm"
        style={{ borderTop: "1px solid #1a1a2e" }}
      >
        <Link
          href="/leaderboard"
          style={{ color: "#555568" }}
          className="transition-colors hover:text-[#c8c8d0]"
        >
          &larr; Leaderboard
        </Link>
        <Link
          href="/consensus"
          style={{ color: "#555568" }}
          className="transition-colors hover:text-[#c8c8d0]"
        >
          Consensus Plays &rarr;
        </Link>
      </div>
    </main>
  );
}
