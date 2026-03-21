import { VENUES, platformToVenue, type VenueKey } from "@/lib/venues";

export interface VenueStat {
  venue: VenueKey;
  trades: number;
  winRate: number;
  avgPnl: number;
}

interface VenueBreakdownProps {
  stats: VenueStat[];
}

function formatPnl(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function VenueBreakdown({ stats }: VenueBreakdownProps) {
  if (stats.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-text-muted font-normal">
          Venue Performance
        </h3>
      </div>
      <div className="divide-y divide-border">
        {stats.map((s) => {
          const config = VENUES[s.venue];
          const winColor =
            s.winRate >= 65
              ? "text-win"
              : s.winRate >= 50
                ? "text-amber"
                : "text-loss";
          const pnlColor = s.avgPnl >= 0 ? "text-win" : "text-loss";

          // Win rate bar
          const filled = Math.round((s.winRate / 100) * 8);
          const empty = 8 - filled;

          return (
            <div key={s.venue} className="px-4 py-3 flex items-center gap-4">
              {/* Venue icon + name */}
              <div className="flex items-center gap-2 w-32 shrink-0">
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full text-xs"
                  style={{ backgroundColor: `${config.color}20`, color: config.color }}
                >
                  {config.icon}
                </span>
                <span className="text-text-secondary text-[13px] font-medium">
                  {config.name}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-[13px] flex-1">
                <span className="text-text-muted">
                  {s.trades} {s.trades === 1 ? "trade" : "trades"}
                </span>
                <span className={`font-bold ${winColor}`}>
                  {Math.round(s.winRate)}% win
                </span>
                <span className={`font-bold ${pnlColor}`}>
                  {formatPnl(s.avgPnl)} avg
                </span>
              </div>

              {/* Mini bar */}
              <div className="hidden sm:block text-xs font-mono">
                <span className="text-win">{"\u2588".repeat(filled)}</span>
                <span className="text-text-muted/40">{"\u2591".repeat(empty)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compute venue stats from trades array.
 * Each trade should have a `platform` and `pnl_pct` field.
 */
export function computeVenueStats(
  trades: Array<{ platform?: string; pnl_pct: number }>,
): VenueStat[] {
  const map = new Map<VenueKey, { trades: number; wins: number; pnlSum: number }>();

  for (const t of trades) {
    const venue = platformToVenue(t.platform);
    if (!venue) continue;

    let entry = map.get(venue);
    if (!entry) {
      entry = { trades: 0, wins: 0, pnlSum: 0 };
      map.set(venue, entry);
    }
    entry.trades += 1;
    if (t.pnl_pct > 0) entry.wins += 1;
    entry.pnlSum += t.pnl_pct;
  }

  const stats: VenueStat[] = [];
  for (const [venue, data] of map.entries()) {
    stats.push({
      venue,
      trades: data.trades,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      avgPnl: data.trades > 0 ? data.pnlSum / data.trades : 0,
    });
  }

  // Sort by trade count descending
  stats.sort((a, b) => b.trades - a.trades);
  return stats;
}
