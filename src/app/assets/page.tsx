import type { Metadata } from "next";
import Link from "next/link";
import { PnlDisplay } from "@/components/ui/pnl-display";
import { TickerSearch } from "@/components/ticker-search";
import type { AssetsResponse } from "@/app/api/assets/route";

export const metadata: Metadata = {
  title: "Asset Explorer -- paste.markets",
  description:
    "Browse all tracked assets. See which tickers CT traders are calling and how they're performing.",
  openGraph: {
    title: "Asset Explorer -- paste.markets",
    description:
      "All tracked tickers with call counts, avg P&L, and bull/bear sentiment.",
    images: [{ url: "/api/og/assets", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Asset Explorer -- paste.markets",
    images: ["/api/og/assets"],
  },
};

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function fetchAssets(): Promise<AssetsResponse["assets"]> {
  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/assets`, { cache: "no-store" });
    if (!res.ok) return [];
    const data: AssetsResponse = await res.json();
    return data.assets ?? [];
  } catch {
    return [];
  }
}

export default async function AssetsPage() {
  const assets = await fetchAssets();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Asset Explorer
        </h1>
        <p className="text-text-muted text-sm mb-6">
          Every ticker tracked by CT traders, ranked by call volume.
        </p>

        {/* Ticker search */}
        <TickerSearch assets={assets} />
      </section>

      {/* Stats row */}
      {assets.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "TRACKED ASSETS", value: String(assets.length) },
              {
                label: "TOTAL CALLS",
                value: String(assets.reduce((s, a) => s + a.callCount, 0)),
              },
              {
                label: "AVG SENTIMENT",
                value: (() => {
                  const bull = assets.reduce((s, a) => s + a.bullCount, 0);
                  const bear = assets.reduce((s, a) => s + a.bearCount, 0);
                  const total = bull + bear;
                  return total > 0
                    ? `${Math.round((bull / total) * 100)}% BULL`
                    : "—";
                })(),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-surface border border-border rounded-lg p-4"
              >
                <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">
                  {stat.label}
                </div>
                <div className="text-lg font-bold text-text-primary font-mono">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Asset grid */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="text-xs uppercase tracking-widest text-text-muted mb-4">
          ALL ASSETS — sorted by calls
        </div>

        {assets.length === 0 ? (
          <div className="text-text-muted text-sm py-8 text-center">
            No assets tracked yet. Trades will appear here once synced.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assets.map((asset) => {
              const total = asset.bullCount + asset.bearCount;
              const bullPct =
                total > 0 ? Math.round((asset.bullCount / total) * 100) : 50;
              const sentimentColor =
                bullPct >= 60
                  ? "text-win"
                  : bullPct <= 40
                    ? "text-loss"
                    : "text-text-secondary";

              return (
                <Link
                  key={asset.ticker}
                  href={`/asset/${asset.ticker}`}
                  className="bg-surface border border-border rounded-lg p-4 hover:border-accent transition-colors group"
                >
                  {/* Ticker + last call */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">
                        ${asset.ticker}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        last call {formatDate(asset.lastCallAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-muted">
                        {asset.callCount} call{asset.callCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Avg PnL */}
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-text-muted text-xs">Avg P&L</span>
                    {asset.avgPnl != null ? (
                      <PnlDisplay value={asset.avgPnl} />
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </div>

                  {/* Bull/Bear bar */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-win">{asset.bullCount} LONG</span>
                      <span className={sentimentColor}>{bullPct}% bull</span>
                      <span className="text-loss">{asset.bearCount} SHORT</span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-win rounded-full"
                        style={{ width: `${bullPct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 text-center text-xs text-text-muted">
        <p>
          <Link href="/" className="hover:text-accent transition-colors">
            paste.markets
          </Link>{" "}
          — Real P&L data from{" "}
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
