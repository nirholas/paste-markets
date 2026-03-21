/**
 * Server-Sent Events endpoint for real-time trade streaming.
 *
 * GET /api/stream
 *
 * Events:
 *   new_trade       — a new trade call was detected
 *   caller_checked  — a caller was polled (with stats)
 *   heartbeat       — periodic keep-alive with active caller count
 */

import { addSSEListener, removeSSEListener, startPollingLoop, isPollingActive } from "@/lib/tweet-poller";
import { getEnabledWatched, autoPopulateFromLeaderboard, getWatchlistStats } from "@/lib/watchlist";
import { startWSBridge, isWSBridgeConnected } from "@/lib/ws-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  // Auto-populate watchlist on first connection if empty
  try {
    const callers = await getEnabledWatched();
    if (callers.length === 0) {
      await autoPopulateFromLeaderboard();
    }
  } catch (err) {
    console.error("[api/stream] Failed to check watchlist:", err);
  }

  // Start polling loop if not already running
  if (!isPollingActive()) {
    startPollingLoop().catch((err) => {
      console.error("[api/stream] Failed to start polling:", err);
    });
  }

  // Start WebSocket bridge for real-time paste.trade events
  startWSBridge();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      let stats: Awaited<ReturnType<typeof getWatchlistStats>> | null = null;
      try {
        stats = await getWatchlistStats();
      } catch (err) {
        console.error("[api/stream] Failed to get watchlist stats:", err);
      }
      controller.enqueue(
        encoder.encode(
          `event: connected\ndata: ${JSON.stringify({
            activeCallers: stats?.activeCallers ?? 0,
            totalCallers: stats?.totalCallers ?? 0,
            lastSignalAt: stats?.lastSignalAt ?? null,
          })}\n\n`,
        ),
      );

      // Listen for events from the poller
      const listener = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Stream closed
          removeSSEListener(listener);
        }
      };

      addSSEListener(listener);

      // Heartbeat every 30 seconds
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

      // Cleanup when stream is cancelled
      const cleanup = () => {
        clearInterval(heartbeat);
        removeSSEListener(listener);
      };

      // Handle stream abort
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Store cleanup for cancel
      (stream as unknown as { _cleanup: () => void })._cleanup = cleanup;
    },
    cancel() {
      const s = stream as unknown as { _cleanup?: () => void };
      s._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
