# Fix: /api/stream SSE Endpoint 500 Errors

## Your working directory
`/workspaces/paste-markets/`

Read `CLAUDE.md` before starting. Follow its conventions exactly.

---

## Problem

`GET /api/stream` returns HTTP 500 repeatedly on production. The browser console shows many failed requests to this endpoint. The SSE stream is used by the home page for real-time trade updates.

The root cause: the handler calls several async functions (`getEnabledWatched`, `autoPopulateFromLeaderboard`, `getWatchlistStats`) **before** returning the SSE Response. If any of these throw (DB table missing, connection timeout), the entire endpoint crashes with an unhandled exception.

---

## File to edit

- `src/app/api/stream/route.ts`

---

## What to fix

### 1. Wrap the entire GET handler body in try/catch

The top-level calls to `getEnabledWatched()` and `autoPopulateFromLeaderboard()` happen before the stream is set up. If they throw, return a proper error response instead of crashing:

```ts
export async function GET(): Promise<Response> {
  try {
    // Auto-populate watchlist on first connection if empty
    const callers = await getEnabledWatched();
    if (callers.length === 0) {
      await autoPopulateFromLeaderboard();
    }
  } catch (err) {
    console.error("[api/stream] Watchlist init failed:", err);
    // Continue anyway — stream can still relay WebSocket events
  }

  // Start polling loop if not already running
  if (!isPollingActive()) {
    startPollingLoop().catch((err) => {
      console.error("[api/stream] Failed to start polling:", err);
    });
  }

  // ... rest unchanged
```

### 2. Wrap `getWatchlistStats` inside the stream's `start()` callback

The initial `connected` event also calls `getWatchlistStats()` which can throw:

```ts
async start(controller) {
  // Send initial connection event
  try {
    const stats = await getWatchlistStats();
    controller.enqueue(
      encoder.encode(
        `event: connected\ndata: ${JSON.stringify({
          activeCallers: stats.activeCallers,
          totalCallers: stats.totalCallers,
          lastSignalAt: stats.lastSignalAt,
        })}\n\n`,
      ),
    );
  } catch {
    // Send a minimal connected event if stats unavailable
    controller.enqueue(
      encoder.encode(
        `event: connected\ndata: ${JSON.stringify({
          activeCallers: 0,
          totalCallers: 0,
          lastSignalAt: null,
        })}\n\n`,
      ),
    );
  }
```

### 3. Protect the heartbeat callback

The `setInterval` heartbeat also calls `getWatchlistStats()`. It already has a catch block, but it kills the heartbeat entirely on failure. Instead, send a degraded heartbeat:

```ts
const heartbeat = setInterval(async () => {
  try {
    const currentStats = await getWatchlistStats();
    controller.enqueue(
      encoder.encode(
        `event: heartbeat\ndata: ${JSON.stringify({
          timestamp: new Date().toISOString(),
          activeCallers: currentStats.activeCallers,
          tradesFoundToday: currentStats.tradesFoundToday,
          lastSignalAt: currentStats.lastSignalAt,
          wsConnected: isWSBridgeConnected(),
        })}\n\n`,
      ),
    );
  } catch {
    // Send a minimal heartbeat to keep connection alive
    try {
      controller.enqueue(
        encoder.encode(
          `event: heartbeat\ndata: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            wsConnected: isWSBridgeConnected(),
          })}\n\n`,
        ),
      );
    } catch {
      // Stream is closed — clean up
      clearInterval(heartbeat);
      removeSSEListener(listener);
    }
  }
}, 30_000);
```

---

## Testing

1. `npm run build` — no type errors
2. The endpoint should return a valid SSE stream even if the watchlist table doesn't exist
3. The stream should not die on transient DB errors

---

## Do NOT

- Change the SSE event format (clients depend on event names)
- Add new event types
- Change polling intervals or WebSocket bridge logic
