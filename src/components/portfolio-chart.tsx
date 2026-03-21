"use client";

import { useState, useCallback, useMemo } from "react";

interface TimelinePoint {
  date: string;
  value: number;
}

interface PortfolioChartProps {
  timeline: TimelinePoint[];
  startingCapital: number;
}

export default function PortfolioChart({ timeline, startingCapital }: PortfolioChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 720;
  const height = 320;
  const padding = { top: 24, right: 16, bottom: 40, left: 72 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { points, minVal, maxVal, isPositive, xLabels, yLabels } = useMemo(() => {
    if (timeline.length === 0) {
      return { points: [], minVal: 0, maxVal: 0, isPositive: true, xLabels: [], yLabels: [] };
    }

    const values = timeline.map((t) => t.value);
    const mn = Math.min(...values, startingCapital) * 0.98;
    const mx = Math.max(...values, startingCapital) * 1.02;
    const range = mx - mn || 1;

    const pts = timeline.map((t, i) => ({
      x: padding.left + (i / Math.max(timeline.length - 1, 1)) * chartW,
      y: padding.top + (1 - (t.value - mn) / range) * chartH,
      date: t.date,
      value: t.value,
    }));

    const pos = timeline[timeline.length - 1].value >= startingCapital;

    // X-axis: pick ~5 evenly spaced date labels
    const xCount = Math.min(5, timeline.length);
    const xl: { x: number; label: string }[] = [];
    for (let i = 0; i < xCount; i++) {
      const idx = Math.round((i / Math.max(xCount - 1, 1)) * (timeline.length - 1));
      const d = new Date(timeline[idx].date);
      xl.push({
        x: pts[idx].x,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }

    // Y-axis: 5 labels
    const yl: { y: number; label: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const val = mn + (i / 4) * range;
      yl.push({
        y: padding.top + (1 - i / 4) * chartH,
        label: val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`,
      });
    }

    return { points: pts, minVal: mn, maxVal: mx, isPositive: pos, xLabels: xl, yLabels: yl };
  }, [timeline, startingCapital, chartW, chartH, padding.left, padding.top]);

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [points]);

  // Starting capital horizontal line
  const capitalY = useMemo(() => {
    if (timeline.length === 0) return 0;
    const range = (maxVal - minVal) || 1;
    return padding.top + (1 - (startingCapital - minVal) / range) * chartH;
  }, [timeline, startingCapital, minVal, maxVal, chartH, padding.top]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (points.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * width;
      let closest = 0;
      let closestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs(points[i].x - mouseX);
        if (d < closestDist) {
          closestDist = d;
          closest = i;
        }
      }
      setHoverIndex(closest);
    },
    [points, width],
  );

  const handleMouseLeave = useCallback(() => setHoverIndex(null), []);

  if (timeline.length < 2) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-muted">
        Not enough data to display chart
      </div>
    );
  }

  const lineColor = isPositive ? "#2ecc71" : "#e74c3c";
  const hoverPt = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <line
            key={i}
            x1={padding.left}
            x2={width - padding.right}
            y1={yl.y}
            y2={yl.y}
            stroke="#1a1a2e"
            strokeWidth={1}
          />
        ))}

        {/* Starting capital dashed line */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={capitalY}
          y2={capitalY}
          stroke="#555568"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <text
          x={padding.left - 4}
          y={capitalY - 6}
          textAnchor="end"
          fill="#555568"
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
        >
          start
        </text>

        {/* Area fill under line */}
        <path
          d={`${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`}
          fill={lineColor}
          fillOpacity={0.06}
        />

        {/* Main line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" />

        {/* Y-axis labels */}
        {yLabels.map((yl, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={yl.y + 4}
            textAnchor="end"
            fill="#555568"
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
          >
            {yl.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text
            key={i}
            x={xl.x}
            y={height - 8}
            textAnchor="middle"
            fill="#555568"
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
          >
            {xl.label}
          </text>
        ))}

        {/* Hover indicator */}
        {hoverPt && (
          <>
            <line
              x1={hoverPt.x}
              x2={hoverPt.x}
              y1={padding.top}
              y2={padding.top + chartH}
              stroke="#555568"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={hoverPt.x} cy={hoverPt.y} r={4} fill={lineColor} stroke="#0a0a1a" strokeWidth={2} />

            {/* Tooltip */}
            <rect
              x={Math.min(hoverPt.x - 60, width - padding.right - 120)}
              y={Math.max(hoverPt.y - 44, padding.top)}
              width={120}
              height={32}
              rx={4}
              fill="#0f0f22"
              stroke="#1a1a2e"
              strokeWidth={1}
            />
            <text
              x={Math.min(hoverPt.x, width - padding.right - 60)}
              y={Math.max(hoverPt.y - 22, padding.top + 22)}
              textAnchor="middle"
              fill="#f0f0f0"
              fontSize={11}
              fontFamily="JetBrains Mono, monospace"
              fontWeight={700}
            >
              ${hoverPt.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </text>
            <text
              x={Math.min(hoverPt.x, width - padding.right - 60)}
              y={Math.max(hoverPt.y - 34, padding.top + 10)}
              textAnchor="middle"
              fill="#555568"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
            >
              {new Date(hoverPt.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
