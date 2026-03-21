"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import CallerSelector from "@/components/caller-selector";
import PortfolioChart from "@/components/portfolio-chart";

interface SelectedCaller {
  handle: string;
  winRate?: number;
}

interface PerCaller {
  handle: string;
  trades: number;
  winRate: number;
  pnlDollar: number;
  pnlPct: number;
  weight: number;
}

interface SimResult {
  finalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  timeline: { date: string; value: number }[];
  perCaller: PerCaller[];
  stats: {
    totalTrades: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    bestTrade: { caller: string; ticker: string; pnl_pct: number; dollar: number } | null;
    worstTrade: { caller: string; ticker: string; pnl_pct: number; dollar: number } | null;
  };
  config: {
    callers: string[];
    starting_capital: number;
    timeframe: string;
    allocation: string;
  };
}

const CAPITAL_PRESETS = [1000, 5000, 10000, 50000];
const TIMEFRAME_OPTIONS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatDollar(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

function formatBigDollar(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function SimulatePage() {
  return (
    <Suspense>
      <SimulatePageInner />
    </Suspense>
  );
}

function SimulatePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [callers, setCallers] = useState<SelectedCaller[]>([]);
  const [capital, setCapital] = useState(10000);
  const [customCapital, setCustomCapital] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [timeframe, setTimeframe] = useState("30d");
  const [allocation, setAllocation] = useState<"equal" | "weighted">("equal");
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse URL params on mount
  useEffect(() => {
    const callersParam = searchParams.get("callers");
    const capitalParam = searchParams.get("capital");
    const tfParam = searchParams.get("tf");
    const allocParam = searchParams.get("alloc");

    if (callersParam) {
      const handles = callersParam.split(",").filter(Boolean).slice(0, 10);
      setCallers(handles.map((h) => ({ handle: h })));
    }
    if (capitalParam) {
      const c = parseInt(capitalParam, 10);
      if (!isNaN(c) && c >= 100) {
        setCapital(c);
        if (!CAPITAL_PRESETS.includes(c)) {
          setUseCustom(true);
          setCustomCapital(String(c));
        }
      }
    }
    if (tfParam && ["7d", "30d", "90d", "all"].includes(tfParam)) {
      setTimeframe(tfParam);
    }
    if (allocParam === "weighted") {
      setAllocation("weighted");
    }
  }, [searchParams]);

  const runSimulation = useCallback(async () => {
    if (callers.length === 0) return;

    const cap = useCustom ? parseInt(customCapital, 10) || capital : capital;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callers: callers.map((c) => c.handle),
          starting_capital: cap,
          timeframe,
          allocation,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Simulation failed");
        return;
      }

      const data: SimResult = await res.json();
      setResult(data);

      // Update URL for sharing
      const params = new URLSearchParams();
      params.set("callers", callers.map((c) => c.handle).join(","));
      params.set("capital", String(cap));
      params.set("tf", timeframe);
      if (allocation !== "equal") params.set("alloc", allocation);
      router.replace(`/simulate?${params.toString()}`, { scroll: false });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [callers, capital, customCapital, useCustom, timeframe, allocation, router]);

  const shareUrl = result
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/simulate?callers=${result.config.callers.join(",")}&capital=${result.config.starting_capital}&tf=${result.config.timeframe}${result.config.allocation !== "equal" ? `&alloc=${result.config.allocation}` : ""}`
    : "";

  const handleShare = useCallback(() => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [shareUrl]);

  const effectiveCapital = useCustom ? parseInt(customCapital, 10) || capital : capital;

  return (
    <>
      <main className="min-h-screen bg-bg p-6 font-mono">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-[28px] font-bold text-text-primary tracking-tight">
              Portfolio Simulator
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Pick callers, set your capital, see what would have happened
            </p>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step 1: Select callers */}
            <div className="lg:col-span-3 bg-surface border border-border rounded-lg p-6">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                Step 1 — Select callers
              </div>
              <CallerSelector selected={callers} onChange={setCallers} max={10} />
            </div>

            {/* Step 2: Starting capital */}
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                Step 2 — Starting capital
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {CAPITAL_PRESETS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setCapital(amt); setUseCustom(false); }}
                    className={`py-2 px-3 rounded text-sm transition border ${
                      !useCustom && capital === amt
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-secondary hover:border-accent"
                    }`}
                  >
                    ${(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="Custom amount"
                value={customCapital}
                onChange={(e) => { setCustomCapital(e.target.value); setUseCustom(true); }}
                onFocus={() => setUseCustom(true)}
                className={`w-full bg-bg border rounded px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none transition ${
                  useCustom ? "border-accent" : "border-border focus:border-accent"
                }`}
              />
            </div>

            {/* Step 3: Timeframe */}
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                Step 3 — Timeframe
              </div>
              <div className="space-y-2">
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeframe(opt.value)}
                    className={`w-full text-left py-2 px-3 rounded text-sm transition border ${
                      timeframe === opt.value
                        ? "border-accent text-accent bg-accent/10"
                        : "border-border text-text-secondary hover:border-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Allocation */}
            <div className="bg-surface border border-border rounded-lg p-6">
              <div className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                Allocation strategy
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => setAllocation("equal")}
                  className={`w-full text-left py-2 px-3 rounded text-sm transition border ${
                    allocation === "equal"
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-secondary hover:border-accent"
                  }`}
                >
                  <div className="font-bold">Equal split</div>
                  <div className="text-text-muted text-xs mt-0.5">Split capital evenly across callers</div>
                </button>
                <button
                  onClick={() => setAllocation("weighted")}
                  className={`w-full text-left py-2 px-3 rounded text-sm transition border ${
                    allocation === "weighted"
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-text-secondary hover:border-accent"
                  }`}
                >
                  <div className="font-bold">Weighted</div>
                  <div className="text-text-muted text-xs mt-0.5">More capital to higher win-rate callers</div>
                </button>
              </div>
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runSimulation}
            disabled={callers.length === 0 || loading}
            className={`w-full py-4 rounded-lg text-sm font-bold transition ${
              callers.length === 0
                ? "bg-border text-text-muted cursor-not-allowed"
                : loading
                  ? "bg-accent/50 text-text-primary cursor-wait"
                  : "bg-accent text-white hover:bg-accent/80"
            }`}
          >
            {loading
              ? "Simulating..."
              : callers.length === 0
                ? "Select at least one caller to simulate"
                : `Simulate ${formatBigDollar(effectiveCapital)} across ${callers.length} caller${callers.length > 1 ? "s" : ""}`}
          </button>

          {error && (
            <div className="bg-loss/10 border border-loss/30 rounded-lg px-4 py-3 text-loss text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Big numbers */}
              <div className="bg-surface border border-border rounded-lg p-6">
                <div className="text-[11px] uppercase tracking-widest text-text-muted mb-4">
                  Simulation results
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <div className="text-text-muted text-xs mb-1">Final portfolio value</div>
                    <div className="text-[32px] font-bold text-text-primary leading-none">
                      {formatBigDollar(result.finalValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-text-muted text-xs mb-1">Total P&L</div>
                    <div
                      className={`text-[32px] font-bold leading-none ${
                        result.totalPnl >= 0 ? "text-win" : "text-loss"
                      }`}
                    >
                      {result.totalPnl >= 0 ? "+" : ""}
                      {formatBigDollar(Math.abs(result.totalPnl))}{" "}
                      <span className="text-lg">
                        ({result.totalPnlPct >= 0 ? "+" : ""}
                        {result.totalPnlPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Headline */}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-text-secondary text-sm">
                    If you followed{" "}
                    {result.config.callers.map((c, i) => (
                      <span key={c}>
                        {i > 0 && (i === result.config.callers.length - 1 ? " and " : ", ")}
                        <span className="text-accent">@{c}</span>
                      </span>
                    ))}{" "}
                    with {formatBigDollar(result.config.starting_capital)}, you&apos;d have{" "}
                    <span className={result.totalPnl >= 0 ? "text-win font-bold" : "text-loss font-bold"}>
                      {formatBigDollar(result.finalValue)}
                    </span>{" "}
                    today.
                  </p>
                </div>
              </div>

              {/* Chart */}
              <PortfolioChart
                timeline={result.timeline}
                startingCapital={result.config.starting_capital}
              />

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Win rate" value={`${result.stats.winRate}%`} color={result.stats.winRate >= 50 ? "win" : "loss"} />
                <StatCard label="Max drawdown" value={`-${result.stats.maxDrawdown.toFixed(1)}%`} color="loss" />
                <StatCard label="Sharpe ratio" value={result.stats.sharpeRatio.toFixed(2)} color={result.stats.sharpeRatio > 0 ? "win" : "loss"} />
                <StatCard label="Total trades" value={String(result.stats.totalTrades)} color="muted" />
              </div>

              {/* Best / Worst trade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.stats.bestTrade && (
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Best trade</div>
                    <div className="text-win text-lg font-bold">
                      {result.stats.bestTrade.ticker} +{result.stats.bestTrade.pnl_pct.toFixed(1)}%
                    </div>
                    <div className="text-text-muted text-xs mt-1">
                      @{result.stats.bestTrade.caller} | {formatDollar(result.stats.bestTrade.dollar)}
                    </div>
                  </div>
                )}
                {result.stats.worstTrade && (
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Worst trade</div>
                    <div className="text-loss text-lg font-bold">
                      {result.stats.worstTrade.ticker} {result.stats.worstTrade.pnl_pct.toFixed(1)}%
                    </div>
                    <div className="text-text-muted text-xs mt-1">
                      @{result.stats.worstTrade.caller} | {formatDollar(result.stats.worstTrade.dollar)}
                    </div>
                  </div>
                )}
              </div>

              {/* Per-caller breakdown */}
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <div className="text-[11px] uppercase tracking-widest text-text-muted">
                    Per-caller breakdown
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-2 text-[11px] uppercase tracking-widest text-text-muted font-normal">Caller</th>
                      <th className="text-right px-4 py-2 text-[11px] uppercase tracking-widest text-text-muted font-normal">Weight</th>
                      <th className="text-right px-4 py-2 text-[11px] uppercase tracking-widest text-text-muted font-normal">Trades</th>
                      <th className="text-right px-4 py-2 text-[11px] uppercase tracking-widest text-text-muted font-normal">Win rate</th>
                      <th className="text-right px-6 py-2 text-[11px] uppercase tracking-widest text-text-muted font-normal">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.perCaller.map((c) => (
                      <tr key={c.handle} className="border-b border-border last:border-0">
                        <td className="px-6 py-3 text-text-primary">@{c.handle}</td>
                        <td className="text-right px-4 py-3 text-text-muted">{c.weight}%</td>
                        <td className="text-right px-4 py-3 text-text-muted">{c.trades}</td>
                        <td className={`text-right px-4 py-3 ${c.winRate >= 50 ? "text-win" : "text-loss"}`}>
                          {c.winRate}%
                        </td>
                        <td className={`text-right px-6 py-3 font-bold ${c.pnlDollar >= 0 ? "text-win" : "text-loss"}`}>
                          {formatDollar(c.pnlDollar)} ({c.pnlPct >= 0 ? "+" : ""}{c.pnlPct}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Share */}
              <div className="flex justify-center">
                <button
                  onClick={handleShare}
                  className="border border-border hover:border-accent text-text-secondary hover:text-accent px-6 py-3 rounded-lg text-sm transition"
                >
                  Share your picks (copy link)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: "win" | "loss" | "muted" }) {
  const colorClass = color === "win" ? "text-win" : color === "loss" ? "text-loss" : "text-text-secondary";
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">{label}</div>
      <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}
