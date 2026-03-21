/**
 * SVG cumulative PnL chart.
 * Server-compatible (no hooks), Bloomberg terminal aesthetic.
 */

import type { PnlPoint } from "@/lib/metrics";

interface PnlChartProps {
  data: PnlPoint[];
  height?: number;
}

export function PnlChart({ data, height = 120 }: PnlChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
      >
        Not enough data to plot chart
      </div>
    );
  }

  const W = 600;
  const PAD = { top: 12, right: 8, bottom: 20, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = height - PAD.top - PAD.bottom;

  const values = data.map((d) => d.cumulativePnl);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;

  const xAt = (i: number) => PAD.left + (i / (data.length - 1)) * cw;
  const yAt = (v: number) => PAD.top + ch - ((v - minVal) / range) * ch;

  const zeroY = yAt(0);
  const lastVal = values[values.length - 1] ?? 0;
  const lineColor = lastVal >= 0 ? "#2ecc71" : "#e74c3c";
  const fillColor = lastVal >= 0 ? "#2ecc7118" : "#e74c3c18";

  // Build polyline points
  const pts = data.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.cumulativePnl).toFixed(1)}`).join(" ");

  // Area fill path: line points + bottom-right + bottom-left
  const firstX = xAt(0).toFixed(1);
  const lastX = xAt(data.length - 1).toFixed(1);
  const bottomY = (PAD.top + ch).toFixed(1);
  const areaPath = `M ${firstX},${zeroY.toFixed(1)} L ${pts
    .split(" ")
    .map((p, i) => {
      const [x, y] = p.split(",");
      return i === 0 ? `${x},${y}` : `L ${x},${y}`;
    })
    .join(" ")} L ${lastX},${zeroY.toFixed(1)} Z`;

  // Y-axis labels: max, 0, min (deduplicated)
  const yLabels = Array.from(
    new Map(
      [maxVal, 0, minVal].map((v) => [v.toFixed(0), v]),
    ).values(),
  );

  // X-axis: show first and last date labels
  const firstDate = formatShortDate(data[0]!.date);
  const lastDate = formatShortDate(data[data.length - 1]!.date);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="w-full"
      style={{ height, display: "block" }}
      aria-label="Cumulative P&L chart"
    >
      {/* Zero baseline */}
      <line
        x1={PAD.left}
        y1={zeroY}
        x2={W - PAD.right}
        y2={zeroY}
        stroke="#1a1a2e"
        strokeWidth="1"
      />

      {/* Area fill */}
      <path d={areaPath} fill={fillColor} />

      {/* PnL line */}
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" />

      {/* First / last dot */}
      <circle cx={xAt(0)} cy={yAt(values[0]!)} r="2.5" fill={lineColor} />
      <circle
        cx={xAt(data.length - 1)}
        cy={yAt(lastVal)}
        r="3"
        fill={lineColor}
      />

      {/* Y-axis labels */}
      {yLabels.map((v) => (
        <text
          key={v}
          x={PAD.left - 4}
          y={yAt(v) + 4}
          textAnchor="end"
          fontSize="9"
          fill="#555568"
          fontFamily="JetBrains Mono, monospace"
        >
          {v >= 0 ? "+" : ""}
          {v.toFixed(0)}%
        </text>
      ))}

      {/* X-axis date labels */}
      <text
        x={PAD.left}
        y={height - 2}
        fontSize="9"
        fill="#555568"
        fontFamily="JetBrains Mono, monospace"
      >
        {firstDate}
      </text>
      <text
        x={W - PAD.right}
        y={height - 2}
        fontSize="9"
        fill="#555568"
        textAnchor="end"
        fontFamily="JetBrains Mono, monospace"
      >
        {lastDate}
      </text>
    </svg>
  );
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}
