/**
 * Per-caller watchlist management.
 *
 * DELETE /api/watchlist/[handle] — remove caller from watchlist
 * PATCH  /api/watchlist/[handle] — update tier/interval/enabled
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getWatchedCaller,
  removeFromWatchlist,
  updateWatchedCaller,
} from "@/lib/watchlist";
import type { CallerTier } from "@/lib/alpha";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ handle: string }>;
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  const { handle } = await context.params;
  const normalized = handle.toLowerCase().replace(/^@/, "");

  const existing = getWatchedCaller(normalized);
  if (!existing) {
    return NextResponse.json({ error: "Caller not found" }, { status: 404 });
  }

  removeFromWatchlist(normalized);
  return NextResponse.json({ ok: true, handle: normalized });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const { handle } = await context.params;
  const normalized = handle.toLowerCase().replace(/^@/, "");

  const existing = getWatchedCaller(normalized);
  if (!existing) {
    return NextResponse.json({ error: "Caller not found" }, { status: 404 });
  }

  try {
    const body = await request.json() as {
      tier?: CallerTier;
      enabled?: boolean;
      displayName?: string;
    };

    const updates: {
      tier?: CallerTier;
      enabled?: boolean;
      displayName?: string;
    } = {};

    if (body.tier && ["S", "A", "B", "C"].includes(body.tier)) {
      updates.tier = body.tier;
    }
    if (typeof body.enabled === "boolean") {
      updates.enabled = body.enabled;
    }
    if (typeof body.displayName === "string") {
      updates.displayName = body.displayName;
    }

    updateWatchedCaller(normalized, updates);

    const updated = getWatchedCaller(normalized);
    return NextResponse.json({ ok: true, caller: updated });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
