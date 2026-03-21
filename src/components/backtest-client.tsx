"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BacktestReport, BacktestCall } from "@/lib/backtest-processor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobStatus {
  jobId: string;
  handle: string;
  status: "queued" | "scanning" | "analyzing" | "complete" | "failed";
  progress: {
    phase: string;
    tweetsScanned: number;
    totalTweets: number;
    callsFound: number;
  };
  result: BacktestReport | null;
  error: string | null;
}

type PageState =
  | { phase: "input" }
  | { phase: "loading"; handle: string }
  | { phase: "polling"; handle: string; jobId: string; progress: JobStatus["progress"] }
  | { phase: "done"; handle: string; report: BacktestReport }
  | { phase: "error"; message: string };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PnlBadge({ value, size = "base" }: { value: number; size?: "base" | "lg" | "xl" }) {
  const color = value >= 0 ? "text-[#2ecc71]" : "text-[#e74c3c]";
  const sizeClass = size === "xl" ? "text-3xl" : size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className={`font-mono font-bold ${color} ${sizeClass}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function GradeBadge({ grade, label }: { grade: string; label: string }) {
  const colorMap: Record<string, string> = {
    S: "text-[#f39c12] border-[#f39c12]/30 bg-[#f39c12]/10",
    A: "text-[#2ecc71] border-[#2ecc71]/30 bg-[#2ecc71]/10",
    B: "text-[#3b82f6] border-[#3b82f6]/30 bg-[#3b82f6]/10",
    C: "text-[#c8c8d0] border-[#555568]/30 bg-[#555568]/10",
    D: "text-[#e74c3c] border-[#e74c3c]/30 bg-[#e74c3c]/10",
    F: "text-[#e74c3c] border-[#e74c3c]/30 bg-[#e74c3c]/10",
  };
  const classes = colorMap[grade] ?? colorMap.C;
  return (
    <div className={`border rounded-lg px-5 py-3 text-center ${classes}`}>
      <p className="text-xs font-bold uppercase tracking-widest mb-1">Grade</p>
      <p className="text-4xl font-bold font-mono">{grade}</p>
      <p className="text-xs mt-1 opacity-80">{label}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "red" | "blue" | "amber";
}) {
  const colorMap = {
    green: "text-[#2ecc71]",
    red: "text-[#e74c3c]",
    blue: "text-[#3b82f6]",
    amber: "text-[#f39c12]",
  };
  const valueColor = highlight ? colorMap[highlight] : "text-[#f0f0f0]";
  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
      <p className="text-[#555568] text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${valueColor}`}>{value}</p>
      {sub && <p className="text-[#555568] text-xs mt-1">{sub}</p>}
    </div>
  );
}

function PhaseLabel({ phase }: { phase: string }) {
  const labels: Record<string, string> = {
    fetching_tweets: "Fetching tweets...",
    detecting_calls: "Detecting trade calls...",
    pricing: "Getting historical prices...",
    aggregating: "Generating report...",
  };
  return (
    <span className="text-[#c8c8d0] text-sm font-mono">
      {labels[phase] ?? phase}
    </span>
  );
}

