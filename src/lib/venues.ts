/**
 * Venue configuration for multi-venue display.
 * Each venue (Robinhood, Hyperliquid, Polymarket) has different mechanics.
 */

export type VenueKey = "robinhood" | "hyperliquid" | "polymarket";
export type VenueType = "stocks" | "perps" | "prediction";

export interface VenueConfig {
  name: string;
  type: VenueType;
  icon: string;
  color: string;
  pnlLabel: string;
  directionLabels: { long: string; short: string };
  showLeverage?: boolean;
  showProbability?: boolean;
}

export const VENUES: Record<VenueKey, VenueConfig> = {
  robinhood: {
    name: "Robinhood",
    type: "stocks",
    icon: "📈",
    color: "#2ecc71",
    pnlLabel: "P&L",
    directionLabels: { long: "BUY", short: "SELL" },
  },
  hyperliquid: {
    name: "Hyperliquid",
    type: "perps",
    icon: "⚡",
    color: "#3b82f6",
    pnlLabel: "P&L",
    directionLabels: { long: "LONG", short: "SHORT" },
    showLeverage: true,
  },
  polymarket: {
    name: "Polymarket",
    type: "prediction",
    icon: "🎯",
    color: "#f39c12",
    pnlLabel: "Outcome",
    directionLabels: { long: "YES", short: "NO" },
    showProbability: true,
  },
} as const;

/** Filter options for the venue filter component */
export const VENUE_FILTER_OPTIONS = [
  { value: "all", label: "All", icon: "", color: "#3b82f6" },
  { value: "stocks", label: "Stocks", icon: "📈", color: "#2ecc71", venue: "robinhood" as VenueKey },
  { value: "perps", label: "Perps", icon: "⚡", color: "#3b82f6", venue: "hyperliquid" as VenueKey },
  { value: "prediction", label: "Predictions", icon: "🎯", color: "#f39c12", venue: "polymarket" as VenueKey },
] as const;

/** Map a platform string to a VenueKey (with fallback) */
export function platformToVenue(platform?: string | null): VenueKey | null {
  if (!platform) return null;
  const lower = platform.toLowerCase();
  if (lower in VENUES) return lower as VenueKey;
  return null;
}

/** Map a venue type filter to the platform name for API calls */
export function venueTypeToPlatform(venueType: string): string {
  switch (venueType) {
    case "stocks":
      return "robinhood";
    case "perps":
      return "hyperliquid";
    case "prediction":
      return "polymarket";
    default:
      return "all";
  }
}

/** Get venue-specific direction label */
export function getDirectionLabel(
  direction: "long" | "short" | "yes" | "no",
  platform?: string | null,
): string {
  const venue = platformToVenue(platform);
  if (!venue) return direction.toUpperCase();
  const config = VENUES[venue];
  if (direction === "yes" || direction === "long") return config.directionLabels.long;
  return config.directionLabels.short;
}

/** Get the venue config for a platform, or null */
export function getVenueConfig(platform?: string | null): VenueConfig | null {
  const venue = platformToVenue(platform);
  return venue ? VENUES[venue] : null;
}
