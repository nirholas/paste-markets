/**
 * Server-side WebSocket bridge.
 *
 * Connects to wss://paste.trade/ws and forwards events to the SSE pub/sub
 * so that all connected /api/stream clients receive real-time updates.
 *
 * Uses the `ws` npm package for Node.js WebSocket support (browser's
 * WebSocket API is not available in server components / API routes).
 *
 * Singleton — only one connection per server process.
 */

import { emit } from "./tweet-poller";

const WS_URL = "wss://paste.trade/ws";
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 2000;

let ws: import("ws").WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function getWebSocketClass(): Promise<typeof import("ws").WebSocket | null> {
  try {
    const mod = await import("ws");
    return mod.default ?? mod.WebSocket;
  } catch {
    console.warn("[ws-bridge] `ws` package not available — WebSocket bridge disabled");
    return null;
  }
}

async function connect() {
  const WS = await getWebSocketClass();
  if (!WS) return;

  if (ws && (ws.readyState === WS.CONNECTING || ws.readyState === WS.OPEN)) {
    return;
  }

  try {
    ws = new WS(WS_URL);

    ws.on("open", () => {
      console.log("[ws-bridge] Connected to paste.trade WebSocket");
      reconnectAttempts = 0;
    });

    ws.on("message", (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (!msg.type || !msg.data) return;

        if (msg.type === "new_trade") {
          emit("ws_new_trade", msg.data);
          // Also emit as a regular new_trade so SSE clients pick it up
          emit("new_trade", {
            handle: msg.data["author_handle"] ?? "",
            displayName: null,
            ticker: msg.data["ticker"] ?? "",
            direction: msg.data["direction"] ?? "",
            platform: msg.data["platform"] ?? null,
            confidence: 1,
            tweetUrl: msg.data["source_url"] ?? "",
            tweetText: msg.data["thesis"] ?? "",
            tweetDate: msg.data["created_at"] ?? new Date().toISOString(),
            tradeUrl: msg.data["trade_id"]
              ? `https://paste.trade/t/${msg.data["trade_id"]}`
              : null,
            entryPrice: msg.data["entry_price"] != null ? Number(msg.data["entry_price"]) : null,
            detectionLatencyMs: 0,
            source: "websocket",
          });
        } else if (msg.type === "price_update") {
          emit("price_update", msg.data);
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    ws.on("close", () => {
      ws = null;
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[ws-bridge] WebSocket error:", err.message);
      ws?.close();
    });
  } catch (err) {
    console.error("[ws-bridge] Connection failed:", err);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn("[ws-bridge] Max reconnect attempts reached — giving up");
    return;
  }
  const delay = BASE_RECONNECT_DELAY * Math.pow(2, Math.min(reconnectAttempts, 6));
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    connect();
  }, delay);
}

/**
 * Start the WebSocket bridge. Idempotent — calling multiple times is safe.
 */
export function startWSBridge(): void {
  if (started) return;
  started = true;
  connect();
}

/**
 * Stop the WebSocket bridge and clean up.
 */
export function stopWSBridge(): void {
  started = false;
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

/**
 * Check if the WebSocket bridge is currently connected.
 */
export function isWSBridgeConnected(): boolean {
  return ws?.readyState === 1; // WebSocket.OPEN
}
