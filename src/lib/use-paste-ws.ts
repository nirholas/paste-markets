"use client";

/**
 * React hook for real-time paste.trade WebSocket events.
 *
 * Connects to wss://paste.trade/ws and provides:
 *   - newTrades: array of recent trades received via WebSocket
 *   - priceUpdates: map of trade_id → latest price data
 *   - isConnected: whether the WebSocket is currently open
 *
 * Usage:
 *   const { newTrades, priceUpdates, isConnected } = usePasteTradeWS();
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createPasteTradeWS,
  type WSNewTrade,
  type WSPriceUpdate,
} from "./ws-client";

const MAX_TRADES = 50;

export interface UsePasteTradeWSResult {
  newTrades: WSNewTrade[];
  priceUpdates: Map<string, WSPriceUpdate>;
  isConnected: boolean;
}

export function usePasteTradeWS(
  options?: { enabled?: boolean },
): UsePasteTradeWSResult {
  const enabled = options?.enabled ?? true;
  const [newTrades, setNewTrades] = useState<WSNewTrade[]>([]);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, WSPriceUpdate>>(
    new Map(),
  );
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<ReturnType<typeof createPasteTradeWS> | null>(null);

  const handleNewTrade = useCallback((data: WSNewTrade) => {
    setNewTrades((prev) => [data, ...prev].slice(0, MAX_TRADES));
  }, []);

  const handlePriceUpdate = useCallback((data: WSPriceUpdate) => {
    setPriceUpdates((prev) => {
      const next = new Map(prev);
      next.set(data.trade_id, data);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const ws = createPasteTradeWS();
    wsRef.current = ws;

    ws.on("new_trade", handleNewTrade);
    ws.on("price_update", handlePriceUpdate);
    ws.connect();

    // Poll connection status
    const statusInterval = setInterval(() => {
      setIsConnected(ws.isConnected());
    }, 2000);

    return () => {
      clearInterval(statusInterval);
      ws.disconnect();
      wsRef.current = null;
    };
  }, [enabled, handleNewTrade, handlePriceUpdate]);

  return { newTrades, priceUpdates, isConnected };
}
