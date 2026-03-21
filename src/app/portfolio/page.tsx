"use client";

import { useState, useRef } from "react";
import Link from "next/link";


// ── Types ──────────────────────────────────────────────────────────────────

interface SimTrade {
  ticker: string;
  direction: string;
  pnlPct: number;
  postedAt: string;
  platform: string | null;
  runningPortfolio: number;
  tradePnlDollars: number;
}

interface CallerResult {
  handle: string;
  timeframe: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  totalReturnPct: number;
  totalPnlDollars: number;
  portfolioFinal: number;
  bestTrade: { ticker: string; direction: string; pnlPct: number } | null;
  worstTrade: { ticker: string; direction: string; pnlPct: number } | null;
  trades: SimTrade[];
  authorRank: number | null;
  authorWinRate: number | null;
}

type Timeframe = "7d" | "30d" | "90d";

// ── Constants ──────────────────────────────────────────────────────────────

const BASE_CAPITAL = 10_000;
const MAX_CALLERS = 5;
const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtPct(n: number, decimals = 1): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

function fmtDollars(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pnlColor(n: number): string {
  return n >= 0 ? "#2ecc71" : "#e74c3c";
}

function winRateBar(pct: number, len = 10): string {
  const filled = Math.round((pct / 100) * len);
  return "█".repeat(filled) + "░".repeat(Math.max(0, len - filled));
}

function rankLabel(rank: number | null): string {
  if (rank == null) return "";
  return `#${rank}`;
}

// ── Components ─────────────────────────────────────────────────────────────

function WinnerBadge({ handle }: { handle: string }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
      style={{ color: "#f39c12", border: "1px solid #f39c12" }}
    >
      winner
    </span>
  );
}

