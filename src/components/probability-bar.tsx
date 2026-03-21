"use client";

interface ProbabilityBarProps {
  currentProbability: number;   // 0-1
  entryProbability: number;     // 0-1
  direction: "yes" | "no";
}

export function ProbabilityBar({ currentProbability, entryProbability, direction }: ProbabilityBarProps) {
  const currentPct = Math.round(currentProbability * 100);
  const entryPct = Math.round(entryProbability * 100);

  // Green if moving in caller's direction, red if against
  const movingInFavor =
    direction === "yes"
      ? currentProbability >= entryProbability
      : currentProbability <= entryProbability;

  const fillColor = movingInFavor ? "bg-win" : "bg-loss";
  const markerColor = movingInFavor ? "border-win" : "border-loss";

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="flex justify-between text-[11px] font-mono mb-1">
        <span className="text-win">YES {currentPct}%</span>
        <span className="text-loss">NO {100 - currentPct}%</span>
      </div>

      {/* Bar */}
      <div className="relative h-3 bg-surface border border-border rounded-full overflow-visible">
        {/* Filled portion */}
        <div
          className={`h-full ${fillColor} rounded-full transition-all duration-500`}
          style={{ width: `${currentPct}%` }}
        />

        {/* Entry marker */}
        <div
          className={`absolute top-[-3px] w-0.5 h-[18px] ${markerColor} border-l-2`}
          style={{ left: `${entryPct}%` }}
          title={`Entry: ${entryPct}%`}
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-text-muted font-mono whitespace-nowrap">
            {entryPct}%
          </div>
        </div>
      </div>
    </div>
  );
}
