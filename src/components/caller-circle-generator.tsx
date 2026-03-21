"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface CircleCaller {
  rank: number;
  handle: string;
  avatarUrl: string | null;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  totalTrades: number;
  alphaScore: number;
  tier: "S" | "A" | "B" | "C";
  ring: "inner" | "middle" | "outer";
}

interface CircleData {
  callers: CircleCaller[];
  timeframe: string;
  total: number;
  updatedAt: string;
}

const TIMEFRAMES = ["7d", "30d", "all"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

// Ring configuration: [radius, node diameter, border color, border width]
const RING_CONFIG = {
  inner: { r: 120, d: 60, color: "#f39c12", strokeWidth: 2.5 },
  middle: { r: 200, d: 46, color: "#3b82f6", strokeWidth: 2 },
  outer: { r: 275, d: 34, color: "#1a1a2e", strokeWidth: 1.5 },
} as const;

const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const RED = "#e74c3c";
const ACCENT = "#3b82f6";
const AMBER = "#f39c12";

function pnlColor(v: number): string {
  return v >= 0 ? GREEN : RED;
}

function formatPnl(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
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

function tierLabel(tier: string): string {
  switch (tier) {
    case "S": return "Elite";
    case "A": return "Strong";
    case "B": return "Developing";
    default: return "New";
  }
}

// ── SVG Circle Visualization ─────────────────────────────────────────────────

interface CircleSvgProps {
  data: CircleData;
  svgRef: React.RefObject<SVGSVGElement | null>;
  hoveredHandle: string | null;
  onHover: (handle: string | null) => void;
}

function CircleSvg({ data, svgRef, hoveredHandle, onHover }: CircleSvgProps) {
  const SIZE = 620;
  const CX = 310;
  const CY = 310;

  const inner = data.callers.filter((c) => c.ring === "inner");
  const middle = data.callers.filter((c) => c.ring === "middle");
  const outer = data.callers.filter((c) => c.ring === "outer");

  const innerPos = nodePositions(inner.length, RING_CONFIG.inner.r, CX, CY);
  const middlePos = nodePositions(middle.length, RING_CONFIG.middle.r, CX, CY);
  const outerPos = nodePositions(outer.length, RING_CONFIG.outer.r, CX, CY);

  const tfLabel = data.timeframe === "all" ? "ALL TIME" : `LAST ${data.timeframe.toUpperCase()}`;

  const renderNode = (
    caller: CircleCaller,
    pos: { x: number; y: number },
    ring: "inner" | "middle" | "outer",
  ) => {
    const cfg = RING_CONFIG[ring];
    const r = cfg.d / 2;
    const isHovered = hoveredHandle === caller.handle;
    const clipId = `clip-${ring}-${caller.handle}`;

    return (
      <g
        key={`${ring}-${caller.handle}`}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onHover(caller.handle)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Glow on inner ring */}
        {ring === "inner" && (
          <circle
            cx={pos.x}
            cy={pos.y}
            r={r + 6}
            fill={AMBER}
            opacity={isHovered ? 0.2 : 0.08}
          />
        )}
        {ring === "middle" && isHovered && (
          <circle cx={pos.x} cy={pos.y} r={r + 5} fill={ACCENT} opacity={0.15} />
        )}

        {/* Avatar clip path */}
        <defs>
          <clipPath id={clipId}>
            <circle cx={pos.x} cy={pos.y} r={r - cfg.strokeWidth} />
          </clipPath>
        </defs>

        {/* Avatar background */}
        <circle
          cx={pos.x}
          cy={pos.y}
          r={r}
          fill={SURFACE}
          stroke={isHovered ? TEXT : cfg.color}
          strokeWidth={cfg.strokeWidth}
        />

        {/* Avatar image or fallback */}
        {caller.avatarUrl ? (
          <image
            href={caller.avatarUrl}
            x={pos.x - r + cfg.strokeWidth}
            y={pos.y - r + cfg.strokeWidth}
            width={(r - cfg.strokeWidth) * 2}
            height={(r - cfg.strokeWidth) * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <text
            x={pos.x}
            y={pos.y + (ring === "outer" ? 3 : 4)}
            textAnchor="middle"
            fill={cfg.color}
            fontSize={ring === "outer" ? 9 : ring === "middle" ? 11 : 13}
            fontFamily="monospace"
            fontWeight="700"
          >
            {caller.handle.slice(0, 2).toUpperCase()}
          </text>
        )}

        {/* Handle label below node */}
        <text
          x={pos.x}
          y={pos.y + r + (ring === "outer" ? 10 : 13)}
          textAnchor="middle"
          fill={isHovered ? TEXT : ring === "outer" ? MUTED : TEXT}
          fontSize={ring === "outer" ? 7 : ring === "middle" ? 8 : 9}
          fontFamily="monospace"
          fontWeight={ring === "inner" ? "600" : "400"}
        >
          @{caller.handle.length > 12 ? caller.handle.slice(0, 11) + "\u2026" : caller.handle}
        </text>

        {/* Rank badge for inner ring */}
        {ring === "inner" && (
          <>
            <circle
              cx={pos.x + r - 4}
              cy={pos.y - r + 4}
              r={9}
              fill={AMBER}
            />
            <text
              x={pos.x + r - 4}
              y={pos.y - r + 8}
              textAnchor="middle"
              fill={BG}
              fontSize="9"
              fontFamily="monospace"
              fontWeight="800"
            >
              {caller.rank}
            </text>
          </>
        )}
      </g>
    );
  };

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
      <rect width={SIZE} height={SIZE} rx="8" fill={BG} />

      {/* Ring guide circles */}
      <circle cx={CX} cy={CY} r={RING_CONFIG.outer.r} fill="none" stroke={BORDER} strokeWidth="1" strokeDasharray="4 6" opacity="0.5" />
      <circle cx={CX} cy={CY} r={RING_CONFIG.middle.r} fill="none" stroke={ACCENT} strokeWidth="1" strokeDasharray="4 6" opacity="0.2" />
      <circle cx={CX} cy={CY} r={RING_CONFIG.inner.r} fill="none" stroke={AMBER} strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />

      {/* Center hub */}
      <circle cx={CX} cy={CY} r={55} fill={SURFACE} stroke={AMBER} strokeWidth="1.5" opacity="0.9" />
      <text x={CX} y={CY - 14} textAnchor="middle" fill={AMBER} fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="2">
        TOP {data.total}
      </text>
      <text x={CX} y={CY + 2} textAnchor="middle" fill={TEXT} fontSize="12" fontFamily="monospace" fontWeight="700" letterSpacing="1">
        CALLERS
      </text>
      <text x={CX} y={CY + 18} textAnchor="middle" fill={MUTED} fontSize="9" fontFamily="monospace" letterSpacing="0.5">
        {tfLabel}
      </text>

      {/* Outer ring nodes */}
      {outer.map((c, i) => renderNode(c, outerPos[i]!, "outer"))}

      {/* Middle ring nodes */}
      {middle.map((c, i) => renderNode(c, middlePos[i]!, "middle"))}

      {/* Inner ring nodes */}
      {inner.map((c, i) => renderNode(c, innerPos[i]!, "inner"))}

      {/* Ring labels */}
      <text x={CX} y={CY - RING_CONFIG.inner.r - 14} textAnchor="middle" fill={AMBER} fontSize="8" fontFamily="monospace" fontWeight="600" letterSpacing="1.5" opacity="0.7">
        INNER CIRCLE
      </text>

      {/* Watermark */}
      <text x={CX} y={SIZE - 10} textAnchor="middle" fill={MUTED} fontSize="8.5" fontFamily="monospace" letterSpacing="0.5" opacity="0.7">
        paste.markets
      </text>
    </svg>
  );
}

// ── Hover Tooltip ─────────────────────────────────────────────────────────────

function Tooltip({ caller }: { caller: CircleCaller }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-xl font-mono text-xs min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        {caller.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={caller.avatarUrl}
            alt={caller.handle}
            className="w-7 h-7 rounded-full border border-border"
          />
        )}
        <div>
          <div className="text-text-primary font-semibold">@{caller.handle}</div>
          <div className="text-text-muted text-[10px]">Rank #{caller.rank} · {tierLabel(caller.tier)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-text-muted">Win Rate</span>
        <span className="text-right" style={{ color: caller.winRate >= 50 ? GREEN : RED }}>
          {caller.winRate.toFixed(1)}%
        </span>
        <span className="text-text-muted">Avg P&L</span>
        <span className="text-right" style={{ color: pnlColor(caller.avgPnl) }}>
          {formatPnl(caller.avgPnl)}
        </span>
        <span className="text-text-muted">Trades</span>
        <span className="text-right text-text-secondary">{caller.totalTrades}</span>
        <span className="text-text-muted">Alpha</span>
        <span className="text-right text-text-secondary">{caller.alphaScore.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function CircleSkeleton() {
  return (
    <svg viewBox="0 0 620 620" className="w-full h-full" style={{ maxWidth: 620 }}>
      <rect width="620" height="620" rx="8" fill={BG} />
      {[275, 200, 120].map((r, i) => (
        <circle
          key={r}
          cx="310"
          cy="310"
          r={r}
          fill="none"
          stroke={BORDER}
          strokeWidth="1"
          opacity={0.3 + i * 0.15}
        >
          <animate attributeName="opacity" values={`${0.2 + i * 0.1};${0.5 + i * 0.1};${0.2 + i * 0.1}`} dur="2s" repeatCount="indefinite" />
        </circle>
      ))}
      <circle cx="310" cy="310" r="55" fill={SURFACE} stroke={BORDER} strokeWidth="1.5">
        <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x="310" y="314" textAnchor="middle" fill={MUTED} fontSize="10" fontFamily="monospace">
        Loading...
      </text>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CallerCircleGenerator() {
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [data, setData] = useState<CircleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const fetchCircle = useCallback(async (tf: Timeframe) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circle?timeframe=${tf}&limit=50`);
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
      const scale = 2;
      canvas.width = 620 * scale;
      canvas.height = 620 * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const link = document.createElement("a");
        link.download = `paste-markets-circle-${timeframe}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setDownloading(false);
      };
      img.onerror = () => setDownloading(false);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);
    } catch {
      setDownloading(false);
    }
  }, [timeframe]);

  const handleTweet = useCallback(() => {
    if (!data) return;
    const top3 = data.callers.filter((c) => c.ring === "inner").slice(0, 3);
    const handles = top3.map((c) => `@${c.handle}`).join(" ");
    const tfLabel = timeframe === "all" ? "all time" : `last ${timeframe}`;
    const text = `CT Caller Circle (${tfLabel})\n\nTop callers: ${handles}\n\nPowered by @pastetrade\npaste.markets/circle`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [data, timeframe]);

  const hoveredCaller = data?.callers.find((c) => c.handle === hoveredHandle) ?? null;

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
      <div className="relative w-full max-w-[620px] aspect-square">
        {loading && <CircleSkeleton />}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface border border-border rounded-lg">
            <span className="text-red-400 text-sm font-mono">{error}</span>
            <button
              onClick={() => fetchCircle(timeframe)}
              className="text-xs text-accent hover:underline font-mono"
            >
              Retry
            </button>
          </div>
        )}

        {!error && !loading && data && (
          <CircleSvg data={data} svgRef={svgRef} hoveredHandle={hoveredHandle} onHover={setHoveredHandle} />
        )}

        {!error && !data && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface border border-border rounded-lg">
            <span className="text-text-muted text-sm font-mono">No data available</span>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredCaller && (
          <div className="absolute top-4 right-4 z-20 pointer-events-none animate-[fadeIn_0.15s_ease-out]">
            <Tooltip caller={hoveredCaller} />
          </div>
        )}
      </div>

      {/* Ring legend */}
      {data && data.callers.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2" style={{ borderColor: AMBER }} />
            Inner (#1-5)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2" style={{ borderColor: ACCENT }} />
            Middle (#6-15)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2" style={{ borderColor: BORDER }} />
            Outer (#16-50)
          </span>
        </div>
      )}

      {/* Action buttons */}
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

      {/* Top callers list (fallback / supplementary) */}
      {data && data.callers.length > 0 && (
        <div className="w-full max-w-2xl mt-4">
          <h3 className="text-xs uppercase tracking-widest text-text-muted mb-3">
            Top 50 Callers — {timeframe === "all" ? "All Time" : `Last ${timeframe}`}
          </h3>

          {/* Mobile-friendly list view */}
          <div className="border-t border-border">
            {data.callers.map((caller) => (
              <Link
                key={caller.handle}
                href={`/${caller.handle}`}
                className="flex items-center justify-between py-2.5 border-b border-border hover:bg-surface/50 transition-colors px-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-xs w-5 text-right font-mono">
                    {caller.rank}.
                  </span>
                  {caller.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={caller.avatarUrl}
                      alt={caller.handle}
                      className="w-6 h-6 rounded-full border"
                      style={{
                        borderColor: caller.ring === "inner" ? AMBER : caller.ring === "middle" ? ACCENT : BORDER,
                      }}
                    />
                  ) : (
                    <span
                      className="w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold font-mono"
                      style={{
                        borderColor: caller.ring === "inner" ? AMBER : caller.ring === "middle" ? ACCENT : BORDER,
                        background: SURFACE,
                        color: caller.ring === "inner" ? AMBER : caller.ring === "middle" ? ACCENT : MUTED,
                      }}
                    >
                      {caller.handle.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="text-text-primary text-sm font-mono">@{caller.handle}</span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      color: caller.tier === "S" ? AMBER : caller.tier === "A" ? GREEN : caller.tier === "B" ? ACCENT : MUTED,
                      background: caller.tier === "S" ? "rgba(243,156,18,0.12)" : caller.tier === "A" ? "rgba(46,204,113,0.10)" : caller.tier === "B" ? "rgba(59,130,246,0.10)" : "rgba(85,85,104,0.10)",
                    }}
                  >
                    {caller.tier}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span style={{ color: caller.winRate >= 50 ? GREEN : RED }}>
                    {caller.winRate.toFixed(1)}%
                  </span>
                  <span style={{ color: pnlColor(caller.avgPnl) }}>
                    {formatPnl(caller.avgPnl)}
                  </span>
                  <span className="text-text-muted hidden sm:inline">{caller.totalTrades}t</span>
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
