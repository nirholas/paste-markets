import type { Metadata } from "next";
import Link from "next/link";
import { ProbabilityBar } from "@/components/probability-bar";
import {
  formatProbability,
  formatVolume,
  probabilityToAmericanOdds,
} from "@/lib/category";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CallerPosition {
  handle: string;
  direction: "yes" | "no";
  entry_probability: number;
  current_probability: number;
  pnl_pct: number;
  called_at: string;
}

interface MarketDetailData {
  market: {
    id: string;
    ticker: string;
    direction: string;
    author_handle: string;
    thesis: string | null;
    market_question: string | null;
    entry_price: number | null;
    current_price: number | null;
    pnl_pct: number | null;
    market_volume: number | null;
    expires_at: string | null;
    polymarket_url: string | null;
    category: string;
    created_at: string;
  };
  callers: CallerPosition[];
  consensus: {
    yes_count: number;
    no_count: number;
    total: number;
    yes_pct: number;
  };
}

async function fetchMarketDetail(id: string): Promise<MarketDetailData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/events/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function computeSportsPnl(entry: number, current: number, direction: "yes" | "no", settled: boolean, outcome?: "yes" | "no"): { pnl: number; description: string } {
  if (settled && outcome) {
    if (direction === outcome) {
      // Correct: bought at entry, settled at 1.00
      const pnl = ((1 - entry) / entry) * 100;
      return {
        pnl,
        description: `Called ${direction.toUpperCase()} at ${Math.round(entry * 100)}% -- Settled ${outcome.toUpperCase()} -- PnL: +${pnl.toFixed(1)}% (bought $1 of ${direction.toUpperCase()} at $${entry.toFixed(2)}, settled at $1.00)`,
      };
    } else {
      return {
        pnl: -100,
        description: `Called ${direction.toUpperCase()} at ${Math.round(entry * 100)}% -- Settled ${outcome.toUpperCase()} -- PnL: -100% (bought $1 of ${direction.toUpperCase()} at $${entry.toFixed(2)}, settled at $0.00)`,
      };
    }
  }

  // Active market
  const pnl = direction === "yes"
    ? ((current - entry) / entry) * 100
    : (((1 - current) - (1 - entry)) / (1 - entry)) * 100;

  const currentVal = direction === "yes" ? current : 1 - current;
  const entryVal = direction === "yes" ? entry : 1 - entry;

  return {
    pnl,
    description: `Called ${direction.toUpperCase()} at ${Math.round(entry * 100)}% -- Now at ${Math.round(current * 100)}% -- PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}% (bought $1 of ${direction.toUpperCase()} at $${entryVal.toFixed(2)}, now worth $${currentVal.toFixed(2)})`,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchMarketDetail(id);

  if (!data) {
    return { title: "Market not found | paste.markets" };
  }

  const title = data.market.market_question ?? data.market.ticker;
  const prob = data.market.current_price;
  const description = prob != null
    ? `${title} -- YES at ${Math.round(prob * 100)}% -- ${data.consensus.total} caller${data.consensus.total !== 1 ? "s" : ""} tracking`
    : title;

  return {
    title: `${title} | paste.markets`,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const dynamic = "force-dynamic";

export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchMarketDetail(id);

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-[28px] font-bold mb-2 text-text-primary">
            Market not found
          </h1>
          <p className="text-sm text-text-muted mb-8">
            This event market does not exist or has not been tracked yet.
          </p>
          <Link
            href="/events"
            className="inline-block text-sm px-4 py-2 rounded-lg border border-border text-text-secondary transition-colors hover:border-accent"
          >
            &larr; Browse Events
          </Link>
        </div>
      </main>
    );
  }

  const { market, callers, consensus } = data;
  const title = market.market_question ?? market.ticker;
  const currentProb = market.current_price;
  const currentPct = currentProb != null ? Math.round(currentProb * 100) : null;

  const yesCallers = callers.filter((c) => c.direction === "yes");
  const noCallers = callers.filter((c) => c.direction === "no");

  return (
    <main className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-4">
        <Link href="/" className="hover:text-accent transition-colors">paste.markets</Link>
        <span>/</span>
        <Link href="/events" className="hover:text-accent transition-colors">Events</Link>
        <span>/</span>
        <span className="text-text-secondary truncate">{title}</span>
      </div>

      {/* Market Context Card */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded border border-border text-text-muted">
            {market.category.toUpperCase()}
          </span>
          {market.polymarket_url && (
            <a
              href={market.polymarket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-accent hover:text-text-primary transition-colors font-mono ml-auto"
            >
              View on Polymarket
            </a>
          )}
        </div>

        <h1 className="text-xl font-bold text-text-primary mb-4 leading-snug">
          {title}
        </h1>

        {/* Probability display */}
        {currentProb != null && market.entry_price != null && (
          <div className="mb-4">
            <ProbabilityBar
              currentProbability={currentProb}
              entryProbability={market.entry_price}
              direction={market.direction as "yes" | "no"}
            />
          </div>
        )}

        {/* Market stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {currentPct != null && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Current</div>
              <div className="text-lg font-bold text-win font-mono">
                {formatProbability(currentProb!)}
              </div>
            </div>
          )}
          {currentProb != null && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Odds</div>
              <div className="text-lg font-bold text-text-primary font-mono">
                {probabilityToAmericanOdds(currentProb)}
              </div>
            </div>
          )}
          {market.market_volume != null && market.market_volume > 0 && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Volume</div>
              <div className="text-lg font-bold text-amber font-mono">
                {formatVolume(market.market_volume)}
              </div>
            </div>
          )}
          {market.expires_at && (
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Settles</div>
              <div className="text-lg font-bold text-text-primary font-mono">
                {formatDate(market.expires_at)}
              </div>
            </div>
          )}
        </div>

        {/* Thesis */}
        {market.thesis && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-text-secondary">{market.thesis}</p>
          </div>
        )}
      </div>

      {/* Sports-specific PnL Display */}
      {market.entry_price != null && currentProb != null && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-6">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-3">
            Position P&amp;L
          </h2>
          {(() => {
            const { pnl, description } = computeSportsPnl(
              market.entry_price!,
              currentProb,
              market.direction as "yes" | "no",
              false,
            );
            return (
              <div>
                <div className={`text-2xl font-bold font-mono ${pnl >= 0 ? "text-win" : "text-loss"}`}>
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                </div>
                <p className="text-xs text-text-muted mt-1 font-mono">{description}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Caller Consensus */}
      {callers.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-6 mb-6">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            What Callers Think
          </h2>

          {/* Consensus bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[11px] font-mono mb-1">
              <span className="text-win">YES ({consensus.yes_count})</span>
              <span className="text-loss">NO ({consensus.no_count})</span>
            </div>
            <div className="h-3 bg-bg border border-border rounded-full overflow-hidden flex">
              <div
                className="h-full bg-win rounded-l-full transition-all"
                style={{ width: `${consensus.yes_pct}%` }}
              />
              <div
                className="h-full bg-loss rounded-r-full transition-all"
                style={{ width: `${100 - consensus.yes_pct}%` }}
              />
            </div>
            <div className="text-center text-xs text-text-muted mt-2 font-mono">
              Consensus: {consensus.yes_pct}% of callers say YES
            </div>
          </div>

          {/* YES callers */}
          {yesCallers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[11px] uppercase tracking-widest text-win mb-2 font-bold">
                YES ({yesCallers.length} caller{yesCallers.length !== 1 ? "s" : ""})
              </h3>
              <div className="space-y-2">
                {yesCallers.map((caller) => {
                  const entryPct = Math.round(caller.entry_probability * 100);
                  const currentProbPct = currentPct ?? 0;
                  const delta = currentProbPct - entryPct;
                  const isGood = delta >= 0;

                  return (
                    <div key={caller.handle} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isGood ? "text-win" : "text-loss"}`}>
                          {isGood ? "\u2713" : "\u26A0\uFE0F"}
                        </span>
                        <Link
                          href={`/${encodeURIComponent(caller.handle)}`}
                          className="text-text-primary hover:text-accent transition-colors font-bold"
                        >
                          @{caller.handle}
                        </Link>
                        <span className="text-text-muted text-xs font-mono">
                          called YES at {entryPct}% (now {currentProbPct}%)
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-xs ${isGood ? "text-win" : "text-loss"}`}>
                        {delta >= 0 ? "+" : ""}{delta}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NO callers */}
          {noCallers.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-widest text-loss mb-2 font-bold">
                NO ({noCallers.length} caller{noCallers.length !== 1 ? "s" : ""})
              </h3>
              <div className="space-y-2">
                {noCallers.map((caller) => {
                  const entryPct = Math.round((1 - caller.entry_probability) * 100);
                  const currentNoPct = currentPct != null ? 100 - currentPct : 0;
                  const delta = currentNoPct - entryPct;
                  const isGood = delta >= 0;

                  return (
                    <div key={caller.handle} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isGood ? "text-win" : "text-loss"}`}>
                          {isGood ? "\u2713" : "\u26A0\uFE0F"}
                        </span>
                        <Link
                          href={`/${encodeURIComponent(caller.handle)}`}
                          className="text-text-primary hover:text-accent transition-colors font-bold"
                        >
                          @{caller.handle}
                        </Link>
                        <span className="text-text-muted text-xs font-mono">
                          called NO at {Math.round(caller.entry_probability * 100)}% YES (now {currentPct ?? 0}%)
                        </span>
                      </div>
                      <span className={`font-mono font-bold text-xs ${isGood ? "text-win" : "text-loss"}`}>
                        {delta >= 0 ? "+" : ""}{delta}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex items-center justify-between pt-6 text-sm border-t border-border">
        <Link
          href="/events"
          className="text-text-muted hover:text-accent transition-colors text-xs font-mono"
        >
          &larr; Event Markets
        </Link>
        <Link
          href="/events/calendar"
          className="text-text-muted hover:text-accent transition-colors text-xs font-mono"
        >
          Settlement Calendar &rarr;
        </Link>
      </div>
    </main>
  );
}
