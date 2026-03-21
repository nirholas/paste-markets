"use client";

import { useState, useMemo } from "react";
import { IntegrityBadge } from "@/components/integrity-badge";
import type { IntegrityClass } from "@/lib/integrity";

interface Trade {
  ticker: string;
  direction: string;
  pnl_pct: number;
  platform?: string;
  entry_date: string;
  integrity?: IntegrityClass | null;
  delay_minutes?: number;
}

interface TradeHistoryProps {
  trades: Trade[];
  sortable?: boolean;
}

type SortKey = "ticker" | "direction" | "pnl_pct" | "entry_date";
type SortDir = "asc" | "desc";

const COLUMN_HEADERS: { key: SortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "direction", label: "Dir" },
  { key: "pnl_pct", label: "P&L" },
  { key: "entry_date", label: "Date" },
];

function fmtShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function TradeHistory({ trades, sortable = true }: TradeHistoryProps) {
  const [sortKey, setSortKey] = useState<SortKey>("pnl_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "ticker":
          cmp = a.ticker.localeCompare(b.ticker);
          break;
        case "direction":
          cmp = a.direction.localeCompare(b.direction);
          break;
        case "pnl_pct":
          cmp = a.pnl_pct - b.pnl_pct;
          break;
        case "entry_date":
          cmp = a.entry_date.localeCompare(b.entry_date);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [trades, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (!sortable) return;
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (trades.length === 0) {
    return (
      <div className="text-text-muted text-sm py-8 text-center">
        No trades recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            {COLUMN_HEADERS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`text-left text-[11px] uppercase tracking-widest text-text-muted font-normal px-0 py-2 pr-6 border-b border-border ${
                  sortable ? "cursor-pointer hover:text-text-secondary select-none" : ""
                }`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-accent">
                    {sortDir === "desc" ? "\u2193" : "\u2191"}
                  </span>
                )}
              </th>
            ))}
            <th className="text-left text-[11px] uppercase tracking-widest text-text-muted font-normal px-0 py-2 pr-4 border-b border-border">
              Status
            </th>
            <th className="text-left text-[11px] uppercase tracking-widest text-text-muted font-normal px-0 py-2 border-b border-border hidden sm:table-cell">
              Integrity
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((trade, i) => {
            const isWin = trade.pnl_pct > 0;
            const pnlColor = isWin ? "text-win" : "text-loss";
            const sign = isWin ? "+" : "";

            return (
              <tr
                key={`${trade.ticker}-${trade.direction}-${trade.entry_date}-${i}`}
                className="border-b border-surface last:border-b-0"
              >
                <td className="py-1.5 pr-6 text-text-primary font-bold">
                  {trade.ticker}
                </td>
                <td className="py-1.5 pr-6">
                  <span
                    className={`text-[11px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      trade.direction === "long" || trade.direction === "yes"
                        ? "text-win bg-win/10"
                        : "text-loss bg-loss/10"
                    }`}
                  >
                    {trade.direction.toUpperCase()}
                  </span>
                </td>
                <td className={`py-1.5 pr-6 font-bold ${pnlColor}`}>
                  {sign}
                  {trade.pnl_pct.toFixed(1)}%
                </td>
                <td className="py-1.5 pr-6 text-text-secondary">
                  {fmtShortDate(trade.entry_date)}
                </td>
                <td className={`py-1.5 pr-4 ${pnlColor}`}>
                  {isWin ? "\u2713" : "\u2717"}
                </td>
                <td className="py-1.5">
                  {trade.integrity && trade.integrity !== "unknown" && (
                    <IntegrityBadge
                      integrity={trade.integrity}
                      delayMinutes={trade.delay_minutes}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
