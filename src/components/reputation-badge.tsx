/**
 * ReputationBadge — reusable tier badge component.
 *
 * Usage (inline, e.g. on trade cards):
 *   <ReputationBadge tier="Alpha" score={82} size="sm" />
 *
 * Usage (full display, e.g. on profile headers):
 *   <ReputationBadge tier="Alpha" score={82} size="lg" showScore />
 */

import { type ReputationTier, tierEmoji, tierColor } from "@/lib/reputation";

export type { ReputationTier };

interface ReputationBadgeProps {
  tier: ReputationTier;
  score?: number;
  /** sm = compact inline badge · md = default · lg = hero display */
  size?: "sm" | "md" | "lg";
  showScore?: boolean;
  className?: string;
}

export function ReputationBadge({
  tier,
  score,
  size = "md",
  showScore = false,
  className = "",
}: ReputationBadgeProps) {
  // "Unranked" gets no visual badge
  if (tier === "Unranked") return null;

  const color = tierColor(tier);
  const emoji = tierEmoji(tier);

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[9px] font-bold font-mono px-1 py-0.5 rounded leading-none flex-shrink-0 ${className}`}
        style={{
          color,
          border: `1px solid ${color}`,
          background: `${color}14`,
        }}
        title={`${tier}${score !== undefined ? ` · ${score}/100` : ""}`}
      >
        {emoji} {tier}
        {showScore && score !== undefined && <span className="opacity-70 ml-0.5">{score}</span>}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className="text-2xl font-bold font-mono"
          style={{ color }}
        >
          {emoji} {tier}
        </div>
        {score !== undefined && (
          <div className="text-xl font-bold font-mono" style={{ color }}>
            · {score}/100
          </div>
        )}
      </div>
    );
  }

  // md (default)
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold font-mono px-1.5 py-0.5 rounded leading-none ${className}`}
      style={{
        color,
        border: `1px solid ${color}`,
        background: `${color}14`,
      }}
    >
      {emoji} {tier}
      {showScore && score !== undefined && (
        <span className="opacity-70 ml-0.5 font-normal">{score}/100</span>
      )}
    </span>
  );
}

/** Score breakdown bar used in the expanded profile panel */
interface ScoreBarProps {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
  color: string;
}

export function ScoreBar({ label, score, maxScore, detail, color }: ScoreBarProps) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] font-bold font-mono" style={{ color }}>
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden border border-border">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-[10px] text-text-muted mt-0.5">{detail}</div>
    </div>
  );
}

/** Full score breakdown panel (collapsible) */
interface ScoreBreakdownPanelProps {
  breakdown: {
    accuracy:      { score: number; maxScore: number; detail: string };
    returnQuality: { score: number; maxScore: number; detail: string };
    consistency:   { score: number; maxScore: number; detail: string };
    integrity:     { score: number; maxScore: number; detail: string };
    breadth:       { score: number; maxScore: number; detail: string };
  };
  tier: ReputationTier;
}

export function ScoreBreakdownPanel({ breakdown, tier }: ScoreBreakdownPanelProps) {
  const color = tierColor(tier);

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mt-2">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-4">
        Score Breakdown
      </div>
      <ScoreBar label="Accuracy"       color={color} {...breakdown.accuracy} />
      <ScoreBar label="Return Quality" color={color} {...breakdown.returnQuality} />
      <ScoreBar label="Consistency"    color={color} {...breakdown.consistency} />
      <ScoreBar label="Integrity"      color={color} {...breakdown.integrity} />
      <ScoreBar label="Breadth"        color={color} {...breakdown.breadth} />
    </div>
  );
}
