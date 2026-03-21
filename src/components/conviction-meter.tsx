"use client";

interface ConvictionMeterProps {
  longPct: number; // 0-100
  shortPct: number; // 0-100
  ticker: string;
  consensus: "strong_long" | "strong_short" | "contested" | "mixed";
}

export default function ConvictionMeter({
  longPct,
  shortPct,
  ticker,
  consensus,
}: ConvictionMeterProps) {
  const borderColor =
    consensus === "strong_long"
      ? "#2ecc71"
      : consensus === "strong_short"
        ? "#e74c3c"
        : consensus === "contested"
          ? "#f39c12"
          : "#555568";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "#2ecc71" }}>{longPct}% long</span>
        <span className="text-[#f0f0f0] font-bold text-sm">${ticker}</span>
        <span style={{ color: "#e74c3c" }}>{shortPct}% short</span>
      </div>
      <div
        className="h-3 w-full rounded-sm overflow-hidden flex"
        style={{ border: `1px solid ${borderColor}` }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${longPct}%`,
            background:
              "linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)",
          }}
        />
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${shortPct}%`,
            background:
              "linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)",
          }}
        />
      </div>
    </div>
  );
}
