interface WinRateBarProps {
  pct: number;
  length?: number;
}

export function WinRateBar({ pct, length = 10 }: WinRateBarProps) {
  const filled = Math.round((pct / 100) * length);
  const empty = length - filled;

  return (
    <span className="text-win font-mono text-xs tracking-tight">
      {"\u2588".repeat(filled)}
      <span className="text-text-muted">{"\u2591".repeat(empty)}</span>
    </span>
  );
}
