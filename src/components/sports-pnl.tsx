"use client";

interface SportsPnlProps {
  direction: "yes" | "no";
  entryProbability: number; // 0-1
  currentProbability: number; // 0-1
  settled?: boolean;
  outcome?: "yes" | "no" | null;
}

/**
 * Sports-specific PnL display that shows probability-based returns.
 * For event/sports markets where positions are priced as probabilities.
 */
export function SportsPnl({
  direction,
  entryProbability,
  currentProbability,
  settled = false,
  outcome = null,
}: SportsPnlProps) {
  const entryPct = Math.round(entryProbability * 100);
  const currentPct = Math.round(currentProbability * 100);

  let pnl: number;
  let description: string;
  let costBasis: string;
  let currentValue: string;

  if (settled && outcome) {
    const settledValue = direction === outcome ? 1 : 0;
    const entry = direction === "yes" ? entryProbability : 1 - entryProbability;
    pnl = entry > 0 ? ((settledValue - entry) / entry) * 100 : 0;

    costBasis = `$${entry.toFixed(2)}`;
    currentValue = `$${settledValue.toFixed(2)}`;
    description = `Called ${direction.toUpperCase()} at ${entryPct}% · Settled ${outcome.toUpperCase()} · PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
  } else {
    if (direction === "yes") {
      pnl = entryProbability > 0
        ? ((currentProbability - entryProbability) / entryProbability) * 100
        : 0;
      costBasis = `$${entryProbability.toFixed(2)}`;
      currentValue = `$${currentProbability.toFixed(2)}`;
    } else {
      const entryNo = 1 - entryProbability;
      const currentNo = 1 - currentProbability;
      pnl = entryNo > 0 ? ((currentNo - entryNo) / entryNo) * 100 : 0;
      costBasis = `$${entryNo.toFixed(2)}`;
      currentValue = `$${currentNo.toFixed(2)}`;
    }
    description = `Called ${direction.toUpperCase()} at ${entryPct}% · Now at ${currentPct}% · PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%`;
  }

  const pnlColor = pnl >= 0 ? "text-win" : "text-loss";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2">
        <span className={`text-lg font-bold font-mono ${pnlColor}`}>
          {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
        </span>
        {settled && outcome && (
          <span className={`text-[10px] uppercase tracking-widest font-bold ${
            direction === outcome ? "text-win" : "text-loss"
          }`}>
            {direction === outcome ? "CORRECT" : "WRONG"}
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-muted font-mono">
        {description}
      </p>
      <p className="text-[10px] text-text-muted font-mono">
        (bought $1 of {direction.toUpperCase()} at {costBasis}, {settled ? "settled" : "now worth"} {currentValue})
      </p>
    </div>
  );
}
