interface PnlDisplayProps {
  value: number;
  prefix?: string;
}

export function PnlDisplay({ value, prefix }: PnlDisplayProps) {
  const isPositive = value >= 0;
  const sign = isPositive ? "+" : "";
  const color = isPositive ? "text-win" : "text-loss";

  return (
    <span className={color}>
      {prefix}
      {sign}
      {value.toFixed(1)}%
    </span>
  );
}
