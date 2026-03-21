/**
 * WebSocket client for real-time paste.trade updates.
 *
 * Connects to wss://paste.trade/ws and dispatches events:
 *   - new_trade: A new trade was posted
 *   - price_update: A trade's price changed
 *
 * Usage (client components only):
 *   const ws = createPasteTradeWS();
 *   ws.on("new_trade", (data) => { ... });
 *   ws.on("price_update", (data) => { ... });
 *   ws.connect();
 *   // later:
 *   ws.disconnect();
 */

const WS_URL = "wss://paste.trade/ws";

export type WSEventType = "new_trade" | "price_update";

export interface WSNewTrade {
  trade_id: string;
  ticker: string;
  direction: string;
  platform: string;
  author_handle: string;
  author_avatar_url?: string;
  thesis?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface WSPriceEntry {
  price: number;
  ts: number;
}

export interface WSPriceUpdate {
  prices: Record<string, WSPriceEntry>;
}

type WSEvent =
  | { type: "new_trade"; data?: WSNewTrade; [key: string]: unknown }
  | { type: "price_update"; prices?: Record<string, WSPriceEntry>; data?: WSPriceUpdate; [key: string]: unknown };

type EventHandler<T> = (data: T) => void;

interface PasteTradeWS {
  connect: () => void;
  disconnect: () => void;
  on: ((event: "new_trade", handler: EventHandler<WSNewTrade>) => void) &
      ((event: "price_update", handler: EventHandler<WSPriceUpdate>) => void);
  isConnected: () => boolean;
}

export function createPasteTradeWS(): PasteTradeWS {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000;

  const handlers: {
    new_trade: EventHandler<WSNewTrade>[];
    price_update: EventHandler<WSPriceUpdate>[];
  } = {
    new_trade: [],
    price_update: [],
  };

  function dispatch(event: WSEvent) {
    const list = handlers[event.type];
    if (list) {
      for (const handler of list) {
        try {
          (handler as EventHandler<unknown>)(event.data);
        } catch (err) {
          console.error(`[ws] Error in ${event.type} handler:`, err);
        }
      }
    }
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn("[ws] Max reconnect attempts reached");
      return;
    }
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
    reconnectTimer = setTimeout(() => {
      reconnectAttempts++;
      connect();
    }, delay);
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "new_trade") {
            dispatch({ type: "new_trade", data: parsed.data ?? parsed });
          } else if (parsed.type === "price_update") {
            // Real shape has prices at top level, not in data
            const priceData: WSPriceUpdate = {
              prices: parsed.prices ?? parsed.data?.prices ?? {},
            };
            dispatch({ type: "price_update", data: priceData });
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      scheduleReconnect();
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function on(event: WSEventType, handler: EventHandler<WSNewTrade | WSPriceUpdate>) {
    if (event === "new_trade") {
      handlers.new_trade.push(handler as EventHandler<WSNewTrade>);
    } else if (event === "price_update") {
      handlers.price_update.push(handler as EventHandler<WSPriceUpdate>);
    }
  }

  function isConnected() {
    return ws?.readyState === WebSocket.OPEN;
  }

  return { connect, disconnect, on, isConnected } as PasteTradeWS;
}
