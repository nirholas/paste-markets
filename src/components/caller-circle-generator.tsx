"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface CircleCaller {
  handle: string;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  tier: 1 | 2 | 3;
}

interface CircleData {
  callers: CircleCaller[];
  timeframe: string;
  total: number;
}

const TIMEFRAMES = ["7d", "30d", "90d", "all"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

// Tier layout: [radius, node diameter]
const TIER_LAYOUT: Record<1 | 2 | 3, { r: number; d: number }> = {
  1: { r: 118, d: 54 },
  2: { r: 196, d: 42 },
  3: { r: 268, d: 34 },
};

const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const AMBER = "#f39c12";
const RED = "#e74c3c";
const ACCENT = "#3b82f6";

function callerColor(winRate: number): string {
  if (winRate >= 65) return GREEN;
  if (winRate >= 50) return AMBER;
  return RED;
}

function callersByTier(callers: CircleCaller[], tier: 1 | 2 | 3) {
  return callers.filter((c) => c.tier === tier);
}

function nodePositions(count: number, radius: number, cx: number, cy: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

interface CircleSvgProps {
  data: CircleData;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

function CircleSvg({ data, svgRef }: CircleSvgProps) {
  const SIZE = 600;
  const CX = 300;
  const CY = 300;

  const tier1 = callersByTier(data.callers, 1);
  const tier2 = callersByTier(data.callers, 2);
  const tier3 = callersByTier(data.callers, 3);

  const tier1Pos = nodePositions(tier1.length, TIER_LAYOUT[1].r, CX, CY);
  const tier2Pos = nodePositions(tier2.length, TIER_LAYOUT[2].r, CX, CY);
  const tier3Pos = nodePositions(tier3.length, TIER_LAYOUT[3].r, CX, CY);

  const formatPnl = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
  const tfLabel = data.timeframe === "all" ? "ALL TIME" : `LAST ${data.timeframe.toUpperCase()}`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
    >
      {/* Background */}
      <rect width={SIZE} height={SIZE} fill={BG} />

      {/* Ring guides */}
      {([1, 2, 3] as const).map((t) => (
        <circle
          key={t}
          cx={CX}
          cy={CY}
          r={TIER_LAYOUT[t].r}
          fill="none"
          stroke={BORDER}
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.6"
        />
      ))}

      {/* Center */}
      <circle cx={CX} cy={CY} r={52} fill={SURFACE} stroke={BORDER} strokeWidth="1.5" />
      <text x={CX} y={CY - 10} textAnchor="middle" fill={ACCENT} fontSize="11" fontFamily="monospace" fontWeight="700" letterSpacing="1.5">
        CT CALLERS
      </text>
      <text x={CX} y={CY + 6} textAnchor="middle" fill={ACCENT} fontSize="11" fontFamily="monospace" fontWeight="700" letterSpacing="1.5">
        CIRCLE
      </text>
      <text x={CX} y={CY + 22} textAnchor="middle" fill={MUTED} fontSize="9" fontFamily="monospace" letterSpacing="0.5">
        {tfLabel}
      </text>

      {/* Tier 3 nodes */}
      {tier3.map((caller, i) => {
        const pos = tier3Pos[i]!;
        const { d } = TIER_LAYOUT[3];
        const r = d / 2;
        const color = callerColor(caller.winRate);
        return (
          <g key={`t3-${caller.handle}`}>
            <circle cx={pos.x} cy={pos.y} r={r} fill={SURFACE} stroke={color} strokeWidth="1.2" opacity="0.85" />
            <text x={pos.x} y={pos.y + 3} textAnchor="middle" fill={color} fontSize="8" fontFamily="monospace" fontWeight="700">
              {Math.round(caller.winRate)}%
            </text>
            <text x={pos.x} y={pos.y + r + 10} textAnchor="middle" fill={MUTED} fontSize="7.5" fontFamily="monospace">
              @{caller.handle.length > 10 ? caller.handle.slice(0, 9) + "…" : caller.handle}
            </text>
          </g>
        );
      })}

      {/* Tier 2 nodes */}
      {tier2.map((caller, i) => {
        const pos = tier2Pos[i]!;
        const { d } = TIER_LAYOUT[2];
        const r = d / 2;
        const color = callerColor(caller.winRate);
        return (
          <g key={`t2-${caller.handle}`}>
            <circle cx={pos.x} cy={pos.y} r={r} fill={SURFACE} stroke={color} strokeWidth="1.5" opacity="0.9" />
            <text x={pos.x} y={pos.y + 3} textAnchor="middle" fill={color} fontSize="9" fontFamily="monospace" fontWeight="700">
              {Math.round(caller.winRate)}%
            </text>
            <text x={pos.x} y={pos.y + r + 11} textAnchor="middle" fill={TEXT} fontSize="8" fontFamily="monospace">
              @{caller.handle.length > 11 ? caller.handle.slice(0, 10) + "…" : caller.handle}
            </text>
          </g>
        );
      })}

      {/* Tier 1 nodes (innermost, most prominent) */}
      {tier1.map((caller, i) => {
        const pos = tier1Pos[i]!;
        const { d } = TIER_LAYOUT[1];
        const r = d / 2;
        const color = callerColor(caller.winRate);
        return (
          <g key={`t1-${caller.handle}`}>
            {/* Glow effect */}
            <circle cx={pos.x} cy={pos.y} r={r + 5} fill={color} opacity="0.08" />
            <circle cx={pos.x} cy={pos.y} r={r} fill={SURFACE} stroke={color} strokeWidth="2" />
            <text x={pos.x} y={pos.y - 3} textAnchor="middle" fill={color} fontSize="10" fontFamily="monospace" fontWeight="700">
              {Math.round(caller.winRate)}%
            </text>
            <text x={pos.x} y={pos.y + 10} textAnchor="middle" fill={MUTED} fontSize="7.5" fontFamily="monospace">
              {formatPnl(caller.avgPnl)}
            </text>
            <text x={pos.x} y={pos.y + r + 13} textAnchor="middle" fill={TEXT} fontSize="8.5" fontFamily="monospace" fontWeight="600">
              @{caller.handle.length > 12 ? caller.handle.slice(0, 11) + "…" : caller.handle}
            </text>
          </g>
        );
      })}

      {/* Watermark */}
      <text x={SIZE / 2} y={SIZE - 12} textAnchor="middle" fill={MUTED} fontSize="9" fontFamily="monospace" letterSpacing="0.5">
        paste.markets · Powered by paste.trade
      </text>
    </svg>
  );
}

export default function CallerCircleGenerator() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [data, setData] = useState<CircleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const fetchCircle = useCallback(async (tf: Timeframe) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circle?timeframe=${tf}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load circle data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCircle(timeframe);
  }, [timeframe, fetchCircle]);

  const handleDownload = useCallback(async () => {
    if (!svgRef.current) return;
    setDownloading(true);
    try {
      const svgEl = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement("canvas");
      const scale = 2; // 2x for retina
      canvas.width = 600 * scale;
      canvas.height = 600 * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const link = document.createElement("a");
        link.download = `ct-caller-circle-${timeframe}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setDownloading(false);
      };
      img.onerror = () => setDownloading(false);
      img.src =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
    } catch {
      setDownloading(false);
    }
  }, [timeframe]);

  const tweetText = useCallback(() => {
    if (!data) return "";
    const top3 = data.callers.filter((c) => c.tier === 1).slice(0, 3);
    const handles = top3.map((c) => `@${c.handle}`).join(" ");
    const tfLabel = timeframe === "all" ? "all time" : `last ${timeframe}`;
    return `CT Caller Circle (${tfLabel})\n\nTop callers: ${handles}\n\nPowered by @pastetrade\n\npaste.markets/circle`;
  }, [data, timeframe]);

  const handleTweet = useCallback(() => {
    const text = tweetText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [tweetText]);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Timeframe selector */}
      <div className="flex items-center gap-1 border border-border rounded p-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-1.5 text-xs font-mono rounded transition-colors ${
              timeframe === tf
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tf === "all" ? "ALL" : tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Circle visualization */}
      <div className="relative w-full max-w-[600px] aspect-square">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/80 z-10 rounded">
            <span className="text-text-muted text-sm font-mono animate-pulse">
              Loading circle...
            </span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface border border-border rounded">
            <span className="text-red-400 text-sm font-mono">{error}</span>
            <button
              onClick={() => fetchCircle(timeframe)}
              className="text-xs text-accent hover:underline font-mono"
            >
              Retry
            </button>
          </div>
        )}
        {!error && data && (
          <CircleSvg data={data} svgRef={svgRef} />
        )}
        {!error && !data && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface border border-border rounded">
            <span className="text-text-muted text-sm font-mono">No data available</span>
          </div>
        )}
      </div>

      {/* Legend */}
      {data && data.callers.length > 0 && (
        <div className="flex items-center gap-6 text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: GREEN }} />
            &ge;65% WR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: AMBER }} />
            50–65% WR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: RED }} />
            &lt;50% WR
          </span>
        </div>
      )}

      {/* Actions */}
      {data && data.callers.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2 border border-border rounded text-sm font-mono text-text-primary hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            {downloading ? "Saving..." : "Download PNG"}
          </button>
          <button
            onClick={handleTweet}
            className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded text-sm font-mono hover:bg-blue-500 transition-colors"
          >
            Tweet Circle
          </button>
        </div>
      )}

      {/* Top callers list */}
      {data && data.callers.length > 0 && (
        <div className="w-full max-w-lg mt-2">
          <h3 className="text-xs uppercase tracking-widest text-text-muted mb-3">
            Top Callers — {timeframe === "all" ? "All Time" : `Last ${timeframe}`}
          </h3>
          <div className="border-t border-border">
            {data.callers.filter((c) => c.tier === 1).map((caller, i) => (
              <Link
                key={caller.handle}
                href={`/${caller.handle}`}
                className="flex items-center justify-between py-2.5 border-b border-border hover:bg-surface/50 transition-colors px-1"
              >
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-xs w-4 text-right">{i + 1}.</span>
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: callerColor(caller.winRate) }}
                  />
                  <span className="text-text-primary text-sm">@{caller.handle}</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span style={{ color: callerColor(caller.winRate) }}>
                    {Math.round(caller.winRate)}% WR
                  </span>
                  <span style={{ color: caller.avgPnl >= 0 ? GREEN : RED }}>
                    {caller.avgPnl >= 0 ? "+" : ""}{caller.avgPnl.toFixed(1)}%
                  </span>
                  <span className="text-text-muted">{caller.totalTrades}t</span>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href="/leaderboard"
            className="block mt-3 text-xs text-text-muted hover:text-accent transition-colors font-mono"
          >
            View Full Leaderboard &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
