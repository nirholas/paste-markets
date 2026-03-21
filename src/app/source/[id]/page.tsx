import type { Metadata } from "next";
import { getExtraction, getSourcePerformance } from "@/lib/db";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const extraction = getExtraction(id);
  if (!extraction) return { title: "Source Not Found — paste.markets" };

  const title = `${extraction.title} — ${extraction.thesis_count} trades found`;
  return {
    title: `${title} — paste.markets`,
    description: extraction.summary ?? `${extraction.thesis_count} trade theses extracted from ${extraction.source_type}`,
    openGraph: {
      title,
      description: extraction.summary ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
    },
  };
}

function PnlBadge({ pnl }: { pnl: number | null }) {
  if (pnl == null) return <span className="text-text-muted text-xs">Pending</span>;
  const isWin = pnl > 0;
  return (
    <span className={`text-sm font-bold ${isWin ? "text-win" : "text-loss"}`}>
      {isWin ? "+" : ""}
      {pnl.toFixed(1)}%
    </span>
  );
}

function WinIcon() {
  return <span className="text-win text-xs ml-1">W</span>;
}

function LossIcon() {
  return <span className="text-loss text-xs ml-1">L</span>;
}

export default async function SourcePage({ params }: Props) {
  const { id } = await params;
  const extraction = getExtraction(id);
  if (!extraction) notFound();

  const perf = getSourcePerformance(id);
  const tracked = extraction.theses.filter((t) => t.paste_trade_id);
  const sourceTypeLabel =
    extraction.source_type.charAt(0).toUpperCase() + extraction.source_type.slice(1);

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 pt-16 pb-20">
      {/* Header */}
      <section className="mb-8">
        <div className="flex items-center gap-2 text-xs text-text-muted uppercase tracking-widest mb-2">
          <span>{sourceTypeLabel}</span>
          <span>-</span>
          <span>
            {new Date(extraction.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span>-</span>
          <span>{extraction.thesis_count} trades found</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
          {extraction.title}
        </h1>

        {extraction.author && (
          <p className="text-text-secondary text-sm mb-2">
            By {extraction.author}
          </p>
        )}

        {extraction.summary && (
          <p className="text-text-secondary text-sm leading-relaxed">
            {extraction.summary}
          </p>
        )}

        {extraction.source_url && (
          <a
            href={extraction.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-accent hover:underline"
          >
            View original source
          </a>
        )}
      </section>

      {/* Performance Summary */}
      {perf.tracked > 0 && (
        <section className="bg-surface border border-border rounded-lg p-6 mb-8">
          <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
            Source Performance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-text-muted text-xs">Win Rate</p>
              <p className="text-text-primary text-lg font-bold">
                {perf.winRate.toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Avg PnL</p>
              <p
                className={`text-lg font-bold ${perf.avgPnl > 0 ? "text-win" : perf.avgPnl < 0 ? "text-loss" : "text-text-primary"}`}
              >
                {perf.avgPnl > 0 ? "+" : ""}
                {perf.avgPnl.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Record</p>
              <p className="text-text-primary text-lg font-bold">
                <span className="text-win">{perf.wins}</span>
                <span className="text-text-muted">-</span>
                <span className="text-loss">{perf.losses}</span>
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Tracked</p>
              <p className="text-text-primary text-lg font-bold">
                {perf.tracked}/{perf.total}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Theses List */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
          Extracted Trades
        </h2>
        <div className="space-y-4">
          {extraction.theses.map((thesis, i) => {
            const dirUpper = thesis.direction.toUpperCase();
            const dirColor =
              dirUpper === "LONG" || dirUpper === "YES"
                ? "text-win"
                : dirUpper === "SHORT" || dirUpper === "NO"
                  ? "text-loss"
                  : "text-text-primary";

            const confColor =
              thesis.confidence > 70
                ? "text-win"
                : thesis.confidence >= 40
                  ? "text-amber"
                  : "text-loss";

            return (
              <div
                key={thesis.id}
                className="bg-surface border border-border rounded-lg p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-text-muted text-xs mr-2">
                      Trade {i + 1}
                    </span>
                    <span className="text-text-primary font-bold text-lg">
                      {thesis.ticker}
                    </span>{" "}
                    <span className={`font-bold ${dirColor}`}>
                      {dirUpper}
                    </span>
                    <span className="text-text-muted text-xs ml-2">
                      on {thesis.platform}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${confColor}`}>
                      {thesis.confidence}%
                    </span>
                    {thesis.current_pnl != null && (
                      <div className="mt-1">
                        <PnlBadge pnl={thesis.current_pnl} />
                        {thesis.current_pnl > 0 ? <WinIcon /> : <LossIcon />}
                      </div>
                    )}
                  </div>
                </div>

                {thesis.quote && (
                  <blockquote className="border-l-2 border-border pl-3 text-text-secondary text-sm italic mb-3">
                    &ldquo;{thesis.quote}&rdquo;
                  </blockquote>
                )}

                {thesis.reasoning && (
                  <p className="text-text-secondary text-sm mb-3">
                    {thesis.reasoning}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-text-muted">
                  {thesis.conviction && (
                    <span>
                      Conviction:{" "}
                      <span
                        className={
                          thesis.conviction === "high"
                            ? "text-win"
                            : thesis.conviction === "low"
                              ? "text-loss"
                              : "text-amber"
                        }
                      >
                        {thesis.conviction.toUpperCase()}
                      </span>
                    </span>
                  )}
                  {thesis.timeframe && <span>{thesis.timeframe}</span>}
                  {thesis.price_at_extraction != null && (
                    <span>
                      Entry: $
                      {thesis.price_at_extraction.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>

                {thesis.paste_trade_url && (
                  <a
                    href={thesis.paste_trade_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-xs text-accent hover:underline"
                  >
                    View on paste.trade
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <p className="text-text-muted text-xs text-center pt-8 border-t border-border mt-8">
        Extracted in {extraction.processing_time_ms}ms. Not financial advice.
        AI-generated analysis. Do your own research.
      </p>
    </main>
  );
}
