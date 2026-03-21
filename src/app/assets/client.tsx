"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PnlDisplay } from "@/components/ui/pnl-display";
import { TickerSearch } from "@/components/ticker-search";
import type { AssetSummary } from "@/lib/data";

type SortKey = "calls" | "pnl" | "recent" | "trending";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "calls", label: "Most Calls" },
  { value: "pnl", label: "Best Avg PnL" },
  { value: "recent", label: "Most Recent" },
  { value: "trending", label: "Trending" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isWithinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < days * 24 * 60 * 60 * 1000;
}

interface Props {
  assets: AssetSummary[];
}

export function AssetsClient({ assets }: Props) {
  const [sort, setSort] = useState<SortKey>("calls");

  const sorted = useMemo(() => {
    const list = [...assets];
    switch (sort) {
      case "calls":
        return list.sort((a, b) => b.callCount - a.callCount);
      case "pnl":
        return list.sort(
          (a, b) => (b.avgPnl ?? -Infinity) - (a.avgPnl ?? -Infinity),
        );
      case "recent":
        return list.sort((a, b) =>
          (b.lastCallAt ?? "").localeCompare(a.lastCallAt ?? ""),
        );
      case "trending":
        // Sort by recency of last call (proxy for trending, since we don't have weekly call count)
        return list
          .filter((a) => isWithinDays(a.lastCallAt, 7))
          .concat(
            list.filter((a) => !isWithinDays(a.lastCallAt, 7)),
          )
          .sort((a, b) => {
            const aRecent = isWithinDays(a.lastCallAt, 7);
            const bRecent = isWithinDays(b.lastCallAt, 7);
            if (aRecent && !bRecent) return -1;
            if (!aRecent && bRecent) return 1;
            return b.callCount - a.callCount;
          });
    }
  }, [assets, sort]);

  return (
    <>
      {/* Ticker search */}
      <TickerSearch assets={assets} />

      {/* Sort controls */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          Sort:
        </span>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                sort === opt.value
                  ? "bg-accent text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Asset grid */}
      <div className="mt-6 text-xs uppercase tracking-widest text-text-muted mb-4">
        {sorted.length} ASSET{sorted.length !== 1 ? "S" : ""}
        {sort === "trending" && (
          <span className="ml-2 text-accent normal-case tracking-normal">
            — active in last 7 days first
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="text-text-muted text-sm py-8 text-center">
          No assets tracked yet — paste a tweet to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((asset) => {
            const total = asset.bullCount + asset.bearCount;
            const bullPct =
              total > 0 ? Math.round((asset.bullCount / total) * 100) : 50;
            const sentimentColor =
              bullPct >= 60
                ? "text-win"
                : bullPct <= 40
                  ? "text-loss"
                  : "text-text-secondary";
            const isActive = isWithinDays(asset.lastCallAt, 7);

            return (
              <Link
                key={asset.ticker}
                href={`/asset/${asset.ticker}`}
                className={`bg-surface border rounded-lg p-4 hover:border-accent transition-colors group ${
                  isActive && sort === "trending"
                    ? "border-accent/40"
                    : "border-border"
                }`}
              >
                {/* Ticker + last call */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-base font-bold text-text-primary group-hover:text-accent transition-colors">
                      ${asset.ticker}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      last call {formatDate(asset.lastCallAt)}
                      {isActive && sort === "trending" && (
                        <span className="ml-1 text-accent">↑</span>
                      )}
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
    </>
  );
}
