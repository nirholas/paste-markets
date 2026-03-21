/**
 * Timestamp integrity & anti-cherry-picking classification.
 *
 * Classifies each trade call based on how quickly the tweet was submitted
 * to paste.trade after being posted on Twitter.
 *
 * Data mapping from paste.trade API:
 *   tweetCreatedAt  = author_date  (when the author posted the tweet)
 *   submittedAt     = posted_at    (when submitted / registered in paste.trade)
 */

export type IntegrityClass =
  | "live"         // < 1 hour delay   — full credit
  | "late"         // 1-24 hours       — flagged, still counted
  | "historical"   // 1-7 days         — allowed for analysis, not in leaderboard
  | "retroactive"  // > 7 days         — analysis only, not counted in stats
  | "unknown";     // missing timestamp data

export interface IntegrityInfo {
  integrity: IntegrityClass;
  delayMinutes: number;
  countedInStats: boolean;
}

export function classifyIntegrity(
  tweetCreatedAt: string | null | undefined,
  submittedAt: string | null | undefined,
): IntegrityInfo {
  if (!tweetCreatedAt || !submittedAt) {
    return { integrity: "unknown", delayMinutes: 0, countedInStats: true };
  }

  const tweetMs = new Date(tweetCreatedAt).getTime();
  const submitMs = new Date(submittedAt).getTime();

  if (isNaN(tweetMs) || isNaN(submitMs)) {
    return { integrity: "unknown", delayMinutes: 0, countedInStats: true };
  }

  // If dates are identical (often the case when paste.trade records both as same), treat as live
  const delayMs = submitMs - tweetMs;
  if (delayMs < 0) {
    // submit before tweet? data error — treat as unknown
    return { integrity: "unknown", delayMinutes: 0, countedInStats: true };
  }

  const delayMinutes = Math.floor(delayMs / 60000);

  let integrity: IntegrityClass;
  if (delayMinutes < 60) {
    integrity = "live";
  } else if (delayMinutes < 24 * 60) {
    integrity = "late";
  } else if (delayMinutes < 7 * 24 * 60) {
    integrity = "historical";
  } else {
    integrity = "retroactive";
  }

  return {
    integrity,
    delayMinutes,
    countedInStats: integrity !== "retroactive",
  };
}

export interface IntegrityBadgeInfo {
  label: string;
  color: "green" | "yellow" | "orange" | "red" | "gray";
  description: string;
  symbol: string;
}

export function getIntegrityBadge(integrity: IntegrityClass): IntegrityBadgeInfo {
  switch (integrity) {
    case "live":
      return {
        label: "LIVE",
        color: "green",
        symbol: "\u2713",
        description: "Called within 1 hour of tweet",
      };
    case "late":
      return {
        label: "LATE",
        color: "yellow",
        symbol: "\u23F0",
        description: "Called 1-24 hours after tweet",
      };
    case "historical":
      return {
        label: "HISTORICAL",
        color: "orange",
        symbol: "\u2691",
        description: "Called 1-7 days after tweet — not on leaderboard",
      };
    case "retroactive":
      return {
        label: "RETROACTIVE",
        color: "red",
        symbol: "\u2716",
        description: "Called 7+ days after tweet — not counted in stats",
      };
    default:
      return {
        label: "UNVERIFIED",
        color: "gray",
        symbol: "?",
        description: "Submission timing unknown",
      };
  }
}

/** Tail-class map for Tailwind (avoids purging dynamic class strings) */
export const INTEGRITY_COLORS: Record<IntegrityClass, { text: string; border: string; bg: string }> = {
  live:        { text: "text-win",    border: "border-win",    bg: "bg-win/10" },
  late:        { text: "text-amber",  border: "border-amber",  bg: "bg-amber/10" },
  historical:  { text: "text-orange-400", border: "border-orange-400", bg: "bg-orange-400/10" },
  retroactive: { text: "text-loss",   border: "border-loss",   bg: "bg-loss/10" },
  unknown:     { text: "text-text-muted", border: "border-border", bg: "bg-surface" },
};

/**
 * Compute the integrity score for a caller: % of calls that were live (< 1 hour).
 */
export function computeIntegrityScore(
  trades: { integrity: IntegrityClass }[],
): number {
  if (trades.length === 0) return 100; // no data → assume clean
  const live = trades.filter((t) => t.integrity === "live").length;
  return Math.round((live / trades.length) * 100);
}

export type IntegrityTier = "live-caller" | "mostly-live" | "cherry-picker";

export function integrityTier(score: number): IntegrityTier {
  if (score >= 90) return "live-caller";
  if (score >= 50) return "mostly-live";
  return "cherry-picker";
}

export interface IntegrityTierInfo {
  tier: IntegrityTier;
  label: string;
  color: "green" | "yellow" | "red";
  description: string;
}

export function getIntegrityTierInfo(tier: IntegrityTier): IntegrityTierInfo {
  switch (tier) {
    case "live-caller":
      return { tier, label: "Live Caller", color: "green", description: "90%+ of calls submitted within 1 hour" };
    case "mostly-live":
      return { tier, label: "Mostly Live", color: "yellow", description: "50-89% of calls submitted live" };
    case "cherry-picker":
      return { tier, label: "Cherry Picker", color: "red", description: "Less than 50% of calls submitted live" };
  }
}

/** Extract tweet ID from a Twitter/X source URL */
export function extractTweetId(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match?.[1] ?? null;
}

/** Format delay for display */
export function formatDelay(delayMinutes: number): string {
  if (delayMinutes < 1) return "< 1 min";
  if (delayMinutes < 60) return `${delayMinutes}m`;
  const hours = Math.floor(delayMinutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
