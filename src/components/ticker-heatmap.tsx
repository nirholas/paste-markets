"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { HeatmapTicker, HeatmapResponse } from "@/app/api/heatmap/route";

const SENTIMENT_COLORS: Record<HeatmapTicker["sentiment"], string> = {
  "strong-bullish": "#2ecc71",
  "lean-bullish": "#27ae60",
  neutral: "#555568",
  "lean-bearish": "#c0392b",
  "strong-bearish": "#e74c3c",
};

const SENTIMENT_BG: Record<HeatmapTicker["sentiment"], string> = {
  "strong-bullish": "rgba(46,204,113,0.15)",
  "lean-bullish": "rgba(39,174,96,0.1)",
  neutral: "rgba(85,85,104,0.15)",
  "lean-bearish": "rgba(192,57,43,0.1)",
  "strong-bearish": "rgba(231,76,60,0.15)",
};

function getColSpan(calls: number, maxCalls: number): number {
  const ratio = calls / maxCalls;
  if (ratio > 0.6) return 4;
  if (ratio > 0.35) return 3;
  if (ratio > 0.15) return 2;
  return 1;
}

function formatPnl(pnl: number | null): string {
  if (pnl == null) return "—";
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}${pnl.toFixed(1)}%`;
}

interface TileProps {
  ticker: HeatmapTicker;
  colSpan: number;
  onClick: () => void;
}

function HeatmapTile({ ticker, colSpan, onClick }: TileProps) {
  const [hovered, setHovered] = useState(false);
  const color = SENTIMENT_COLORS[ticker.sentiment];
  const bg = SENTIMENT_BG[ticker.sentiment];
  const rowSpan = colSpan;
  const isLarge = colSpan >= 3;
  const isMedium = colSpan === 2;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        backgroundColor: hovered ? bg : "rgba(15,15,34,0.8)",
        borderColor: hovered ? color : "#1a1a2e",
        color: color,
        transition: "background-color 0.15s, border-color 0.15s",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      className="border rounded flex flex-col items-center justify-center p-2 select-none"
    >
      {/* Ticker name */}
      <div
        style={{
          fontSize: isLarge ? "1.1rem" : isMedium ? "0.85rem" : "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        ${ticker.ticker}
      </div>

      {/* Call count */}
      {(isLarge || isMedium) && (
        <div
          style={{
            fontSize: isLarge ? "0.7rem" : "0.6rem",
            color: "#c8c8d0",
            marginTop: "2px",
          }}
        >
          {ticker.calls} calls
        </div>
      )}

      {/* Avg P&L */}
      {isLarge && (
        <div
          style={{
            fontSize: "0.65rem",
            color: ticker.avgPnl != null && ticker.avgPnl >= 0 ? "#2ecc71" : "#e74c3c",
            marginTop: "2px",
            fontWeight: 600,
          }}
        >
          {formatPnl(ticker.avgPnl)}
        </div>
      )}

      {/* Hover tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#0f0f22",
            border: "1px solid #1a1a2e",
            borderRadius: "6px",
            padding: "8px 12px",
            zIndex: 50,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
          className="text-xs"
        >
          <div style={{ color: color, fontWeight: 700, marginBottom: "4px" }}>
            ${ticker.ticker}
          </div>
          <div style={{ color: "#c8c8d0" }}>
            {ticker.longs}L / {ticker.shorts}S &nbsp;·&nbsp; {ticker.calls} calls
          </div>
          <div style={{ color: "#c8c8d0", marginTop: "2px" }}>
            avg P&L: <span style={{ color: ticker.avgPnl != null && ticker.avgPnl >= 0 ? "#2ecc71" : "#e74c3c" }}>{formatPnl(ticker.avgPnl)}</span>
          </div>
          {ticker.topCaller && (
            <div style={{ color: "#555568", marginTop: "2px" }}>
              top caller: @{ticker.topCaller}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Timeframe = "7d" | "30d" | "90d";

interface Props {
  initialData: HeatmapResponse;
}

export default function TickerHeatmap({ initialData }: Props) {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<Timeframe>(initialData.timeframe);
  const [data, setData] = useState<HeatmapResponse>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (tf: Timeframe) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/heatmap?timeframe=${tf}`);
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
    if (timeframe !== initialData.timeframe) {
      fetchData(timeframe);
    }
  }, [timeframe, initialData.timeframe, fetchData]);

  const tickers = data.tickers;
  const maxCalls = tickers.length > 0 ? tickers[0].calls : 1;

  const top5 = tickers.slice(0, 5);

  return (
    <div className="font-mono">
      {/* Timeframe toggle */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs uppercase tracking-widest" style={{ color: "#555568" }}>
          Timeframe
        </span>
        {(["7d", "30d", "90d"] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
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
        {loading && (
          <span className="text-xs" style={{ color: "#555568" }}>
            loading...
          </span>
        )}
      </div>

      {/* Heatmap grid */}
      {tickers.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-lg border"
          style={{ height: "320px", borderColor: "#1a1a2e", color: "#555568" }}
        >
          No data available for this timeframe.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gridAutoRows: "80px",
            gap: "4px",
            opacity: loading ? 0.5 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {tickers.map((ticker) => {
            const colSpan = getColSpan(ticker.calls, maxCalls);
            return (
              <HeatmapTile
                key={ticker.ticker}
                ticker={ticker}
                colSpan={colSpan}
                onClick={() => router.push(`/leaderboard?ticker=${ticker.ticker}`)}
              />
            );
          })}
        </div>
      )}

      {/* Top 5 list */}
      {top5.length > 0 && (
        <div className="mt-8">
          <div
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: "#555568" }}
          >
            Top Tickers by Volume
          </div>
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "#1a1a2e" }}
          >
            {top5.map((ticker, i) => {
              const color = SENTIMENT_COLORS[ticker.sentiment];
              const longPct =
                ticker.calls > 0
                  ? Math.round((ticker.longs / ticker.calls) * 100)
                  : 0;

              return (
                <div
                  key={ticker.ticker}
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer transition"
                  style={{
                    borderBottom: i < top5.length - 1 ? "1px solid #1a1a2e" : "none",
                    backgroundColor: "#0f0f22",
                  }}
                  onClick={() => router.push(`/leaderboard?ticker=${ticker.ticker}`)}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.backgroundColor = "#13132a")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.backgroundColor = "#0f0f22")
                  }
                >
                  <span className="text-xs" style={{ color: "#555568", width: "16px" }}>
                    {i + 1}
                  </span>
                  <span className="font-bold text-sm" style={{ color, minWidth: "60px" }}>
                    ${ticker.ticker}
                  </span>
                  <span className="text-xs" style={{ color: "#c8c8d0", minWidth: "64px" }}>
                    {ticker.calls} calls
                  </span>
                  <span className="text-xs" style={{ color: "#555568", minWidth: "100px" }}>
                    {ticker.longs}L / {ticker.shorts}S ({longPct}% long)
                  </span>
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color:
                        ticker.avgPnl != null && ticker.avgPnl >= 0
                          ? "#2ecc71"
                          : "#e74c3c",
                      minWidth: "60px",
                    }}
                  >
                    {formatPnl(ticker.avgPnl)}
                  </span>
                  {ticker.topCaller && (
                    <span className="text-xs" style={{ color: "#555568" }}>
                      top: @{ticker.topCaller}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
