export interface TradePoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  size: number;
  color: string;
  altitude?: number;
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
}