function ProgressPanel({ progress }: { progress: JobStatus["progress"] }) {
  const total = progress.totalTweets || 800;
  const pct = Math.min(100, Math.round((progress.tweetsScanned / total) * 100));
  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-[#3b82f6] text-sm animate-pulse">&#9654;</span>
        <PhaseLabel phase={progress.phase} />
      </div>

      <div>
        <div className="flex justify-between text-xs text-[#555568] mb-1">
          <span>{progress.tweetsScanned} / {total} tweets</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-[#1a1a2e] rounded-full h-1.5">
          <div
            className="bg-[#3b82f6] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="text-[#555568] text-xs">
        Found{" "}
        <span className="text-[#f39c12] font-bold">{progress.callsFound}</span>{" "}
        trade calls so far...
      </p>

      <p className="text-[#555568] text-xs">
        Full backtest takes 2-5 minutes depending on tweet history depth.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Follow vs Fade comparison
// ---------------------------------------------------------------------------

function FollowFadeComparison({ report }: { report: BacktestReport }) {
  const { follow, fade } = report;
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-5">
        <p className="text-xs uppercase tracking-widest text-[#555568] mb-3">Follow</p>
        <div className="space-y-3">
          <div>
            <p className="text-[#555568] text-xs">Win Rate</p>
            <p className={`text-xl font-bold font-mono ${follow.winRate >= 50 ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
              {follow.winRate.toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-[#555568] text-xs">Avg P&L</p>
            <PnlBadge value={follow.avgPnlPercent} size="lg" />
          </div>
          <div>
            <p className="text-[#555568] text-xs">Cumulative</p>
            <PnlBadge value={follow.cumulativePnl} size="lg" />
          </div>
          <div className="pt-2 border-t border-[#1a1a2e]">
            <p className={`text-sm font-bold ${follow.cumulativePnl >= 0 ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
              {follow.cumulativePnl >= fade.cumulativePnl ? "FOLLOW" : "DON'T FOLLOW"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-5">
        <p className="text-xs uppercase tracking-widest text-[#555568] mb-3">Fade</p>
        <div className="space-y-3">
          <div>
            <p className="text-[#555568] text-xs">Win Rate</p>
            <p className={`text-xl font-bold font-mono ${fade.winRate >= 50 ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
              {fade.winRate.toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-[#555568] text-xs">Avg P&L</p>
            <PnlBadge value={fade.avgPnlPercent} size="lg" />
          </div>
          <div>
            <p className="text-[#555568] text-xs">Cumulative</p>
            <PnlBadge value={fade.cumulativePnl} size="lg" />
          </div>
          <div className="pt-2 border-t border-[#1a1a2e]">
            <p className={`text-sm font-bold ${fade.cumulativePnl > follow.cumulativePnl ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
              {fade.cumulativePnl > follow.cumulativePnl ? "FADE" : "DON'T FADE"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly chart (simple bar chart with divs)
// ---------------------------------------------------------------------------

function MonthlyChart({ months }: { months: BacktestReport["byMonth"] }) {
  if (months.length === 0) return null;
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.pnl)), 1);

  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-[#555568] mb-3">
        Monthly Performance
      </h3>
      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
        <div className="flex items-end gap-1" style={{ height: "120px" }}>
          {months.map((m) => {
            const heightPct = Math.max(5, (Math.abs(m.pnl) / maxAbs) * 100);
            const isPositive = m.pnl >= 0;
            return (
              <div
                key={m.month}
                className="flex-1 flex flex-col items-center justify-end h-full"
              >
                <div
                  className={`w-full rounded-t ${isPositive ? "bg-[#2ecc71]" : "bg-[#e74c3c]"}`}
                  style={{ height: `${heightPct}%`, minHeight: "4px" }}
                  title={`${m.month}: ${m.pnl >= 0 ? "+" : ""}${m.pnl.toFixed(1)}% (${m.calls} calls)`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {months.map((m) => (
            <div key={m.month} className="flex-1 text-center">
              <span className="text-[8px] text-[#555568]">
                {m.month.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Asset breakdown table
// ---------------------------------------------------------------------------

function AssetTable({ assets }: { assets: BacktestReport["byAsset"] }) {
  if (assets.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-[#555568] mb-3">
        Asset Breakdown
      </h3>
      <div className="border border-[#1a1a2e] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#555568] text-xs uppercase tracking-widest border-b border-[#1a1a2e]">
              <th className="text-left px-4 py-2">Ticker</th>
              <th className="text-right px-4 py-2">Calls</th>
              <th className="text-right px-4 py-2">Win Rate</th>
              <th className="text-right px-4 py-2">Avg P&L</th>
            </tr>
          </thead>
          <tbody>
            {assets.slice(0, 20).map((a, i) => (
              <tr
                key={a.ticker}
                className={`border-b border-[#1a1a2e] ${i % 2 === 0 ? "bg-[#0a0a1a]" : "bg-[#0f0f22]"}`}
              >
                <td className="px-4 py-2 font-bold text-[#f0f0f0] font-mono">{a.ticker}</td>
                <td className="px-4 py-2 text-right text-[#c8c8d0]">{a.calls}</td>
                <td className={`px-4 py-2 text-right font-mono ${a.winRate >= 50 ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
                  {a.winRate.toFixed(0)}%
                </td>
                <td className={`px-4 py-2 text-right font-mono ${a.avgPnl >= 0 ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
                  {a.avgPnl >= 0 ? "+" : ""}{a.avgPnl.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full call history table (anti-cherry-pick — ALL calls shown)
// ---------------------------------------------------------------------------

type SortKey = "date" | "pnl" | "ticker" | "confidence";
type SortDir = "asc" | "desc";

function CallHistoryTable({ calls }: { calls: BacktestCall[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...calls].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "date":
        cmp = a.tweetDate.localeCompare(b.tweetDate);
        break;
      case "pnl":
        cmp = a.pnlPercent - b.pnlPercent;
        break;
      case "ticker":
        cmp = a.ticker.localeCompare(b.ticker);
        break;
      case "confidence":
        cmp = a.confidence - b.confidence;
        break;
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-[#555568] mb-1">
        All Calls ({calls.length}) — Full Transparency
      </h3>
      <p className="text-[#555568] text-xs mb-3">
        Every detected call is shown. No filtering, no cherry-picking.
      </p>
      <div className="border border-[#1a1a2e] rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-[#555568] text-xs uppercase tracking-widest border-b border-[#1a1a2e]">
              <th
                className="text-left px-3 py-2 cursor-pointer hover:text-[#c8c8d0]"
                onClick={() => toggleSort("date")}
              >
                Date{arrow("date")}
              </th>
              <th
                className="text-left px-3 py-2 cursor-pointer hover:text-[#c8c8d0]"
                onClick={() => toggleSort("ticker")}
              >
                Ticker{arrow("ticker")}
              </th>
              <th className="text-left px-3 py-2">Dir</th>
              <th className="text-left px-3 py-2">Tweet</th>
              <th className="text-right px-3 py-2">Entry</th>
              <th className="text-right px-3 py-2">Now</th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-[#c8c8d0]"
                onClick={() => toggleSort("pnl")}
              >
                P&L{arrow("pnl")}
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer hover:text-[#c8c8d0]"
                onClick={() => toggleSort("confidence")}
              >
                Conf{arrow("confidence")}
              </th>
              <th className="text-right px-3 py-2">Platform</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((call, i) => {
              const date = new Date(call.tweetDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "2-digit",
              });
              return (
                <tr
                  key={call.tweetId}
                  className={`border-b border-[#1a1a2e] ${i % 2 === 0 ? "bg-[#0a0a1a]" : "bg-[#0f0f22]"}`}
                >
                  <td className="px-3 py-2 text-[#555568] font-mono text-xs whitespace-nowrap">
                    {date}
                  </td>
                  <td className="px-3 py-2 font-bold text-[#f0f0f0] font-mono">
                    {call.ticker}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-bold uppercase ${call.direction === "long" ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
                      {call.direction === "long" ? "LONG" : "SHORT"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#c8c8d0] text-xs max-w-[200px] truncate">
                    <a
                      href={call.tweetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#3b82f6] transition-colors"
                      title={call.tweetText}
                    >
                      {call.tweetText.slice(0, 80)}{call.tweetText.length > 80 ? "..." : ""}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right text-[#c8c8d0] font-mono text-xs">
                    ${call.priceAtTweet.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right text-[#c8c8d0] font-mono text-xs">
                    ${call.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PnlBadge value={call.pnlPercent} />
                  </td>
                  <td className="px-3 py-2 text-right text-[#555568] font-mono text-xs">
                    {(call.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right text-[#555568] text-xs uppercase">
                    {call.platform}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report panel
// ---------------------------------------------------------------------------

function ReportPanel({ report, onReset }: { report: BacktestReport; onReset: () => void }) {
  const { follow, fade } = report;
  const dateFrom = new Date(report.dateRange.from).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const dateTo = new Date(report.dateRange.to).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  const shareText = encodeURIComponent(
    `@${report.handle} backtest: Grade ${report.grade} (${report.gradeLabel})\n\n${follow.winRate.toFixed(0)}% win rate | ${follow.totalCalls} calls | ${follow.avgPnlPercent >= 0 ? "+" : ""}${follow.avgPnlPercent.toFixed(1)}% avg P&L${report.jimCramerScore ? "\n\nJim Cramer Alert: fading beats following!" : ""}\n\npaste.markets/backtest/${report.handle}`,
  );

  return (
    <div className="space-y-6">
      <button
        onClick={onReset}
        className="text-xs text-[#555568] hover:text-[#c8c8d0] transition-colors"
      >
        &larr; Backtest another account
      </button>

      {/* Hero + Grade */}
      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-[#f0f0f0]">@{report.handle}</h2>
            <p className="text-[#555568] text-xs mt-1">
              {follow.totalCalls} calls found across {report.tweetsCovered} tweets ({dateFrom} &mdash; {dateTo})
            </p>
          </div>
          <GradeBadge grade={report.grade} label={report.gradeLabel} />
        </div>
      </div>

      {/* Jim Cramer alert */}
      {report.jimCramerScore && (
        <div className="bg-[#e74c3c]/10 border border-[#e74c3c]/30 rounded-lg px-5 py-4">
          <p className="text-[#e74c3c] font-bold text-sm mb-1">
            JIM CRAMER ALERT &mdash; Fading this account beats following!
          </p>
          <p className="text-[#c8c8d0] text-xs">
            Fade win rate: {fade.winRate.toFixed(0)}% | Fade cumulative:{" "}
            {fade.cumulativePnl >= 0 ? "+" : ""}{fade.cumulativePnl.toFixed(0)}%
          </p>
        </div>
      )}

      {/* Follow vs Fade */}
      <FollowFadeComparison report={report} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Calls"
          value={String(follow.totalCalls)}
          highlight="blue"
        />
        <StatCard
          label="Sharpe (approx)"
          value={follow.sharpeApprox.toFixed(2)}
          highlight={follow.sharpeApprox >= 0.5 ? "green" : follow.sharpeApprox >= 0 ? "amber" : "red"}
        />
        <StatCard
          label="Max Drawdown"
          value={`-${follow.maxDrawdown.toFixed(1)}%`}
          highlight="red"
        />
        <StatCard
          label="Streaks"
          value={`W${follow.winStreak} / L${follow.lossStreak}`}
          sub="longest win / loss"
        />
      </div>

      {/* Best / Worst */}
      {(follow.bestCall || follow.worstCall) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {follow.bestCall && (
            <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
              <p className="text-[#555568] text-xs uppercase tracking-widest mb-2">Best Call</p>
              <p className="text-[#f0f0f0] font-bold">
                {follow.bestCall.ticker}{" "}
                <span className={`text-xs ${follow.bestCall.direction === "long" ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
                  {follow.bestCall.direction.toUpperCase()}
                </span>
              </p>
              <PnlBadge value={follow.bestCall.pnlPercent} size="lg" />
              <a
                href={follow.bestCall.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#3b82f6] hover:underline mt-1 block"
              >
                View tweet &rarr;
              </a>
            </div>
          )}
          {follow.worstCall && (
            <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
              <p className="text-[#555568] text-xs uppercase tracking-widest mb-2">Worst Call</p>
              <p className="text-[#f0f0f0] font-bold">
                {follow.worstCall.ticker}{" "}
                <span className={`text-xs ${follow.worstCall.direction === "long" ? "text-[#2ecc71]" : "text-[#e74c3c]"}`}>
                  {follow.worstCall.direction.toUpperCase()}
                </span>
              </p>
              <PnlBadge value={follow.worstCall.pnlPercent} size="lg" />
              <a
                href={follow.worstCall.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#3b82f6] hover:underline mt-1 block"
              >
                View tweet &rarr;
              </a>
            </div>
          )}
        </div>
      )}

      {/* Monthly chart */}
      <MonthlyChart months={report.byMonth} />

      {/* Asset breakdown */}
      <AssetTable assets={report.byAsset} />

      {/* Full call history */}
      <CallHistoryTable calls={report.calls} />

      {/* Share CTAs */}
      <div className="flex gap-3 flex-wrap">
        <a
          href={`https://twitter.com/intent/tweet?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-[#1a1a2e] hover:border-[#3b82f6] rounded-lg px-4 py-2 text-sm font-bold text-[#f0f0f0] transition-colors"
        >
          Share Report
        </a>
      </div>

      <p className="text-[#555568] text-xs text-center border-t border-[#1a1a2e] pt-4">
        Trade detection is AI-based and may miss calls or produce false positives.
        Every detected call is shown — no cherry-picking. Not financial advice.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface BacktestClientProps {
  initialHandle?: string;
  cachedReport?: BacktestReport | null;
}

export function BacktestClient({ initialHandle, cachedReport }: BacktestClientProps) {
  const [input, setInput] = useState(initialHandle ?? "");
  const [state, setState] = useState<PageState>(
    cachedReport && initialHandle
      ? { phase: "done", handle: initialHandle, report: cachedReport }
      : { phase: "input" },
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollJob = useCallback(
    async (jobId: string, handle: string) => {
      try {
        const res = await fetch(`/api/backtest/${jobId}`);
        if (!res.ok) return;

        const data = (await res.json()) as JobStatus;

        if (data.status === "complete" && data.result) {
          stopPolling();
          setState({ phase: "done", handle, report: data.result });
          // Update URL without navigation
          window.history.replaceState(null, "", `/backtest/${handle}`);
        } else if (data.status === "failed") {
          stopPolling();
          setState({ phase: "error", message: data.error ?? "Backtest failed. Please try again." });
        } else {
          setState({
            phase: "polling",
            handle,
            jobId,
            progress: data.progress ?? { phase: "fetching_tweets", tweetsScanned: 0, totalTweets: 0, callsFound: 0 },
          });
        }
      } catch {
        // keep polling on transient errors
      }
    },
    [stopPolling],
  );

  const startBacktest = async (handleRaw: string) => {
    const handle = handleRaw.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return;

    stopPolling();
    setState({ phase: "loading", handle });

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      const data = (await res.json()) as {
        jobId?: string;
        status?: string;
        error?: string;
        details?: string;
      };

      if (!res.ok) {
        setState({
          phase: "error",
          message: data.details ?? data.error ?? `Request failed (${res.status})`,
        });
        return;
      }

      const { jobId, status } = data;
      if (!jobId) {
        setState({ phase: "error", message: "No job ID returned." });
        return;
      }

      // Update URL
      window.history.replaceState(null, "", `/backtest/${handle}`);

      // If already cached+complete, fetch results immediately
      if (status === "complete") {
        const jobRes = await fetch(`/api/backtest/${jobId}`);
        const jobData = (await jobRes.json()) as JobStatus;
        if (jobData.result) {
          setState({ phase: "done", handle, report: jobData.result });
          return;
        }
      }

      setState({
        phase: "polling",
        handle,
        jobId,
        progress: { phase: "fetching_tweets", tweetsScanned: 0, totalTweets: 0, callsFound: 0 },
      });

      pollRef.current = setInterval(() => pollJob(jobId, handle), 2000);
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Network error. Please try again.",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startBacktest(input);
  };

  const handleReset = () => {
    stopPolling();
    setState({ phase: "input" });
    setInput("");
    window.history.replaceState(null, "", "/backtest");
  };

  const isLoading = state.phase === "loading" || state.phase === "polling";

  return (
    <div className="max-w-3xl mx-auto px-4 pt-16 pb-20">
      {/* Header — always visible */}
      {state.phase !== "done" && (
        <section className="mb-10">
          <p className="text-[#3b82f6] text-xs font-bold uppercase tracking-widest mb-2">
            Bulk Profile Backtest
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-[#f0f0f0] mb-2">
            Backtest Any Twitter Account
          </h1>
          <p className="text-[#c8c8d0] text-sm">
            Full history scan &mdash; every call tracked, no cherry-picking.
            See if following (or fading) any account would have made money.
          </p>
        </section>
      )}

      {/* Input form */}
      {state.phase !== "done" && (
        <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555568] text-sm select-none">
              @
            </span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="jimcramer"
              disabled={isLoading}
              className="w-full bg-[#0f0f22] border border-[#1a1a2e] rounded-lg pl-7 pr-4 py-3 text-[#f0f0f0] text-sm placeholder:text-[#555568] focus:outline-none focus:border-[#3b82f6] transition-colors disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="border border-[#3b82f6] rounded-lg px-5 py-3 text-sm font-bold text-[#3b82f6] hover:bg-[#3b82f6] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLoading ? "Running..." : "Run Backtest"}
          </button>
        </form>
      )}

      {/* State panels */}
      {state.phase === "loading" && (
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 mb-8">
          <p className="text-[#c8c8d0] text-sm animate-pulse">
            Starting backtest for @{state.handle}...
          </p>
        </div>
      )}

      {state.phase === "polling" && (
        <div className="mb-8">
          <ProgressPanel progress={state.progress} />
        </div>
      )}

      {state.phase === "error" && (
        <div className="bg-[#0f0f22] border border-[#e74c3c]/30 rounded-lg p-6 mb-8">
          <p className="text-[#e74c3c] text-sm font-bold mb-1">Backtest failed</p>
          <p className="text-[#c8c8d0] text-sm">{state.message}</p>
          <button
            onClick={handleReset}
            className="mt-4 text-xs text-[#555568] hover:text-[#c8c8d0] transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {state.phase === "done" && (
        <ReportPanel report={state.report} onReset={handleReset} />
      )}

      {/* Footer note */}
      {state.phase === "input" && (
        <p className="text-[#555568] text-xs text-center mt-8">
          Max 3 backtests per hour &middot; Results cached for 24 hours
        </p>
      )}
    </div>
  );
}
