import type { Metadata } from "next";
import Link from "next/link";
import { getTradeById, searchFullTrades, PasteTradeFullTrade } from "@/lib/paste-trade";
import { ShareButton } from "./share-button";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ author?: string }>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function directionColor(direction: string): string {
  if (direction === "long" || direction === "yes") return "text-win";
  return "text-loss";
}

function DirectionBadge({ direction }: { direction: string }) {
  const isPositive = direction === "long" || direction === "yes";
  return (
    <span
      className={`text-xs uppercase tracking-widest font-mono px-2 py-0.5 rounded border ${
        isPositive
          ? "border-win text-win bg-win/10"
          : "border-loss text-loss bg-loss/10"
      }`}
    >
      {direction}
    </span>
  );
}

function PnlBadge({ pnlPct }: { pnlPct: number | null }) {
  if (pnlPct == null) return null;
  const isPositive = pnlPct >= 0;
  const sign = isPositive ? "+" : "";
  return (
    <span className={`text-2xl font-bold font-mono ${isPositive ? "text-win" : "text-loss"}`}>
      {sign}{pnlPct.toFixed(1)}%
    </span>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Trade Not Found</h1>
        <p className="text-text-muted text-sm mb-8">
          Trade ID <code className="text-text-secondary">{id}</code> could not be located.
        </p>
        <Link
          href="/leaderboard"
          className="inline-block border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
        >
          &larr; Back to Leaderboard
        </Link>
      </div>
    </main>
  );
}

