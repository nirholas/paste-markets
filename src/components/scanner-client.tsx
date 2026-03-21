"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { ScanResult, DetectedCall } from "@/lib/scan-processor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentScan {
  jobId: string;
  handle: string;
  callsFound: number;
  winRate: number | null;
}

interface JobStatus {
  status: "queued" | "running" | "complete" | "failed";
  progress: { tweetsScanned: number; callsFound: number };
  result: ScanResult | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PnlBadge({ value }: { value?: number }) {
  if (value == null) return <span className="text-[#555568]">--</span>;
  const color = value >= 0 ? "text-[#2ecc71]" : "text-[#e74c3c]";
  return (
    <span className={`font-mono font-bold ${color}`}>
      {value >= 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function DirectionBadge({ dir }: { dir: string }) {
  if (dir === "long")
    return <span className="text-[#2ecc71] text-xs font-bold uppercase">LONG</span>;
  if (dir === "short")
    return <span className="text-[#e74c3c] text-xs font-bold uppercase">SHORT</span>;
  return <span className="text-[#555568] text-xs uppercase">{dir}</span>;
}

function ConfidenceBar({ value }: { value: number }) {
  const filled = Math.round(value * 10);
  const empty = 10 - filled;
  const color =
    value >= 0.8 ? "text-[#2ecc71]" : value >= 0.6 ? "text-[#f39c12]" : "text-[#555568]";
  return (
    <span className={`font-mono text-xs ${color}`}>
      {"█".repeat(filled)}
      <span className="text-[#1a1a2e]">{"█".repeat(empty)}</span>
    </span>
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

function CallRow({ call, index }: { call: DetectedCall; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const date = call.tweetDate
    ? new Date(call.tweetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
    : "–";

  return (
    <div
      className={`border-b border-[#1a1a2e] ${index % 2 === 0 ? "bg-[#0a0a1a]" : "bg-[#0f0f22]"}`}
    >
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#0f0f22] transition-colors"
      >
        {/* Ticker + direction */}
        <span className="text-[#f0f0f0] font-bold font-mono w-16 shrink-0">
          ${call.detectedCall.ticker}
        </span>
        <DirectionBadge dir={call.detectedCall.direction} />

        {/* Confidence */}
        <span className="hidden sm:block">
          <ConfidenceBar value={call.detectedCall.confidence} />
        </span>

        {/* Date */}
        <span className="text-[#555568] text-xs font-mono ml-auto shrink-0">{date}</span>

        {/* PnL */}
        <span className="w-20 text-right shrink-0">
          <PnlBadge value={call.pnlPercent} />
        </span>

        {/* Expand indicator */}
        <span className="text-[#555568] text-xs w-4 shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 text-sm border-t border-[#1a1a2e] pt-3">
          <p className="text-[#c8c8d0] leading-relaxed">{call.tweetText}</p>
          <div className="flex flex-wrap gap-4 text-xs text-[#555568]">
            <span>Market: {call.detectedCall.market}</span>
            {call.priceAtTweet != null && (
              <span>Entry: ${call.priceAtTweet.toLocaleString()}</span>
            )}
            {call.currentPrice != null && (
              <span>Now: ${call.currentPrice.toLocaleString()}</span>
            )}
          </div>
          <div className="flex gap-3">
            <a
              href={call.tweetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3b82f6] hover:underline"
            >
              View tweet →
            </a>
            {call.pasteTradeCardUrl && (
              <a
                href={call.pasteTradeCardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#f39c12] hover:underline"
              >
                paste.trade card →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsPanel({ result, handle }: { result: ScanResult; handle: string }) {
  const { stats, calls } = result;
  const hasStats = calls.some((c) => c.pnlPercent != null);
  const isJimCramer = hasStats && stats.inversePerformance > 20;

  const winRateColor: "green" | "red" | "amber" =
    stats.winRate >= 55 ? "green" : stats.winRate >= 40 ? "amber" : "red";

  const shareText = encodeURIComponent(
    `@${handle} has a ${stats.winRate.toFixed(0)}% win rate on ${result.callsFound} detected trade calls. Scan any CT caller at paste.markets/scan`,
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-[#f0f0f0]">@{handle}</h2>
            <p className="text-[#555568] text-xs mt-1">
              {result.tweetsScanned} tweets scanned · {result.callsFound} trade calls detected
            </p>
          </div>
          {isJimCramer && (
            <div className="bg-[#e74c3c]/10 border border-[#e74c3c]/30 rounded-lg px-4 py-2 text-center">
              <p className="text-[#e74c3c] text-xs font-bold uppercase tracking-widest">
                Jim Cramer Score
              </p>
              <p className="text-[#e74c3c] text-2xl font-bold font-mono">
                +{stats.inversePerformance.toFixed(0)}%
              </p>
              <p className="text-[#555568] text-xs mt-1">fade everything they say</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Win Rate"
          value={hasStats ? `${stats.winRate.toFixed(0)}%` : "–"}
          sub="of calls with data"
          highlight={hasStats ? winRateColor : undefined}
        />
        <StatCard
          label="Avg P&L"
          value={hasStats ? `${stats.avgPnlPercent >= 0 ? "+" : ""}${stats.avgPnlPercent.toFixed(1)}%` : "–"}
          sub="per call"
          highlight={hasStats ? (stats.avgPnlPercent >= 0 ? "green" : "red") : undefined}
        />
        <StatCard
          label="Copy P&L"
          value={hasStats ? `${stats.totalPnlIfFollowed >= 0 ? "+" : ""}${stats.totalPnlIfFollowed.toFixed(0)}%` : "–"}
          sub="if you copied all calls"
          highlight={hasStats ? (stats.totalPnlIfFollowed >= 0 ? "green" : "red") : undefined}
        />
        <StatCard
          label="Fade P&L"
          value={hasStats ? `${stats.inversePerformance >= 0 ? "+" : ""}${stats.inversePerformance.toFixed(0)}%` : "–"}
          sub="if you faded all calls"
          highlight={hasStats ? (stats.inversePerformance >= 0 ? "green" : "red") : undefined}
        />
      </div>

      {/* Best / Worst */}
      {hasStats && (stats.bestCall || stats.worstCall) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.bestCall && (
            <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
              <p className="text-[#555568] text-xs uppercase tracking-widest mb-2">Best Call</p>
              <p className="text-[#f0f0f0] font-bold">
                ${stats.bestCall.detectedCall.ticker}{" "}
                <DirectionBadge dir={stats.bestCall.detectedCall.direction} />
              </p>
              <p className="text-[#2ecc71] font-bold font-mono text-lg">
                +{(stats.bestCall.pnlPercent ?? 0).toFixed(1)}%
              </p>
              <a
                href={stats.bestCall.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#3b82f6] hover:underline mt-1 block"
              >
                View tweet →
              </a>
            </div>
          )}
          {stats.worstCall && (
            <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-4">
              <p className="text-[#555568] text-xs uppercase tracking-widest mb-2">Worst Call</p>
              <p className="text-[#f0f0f0] font-bold">
                ${stats.worstCall.detectedCall.ticker}{" "}
                <DirectionBadge dir={stats.worstCall.detectedCall.direction} />
              </p>
              <p className="text-[#e74c3c] font-bold font-mono text-lg">
                {(stats.worstCall.pnlPercent ?? 0).toFixed(1)}%
              </p>
              <a
                href={stats.worstCall.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#3b82f6] hover:underline mt-1 block"
              >
                View tweet →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Calls table */}
      {calls.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-[#555568]">
              Detected Calls ({calls.length})
            </h3>
            {/* Column headers */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-[#555568] pr-8">
              <span className="w-16">Ticker</span>
              <span>Dir</span>
              <span>Confidence</span>
              <span className="ml-auto">Date</span>
              <span className="w-20 text-right">P&L</span>
            </div>
          </div>
          <div className="border border-[#1a1a2e] rounded-lg overflow-hidden">
            {calls.map((call, i) => (
              <CallRow key={call.tweetId} call={call} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 text-center">
          <p className="text-[#555568] text-sm">
            No trade calls detected with confidence &ge; 70%.
          </p>
          <p className="text-[#555568] text-xs mt-1">
            This account may post general commentary rather than specific trade calls.
          </p>
        </div>
      )}

      {/* Share + profile links */}
      <div className="flex gap-3 flex-wrap">
        <a
          href={`https://twitter.com/intent/tweet?text=${shareText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-[#1a1a2e] hover:border-[#3b82f6] rounded-lg px-4 py-2 text-sm font-bold text-[#f0f0f0] transition-colors"
        >
          Tweet these results
        </a>
        <Link
          href={`/${handle}`}
          className="border border-[#1a1a2e] hover:border-[#3b82f6] rounded-lg px-4 py-2 text-sm font-bold text-[#f0f0f0] transition-colors"
        >
          paste.markets profile →
        </Link>
      </div>

      <p className="text-[#555568] text-xs text-center border-t border-[#1a1a2e] pt-4">
        Trade detection is AI-based and may miss calls or produce false positives. Not financial
        advice.
      </p>
    </div>
  );
}

function ProgressState({
  progress,
}: {
  progress: { tweetsScanned: number; callsFound: number };
}) {
  const pct = Math.min(100, Math.round((progress.tweetsScanned / 200) * 100));
  return (
    <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-[#3b82f6] text-sm animate-pulse">▶</span>
        <span className="text-[#c8c8d0] text-sm font-mono">Scanning tweets...</span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-[#555568] mb-1">
          <span>
            {progress.tweetsScanned} / 200 tweets
          </span>
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
        <span className="text-[#f39c12] font-bold">{progress.callsFound}</span> potential trade
        calls so far...
      </p>

      <p className="text-[#555568] text-xs">
        This takes 30–90 seconds depending on how prolific the account is.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface ScannerClientProps {
  recentScans: RecentScan[];
}

type ScanState =
  | { phase: "idle" }
  | { phase: "loading"; handle: string }
  | { phase: "polling"; handle: string; jobId: string; progress: { tweetsScanned: number; callsFound: number } }
  | { phase: "done"; handle: string; result: ScanResult }
  | { phase: "error"; message: string };

export function ScannerClient({ recentScans }: ScannerClientProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<ScanState>({ phase: "idle" });
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
        const res = await fetch(`/api/scan/${jobId}`);
        if (!res.ok) return;

        const data = (await res.json()) as JobStatus;

        if (data.status === "complete" && data.result) {
          stopPolling();
          setState({ phase: "done", handle, result: data.result });
        } else if (data.status === "failed") {
          stopPolling();
          setState({ phase: "error", message: data.error ?? "Scan failed. Please try again." });
        } else {
          setState({
            phase: "polling",
            handle,
            jobId,
            progress: data.progress ?? { tweetsScanned: 0, callsFound: 0 },
          });
        }
      } catch {
        // keep polling on transient errors
      }
    },
    [stopPolling],
  );

  const startScan = async (handleRaw: string) => {
    const handle = handleRaw.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return;

    stopPolling();
    setState({ phase: "loading", handle });

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      const data = (await res.json()) as { jobId?: string; status?: string; error?: string; details?: string };

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

      // If already cached+complete, fetch results immediately
      if (status === "complete") {
        const jobRes = await fetch(`/api/scan/${jobId}`);
        const jobData = (await jobRes.json()) as JobStatus;
        if (jobData.result) {
          setState({ phase: "done", handle, result: jobData.result });
          return;
        }
      }

      setState({
        phase: "polling",
        handle,
        jobId,
        progress: { tweetsScanned: 0, callsFound: 0 },
      });

      // Poll every 2 seconds
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
    startScan(input);
  };

  const handleReset = () => {
    stopPolling();
    setState({ phase: "idle" });
    setInput("");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-16 pb-20">
      {/* Header */}
      <section className="mb-10">
        <p className="text-[#3b82f6] text-xs font-bold uppercase tracking-widest mb-2">
          Bulk Caller Scan
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-[#f0f0f0] mb-2">
          Scan Any CT Caller
        </h1>
        <p className="text-[#c8c8d0] text-sm">
          Enter any Twitter handle. We scan their last 200 tweets, detect trade calls, and score
          every one with real P&L.
        </p>
      </section>

      {/* Input form — always visible */}
      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555568] text-sm select-none">
            @
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ZssBecker"
            disabled={state.phase === "loading" || state.phase === "polling"}
            className="w-full bg-[#0f0f22] border border-[#1a1a2e] rounded-lg pl-7 pr-4 py-3 text-[#f0f0f0] text-sm placeholder:text-[#555568] focus:outline-none focus:border-[#3b82f6] transition-colors disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={
            !input.trim() || state.phase === "loading" || state.phase === "polling"
          }
          className="border border-[#3b82f6] rounded-lg px-5 py-3 text-sm font-bold text-[#3b82f6] hover:bg-[#3b82f6] hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {state.phase === "loading" || state.phase === "polling" ? "Scanning..." : "Scan Calls"}
        </button>
      </form>

      {/* State panels */}
      {state.phase === "loading" && (
        <div className="bg-[#0f0f22] border border-[#1a1a2e] rounded-lg p-6 mb-8">
          <p className="text-[#c8c8d0] text-sm animate-pulse">
            Starting scan for @{state.handle}...
          </p>
        </div>
      )}

      {state.phase === "polling" && (
        <div className="mb-8">
          <ProgressState progress={state.progress} />
        </div>
      )}

      {state.phase === "error" && (
        <div className="bg-[#0f0f22] border border-[#e74c3c]/30 rounded-lg p-6 mb-8">
          <p className="text-[#e74c3c] text-sm font-bold mb-1">Scan failed</p>
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
        <div className="mb-8">
          <button
            onClick={handleReset}
            className="text-xs text-[#555568] hover:text-[#c8c8d0] transition-colors mb-6 block"
          >
            ← Scan another account
          </button>
          <ResultsPanel result={state.result} handle={state.handle} />
        </div>
      )}

      {/* Recent scans — social proof */}
      {recentScans.length > 0 && state.phase === "idle" && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-widest text-[#555568] mb-4">
            Recent Scans
          </h2>
          <div className="border-t border-[#1a1a2e]">
            {recentScans.map((scan) => (
              <button
                key={scan.jobId}
                onClick={() => {
                  setInput(scan.handle);
                  startScan(scan.handle);
                }}
                className="w-full flex items-center justify-between py-3 border-b border-[#1a1a2e] hover:bg-[#0f0f22]/50 transition-colors px-2 -mx-2 text-left"
              >
                <span className="text-[#c8c8d0] text-sm">@{scan.handle}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-[#555568] text-xs">
                    {scan.callsFound} calls
                  </span>
                  {scan.winRate != null && (
                    <span
                      className={`text-xs font-bold font-mono ${scan.winRate >= 55 ? "text-[#2ecc71]" : scan.winRate >= 40 ? "text-[#f39c12]" : "text-[#e74c3c]"}`}
                    >
                      {scan.winRate.toFixed(0)}% WR
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Rate limit note */}
      <p className="text-[#555568] text-xs text-center mt-8">
        Max 3 scans per hour · Results cached for 6 hours
      </p>
    </div>
  );
}
