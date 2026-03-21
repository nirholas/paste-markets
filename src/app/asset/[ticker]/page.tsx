import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PnlDisplay } from "@/components/ui/pnl-display";
import { AssetTradesTable } from "./trades-table";
import type {
  AssetDetailResponse,
  AssetTrade,
} from "@/app/api/asset/[ticker]/route";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/asset/${ticker}`, {
      cache: "no-store",
    });
    if (!res.ok)
      return { title: `$${ticker} — paste.markets` };
    const data: AssetDetailResponse = await res.json();
    return {
      title: `$${ticker} — ${data.totalCalls} calls | paste.markets`,
      description: `See all CT trade calls for $${ticker}. ${data.totalCalls} calls tracked, avg P&L ${data.avgPnlPercent != null ? `${data.avgPnlPercent >= 0 ? "+" : ""}${data.avgPnlPercent.toFixed(1)}%` : "—"}. ${data.bullCount} long vs ${data.bearCount} short.`,
      openGraph: {
        title: `$${ticker} — CT Trade Calls | paste.markets`,
        description: `${data.totalCalls} calls. Avg P&L ${data.avgPnlPercent != null ? `${data.avgPnlPercent >= 0 ? "+" : ""}${data.avgPnlPercent.toFixed(1)}%` : "—"}. ${data.bullCount}L / ${data.bearCount}S.`,
        images: [
          { url: `/api/og/asset/${ticker}`, width: 1200, height: 630 },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `$${ticker} — CT Trade Calls | paste.markets`,
        images: [`/api/og/asset/${ticker}`],
      },
    };
  } catch {
    return { title: `$${ticker} — paste.markets` };
  }
}

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

async function fetchAssetDetail(
  ticker: string,
): Promise<AssetDetailResponse | null> {
  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/asset/${ticker}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<AssetDetailResponse>;
  } catch {
    return null;
  }
}

export default async function AssetPage({ params }: PageProps) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const data = await fetchAssetDetail(ticker);

  if (!data) notFound();

  const bullPct =
    data.bullCount + data.bearCount > 0
      ? Math.round((data.bullCount / (data.bullCount + data.bearCount)) * 100)
      : 50;

  const sentimentLabel =
    bullPct >= 65
      ? "BULLISH"
      : bullPct <= 35
        ? "BEARISH"
        : "MIXED";
  const sentimentColor =
    bullPct >= 65
      ? "text-win"
      : bullPct <= 35
        ? "text-loss"
        : "text-[#f39c12]";

  return (
    <main className="min-h-screen">
      {/* Breadcrumb */}
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-0">
        <div className="text-xs text-text-muted font-mono">
          <Link href="/assets" className="hover:text-accent transition-colors">
            Assets
          </Link>
          {" / "}
          <span className="text-text-secondary">${ticker}</span>
        </div>
      </div>

      {/* Header */}
      <section className="max-w-5xl mx-auto px-4 pt-6 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">${ticker}</h1>
            {data.currentPrice != null && (
              <div className="text-text-secondary text-sm mt-1 font-mono">
                current price{" "}
                <span className="text-text-primary font-bold">
                  {formatPrice(data.currentPrice)}
                </span>
              </div>
            )}
          </div>
          <div className={`text-sm font-bold ${sentimentColor} font-mono`}>
            {sentimentLabel}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Total Calls
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">
              {data.totalCalls}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Avg P&L
            </div>
            <div className="text-xl font-bold font-mono">
              {data.avgPnlPercent != null ? (
                <PnlDisplay value={data.avgPnlPercent} />
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Long / Short
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">
              <span className="text-win">{data.bullCount}</span>
              <span className="text-text-muted text-base mx-1">/</span>
              <span className="text-loss">{data.bearCount}</span>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Callers
            </div>
            <div className="text-xl font-bold text-text-primary font-mono">
              {data.callers.length}
            </div>
          </div>
        </div>

        {/* Bull/Bear sentiment bar */}
        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-win font-mono">
              {data.bullCount} LONG ({bullPct}%)
            </span>
            <span className="text-text-muted uppercase tracking-widest">
              Sentiment
            </span>
            <span className="text-loss font-mono">
              SHORT {data.bearCount} ({100 - bullPct}%)
            </span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-win rounded-full transition-all"
              style={{ width: `${bullPct}%` }}
            />
          </div>
        </div>

        {/* Best call banner */}
        {data.bestCall && (
          <div className="bg-surface border border-[#2ecc71]/30 rounded-lg p-4 mb-6">
            <div className="text-[10px] uppercase tracking-widest text-[#2ecc71] mb-2">
              Best Call Ever
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${data.bestCall.handle}`}
                className="text-text-primary font-bold hover:text-accent transition-colors"
              >
                @{data.bestCall.handle}
              </Link>
              <PnlDisplay value={data.bestCall.pnlPercent} />
              {data.bestCall.entryPrice != null && (
                <span className="text-text-muted text-xs">
                  entry {formatPrice(data.bestCall.entryPrice)}
                </span>
              )}
              <span className="text-text-muted text-xs">
                {formatDate(data.bestCall.date)}
              </span>
              {data.bestCall.cardUrl && (
                <a
                  href={data.bestCall.cardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent hover:text-blue-400 transition-colors"
                >
                  view card →
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Main content: trades table + callers sidebar */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Trades table */}
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-text-muted mb-4">
              All Calls — sorted by P&L
            </div>
            <AssetTradesTable trades={data.trades} ticker={ticker} />
          </div>

          {/* Callers sidebar */}
          {data.callers.length > 0 && (
            <div className="lg:w-64 shrink-0">
              <div className="text-xs uppercase tracking-widest text-text-muted mb-4">
                Callers on ${ticker}
              </div>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {data.callers.map((caller) => (
                  <Link
                    key={caller.handle}
                    href={`/${caller.handle}`}
                    className="flex items-center justify-between p-3 hover:bg-[#0f0f22]/50 transition-colors"
                  >
                    <div>
                      <div className="text-sm text-text-primary font-mono">
                        @{caller.handle}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {caller.callCount} call
                        {caller.callCount !== 1 ? "s" : ""} ·{" "}
                        {Math.round(caller.hitRate)}% hit rate
                      </div>
                    </div>
                    <div className="text-right">
                      {caller.avgPnl != null ? (
                        <PnlDisplay value={caller.avgPnl} />
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted">
        <p>
          <Link href="/" className="hover:text-accent transition-colors">
            paste.markets
          </Link>{" "}
          ·{" "}
          <Link
            href="/assets"
            className="hover:text-accent transition-colors"
          >
            All Assets
          </Link>{" "}
          — data from{" "}
          <a
            href="https://paste.trade"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent transition-colors"
          >
            paste.trade
          </a>
        </p>
      </footer>
    </main>
  );
}
