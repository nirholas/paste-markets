/**
 * Watchlist management API.
 *
 * GET  /api/watchlist — list all watched callers
 * POST /api/watchlist — add a caller to the watchlist
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllWatched,
  addToWatchlist,
  autoPopulateFromLeaderboard,
} from "@/lib/watchlist";
import { callerTier, computeAlphaScore, type CallerTier } from "@/lib/alpha";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const callers = await getAllWatched();

    // Auto-populate if empty
    if (callers.length === 0) {
      const added = await autoPopulateFromLeaderboard();
      if (added > 0) {
        const refreshed = await getAllWatched();
        return NextResponse.json({
          callers: refreshed,
          total: refreshed.length,
          autoPopulated: true,
        });
      }
    }

    return NextResponse.json({
      callers,
      total: callers.length,
      autoPopulated: false,
    });
  } catch (err) {
    console.error("[api/watchlist] GET failed:", err);
    return NextResponse.json(
      { callers: [], total: 0, error: "Watchlist unavailable" },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { handle?: string; tier?: CallerTier; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.handle || typeof body.handle !== "string") {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  const handle = body.handle.toLowerCase().replace(/^@/, "").trim();
  if (!handle || handle.length > 50) {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  const tier = (body.tier && ["S", "A", "B", "C"].includes(body.tier))
    ? body.tier
    : "C";

  try {
    const added = await addToWatchlist(handle, tier, body.displayName);

    if (!added) {
      return NextResponse.json(
        { error: "Caller already on watchlist", handle },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, handle, tier }, { status: 201 });
  } catch (err) {
    console.error("[api/watchlist] POST failed:", err);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 },
    );
  }
}
