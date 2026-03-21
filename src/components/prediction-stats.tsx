import Link from "next/link";
import type { PredictionTrade } from "@/lib/types";

interface PredictionStatsProps {
  handle: string;
}

export async function PredictionStats({ handle }: PredictionStatsProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let trades: PredictionTrade[] = [];

  try {
    const res = await fetch(
      `${baseUrl}/api/predictions?handle=${encodeURIComponent(handle)}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = await res.json();
      trades = data.trades ?? [];
    }
  } catch {
    // prediction stats are optional
  }

  if (trades.length === 0) return null;

  const resolved = trades.filter((t) => t.resolved);
  const correct = resolved.filter((t) => t.resolution === t.direction);
  const active = trades.filter((t) => !t.resolved);

  const accuracy = resolved.length > 0
    ? Math.round((correct.length / resolved.length) * 100)
    : 0;

  const avgDelta = resolved.length > 0
    ? parseFloat(
        (
          resolved.reduce((sum, t) => {
            const exitProb = t.exit_probability ?? (t.resolution === "yes" ? 1 : 0);
            return sum + Math.abs(exitProb - t.entry_probability);
          }, 0) / resolved.length
        ).toFixed(2),
      )
    : 0;

  const bestPrediction = [...trades]
    .filter((t) => t.pnl_pct != null)
    .sort((a, b) => b.pnl_pct - a.pnl_pct)[0] ?? null;

  function accuracyColor(pct: number): string {
    if (pct >= 70) return "text-win";
    if (pct >= 50) return "text-amber";
    return "text-loss";
  }

  return (
    <div className="mt-10">
      <h2 className="text-xs uppercase tracking-widest text-text-muted mb-4">
        Prediction Markets
      </h2>
      <div className="bg-surface border border-border rounded-lg p-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Accuracy</div>
            <div className={`text-lg font-bold ${accuracyColor(accuracy)}`}>
              {resolved.length > 0 ? `${accuracy}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Avg Delta</div>
            <div className="text-lg font-bold text-amber">
              {resolved.length > 0 ? `${Math.round(avgDelta * 100)}pp` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Best Call</div>
            <div className="text-lg font-bold text-win">
              {bestPrediction ? `+${bestPrediction.pnl_pct.toFixed(1)}%` : "--"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Active</div>
            <div className="text-lg font-bold text-text-primary">{active.length}</div>
          </div>
        </div>

        {/* Active predictions list */}
        {active.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            {active.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-[10px] uppercase font-bold px-1 py-0.5 rounded ${
                      t.direction === "yes"
                        ? "text-win bg-win/10"
                        : "text-loss bg-loss/10"
                    }`}
                  >
                    {t.direction}
                  </span>
                  <span className="text-text-primary truncate">{t.event_title}</span>
                </div>
                <span className={`font-mono font-bold flex-shrink-0 ml-2 ${t.pnl_pct >= 0 ? "text-win" : "text-loss"}`}>
                  {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Link to full predictions */}
        <div className="mt-3 pt-3 border-t border-border">
          <Link
            href={`/predictions`}
            className="text-[11px] text-text-muted hover:text-amber transition-colors font-mono"
          >
            View all predictions &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
