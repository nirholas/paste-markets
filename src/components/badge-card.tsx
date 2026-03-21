"use client";

import { TIER_COLORS, BADGE_CATALOG, type BadgeTier, type EarnedBadge } from "@/lib/badges";
import { useState } from "react";

function tierBg(tier: BadgeTier): string {
  const color = TIER_COLORS[tier];
  return `${color}15`; // 15 = ~8% opacity in hex
}

function tierGlow(tier: BadgeTier): string {
  const color = TIER_COLORS[tier];
  return `0 0 12px ${color}40`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

/** Small inline badge for the profile shelf. */
export function BadgeSmall({
  badge,
  earned,
  earnedAt,
}: {
  badge: (typeof BADGE_CATALOG)[number];
  earned: boolean;
  earnedAt?: string;
}) {
  const [hover, setHover] = useState(false);
  const color = TIER_COLORS[badge.tier];

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-mono transition-all ${
          earned
            ? "border-opacity-60"
            : "opacity-30 grayscale border-border"
        }`}
        style={
          earned
            ? {
                borderColor: `${color}60`,
                backgroundColor: tierBg(badge.tier),
                boxShadow: tierGlow(badge.tier),
                color,
              }
            : undefined
        }
      >
        <span className="text-sm">{badge.icon}</span>
        <span
          className={earned ? "" : "text-text-muted"}
          style={earned ? { color } : undefined}
        >
          {badge.name}
        </span>
      </div>

      {/* Tooltip */}
      {hover && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-surface border border-border rounded-lg p-3 shadow-lg pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">{badge.icon}</span>
            <span
              className="text-[12px] font-bold font-mono"
              style={{ color }}
            >
              {badge.name}
            </span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {badge.description}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span
              className="text-[10px] uppercase tracking-widest font-mono"
              style={{ color }}
            >
              {badge.tier}
            </span>
            {earned && earnedAt && (
              <span className="text-[10px] text-text-muted">
                {formatDate(earnedAt)}
              </span>
            )}
            {!earned && (
              <span className="text-[10px] text-text-muted">Locked</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Large badge card for detail views. */
export function BadgeLarge({
  badge,
  earned,
  earnedAt,
}: {
  badge: (typeof BADGE_CATALOG)[number];
  earned: boolean;
  earnedAt?: string;
}) {
  const color = TIER_COLORS[badge.tier];

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        earned ? "" : "opacity-30 grayscale border-border"
      }`}
      style={
        earned
          ? {
              borderColor: `${color}50`,
              backgroundColor: tierBg(badge.tier),
              boxShadow: tierGlow(badge.tier),
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{badge.icon}</span>
        <div>
          <div
            className="text-sm font-bold font-mono"
            style={earned ? { color } : undefined}
          >
            {badge.name}
          </div>
          <div
            className="text-[10px] uppercase tracking-widest font-mono"
            style={earned ? { color } : undefined}
          >
            {badge.tier}
          </div>
        </div>
      </div>
      <p className="text-[12px] text-text-secondary leading-relaxed">
        {badge.description}
      </p>
      {earned && earnedAt && (
        <p className="text-[10px] text-text-muted mt-2">
          Earned {formatDate(earnedAt)}
        </p>
      )}
    </div>
  );
}

/** Badge shelf: shows earned badges first, then dimmed unearned ones. */
export function BadgeShelf({
  earnedBadges,
}: {
  earnedBadges: { id: string; earnedAt: string }[];
}) {
  const earnedMap = new Map(earnedBadges.map((b) => [b.id, b.earnedAt]));

  // Sort: earned first, then by catalog order
  const sorted = [...BADGE_CATALOG].sort((a, b) => {
    const aEarned = earnedMap.has(a.id) ? 0 : 1;
    const bEarned = earnedMap.has(b.id) ? 0 : 1;
    return aEarned - bEarned;
  });

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((badge) => {
        const earnedAt = earnedMap.get(badge.id);
        return (
          <BadgeSmall
            key={badge.id}
            badge={badge}
            earned={!!earnedAt}
            earnedAt={earnedAt}
          />
        );
      })}
    </div>
  );
}
