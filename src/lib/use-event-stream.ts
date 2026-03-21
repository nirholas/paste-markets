/**
 * React hook for consuming Server-Sent Events from /api/stream.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { NewTradeEvent } from "./tweet-poller";

export interface StreamState {
  connected: boolean;
  activeCallers: number;
  lastSignalAt: string | null;
  tradesFoundToday: number;
  liveEvents: NewTradeEvent[];
}

export function useEventStream(enabled: boolean, maxEvents = 100) {
  const [state, setState] = useState<StreamState>({
    connected: false,
    activeCallers: 0,
    lastSignalAt: null,
    tradesFoundToday: 0,
    liveEvents: [],
  });

  const esRef = useRef<EventSource | null>(null);

  const clearEvents = useCallback(() => {
    setState((prev) => ({ ...prev, liveEvents: [] }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setState((prev) => ({ ...prev, connected: false }));
      }
      return;
    }

    const es = new EventSource("/api/stream");
    esRef.current = es;

    es.addEventListener("connected", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          connected: true,
          activeCallers: data.activeCallers ?? 0,
          lastSignalAt: data.lastSignalAt ?? null,
        }));
      } catch {
        setState((prev) => ({ ...prev, connected: true }));
      }
    });

    es.addEventListener("new_trade", (e) => {
      try {
        const trade = JSON.parse(e.data) as NewTradeEvent;
        setState((prev) => ({
          ...prev,
          liveEvents: [trade, ...prev.liveEvents].slice(0, maxEvents),
          lastSignalAt: new Date().toISOString(),
        }));
      } catch {
        // ignore
      }
    });

    es.addEventListener("heartbeat", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState((prev) => ({
          ...prev,
          activeCallers: data.activeCallers ?? prev.activeCallers,
          tradesFoundToday: data.tradesFoundToday ?? prev.tradesFoundToday,
          lastSignalAt: data.lastSignalAt ?? prev.lastSignalAt,
        }));
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [enabled, maxEvents]);

  return { ...state, clearEvents };
}
