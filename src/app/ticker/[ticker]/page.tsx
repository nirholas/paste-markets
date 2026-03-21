import type { Metadata } from "next";
import Link from "next/link";
import { searchFullTrades, type PasteTradeFullTrade } from "@/lib/paste-trade";
import { PnlDisplay } from "@/components/ui/pnl-display";
import { WinRateBar } from "@/components/ui/win-rate-bar";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

// ── Data aggregation ─────────────────────────────────────────────────────────

interface CallerStats {
  handle: string;
  calls: number;
  wins: number;
  avgPnl: number;
  lastCallAt: string;
}

interface TickerIntel {
  ticker: string;
  trades: PasteTradeFullTrade[];
  totalCalls: number;
  withPnl: number;
  winRate: number;
  avgPnl: number;
  longPct: number;
  shortPct: number;
  longCount: number;
  shortCount: number;
  tickerContext: string | null;
  callers: CallerStats[];
}

function aggregateTicker(ticker: string, trades: PasteTradeFullTrade[]): TickerIntel {
  const withPnl = trades.filter((t) => t.pnlPct != null);
  const wins = withPnl.filter((t) => t.pnlPct! > 0).length;
  const winRate = withPnl.length > 0 ? (wins / withPnl.length) * 100 : 0;
  const avgPnl =
    withPnl.length > 0
      ? withPnl.reduce((acc, t) => acc + t.pnlPct!, 0) / withPnl.length
      : 0;

  const longs = trades.filter((t) => t.direction === "long" || t.direction === "yes").length;
  const shorts = trades.filter((t) => t.direction === "short" || t.direction === "no").length;
  const total = longs + shorts;
  const longPct = total > 0 ? (longs / total) * 100 : 50;
  const shortPct = total > 0 ? (shorts / total) * 100 : 50;

  // Ticker context: take the most recent non-null one
  const tickerContext =
    trades.find((t) => t.ticker_context)?.ticker_context ?? null;

  // Per-caller aggregation
  const callerMap = new Map<string, { pnls: number[]; lastAt: string }>();
  for (const trade of trades) {
    const handle = trade.author_handle;
    if (!handle) continue;
    if (!callerMap.has(handle)) callerMap.set(handle, { pnls: [], lastAt: "" });
    const entry = callerMap.get(handle)!;
    if (trade.pnlPct != null) entry.pnls.push(trade.pnlPct);
    const at = trade.author_date ?? trade.posted_at ?? "";
    if (!entry.lastAt || at > entry.lastAt) entry.lastAt = at;
  }

  const callers: CallerStats[] = Array.from(callerMap.entries())
    .map(([handle, { pnls, lastAt }]) => ({
      handle,
      calls: trades.filter((t) => t.author_handle === handle).length,
      wins: pnls.filter((p) => p > 0).length,
      avgPnl: pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0,
      lastCallAt: lastAt,
    }))
    .filter((c) => c.calls > 0)
    .sort((a, b) => b.avgPnl - a.avgPnl);

  return {
    ticker,
    trades,
    totalCalls: trades.length,
    withPnl: withPnl.length,
    winRate,
    avgPnl,
    longPct,
    shortPct,
    longCount: longs,
    shortCount: shorts,
    tickerContext,
    callers,
  };
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  return {
    title: `$${upper} — CT Calls & P&L`,
    description: `All Crypto Twitter calls on $${upper}. Win rate, avg P&L, consensus direction, and which callers have been most right.`,
    openGraph: {
      title: `$${upper} on paste.markets`,
      description: `CT consensus, win rate, and top callers for $${upper}.`,
      images: [{ url: `/api/og/ticker/${upper}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `$${upper} CT Intelligence`,
      description: `Win rate, avg P&L, and top callers for $${upper} on paste.markets.`,
      images: [`/api/og/ticker/${upper}`],
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function DirectionPill({ direction }: { direction: string }) {
  const isLong = direction === "long" || direction === "yes";
  return (
    <span
      className="inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
      style={{
        backgroundColor: isLong ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)",
        color: isLong ? "#2ecc71" : "#e74c3c",
        border: `1px solid ${isLong ? "#2ecc71" : "#e74c3c"}`,
      }}
    >
      {direction.toUpperCase()}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TickerPage({ params }: PageProps) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  const trades = await searchFullTrades({ ticker: upper, top: "all", limit: 100 });
  const intel = aggregateTicker(upper, trades);

  // Sort recent trades by date desc
  const recentTrades = [...intel.trades]
    .sort((a, b) => {
      const da = a.author_date ?? a.posted_at ?? "";
      const db = b.author_date ?? b.posted_at ?? "";
      return db.localeCompare(da);
    })
    .slice(0, 20);

  if (intel.totalCalls === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#f0f0f0" }}>
            ${upper}
          </h1>
          <p className="text-sm mb-8" style={{ color: "#555568" }}>
            No CT calls found for this ticker yet.
          </p>
          <Link href="/" className="text-sm transition-colors" style={{ color: "#3b82f6" }}>
            &larr; Back to paste.markets
          </Link>
        </div>
      </main>
    );
  }

  const consensusSide = intel.longPct >= 50 ? "LONG" : "SHORT";
  const consensusColor = intel.longPct >= 50 ? "#2ecc71" : "#e74c3c";
  const longBlocks = Math.round(intel.longPct / 10);
  const shortBlocks = 10 - longBlocks;

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-1" style={{ color: "#f0f0f0" }}>
          ${upper}
        </h1>
        {intel.tickerContext && (
          <p className="text-sm" style={{ color: "#555568" }}>
            {intel.tickerContext}
          </p>
        )}
      </div>

      {/* Stats bar */}
      <div
        className="rounded-lg p-5 mb-6 grid grid-cols-3 gap-4"
        style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
      >
        <div>
          <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
            Calls
          </div>
          <div className="text-xl font-bold" style={{ color: "#f0f0f0" }}>
            {intel.totalCalls}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
            Win Rate
          </div>
          <div className="text-xl font-bold" style={{ color: intel.winRate >= 50 ? "#2ecc71" : "#e74c3c" }}>
            {Math.round(intel.winRate)}%
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "#555568" }}>
            Avg P&L
          </div>
          <div className="text-xl font-bold">
            <PnlDisplay value={intel.avgPnl} />
          </div>
        </div>
      </div>

      {/* Consensus */}
      <div
        className="rounded-lg p-5 mb-8"
        style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "#555568" }}>
            CT Consensus
          </span>
          <span className="text-sm font-bold" style={{ color: consensusColor }}>
            {consensusSide} {Math.round(intel.longPct >= 50 ? intel.longPct : intel.shortPct)}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase" style={{ color: "#2ecc71" }}>
            L
          </span>
          <div className="flex gap-0.5 flex-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-3 flex-1 rounded-sm"
                style={{
                  backgroundColor: i < longBlocks ? "#2ecc71" : i < longBlocks + shortBlocks ? "#e74c3c" : "#1a1a2e",
                  opacity: i < longBlocks ? 1 : i < 10 ? 0.7 : 0.2,
                }}
              />
            ))}
          </div>
          <span className="text-[11px] uppercase" style={{ color: "#e74c3c" }}>
            S
          </span>
        </div>
        <div className="flex justify-between mt-2 text-[11px]" style={{ color: "#555568" }}>
          <span>{intel.longCount} long{intel.longCount !== 1 ? "s" : ""}</span>
          <span>{intel.shortCount} short{intel.shortCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Top callers */}
      {intel.callers.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-widest mb-4" style={{ color: "#555568" }}>
            Top Callers on ${upper}
          </h2>
          <div style={{ borderTop: "1px solid #1a1a2e" }}>
            {intel.callers.slice(0, 8).map((caller, i) => (
              <Link
                key={caller.handle}
                href={`/${caller.handle}`}
                className="flex items-center justify-between py-3 px-2 -mx-2 transition-colors"
                style={{ borderBottom: "1px solid #1a1a2e" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm w-5 text-right" style={{ color: "#555568" }}>
                    {i + 1}.
                  </span>
                  <span className="text-sm" style={{ color: "#f0f0f0" }}>
                    @{caller.handle}
                  </span>
                  <span className="text-xs" style={{ color: "#555568" }}>
                    {caller.calls} call{caller.calls !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span style={{ color: caller.wins / caller.calls >= 0.5 ? "#2ecc71" : "#e74c3c" }}>
                    {caller.calls > 0 ? Math.round((caller.wins / caller.calls) * 100) : 0}% WR
                  </span>
                  <PnlDisplay value={caller.avgPnl} />
                  <WinRateBar pct={caller.calls > 0 ? (caller.wins / caller.calls) * 100 : 0} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent calls */}
      <section className="mb-12">
        <h2 className="text-[11px] uppercase tracking-widest mb-4" style={{ color: "#555568" }}>
          Recent Calls
        </h2>
        <div style={{ borderTop: "1px solid #1a1a2e" }}>
          {recentTrades.map((trade, i) => (
            <div
              key={trade.trade_id ?? `${trade.author_handle}-${i}`}
              className="py-4 px-2 -mx-2"
              style={{ borderBottom: "1px solid #1a1a2e" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <DirectionPill direction={trade.direction} />
                    {trade.author_handle && (
                      <Link
                        href={`/${trade.author_handle}`}
                        className="text-xs transition-colors hover:text-[#3b82f6]"
                        style={{ color: "#c8c8d0" }}
                      >
                        @{trade.author_handle}
                      </Link>
                    )}
                    <span className="text-xs" style={{ color: "#555568" }}>
                      {formatDate(trade.author_date ?? trade.posted_at ?? "")}
                    </span>
                    {trade.platform && (
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: "#555568" }}>
                        {trade.platform}
                      </span>
                    )}
                  </div>
                  {trade.headline_quote && (
                    <p className="text-sm italic truncate" style={{ color: "#c8c8d0" }}>
                      &ldquo;{trade.headline_quote}&rdquo;
                    </p>
                  )}
                  {!trade.headline_quote && trade.thesis && (
                    <p className="text-sm truncate" style={{ color: "#c8c8d0" }}>
                      {trade.thesis}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {trade.pnlPct != null ? (
                    <PnlDisplay value={trade.pnlPct} />
                  ) : (
                    <span style={{ color: "#555568" }}>–</span>
                  )}
                  {trade.source_url && (
                    <div className="mt-1">
                      <a
                        href={trade.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] transition-colors hover:text-[#3b82f6]"
                        style={{ color: "#555568" }}
                      >
                        source &rarr;
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer nav */}
      <div
        className="flex items-center justify-between text-sm pt-4"
        style={{ borderTop: "1px solid #1a1a2e" }}
      >
        <Link href="/leaderboard" className="transition-colors" style={{ color: "#555568" }}>
          &larr; Leaderboard
        </Link>
        <Link href="/trade" className="transition-colors" style={{ color: "#555568" }}>
          What&apos;s the trade? &rarr;
        </Link>
      </div>
    </main>
  );
}
