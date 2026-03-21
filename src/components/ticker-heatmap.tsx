"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { HeatmapTicker, HeatmapResponse } from "@/app/api/heatmap/route";
import { VenueFilter, type VenueFilterValue } from "@/components/venue-filter";

// ── Color interpolation ────────────────────────────────────────────────────

function pnlColor(pnl: number | null): string {
  if (pnl == null) return "#1a1a2e";
  // Clamp to [-20, +20] for color mapping
  const clamped = Math.max(-20, Math.min(20, pnl));
  const t = (clamped + 20) / 40; // 0 = -20%, 0.5 = 0%, 1 = +20%

  if (t < 0.5) {
    // Red scale: #2e0a0a (t=0) → #1a1a2e (t=0.5)
    const s = t / 0.5;
    const r = Math.round(0x2e + (0x1a - 0x2e) * s);
    const g = Math.round(0x0a + (0x1a - 0x0a) * s);
    const b = Math.round(0x0a + (0x2e - 0x0a) * s);
    return `rgb(${r},${g},${b})`;
  } else {
    // Green scale: #1a1a2e (t=0.5) → #0a2e1a (t=1)
    const s = (t - 0.5) / 0.5;
    const r = Math.round(0x1a + (0x0a - 0x1a) * s);
    const g = Math.round(0x1a + (0x2e - 0x1a) * s);
    const b = Math.round(0x2e + (0x1a - 0x2e) * s);
    return `rgb(${r},${g},${b})`;
  }
}

function pnlTextColor(pnl: number | null): string {
  if (pnl == null) return "#555568";
  return pnl >= 0 ? "#2ecc71" : "#e74c3c";
}

