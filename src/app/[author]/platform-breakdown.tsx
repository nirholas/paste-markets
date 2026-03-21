interface PlatformBreakdownProps {
  platforms: Record<string, number>;
}

export function PlatformBreakdown({ platforms }: PlatformBreakdownProps) {
  const entries = Object.entries(platforms)
    .filter(([name]) => name !== "unknown")
    .sort(([, a], [, b]) => b - a);

  if (entries.length === 0) return null;

  const maxCount = Math.max(...entries.map(([, count]) => count));

  return (
    <div className="space-y-2">
      {entries.map(([name, count]) => {
        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return (
          <div key={name} className="flex items-center gap-3 text-[13px]">
            <span className="text-text-secondary w-28 shrink-0 capitalize">
              {name}
            </span>
            <div className="flex-1 h-3 bg-border/30 rounded overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-text-muted text-xs w-20 text-right">
              {count} {count === 1 ? "trade" : "trades"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