function CallerCard({
  result,
  isWinner,
  onRemove,
}: {
  result: CallerResult;
  isWinner: boolean;
  onRemove: () => void;
}) {
  const returnColor = pnlColor(result.totalReturnPct);
  return (
    <div
      className="rounded-lg p-5 font-mono"
      style={{
        backgroundColor: "#0f0f22",
        border: isWinner ? "1px solid #f39c12" : "1px solid #1a1a2e",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/${result.handle}`}
              className="font-bold text-sm hover:text-[#3b82f6] transition-colors"
              style={{ color: "#f0f0f0" }}
            >
              @{result.handle}
            </Link>
            {isWinner && <WinnerBadge handle={result.handle} />}
          </div>
          {result.authorRank && (
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "#555568" }}>
              {rankLabel(result.authorRank)} on leaderboard
            </span>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-[#555568] hover:text-[#e74c3c] transition-colors text-xs"
        >
          remove
        </button>
      </div>

      {/* Big return number */}
      <div className="mb-4">
        <div className="text-3xl font-bold" style={{ color: returnColor }}>
          {fmtPct(result.totalReturnPct)}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "#555568" }}>
          {fmtDollars(result.totalPnlDollars)} on $10k
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Trades
          </div>
          <div className="text-sm font-bold" style={{ color: "#f0f0f0" }}>
            {result.tradeCount}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Win Rate
          </div>
          <div
            className="text-sm font-bold"
            style={{ color: result.winRate >= 50 ? "#2ecc71" : "#e74c3c" }}
          >
            {result.winRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Avg/Trade
          </div>
          <div
            className="text-sm font-bold"
            style={{ color: pnlColor(result.totalReturnPct / Math.max(1, result.tradeCount)) }}
          >
            {fmtPct(result.totalReturnPct / Math.max(1, result.tradeCount))}
          </div>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="mb-3 text-[10px] font-mono" style={{ color: result.winRate >= 50 ? "#2ecc71" : "#e74c3c" }}>
        {winRateBar(result.winRate)}
      </div>

      {/* Best/worst */}
      {result.bestTrade && (
        <div className="text-[10px]" style={{ color: "#555568" }}>
          Best:{" "}
          <span style={{ color: "#2ecc71" }}>
            {result.bestTrade.ticker} {result.bestTrade.direction.toUpperCase()} {fmtPct(result.bestTrade.pnlPct)}
          </span>
        </div>
      )}
      {result.worstTrade && (
        <div className="text-[10px] mt-0.5" style={{ color: "#555568" }}>
          Worst:{" "}
          <span style={{ color: "#e74c3c" }}>
            {result.worstTrade.ticker} {result.worstTrade.direction.toUpperCase()} {fmtPct(result.worstTrade.pnlPct)}
          </span>
        </div>
      )}
    </div>
  );
}

function CombinedStats({ results }: { results: CallerResult[] }) {
  const totalPnl = results.reduce((sum, r) => sum + r.totalPnlDollars, 0);
  const totalBase = results.length * BASE_CAPITAL;
  const combinedReturn = totalBase > 0 ? (totalPnl / totalBase) * 100 : 0;
  const totalTrades = results.reduce((sum, r) => sum + r.tradeCount, 0);
  const totalWins = results.reduce((sum, r) => sum + r.winCount, 0);
  const combinedWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  const returnColor = pnlColor(combinedReturn);

  return (
    <div
      className="rounded-lg p-6 font-mono mb-8"
      style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
    >
      <div className="text-[11px] uppercase tracking-widest mb-4" style={{ color: "#555568" }}>
        Combined Portfolio — {results.length} caller{results.length !== 1 ? "s" : ""}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Total Return
          </div>
          <div className="text-2xl font-bold" style={{ color: returnColor }}>
            {fmtPct(combinedReturn)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#555568" }}>
            {fmtDollars(totalPnl)} net
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Total Invested
          </div>
          <div className="text-2xl font-bold" style={{ color: "#f0f0f0" }}>
            ${totalBase.toLocaleString()}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#555568" }}>
            $10k per caller
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Combined WR
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: combinedWinRate >= 50 ? "#2ecc71" : "#e74c3c" }}
          >
            {combinedWinRate.toFixed(0)}%
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#555568" }}>
            {totalWins}W / {totalTrades - totalWins}L
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#555568" }}>
            Total Trades
          </div>
          <div className="text-2xl font-bold" style={{ color: "#f0f0f0" }}>
            {totalTrades}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#555568" }}>
            across all callers
          </div>
        </div>
      </div>

      {/* Rank the callers */}
      <div className="mt-6 pt-4" style={{ borderTop: "1px solid #1a1a2e" }}>
        <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "#555568" }}>
          Caller Ranking
        </div>
        <div className="space-y-2">
          {[...results]
            .sort((a, b) => b.totalReturnPct - a.totalReturnPct)
            .map((r, i) => (
              <div key={r.handle} className="flex items-center gap-3">
                <span className="text-[10px] w-4" style={{ color: "#555568" }}>
                  {i + 1}.
                </span>
                <Link
                  href={`/${r.handle}`}
                  className="text-xs hover:text-[#3b82f6] transition-colors"
                  style={{ color: i === 0 ? "#f0f0f0" : "#c8c8d0", minWidth: "120px" }}
                >
                  @{r.handle}
                </Link>
                <div
                  className="flex-1 h-1.5 rounded"
                  style={{ backgroundColor: "#1a1a2e", overflow: "hidden" }}
                >
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max(0, Math.min(100, 50 + r.totalReturnPct / 2))}%`,
                      backgroundColor: pnlColor(r.totalReturnPct),
                    }}
                  />
                </div>
                <span
                  className="text-xs font-bold w-16 text-right"
                  style={{ color: pnlColor(r.totalReturnPct) }}
                >
                  {fmtPct(r.totalReturnPct)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [handles, setHandles] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<CallerResult[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [simulated, setSimulated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addHandle(raw: string) {
    const handle = raw.replace(/^@/, "").toLowerCase().trim();
    if (!handle || handles.includes(handle) || handles.length >= MAX_CALLERS) return;
    setHandles((prev) => [...prev, handle]);
    setInput("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next[handle];
      return next;
    });
  }

  function removeHandle(handle: string) {
    setHandles((prev) => prev.filter((h) => h !== handle));
    setResults((prev) => prev.filter((r) => r.handle !== handle));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[handle];
      return next;
    });
  }

  async function simulate() {
    if (handles.length === 0) return;

    setSimulated(false);
    setResults([]);
    setErrors({});

    const loadingState: Record<string, boolean> = {};
    handles.forEach((h) => (loadingState[h] = true));
    setLoading(loadingState);

    const fetched = await Promise.all(
      handles.map(async (handle) => {
        try {
          const res = await fetch(`/api/sim/${encodeURIComponent(handle)}?timeframe=${timeframe}`);
          const data = await res.json();
          setLoading((prev) => ({ ...prev, [handle]: false }));
          if (!res.ok || data.error) {
            setErrors((prev) => ({
              ...prev,
              [handle]: data.details ?? data.error ?? "No resolved trades found",
            }));
            return null;
          }
          return data as CallerResult;
        } catch {
          setLoading((prev) => ({ ...prev, [handle]: false }));
          setErrors((prev) => ({ ...prev, [handle]: "Network error" }));
          return null;
        }
      }),
    );

    const valid = fetched.filter((r): r is CallerResult => r !== null);
    setResults(valid);
    setSimulated(true);
  }

  const winnerHandle =
    results.length > 0
      ? results.reduce((best, r) =>
          r.totalReturnPct > best.totalReturnPct ? r : best,
        ).handle
      : null;

  const anyLoading = Object.values(loading).some(Boolean);

  return (
    <main className="min-h-screen">

      <div className="max-w-5xl mx-auto px-4 pt-10 pb-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-[#f0f0f0] font-mono mb-1">
            PORTFOLIO SIMULATOR
          </h1>
          <p className="text-[#555568] text-xs font-mono">
            Pick up to 5 CT callers. See what $10k per caller would have returned.
          </p>
        </div>

        {/* Add callers input */}
        <div
          className="rounded-lg p-5 mb-6 font-mono"
          style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
        >
          <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "#555568" }}>
            Add callers ({handles.length}/{MAX_CALLERS})
          </div>

          {/* Handle chips */}
          {handles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {handles.map((h) => (
                <span
                  key={h}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded"
                  style={{
                    backgroundColor: errors[h] ? "rgba(231,76,60,0.1)" : "rgba(59,130,246,0.1)",
                    border: errors[h] ? "1px solid #e74c3c" : "1px solid #3b82f6",
                    color: errors[h] ? "#e74c3c" : "#c8c8d0",
                  }}
                >
                  @{h}
                  {loading[h] && <span className="animate-pulse">...</span>}
                  {errors[h] && (
                    <span className="text-[10px] text-[#e74c3c]" title={errors[h]}>
                      !
                    </span>
                  )}
                  <button
                    onClick={() => removeHandle(h)}
                    className="ml-1 text-[#555568] hover:text-[#e74c3c] transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addHandle(input);
                }
              }}
              placeholder={handles.length >= MAX_CALLERS ? "Max 5 callers" : "@handle or handle"}
              disabled={handles.length >= MAX_CALLERS}
              className="flex-1 bg-[#0a0a1a] border border-[#1a1a2e] text-[#f0f0f0] rounded px-4 py-2.5 text-sm font-mono focus:border-[#3b82f6] outline-none placeholder:text-[#555568] disabled:opacity-40"
            />
            <button
              onClick={() => addHandle(input)}
              disabled={!input.trim() || handles.length >= MAX_CALLERS}
              className="px-4 py-2.5 rounded text-sm font-mono font-bold transition text-[#3b82f6] disabled:opacity-40"
              style={{ border: "1px solid #3b82f6" }}
            >
              Add
            </button>
          </div>

          {/* Quick add from leaderboard */}
          <p className="text-[10px] mt-2" style={{ color: "#555568" }}>
            Try callers from the{" "}
            <Link href="/leaderboard" className="hover:text-[#c8c8d0] transition-colors" style={{ color: "#3b82f6" }}>
              leaderboard
            </Link>
          </p>
        </div>

        {/* Timeframe + Simulate */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2 font-mono">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className="text-xs px-3 py-1.5 rounded transition"
                style={{
                  border: "1px solid " + (timeframe === tf.value ? "#3b82f6" : "#1a1a2e"),
                  color: timeframe === tf.value ? "#3b82f6" : "#555568",
                  backgroundColor: timeframe === tf.value ? "rgba(59,130,246,0.1)" : "transparent",
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
          <button
            onClick={simulate}
            disabled={handles.length === 0 || anyLoading}
            className="ml-auto px-6 py-2.5 rounded font-mono text-sm font-bold transition text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#3b82f6" }}
          >
            {anyLoading ? "Simulating..." : "Simulate"}
          </button>
        </div>

        {/* Error messages */}
        {Object.entries(errors).length > 0 && (
          <div className="mb-6 font-mono">
            {Object.entries(errors).map(([handle, err]) => (
              <div key={handle} className="text-xs mb-1" style={{ color: "#e74c3c" }}>
                @{handle}: {err}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {simulated && results.length > 0 && (
          <>
            <CombinedStats results={results} />
            <div className={`grid gap-4 ${results.length === 1 ? "grid-cols-1 max-w-sm" : results.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {results.map((result) => (
                <CallerCard
                  key={result.handle}
                  result={result}
                  isWinner={result.handle === winnerHandle && results.length > 1}
                  onRemove={() => removeHandle(result.handle)}
                />
              ))}
            </div>

            <div className="mt-8 text-center">
              <p className="text-[11px] font-mono" style={{ color: "#555568" }}>
                Simulation based on $10,000 base capital with $1,000 per trade, {timeframe} timeframe.
                Past performance is not indicative of future results.
              </p>
              <div className="mt-3 flex justify-center gap-6">
                <Link
                  href="/leaderboard"
                  className="text-xs font-mono hover:text-[#c8c8d0] transition-colors"
                  style={{ color: "#3b82f6" }}
                >
                  View Full Leaderboard &rarr;
                </Link>
                <Link
                  href="/signals"
                  className="text-xs font-mono hover:text-[#c8c8d0] transition-colors"
                  style={{ color: "#3b82f6" }}
                >
                  View Live Signals &rarr;
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {simulated && results.length === 0 && !anyLoading && (
          <div
            className="rounded-lg p-8 text-center font-mono"
            style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
          >
            <p className="text-sm mb-2" style={{ color: "#555568" }}>
              No resolved trade data found for the selected callers in this timeframe.
            </p>
            <p className="text-xs" style={{ color: "#555568" }}>
              Try extending the timeframe or adding different callers.
            </p>
          </div>
        )}

        {/* Default state: example callout */}
        {!simulated && (
          <div
            className="rounded-lg p-6 font-mono"
            style={{ backgroundColor: "#0f0f22", border: "1px solid #1a1a2e" }}
          >
            <p className="text-[11px] uppercase tracking-widest mb-3" style={{ color: "#555568" }}>
              How it works
            </p>
            <div className="space-y-2 text-xs" style={{ color: "#c8c8d0" }}>
              <p>1. Add up to 5 CT caller handles from paste.trade</p>
              <p>2. Choose a lookback window (7d, 30d, 90d)</p>
              <p>3. See what $10,000 per caller would have returned following their closed trades</p>
              <p>4. Compare callers side by side — find who deserves your attention</p>
            </div>
            <p className="text-[10px] mt-4" style={{ color: "#555568" }}>
              Uses $1,000 flat bet per trade on a $10,000 base. Closed trades only.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
