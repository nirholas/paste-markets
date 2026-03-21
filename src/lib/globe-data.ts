import type { TradePoint, TradeArc, GlobeData } from "./globe-types";

// Major financial cities — callers get deterministically assigned
const CALLER_CITIES = [
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Tokyo", lat: 35.68, lng: 139.65 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "San Francisco", lat: 37.77, lng: -122.42 },
  { name: "Dubai", lat: 25.20, lng: 55.27 },
  { name: "Seoul", lat: 37.57, lng: 126.98 },
  { name: "Berlin", lat: 52.52, lng: 13.41 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Mumbai", lat: 19.08, lng: 72.88 },
  { name: "Toronto", lat: 43.65, lng: -79.38 },
  { name: "Hong Kong", lat: 22.32, lng: 114.17 },
  { name: "Lagos", lat: 6.52, lng: 3.38 },
  { name: "Miami", lat: 25.76, lng: -80.19 },
];

// Ticker locations — tickers get mapped to exchange cities
const TICKER_CITIES = [
  { name: "NYSE", lat: 40.71, lng: -74.01 },
  { name: "NASDAQ", lat: 40.76, lng: -73.98 },
  { name: "CME", lat: 41.88, lng: -87.63 },
  { name: "LSE", lat: 51.51, lng: -0.09 },
  { name: "TSE", lat: 35.68, lng: 139.77 },
  { name: "HKEX", lat: 22.28, lng: 114.16 },
  { name: "Binance", lat: 1.29, lng: 103.85 },
  { name: "Coinbase", lat: 37.79, lng: -122.40 },
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getCallerLocation(handle: string): { lat: number; lng: number; cityName: string } {
  const hash = hashString(handle);
  const city = CALLER_CITIES[hash % CALLER_CITIES.length]!;
  // Add jitter so callers in the same city don't overlap
  const jitterLat = ((hash % 100) / 100) * 2 - 1;
  const jitterLng = (((hash >> 8) % 100) / 100) * 2 - 1;
  return { lat: city.lat + jitterLat, lng: city.lng + jitterLng, cityName: city.name };
}

function getTickerLocation(ticker: string): { lat: number; lng: number } {
  const hash = hashString(ticker);
  const city = TICKER_CITIES[hash % TICKER_CITIES.length]!;
  const jitterLat = ((hash % 50) / 50) * 0.5 - 0.25;
  const jitterLng = (((hash >> 4) % 50) / 50) * 0.5 - 0.25;
  return { lat: city.lat + jitterLat, lng: city.lng + jitterLng };
}

export interface TradeInput {
  author: string;
  ticker: string;
  pnl: number;
  direction?: string;
}

export function buildGlobeData(trades: TradeInput[]): GlobeData {
  const callerMap = new Map<string, { loc: ReturnType<typeof getCallerLocation>; tradeCount: number }>();
  const tickerMap = new Map<string, { loc: ReturnType<typeof getTickerLocation>; tradeCount: number }>();

  // Collect caller and ticker locations
  for (const trade of trades) {
    if (!callerMap.has(trade.author)) {
      callerMap.set(trade.author, { loc: getCallerLocation(trade.author), tradeCount: 0 });
    }
    callerMap.get(trade.author)!.tradeCount++;

    if (!tickerMap.has(trade.ticker)) {
      tickerMap.set(trade.ticker, { loc: getTickerLocation(trade.ticker), tradeCount: 0 });
    }
    tickerMap.get(trade.ticker)!.tradeCount++;
  }

  // Build points for callers
  const points: TradePoint[] = [];
  for (const [handle, data] of callerMap) {
    points.push({
      id: handle,
      label: `@${handle}`,
      lat: data.loc.lat,
      lng: data.loc.lng,
      size: Math.min(0.3 + data.tradeCount * 0.05, 1.2),
      color: "#3b82f6", // accent blue
    });
  }

  // Build points for tickers
  for (const [ticker, data] of tickerMap) {
    points.push({
      id: `ticker-${ticker}`,
      label: `$${ticker}`,
      lat: data.loc.lat,
      lng: data.loc.lng,
      size: Math.min(0.2 + data.tradeCount * 0.08, 1.5),
      color: "#f39c12", // amber
    });
  }

  // Build arcs (caller -> ticker)
  const arcs: TradeArc[] = trades.map((trade) => {
    const callerLoc = callerMap.get(trade.author)!.loc;
    const tickerLoc = tickerMap.get(trade.ticker)!.loc;
    const isWin = trade.pnl >= 0;

    return {
      startLat: callerLoc.lat,
      startLng: callerLoc.lng,
      endLat: tickerLoc.lat,
      endLng: tickerLoc.lng,
      color: isWin ? "#2ecc71" : "#e74c3c",
      stroke: Math.max(0.3, Math.min(Math.abs(trade.pnl) / 10, 1.5)),
      label: `@${trade.author} → $${trade.ticker} ${isWin ? "+" : ""}${trade.pnl.toFixed(1)}%`,
      ticker: trade.ticker,
      pnl: trade.pnl,
      author: trade.author,
      dashGap: 0.5 + Math.random(),
      dashAnimateTime: 1500 + Math.random() * 3000,
    };
  });

  return { points, arcs };
}
