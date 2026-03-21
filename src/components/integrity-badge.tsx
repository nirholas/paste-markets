import { getIntegrityBadge, INTEGRITY_COLORS, type IntegrityClass } from "@/lib/integrity";

interface IntegrityBadgeProps {
  integrity: IntegrityClass;
  delayMinutes?: number;
  showDelay?: boolean;
  size?: "sm" | "xs";
}

function formatDelay(minutes: number): string {
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function IntegrityBadge({
  integrity,
  delayMinutes,
  showDelay = false,
  size = "xs",
}: IntegrityBadgeProps) {
  const badge = getIntegrityBadge(integrity);
  const colors = INTEGRITY_COLORS[integrity];
  const textSize = size === "sm" ? "text-xs" : "text-[10px]";

  return (
    <span
      title={badge.description}
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono font-bold uppercase tracking-widest ${textSize} ${colors.text} ${colors.border} ${colors.bg}`}
    >
      <span aria-hidden="true">{badge.symbol}</span>
      {badge.label}
      {showDelay && delayMinutes != null && delayMinutes > 0 && (
        <span className="opacity-70 font-normal normal-case tracking-normal">
          +{formatDelay(delayMinutes)}
        </span>
      )}
    </span>
  );
}

interface IntegrityScoreBadgeProps {
  score: number; // 0-100
  totalTrades?: number;
}

export function IntegrityScoreBadge({ score, totalTrades }: IntegrityScoreBadgeProps) {
  const color =
    score >= 90 ? "text-win border-win bg-win/10"
    : score >= 50 ? "text-amber border-amber bg-amber/10"
    : "text-loss border-loss bg-loss/10";

  const tier =
    score >= 90 ? "Live Caller"
    : score >= 50 ? "Mostly Live"
    : "Cherry Picker";

  return (
    <div className="flex items-center gap-3">
      <div className={`border px-3 py-1.5 font-mono font-bold text-sm ${color}`}>
        {score}% LIVE
      </div>
      <div>
        <div className="text-xs font-bold text-text-primary">{tier}</div>
        {totalTrades != null && (
          <div className="text-[11px] text-text-muted">
            {score}% of {totalTrades} calls submitted within 1 hour of tweet
          </div>
        )}
      </div>
    </div>
  );
}

interface IntegrityBreakdownProps {
  live: number;
  late: number;
  historical: number;
  retroactive: number;
  unknown: number;
  total: number;
}

export function IntegrityBreakdown({
  live,
  late,
  historical,
  retroactive,
  unknown,
  total,
}: IntegrityBreakdownProps) {
  const rows: Array<{ label: string; count: number; color: string; description: string }> = [
    { label: "Live", count: live, color: "text-win", description: "< 1h after tweet" },
    { label: "Late", count: late, color: "text-amber", description: "1-24h after tweet" },
    { label: "Historical", count: historical, color: "text-orange-400", description: "1-7d after tweet" },
    { label: "Retroactive", count: retroactive, color: "text-loss", description: "> 7d after tweet" },
    { label: "Unverified", count: unknown, color: "text-text-muted", description: "No timestamp data" },
  ].filter((r) => r.count > 0);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 text-sm">
          <span className={`w-24 text-[11px] uppercase tracking-widest font-mono font-bold ${row.color}`}>
            {row.label}
          </span>
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                row.color === "text-win" ? "bg-win"
                : row.color === "text-amber" ? "bg-amber"
                : row.color === "text-orange-400" ? "bg-orange-400"
                : row.color === "text-loss" ? "bg-loss"
                : "bg-text-muted"
              }`}
              style={{ width: total > 0 ? `${(row.count / total) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-text-muted text-xs w-16 text-right">
            {row.count} ({total > 0 ? Math.round((row.count / total) * 100) : 0}%)
          </span>
          <span className="text-text-muted text-[11px] hidden sm:block w-36">
            {row.description}
          </span>
        </div>
      ))}
    </div>
  );
}
