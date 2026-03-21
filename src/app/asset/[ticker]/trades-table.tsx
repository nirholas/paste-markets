"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PnlDisplay } from "@/components/ui/pnl-display";
import type { AssetTrade } from "@/app/api/asset/[ticker]/route";

interface Props {
  trades: AssetTrade[];
  ticker: string;
}

type SortKey = "pnl" | "date" | "direction";
type DirectionFilter = "all" | "long" | "short";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function dirLabel(direction: string): { label: string; color: string } {
  switch (direction) {
    case "long":
    case "yes":
      return { label: "LONG", color: "text-win" };
    case "short":
    case "no":
      return { label: "SHORT", color: "text-loss" };
    default:
      return { label: direction.toUpperCase(), color: "text-text-secondary" };
  }
}

export function AssetTradesTable({ trades, ticker }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortAsc, setSortAsc] = useState(false);
  const [dirFilter, setDirFilter] = useState<DirectionFilter>("all");
  const [minPnl, setMinPnl] = useState("");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = useMemo(() => {
    let result = [...trades];

    // Direction filter
    if (dirFilter !== "all") {
      result = result.filter((t) => {
        const isLong = t.direction === "long" || t.direction === "yes";
        return dirFilter === "long" ? isLong : !isLong;
      });
    }

    // Min PnL filter
    const minPnlNum = parseFloat(minPnl);
    if (!isNaN(minPnlNum)) {
      result = result.filter(
        (t) => t.pnlPercent != null && t.pnlPercent >= minPnlNum,
      );
    }

    // Sort
    result.sort((a, b) => {
      let diff = 0;
      if (sortKey === "pnl") {
        diff = (b.pnlPercent ?? -Infinity) - (a.pnlPercent ?? -Infinity);
      } else if (sortKey === "date") {
        diff = b.submittedAt.localeCompare(a.submittedAt);
      } else if (sortKey === "direction") {
        diff = a.direction.localeCompare(b.direction);
      }
      return sortAsc ? -diff : diff;
    });

    return result;
  }, [trades, dirFilter, minPnl, sortKey, sortAsc]);

  function SortHeader({
    label,
    sortK,
  }: {
    label: string;
    sortK: SortKey;
  }) {
    const active = sortKey === sortK;
    return (
      <button
        onClick={() => toggleSort(sortK)}
        className={`text-left text-[10px] uppercase tracking-widest transition-colors ${
          active ? "text-accent" : "text-text-muted hover:text-text-secondary"
        }`}
      >
        {label}
        {active && (
          <span className="ml-1 text-[10px]">{sortAsc ? "↑" : "↓"}</span>
        )}
      </button>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Direction filter */}
        <div className="flex gap-1">
          {(["all", "long", "short"] as DirectionFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirFilter(d)}
              className={`px-3 py-1 rounded text-xs font-mono uppercase transition-colors border ${
                dirFilter === d
                  ? d === "long"
                    ? "border-win text-win bg-win/10"
                    : d === "short"
                      ? "border-loss text-loss bg-loss/10"
                      : "border-accent text-accent bg-accent/10"
                  : "border-border text-text-muted hover:border-text-secondary"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Min PnL */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted uppercase tracking-widest">
            Min P&L
          </span>
          <input
            type="number"
            value={minPnl}
            onChange={(e) => setMinPnl(e.target.value)}
            placeholder="e.g. 10"
            className="bg-surface border border-border rounded px-2 py-1 text-xs font-mono text-text-primary w-20 focus:outline-none focus:border-accent"
          />
          <span className="text-text-muted text-xs">%</span>
          {minPnl && (
            <button
              onClick={() => setMinPnl("")}
              className="text-text-muted hover:text-text-secondary text-xs transition-colors"
            >
              ×
            </button>
          )}
        </div>

        <span className="text-text-muted text-xs ml-auto">
          {filtered.length} / {trades.length} calls
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-text-muted text-sm py-8 text-center border border-border rounded-lg">
          No calls match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2 pr-3">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted">
                    Caller
                  </span>
                </th>
                <th className="text-left pb-2 pr-3">
                  <SortHeader label="Dir" sortK="direction" />
                </th>
                <th className="text-right pb-2 pr-3">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted">
                    Entry
                  </span>
                </th>
                <th className="text-right pb-2 pr-3">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted">
                    Current
                  </span>
                </th>
                <th className="text-right pb-2 pr-3">
                  <SortHeader label="P&L" sortK="pnl" />
                </th>
                <th className="text-right pb-2 pr-3">
                  <SortHeader label="Date" sortK="date" />
                </th>
                <th className="text-right pb-2">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted">
                    Links
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trade) => {
                const dir = dirLabel(trade.direction);
                return (
                  <tr
                    key={trade.id}
                    className="border-b border-border hover:bg-surface/50 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/${trade.handle}`}
                        className="text-text-primary hover:text-accent transition-colors font-mono text-xs"
                      >
                        @{trade.handle}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`text-xs font-bold font-mono ${dir.color}`}
                      >
                        {dir.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs text-text-secondary">
                      {formatPrice(trade.entryPrice)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs text-text-secondary">
                      {formatPrice(trade.currentPrice)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono">
                      {trade.pnlPercent != null ? (
                        <PnlDisplay value={trade.pnlPercent} />
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-xs text-text-muted">
                      {formatDate(trade.submittedAt)}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {trade.tweetUrl && (
                          <a
                            href={trade.tweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-text-muted hover:text-accent transition-colors"
                            title="Original tweet"
                          >
                            tweet
                          </a>
                        )}
                        {trade.cardUrl && (
                          <a
                            href={trade.cardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-accent hover:text-blue-400 transition-colors"
                            title="Trade card on paste.trade"
                          >
                            card
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Market breakdown */}
      {(() => {
        const markets = filtered.reduce<Record<string, number>>((acc, t) => {
          const m = t.market ?? "other";
          acc[m] = (acc[m] ?? 0) + 1;
          return acc;
        }, {});
        const entries = Object.entries(markets).sort((a, b) => b[1] - a[1]);
        if (entries.length <= 1) return null;
        return (
          <div className="mt-4 flex flex-wrap gap-2">
            {entries.map(([market, count]) => (
              <span
                key={market}
                className="text-[10px] font-mono text-text-muted border border-border rounded px-2 py-1"
              >
                {market}: {count}
              </span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
