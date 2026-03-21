"use client";

const COLORS = [
  { stroke: "#3b82f6", fill: "rgba(59,130,246,0.15)" },  // blue
  { stroke: "#2ecc71", fill: "rgba(46,204,113,0.15)" },  // green
  { stroke: "#f39c12", fill: "rgba(243,156,18,0.15)" },  // amber
  { stroke: "#e74c3c", fill: "rgba(231,76,60,0.15)" },   // red
];

interface RadarAxis {
  label: string;
  key: string;
}

interface RadarDataPoint {
  handle: string;
  values: Record<string, number>; // 0-100 per axis
}

interface RadarChartProps {
  axes: RadarAxis[];
  data: RadarDataPoint[];
  size?: number;
}

export function RadarChart({ axes, data, size = 300 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const levels = 5; // concentric rings

  const angleStep = (2 * Math.PI) / axes.length;
  // Start from top (-90 degrees)
  const startAngle = -Math.PI / 2;

  function getPoint(axisIndex: number, value: number): { x: number; y: number } {
    const angle = startAngle + axisIndex * angleStep;
    const r = (value / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  function getLabelPos(axisIndex: number): { x: number; y: number; anchor: string } {
    const angle = startAngle + axisIndex * angleStep;
    const r = radius + 20;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    let anchor = "middle";
    if (Math.cos(angle) > 0.3) anchor = "start";
    else if (Math.cos(angle) < -0.3) anchor = "end";

    return { x, y, anchor };
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="max-w-full h-auto"
      >
        {/* Concentric rings */}
        {Array.from({ length: levels }, (_, i) => {
          const levelRadius = ((i + 1) / levels) * radius;
          const points = axes
            .map((_, j) => {
              const angle = startAngle + j * angleStep;
              return `${cx + levelRadius * Math.cos(angle)},${cy + levelRadius * Math.sin(angle)}`;
            })
            .join(" ");
          return (
            <polygon
              key={`ring-${i}`}
              points={points}
              fill="none"
              stroke="#1a1a2e"
              strokeWidth={i === levels - 1 ? 1.5 : 0.5}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const end = getPoint(i, 100);
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="#1a1a2e"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Data polygons */}
        {data.map((d, di) => {
          const color = COLORS[di % COLORS.length];
          const points = axes
            .map((axis, i) => {
              const val = d.values[axis.key] ?? 0;
              const p = getPoint(i, val);
              return `${p.x},${p.y}`;
            })
            .join(" ");

          return (
            <polygon
              key={`data-${di}`}
              points={points}
              fill={color.fill}
              stroke={color.stroke}
              strokeWidth={2}
            />
          );
        })}

        {/* Data points (dots) */}
        {data.map((d, di) => {
          const color = COLORS[di % COLORS.length];
          return axes.map((axis, i) => {
            const val = d.values[axis.key] ?? 0;
            const p = getPoint(i, val);
            return (
              <circle
                key={`dot-${di}-${i}`}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={color.stroke}
              />
            );
          });
        })}

        {/* Axis labels */}
        {axes.map((axis, i) => {
          const pos = getLabelPos(i);
          return (
            <text
              key={`label-${i}`}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              dominantBaseline="central"
              className="fill-text-muted"
              style={{ fontSize: "11px", fontFamily: "var(--font-jetbrains), monospace", textTransform: "uppercase", letterSpacing: "0.5px" }}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center">
        {data.map((d, di) => {
          const color = COLORS[di % COLORS.length];
          return (
            <div key={d.handle} className="flex items-center gap-2 text-xs font-mono">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: color.stroke }}
              />
              <span className="text-text-secondary">@{d.handle}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