function MiniTradeRow({ trade }: { trade: PasteTradeFullTrade }) {
  const handle = trade.author_handle ?? "unknown";
  const href = `/trade/${trade.trade_id ?? ""}?author=${handle}`;

  return (
    <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg hover:border-accent transition-colors">
      <div className="flex items-center gap-3">
        <span className="font-bold text-text-primary text-sm">${trade.ticker}</span>
        <DirectionBadge direction={trade.direction} />
        {trade.platform && (
          <span className="text-xs text-text-muted">{trade.platform}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {trade.pnlPct != null && (
          <span className={`text-sm font-mono font-bold ${trade.pnlPct >= 0 ? "text-win" : "text-loss"}`}>
            {trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(1)}%
          </span>
        )}
        {trade.trade_id && (
          <Link
            href={href}
            className="text-xs text-text-muted hover:text-accent transition-colors"
          >
            View &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { author } = await searchParams;
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  const trade = await getTradeById(id, author);

  if (!trade) {
    return { title: "Trade Not Found | paste.markets" };
  }

  const handle = trade.author_handle ?? author ?? "unknown";
  const direction = trade.direction.toUpperCase();
  const pnlStr =
    trade.pnlPct != null
      ? ` (${trade.pnlPct >= 0 ? "+" : ""}${trade.pnlPct.toFixed(1)}%)`
      : "";

  const title = `$${trade.ticker} ${direction}${pnlStr} by @${handle} | paste.markets`;
  const description = trade.thesis
    ? trade.thesis.length > 160
      ? trade.thesis.slice(0, 157) + "..."
      : trade.thesis
    : `${direction} on $${trade.ticker} by @${handle} on paste.markets`;

  // Landscape format for Twitter/OG link preview; 5-min cache enforced in OG route
  const ogUrl = `${baseUrl}/api/og/trade/${id}?format=landscape${author ? `&author=${encodeURIComponent(author)}` : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function TradeDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { author } = await searchParams;

  const trade = await getTradeById(id, author);

  if (!trade) {
    return <NotFound id={id} />;
  }

  const handle = trade.author_handle ?? author ?? "unknown";
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  const tradeUrl = `${baseUrl}/trade/${id}?author=${handle}`;

  // Fetch more trades from same author (exclude current trade)
  let moreTrades: PasteTradeFullTrade[] = [];
  if (handle !== "unknown") {
    try {
      const all = await searchFullTrades({ author: handle, top: "30d", limit: 10 });
      moreTrades = all.filter((t) => t.trade_id !== id && t.trade_id != null).slice(0, 3);
    } catch {
      // non-fatal
    }
  }

  return (
    <main className="min-h-screen px-4 py-12 max-w-2xl mx-auto">
      {/* Back link */}
      <div className="mb-8">
        <Link
          href="/leaderboard"
          className="text-xs text-text-muted hover:text-accent transition-colors uppercase tracking-widest"
        >
          &larr; Leaderboard
        </Link>
      </div>

      {/* Trade card */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        {/* Header: author + timestamp */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Avatar placeholder */}
            <div className="w-9 h-9 rounded-full bg-border flex items-center justify-center text-text-muted text-xs font-bold uppercase">
              {handle.slice(0, 2)}
            </div>
            <div>
              <Link
                href={`/@${handle}`}
                className="text-sm font-bold text-text-primary hover:text-accent transition-colors"
              >
                @{handle}
              </Link>
              <div className="text-xs text-text-muted">
                {formatDate(trade.posted_at)}
              </div>
            </div>
          </div>
          {/* Ticker + direction */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-text-primary font-mono">${trade.ticker}</span>
            <DirectionBadge direction={trade.direction} />
          </div>
        </div>

        {/* Market question (if prediction market) */}
        {trade.market_question && (
          <div className="mb-4 text-sm text-text-muted italic border-l-2 border-accent pl-3">
            {trade.market_question}
          </div>
        )}

        {/* Thesis */}
        {trade.thesis && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-2">Thesis</div>
            <p className="text-sm text-text-secondary leading-relaxed">{trade.thesis}</p>
          </div>
        )}

        {/* Headline quote */}
        {trade.headline_quote && (
          <div className="mb-4 text-sm text-text-muted italic border-l-2 border-border pl-3">
            &ldquo;{trade.headline_quote}&rdquo;
          </div>
        )}

        {/* Chain of reasoning */}
        {trade.chain_steps && trade.chain_steps.length > 0 && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-3">
              Chain of Reasoning
            </div>
            <ol className="space-y-2">
              {trade.chain_steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-text-secondary">
                  <span className="text-text-muted font-mono text-xs mt-0.5 flex-shrink-0">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Explanation */}
        {trade.explanation && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
              Explanation
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{trade.explanation}</p>
          </div>
        )}

        {/* Ticker context */}
        {trade.ticker_context && (
          <div className="mb-5">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-2">
              Context
            </div>
            <p className="text-sm text-text-muted">{trade.ticker_context}</p>
          </div>
        )}

        {/* Price + P&L */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            {trade.entryPrice != null && (
              <div>
                <div className="text-xs text-text-muted mb-0.5">Entry</div>
                <div className="font-mono text-text-secondary">{formatPrice(trade.entryPrice)}</div>
              </div>
            )}
            {trade.currentPrice != null && (
              <>
                <span className="text-text-muted">&rarr;</span>
                <div>
                  <div className="text-xs text-text-muted mb-0.5">Current</div>
                  <div className="font-mono text-text-secondary">{formatPrice(trade.currentPrice)}</div>
                </div>
              </>
            )}
          </div>
          <PnlBadge pnlPct={trade.pnlPct ?? null} />
        </div>

        {/* Platform + source */}
        <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-3">
            {trade.platform && <span className="uppercase tracking-widest">{trade.platform}</span>}
          </div>
          {trade.source_url && (
            <a
              href={trade.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Source &rarr;
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mb-10">
        <ShareButton
          tradeId={id}
          ticker={trade.ticker}
          direction={trade.direction}
          handle={handle}
          pnlPct={trade.pnlPct ?? null}
          tradeUrl={tradeUrl}
        />
        {handle !== "unknown" && (
          <Link
            href={`/@${handle}`}
            className="inline-flex items-center gap-2 border border-border hover:border-accent text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm transition-colors"
          >
            View @{handle}&apos;s profile
          </Link>
        )}
      </div>

      {/* More from @handle */}
      {moreTrades.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            More from @{handle}
          </h2>
          <div className="space-y-3">
            {moreTrades.map((t, i) => (
              <MiniTradeRow key={t.trade_id ?? i} trade={t} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border flex justify-between text-[11px] text-text-muted">
        <span>paste.markets</span>
        <span>data from paste.trade</span>
      </div>
    </main>
  );
}