function formatPnl(pnl: number | null): string {
  if (pnl == null) return "—";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

// ── Squarified treemap algorithm ───────────────────────────────────────────

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TreemapItem {
  ticker: string;
  weight: number;
  pnl: number | null;
  data: HeatmapTicker;
}

interface PositionedItem extends TreemapItem {
  rect: Rect;
}

function worstRatio(row: number[], w: number): number {
  if (row.length === 0) return Infinity;
  const s = row.reduce((a, b) => a + b, 0);
  const maxVal = Math.max(...row);
  const minVal = Math.min(...row);
  const w2 = w * w;
  const s2 = s * s;
  return Math.max((w2 * maxVal) / s2, s2 / (w2 * minVal));
}

function layoutRow(
  row: TreemapItem[],
  bounds: Rect,
  isHorizontal: boolean,
): { rects: Rect[]; remaining: Rect } {
  const totalWeight = row.reduce((s, r) => s + r.weight, 0);

  if (isHorizontal) {
    const rowWidth = bounds.w > 0 ? totalWeight / bounds.h : 0;
    let y = bounds.y;
    const rects: Rect[] = row.map((item) => {
      const h = bounds.h > 0 ? (item.weight / totalWeight) * bounds.h : 0;
      const rect: Rect = { x: bounds.x, y, w: rowWidth, h };
      y += h;
      return rect;
    });
    return {
      rects,
      remaining: {
        x: bounds.x + rowWidth,
        y: bounds.y,
        w: bounds.w - rowWidth,
        h: bounds.h,
      },
    };
  } else {
    const rowHeight = bounds.h > 0 ? totalWeight / bounds.w : 0;
    let x = bounds.x;
    const rects: Rect[] = row.map((item) => {
      const w = bounds.w > 0 ? (item.weight / totalWeight) * bounds.w : 0;
      const rect: Rect = { x, y: bounds.y, w, h: rowHeight };
      x += w;
      return rect;
    });
    return {
      rects,
      remaining: {
        x: bounds.x,
        y: bounds.y + rowHeight,
        w: bounds.w,
        h: bounds.h - rowHeight,
      },
    };
  }
}

function squarify(items: TreemapItem[], bounds: Rect): PositionedItem[] {
  if (items.length === 0 || bounds.w <= 0 || bounds.h <= 0) return [];

  // Normalize weights to fill the area
  const totalArea = bounds.w * bounds.h;
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (totalWeight <= 0) return [];

  const normalized = items.map((item) => ({
    ...item,
    weight: (item.weight / totalWeight) * totalArea,
  }));

  const result: PositionedItem[] = [];
  let remaining = { ...bounds };
  let idx = 0;

  while (idx < normalized.length) {
    const isHorizontal = remaining.w > remaining.h;
    const shortSide = isHorizontal ? remaining.h : remaining.w;

    const row: TreemapItem[] = [];
    const rowWeights: number[] = [];

    // Add first item
    row.push(normalized[idx]);
    rowWeights.push(normalized[idx].weight);
    idx++;

    let currentWorst = worstRatio(rowWeights, shortSide);

    // Try adding more items
    while (idx < normalized.length) {
      const testWeights = [...rowWeights, normalized[idx].weight];
      const testWorst = worstRatio(testWeights, shortSide);
      if (testWorst > currentWorst) break;
      row.push(normalized[idx]);
      rowWeights.push(normalized[idx].weight);
      currentWorst = testWorst;
      idx++;
    }

    const { rects, remaining: newRemaining } = layoutRow(row, remaining, isHorizontal);
    for (let i = 0; i < row.length; i++) {
      result.push({ ...items[result.length], weight: row[i].weight, rect: rects[i] });
    }
    remaining = newRemaining;
  }

  return result;
}

// ── Tooltip component ──────────────────────────────────────────────────────

interface TooltipProps {
  ticker: HeatmapTicker;
  x: number;
  y: number;
}

function Tooltip({ ticker, x, y }: TooltipProps) {
  const longPct = ticker.call_count > 0
    ? Math.round((ticker.longs / ticker.call_count) * 100)
    : 50;

  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y - 10,
        backgroundColor: "#0f0f22",
        border: "1px solid #1a1a2e",
        borderRadius: "6px",
        padding: "10px 14px",
        zIndex: 100,
        pointerEvents: "none",
        fontFamily: "var(--font-jetbrains), JetBrains Mono, monospace",
        minWidth: "180px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ color: "#f0f0f0", fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
        {ticker.ticker}
      </div>
      <div style={{ color: "#c8c8d0", fontSize: "12px", lineHeight: "1.6" }}>
        <div>{ticker.call_count} calls</div>
        <div>
          avg P&L:{" "}
          <span style={{ color: pnlTextColor(ticker.avg_pnl), fontWeight: 600 }}>
            {formatPnl(ticker.avg_pnl)}
          </span>
        </div>
        <div>
          {ticker.longs}L / {ticker.shorts}S ({longPct}% long)
        </div>
      </div>
      {ticker.callers.length > 0 && (
        <div style={{ marginTop: "6px", borderTop: "1px solid #1a1a2e", paddingTop: "6px" }}>
          <div style={{ color: "#555568", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>
            Top Callers
          </div>
          {ticker.callers.slice(0, 3).map((c) => (
            <div key={c.handle} style={{ color: "#c8c8d0", fontSize: "11px" }}>
              @{c.handle} · {c.calls} calls{" "}
              <span style={{ color: pnlTextColor(c.avgPnl) }}>{formatPnl(c.avgPnl)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Caller breakdown panel ─────────────────────────────────────────────────

function CallerBreakdown({
  ticker,
  onClose,
}: {
  ticker: HeatmapTicker;
  onClose: () => void;
}) {
  const router = useRouter();

  return (
    <div
      className="rounded-lg border overflow-hidden mb-4"
      style={{ borderColor: "#1a1a2e", backgroundColor: "#0f0f22" }}
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1a1a2e" }}>
        <div className="flex items-center gap-3">
          <span style={{ color: "#f0f0f0", fontWeight: 700, fontSize: "15px" }}>
            {ticker.ticker}
          </span>
          <span style={{ color: pnlTextColor(ticker.avg_pnl), fontWeight: 600, fontSize: "13px" }}>
            {formatPnl(ticker.avg_pnl)}
          </span>
          <span style={{ color: "#555568", fontSize: "12px" }}>
            {ticker.call_count} calls · {ticker.direction_split}% long
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded border transition"
          style={{ borderColor: "#1a1a2e", color: "#555568" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e74c3c";
            (e.currentTarget as HTMLElement).style.color = "#e74c3c";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#1a1a2e";
            (e.currentTarget as HTMLElement).style.color = "#555568";
          }}
        >
          CLOSE
        </button>
      </div>
      <div>
        {ticker.callers.map((caller, i) => (
          <div
            key={caller.handle}
            className="flex items-center gap-4 px-4 py-2.5 cursor-pointer transition"
            style={{
              borderBottom: i < ticker.callers.length - 1 ? "1px solid #1a1a2e" : "none",
            }}
            onClick={() => router.push(`/${caller.handle}`)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "#13132a";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            <span style={{ color: "#555568", fontSize: "11px", width: "18px" }}>{i + 1}</span>
            <span style={{ color: "#3b82f6", fontSize: "13px", fontWeight: 600, minWidth: "100px" }}>
              @{caller.handle}
            </span>
            <span style={{ color: "#c8c8d0", fontSize: "12px", minWidth: "60px" }}>
              {caller.calls} calls
            </span>
            <span
              style={{
                color: pnlTextColor(caller.avgPnl),
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {formatPnl(caller.avgPnl)}
            </span>
          </div>
        ))}
        {ticker.callers.length === 0 && (
          <div className="px-4 py-3" style={{ color: "#555568", fontSize: "12px" }}>
            No caller data available
          </div>
        )}
      </div>
    </div>
  );
}

// ── SVG Treemap ────────────────────────────────────────────────────────────

function SVGTreemap({
  tickers,
  onSelect,
}: {
  tickers: HeatmapTicker[];
  onSelect: (ticker: HeatmapTicker) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });
  const [tooltip, setTooltip] = useState<{ ticker: HeatmapTicker; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, Math.min(600, entry.contentRect.width * 0.55)),
        });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const positioned = useMemo(() => {
    const items: TreemapItem[] = tickers.map((t) => ({
      ticker: t.ticker,
      weight: t.call_count,
      pnl: t.avg_pnl,
      data: t,
    }));
    const PAD = 2;
    return squarify(items, { x: PAD, y: PAD, w: dimensions.width - PAD * 2, h: dimensions.height - PAD * 2 });
  }, [tickers, dimensions]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: "block", borderRadius: "8px", backgroundColor: "#0a0a1a" }}
      >
        {positioned.map((item) => {
          const { rect } = item;
          if (rect.w < 2 || rect.h < 2) return null;

          const innerX = rect.x + 1;
          const innerY = rect.y + 1;
          const innerW = rect.w - 2;
          const innerH = rect.h - 2;

          const showLabel = innerW > 35 && innerH > 25;
          const showPnl = innerW > 50 && innerH > 40;
          const fontSize = Math.max(10, Math.min(18, innerW / 5, innerH / 3));
          const pnlFontSize = Math.max(9, fontSize * 0.7);

          return (
            <g
              key={item.data.ticker}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(item.data)}
              onMouseMove={(e) => setTooltip({ ticker: item.data, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
            >
              <rect
                x={innerX}
                y={innerY}
                width={innerW}
                height={innerH}
                rx={3}
                fill={pnlColor(item.pnl)}
                stroke="#0a0a1a"
                strokeWidth={1}
              />
              {/* Hover overlay */}
              <rect
                x={innerX}
                y={innerY}
                width={innerW}
                height={innerH}
                rx={3}
                fill="white"
                fillOpacity={0}
                style={{ transition: "fill-opacity 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.setAttribute("fill-opacity", "0.08")}
                onMouseLeave={(e) => e.currentTarget.setAttribute("fill-opacity", "0")}
              />
              {showLabel && (
                <text
                  x={innerX + innerW / 2}
                  y={innerY + innerH / 2 + (showPnl ? -pnlFontSize * 0.3 : 0)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize={fontSize}
                  fontWeight={700}
                  fontFamily="var(--font-jetbrains), JetBrains Mono, monospace"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)", pointerEvents: "none" }}
                >
                  {item.data.ticker}
                </text>
              )}
              {showPnl && (
                <text
                  x={innerX + innerW / 2}
                  y={innerY + innerH / 2 + fontSize * 0.6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={pnlTextColor(item.pnl)}
                  fontSize={pnlFontSize}
                  fontWeight={600}
                  fontFamily="var(--font-jetbrains), JetBrains Mono, monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {formatPnl(item.pnl)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip && <Tooltip ticker={tooltip.ticker} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}

// ── Mobile card grid ───────────────────────────────────────────────────────

function MobileGrid({
  tickers,
  onSelect,
}: {
  tickers: HeatmapTicker[];
  onSelect: (ticker: HeatmapTicker) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {tickers.map((ticker) => (
        <div
          key={ticker.ticker}
          className="rounded-lg border p-3 cursor-pointer transition"
          style={{
            borderColor: "#1a1a2e",
            backgroundColor: pnlColor(ticker.avg_pnl),
          }}
          onClick={() => onSelect(ticker)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#1a1a2e";
          }}
        >
          <div style={{ color: "#ffffff", fontWeight: 700, fontSize: "14px" }}>
            {ticker.ticker}
          </div>
          <div style={{ color: "#c8c8d0", fontSize: "11px", marginTop: "2px" }}>
            {ticker.call_count} calls
          </div>
          <div
            style={{
              color: pnlTextColor(ticker.avg_pnl),
              fontWeight: 600,
              fontSize: "13px",
              marginTop: "4px",
            }}
          >
            {formatPnl(ticker.avg_pnl)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Timeframe = "24h" | "7d" | "30d";
type PlatformFilter = "all" | "stocks" | "perps" | "prediction-markets";

/** Map VenueFilterValue to heatmap API platform param */
function venueToHeatmapPlatform(venue: VenueFilterValue): PlatformFilter {
  switch (venue) {
    case "stocks": return "stocks";
    case "perps": return "perps";
    case "prediction": return "prediction-markets";
    default: return "all";
  }
}

interface Props {
  initialData: HeatmapResponse;
}

export default function TickerHeatmap({ initialData }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialData.timeframe);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [venueFilter, setVenueFilter] = useState<VenueFilterValue>("all");
  const [data, setData] = useState<HeatmapResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<HeatmapTicker | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchData = useCallback(async (tf: Timeframe, pf: PlatformFilter) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/heatmap?timeframe=${tf}&platform=${pf}`);
      if (res.ok) {
        const json: HeatmapResponse = await res.json();
        setData(json);
      }
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timeframe !== initialData.timeframe || platform !== "all") {
      fetchData(timeframe, platform);
    }
  }, [timeframe, platform, initialData.timeframe, fetchData]);

  const handleSelect = useCallback((ticker: HeatmapTicker) => {
    setSelectedTicker((prev) => (prev?.ticker === ticker.ticker ? null : ticker));
  }, []);

  const tickers = data.tickers;

  return (
    <div className="font-mono">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Timeframe toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest" style={{ color: "#555568" }}>
            Timeframe
          </span>
          {(["24h", "7d", "30d"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => { setTimeframe(tf); setSelectedTicker(null); }}
              className="text-xs px-3 py-1 rounded border transition"
              style={{
                borderColor: timeframe === tf ? "#3b82f6" : "#1a1a2e",
                color: timeframe === tf ? "#3b82f6" : "#555568",
                backgroundColor: timeframe === tf ? "rgba(59,130,246,0.1)" : "transparent",
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Venue filter */}
        <VenueFilter
          value={venueFilter}
          onChange={(v) => {
            setVenueFilter(v);
            setPlatform(venueToHeatmapPlatform(v));
            setSelectedTicker(null);
          }}
        />

        {loading && (
          <span className="text-xs" style={{ color: "#555568" }}>
            loading...
          </span>
        )}
      </div>

      {/* Caller breakdown panel (when a box is clicked) */}
      {selectedTicker && (
        <CallerBreakdown
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}

      {/* Heatmap */}
      {tickers.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-lg border"
          style={{ height: "320px", borderColor: "#1a1a2e", color: "#555568" }}
        >
          No data available for this timeframe.
        </div>
      ) : (
        <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }}>
          {isMobile ? (
            <MobileGrid tickers={tickers} onSelect={handleSelect} />
          ) : (
            <SVGTreemap tickers={tickers} onSelect={handleSelect} />
          )}
        </div>
      )}
    </div>
  );
}
