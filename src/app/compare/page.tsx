"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { RadarChart } from "@/components/radar-chart";
import { PnlDisplay } from "@/components/ui/pnl-display";

const CALLER_COLORS = ["#3b82f6", "#2ecc71", "#f39c12", "#e74c3c"];

const RADAR_AXES = [
  { label: "Win Rate", key: "winRate" },
  { label: "Volume", key: "volume" },
  { label: "Consistency", key: "consistency" },
  { label: "Best Trade", key: "bestTrade" },
  { label: "Risk", key: "risk" },
];

const STAT_ROWS = [
  { key: "winRate", label: "WIN RATE", format: (v: number) => `${Math.round(v)}%` },
  { key: "avgPnl", label: "AVG P&L", format: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
  { key: "totalTrades", label: "TOTAL TRADES", format: (v: number) => String(v) },
  { key: "bestTrade", label: "BEST TRADE", format: (_: number, m: CallerMetrics) => m.bestTrade ? `${m.bestTrade.ticker} ${m.bestTrade.pnl >= 0 ? "+" : ""}${m.bestTrade.pnl.toFixed(1)}%` : "--" },
  { key: "worstTrade", label: "WORST TRADE", format: (_: number, m: CallerMetrics) => m.worstTrade ? `${m.worstTrade.ticker} ${m.worstTrade.pnl >= 0 ? "+" : ""}${m.worstTrade.pnl.toFixed(1)}%` : "--" },
  { key: "streak", label: "STREAK", format: (v: number) => v === 0 ? "0" : v > 0 ? `${v}W` : `${Math.abs(v)}L` },
] as const;

interface TradeHighlight {
  ticker: string;
  direction: string;
  pnl: number;
  date: string;
}

interface TradeSummary {
  ticker: string;
  direction: string;
  pnl_pct: number;
  entry_date?: string;
  posted_at?: string;
}

interface CallerMetrics {
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  winCount: number;
  lossCount: number;
  bestTrade: TradeHighlight | null;
  worstTrade: TradeHighlight | null;
  streak: number;
  recentTrades: TradeSummary[];
  pnlHistory: Array<{ date: string; cumulativePnl: number }>;
}

interface CallerData {
  handle: string;
  metrics: CallerMetrics;
  radar: Record<string, number>;
}

interface CompareResponse {
  callers: CallerData[];
  statWinners: Record<string, string>;
  sharedTickers: Array<{
    ticker: string;
    callers: Array<{ handle: string; avgPnl: number }>;
  }>;
  timeframe: string;
}

function CompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [handles, setHandles] = useState<string[]>(() => {
    const c = searchParams.get("c");
    return c ? c.split(",").filter(Boolean).slice(0, 4) : [];
  });
  const [inputValue, setInputValue] = useState("");
  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async (callers: string[]) => {
    if (callers.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vs?callers=${callers.join(",")}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details ?? body.error ?? "Failed to load comparison");
      }
      const json: CompareResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync URL and fetch on handle changes
  useEffect(() => {
    if (handles.length > 0) {
      const params = new URLSearchParams();
      params.set("c", handles.join(","));
      router.replace(`/compare?${params.toString()}`, { scroll: false });
    } else {
      router.replace("/compare", { scroll: false });
    }
    if (handles.length >= 2) {
      fetchComparison(handles);
    } else {
      setData(null);
    }
  }, [handles, router, fetchComparison]);

  function addCaller() {
    const handle = inputValue.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return;
    if (handles.includes(handle)) return;
    if (handles.length >= 4) return;
    setHandles((prev) => [...prev, handle]);
    setInputValue("");
  }

  function removeCaller(handle: string) {
    setHandles((prev) => prev.filter((h) => h !== handle));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-text-primary mb-1">Compare Callers</h1>
      <p className="text-sm text-text-muted mb-6">
        Side-by-side comparison of 2-4 CT callers
      </p>

      {/* Caller selector */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-8">
        <div className="flex flex-wrap gap-2 mb-3">
          {handles.map((h, i) => (
            <span
              key={h}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-mono text-text-primary border border-border"
              style={{ borderLeftColor: CALLER_COLORS[i], borderLeftWidth: 3 }}
            >
              @{h}
              <button
                onClick={() => removeCaller(h)}
                className="text-text-muted hover:text-loss ml-1 text-xs"
              >
                x
              </button>
            </span>
          ))}
          {handles.length === 0 && (
            <span className="text-sm text-text-muted">Add 2-4 callers to compare</span>
          )}
        </div>

        {handles.length < 4 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCaller();
            }}
            className="flex gap-2"
          >
            <div className="flex items-center bg-bg border border-border rounded px-3 py-1.5 flex-1 focus-within:border-accent transition-colors">
              <span className="text-text-muted text-sm mr-1">@</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Add caller handle..."
                className="flex-1 bg-transparent outline-none text-text-primary text-sm font-mono placeholder:text-text-muted"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-1.5 border border-border rounded text-sm text-text-secondary hover:border-accent hover:text-accent transition-colors font-mono"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-12 text-text-muted text-sm font-mono">
          Loading comparison...
        </div>
      )}
      {error && (
        <div className="text-center py-12 text-loss text-sm font-mono">
          {error}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-8">
          {/* Stat Table */}
          <section>
            <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
              Stats Comparison
            </h2>
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              {/* Header row */}
              <div
                className="grid items-center gap-4 px-4 py-3 border-b border-border"
                style={{ gridTemplateColumns: `140px repeat(${data.callers.length}, 1fr)` }}
              >
                <div className="text-[11px] uppercase tracking-widest text-text-muted">
                  Metric
                </div>
                {data.callers.map((c, i) => (
                  <div key={c.handle} className="text-sm font-mono text-text-primary text-center">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: CALLER_COLORS[i] }}
                    />
                    @{c.handle}
                  </div>
                ))}
              </div>

              {/* Stat rows */}
              {STAT_ROWS.map((row, ri) => {
                const winner = data.statWinners[row.key];
                return (
                  <div
                    key={row.key}
                    className="grid items-center gap-4 px-4 py-3 border-b border-border last:border-b-0"
                    style={{
                      gridTemplateColumns: `140px repeat(${data.callers.length}, 1fr)`,
                      backgroundColor: ri % 2 === 0 ? "#0f0f22" : "#0a0a1a",
                    }}
                  >
                    <div className="text-[11px] uppercase tracking-widest text-text-muted">
                      {row.label}
                    </div>
                    {data.callers.map((c) => {
                      const isWinner = winner === c.handle;
                      const val = row.key === "bestTrade"
                        ? (c.metrics.bestTrade?.pnl ?? 0)
                        : row.key === "worstTrade"
                          ? (c.metrics.worstTrade?.pnl ?? 0)
                          : c.metrics[row.key as keyof Pick<CallerMetrics, "winRate" | "avgPnl" | "totalTrades" | "streak">] as number;
                      const formatted = row.format(val, c.metrics);

                      return (
                        <div
                          key={c.handle}
                          className={`text-sm font-mono text-center ${
                            isWinner
                              ? "text-win"
                              : "text-text-secondary"
                          }`}
                          style={isWinner ? { borderLeft: "2px solid #2ecc71", paddingLeft: 8 } : undefined}
                        >
                          {formatted}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Radar Chart */}
          <section>
            <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
              Performance Radar
            </h2>
            <div className="bg-surface border border-border rounded-lg p-6 flex justify-center">
              <RadarChart
                axes={RADAR_AXES}
                data={data.callers.map((c) => ({
                  handle: c.handle,
                  values: c.radar,
                }))}
                size={340}
              />
            </div>
          </section>

          {/* Overlap Analysis */}
          {data.sharedTickers.length > 0 && (
            <section>
              <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
                Overlap Analysis
              </h2>
              <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
                {data.sharedTickers.slice(0, 10).map((st) => {
                  const bestCaller = [...st.callers].sort(
                    (a, b) => b.avgPnl - a.avgPnl,
                  )[0];
                  const callerNames = st.callers
                    .map((c) => `@${c.handle}`)
                    .join(" and ");

                  return (
                    <div
                      key={st.ticker}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-border last:border-b-0"
                    >
                      <div className="text-sm text-text-secondary font-mono flex-1">
                        {callerNames} called{" "}
                        <span className="text-text-primary font-bold">${st.ticker}</span>
                      </div>
                      <div className="flex gap-3 text-xs font-mono">
                        {st.callers.map((c) => {
                          const idx = data.callers.findIndex(
                            (dc) => dc.handle === c.handle,
                          );
                          return (
                            <span key={c.handle} className="flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full inline-block"
                                style={{
                                  backgroundColor: CALLER_COLORS[idx] ?? "#555568",
                                }}
                              />
                              <span className="text-text-muted">@{c.handle}</span>
                              <PnlDisplay value={c.avgPnl} />
                              {c.handle === bestCaller.handle && (
                                <span className="text-win text-[10px]">W</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section>
            <h2 className="text-[11px] uppercase tracking-widest text-text-muted mb-3">
              Trade Timeline
            </h2>
            <div className="bg-surface border border-border rounded-lg p-4 overflow-x-auto">
              <TimelineView callers={data.callers} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ---------- Timeline sub-component ----------

interface TimelineTrade {
  handle: string;
  colorIndex: number;
  ticker: string;
  direction: string;
  pnl: number;
  date: string;
}

function TimelineView({ callers }: { callers: CallerData[] }) {
  const [hoveredTrade, setHoveredTrade] = useState<TimelineTrade | null>(null);

  // Collect all trades with dates
  const trades: TimelineTrade[] = [];
  callers.forEach((c, ci) => {
    for (const t of c.metrics.recentTrades) {
      const date = t.entry_date ?? t.posted_at;
      if (!date) continue;
      trades.push({
        handle: c.handle,
        colorIndex: ci,
        ticker: t.ticker,
        direction: t.direction,
        pnl: t.pnl_pct,
        date,
      });
    }
  });

  if (trades.length === 0) {
    return <div className="text-text-muted text-sm font-mono text-center py-4">No dated trades available</div>;
  }

  // Sort by date
  trades.sort((a, b) => a.date.localeCompare(b.date));

  const minDate = new Date(trades[0].date).getTime();
  const maxDate = new Date(trades[trades.length - 1].date).getTime();
  const range = maxDate - minDate || 1;

  const width = 800;
  const height = 80;
  const padding = 40;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ minWidth: 400 }}>
        {/* Axis line */}
        <line
          x1={padding}
          y1={height / 2}
          x2={width - padding}
          y2={height / 2}
          stroke="#1a1a2e"
          strokeWidth={1}
        />

        {/* Date labels */}
        <text
          x={padding}
          y={height - 4}
          className="fill-text-muted"
          style={{ fontSize: 10, fontFamily: "var(--font-jetbrains), monospace" }}
        >
          {formatShortDate(trades[0].date)}
        </text>
        <text
          x={width - padding}
          y={height - 4}
          textAnchor="end"
          className="fill-text-muted"
          style={{ fontSize: 10, fontFamily: "var(--font-jetbrains), monospace" }}
        >
          {formatShortDate(trades[trades.length - 1].date)}
        </text>

        {/* Trade dots */}
        {trades.map((t, i) => {
          const x =
            padding +
            ((new Date(t.date).getTime() - minDate) / range) *
              (width - 2 * padding);
          // Stagger y position by caller to avoid overlap
          const yOffset = (t.colorIndex - (callers.length - 1) / 2) * 12;
          const y = height / 2 + yOffset;
          const color = CALLER_COLORS[t.colorIndex];

          return (
            <circle
              key={`${t.handle}-${t.ticker}-${i}`}
              cx={x}
              cy={y}
              r={hoveredTrade === t ? 6 : 4}
              fill={t.pnl >= 0 ? color : "transparent"}
              stroke={color}
              strokeWidth={1.5}
              style={{ cursor: "pointer", transition: "r 0.15s" }}
              onMouseEnter={() => setHoveredTrade(t)}
              onMouseLeave={() => setHoveredTrade(null)}
            />
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredTrade && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-bg border border-border rounded px-3 py-2 text-xs font-mono shadow-lg pointer-events-none z-10">
          <span
            className="inline-block w-2 h-2 rounded-full mr-1"
            style={{ backgroundColor: CALLER_COLORS[hoveredTrade.colorIndex] }}
          />
          <span className="text-text-secondary">@{hoveredTrade.handle}</span>{" "}
          <span className="text-text-primary">${hoveredTrade.ticker}</span>{" "}
          <span className="text-text-muted">{hoveredTrade.direction}</span>{" "}
          <span className={hoveredTrade.pnl >= 0 ? "text-win" : "text-loss"}>
            {hoveredTrade.pnl >= 0 ? "+" : ""}{hoveredTrade.pnl.toFixed(1)}%
          </span>{" "}
          <span className="text-text-muted">{formatShortDate(hoveredTrade.date)}</span>
        </div>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ---------- Page wrapper with Suspense ----------

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-8 text-text-muted text-sm font-mono">
          Loading...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
