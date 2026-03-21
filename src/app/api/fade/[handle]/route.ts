import { NextRequest, NextResponse } from "next/server";
import { getAuthorMetrics, syncAuthor, getOrCreateAuthor, isStale } from "@/lib/data";
import { computeFadeScore, type FadeStats } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export interface FadeHandleResponse {
  handle: string;
  fadeStats: FadeStats;
  updatedAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle: rawHandle } = await params;
  const handle = rawHandle.replace(/^@/, "").toLowerCase().trim();

  if (!handle) {
    return NextResponse.json({ error: "Missing handle" }, { status: 400 });
  }

  // Ensure author exists and sync if stale
  const author = await getOrCreateAuthor(handle);
  if (isStale(author.last_fetched)) {
    try {
      await syncAuthor(handle);
    } catch {
      // continue with potentially stale data
    }
  }

  const metrics = await getAuthorMetrics(handle);
  if (!metrics || metrics.totalTrades === 0) {
    return NextResponse.json({ error: "No trades found" }, { status: 404 });
  }

  // Apply timeframe filter if provided
  const url = new URL(request.url);
  const timeframe = url.searchParams.get("timeframe") ?? "all";
  let trades = metrics.recentTrades;

  if (timeframe !== "all") {
    const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    trades = trades.filter((t) => {
      const d = t.entry_date ?? t.posted_at;
      return d ? new Date(d).getTime() >= cutoff : true;
    });
  }

  const fadeStats = computeFadeScore(trades);

  return NextResponse.json({
    handle,
    fadeStats,
    updatedAt: new Date().toISOString(),
  } satisfies FadeHandleResponse, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
