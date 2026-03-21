export interface TradePoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  size: number;
  color: string;
  altitude?: number;
  /** "caller" or "ticker" — determines click navigation */
  type: "caller" | "ticker";
  /** Number of trades for this point */
  tradeCount: number;
  /** Win rate (0-100) for callers, bull ratio for tickers */
  winRate?: number;
  /** Average P&L % */
  avgPnl?: number;
  /** Location label (city name) for callers */
  locationLabel?: string;
}

export interface TradeArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  stroke: number;
  label: string;
  ticker: string;
  pnl: number;
  author: string;
  direction?: string;
  dashGap?: number;
  dashAnimateTime?: number;
}

export interface GlobeData {
  points: TradePoint[];
  arcs: TradeArc[];
}

export interface GlobeStats {
  totalTrades: number;
  activeTickers: number;
  activeCallers: number;
  avgPnl: number;
  realLocations?: number;
  totalLocationsInDb?: number;
}
