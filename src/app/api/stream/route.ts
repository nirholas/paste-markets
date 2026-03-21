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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  // Auto-populate watchlist on first connection if empty
  const callers = await getEnabledWatched();
  if (callers.length === 0) {
    await autoPopulateFromLeaderboard();
  }

  // Start polling loop if not already running
  if (!isPollingActive()) {
    startPollingLoop().catch((err) => {
      console.error("[api/stream] Failed to start polling:", err);
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
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
              })}\n\n`,
            ),
          );
        } catch {
          clearInterval(heartbeat);
          removeSSEListener(listener);
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
