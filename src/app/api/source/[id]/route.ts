import { NextRequest, NextResponse } from "next/server";
import { fetchSource } from "@/lib/paste-trade";
import { searchPasteTrade } from "@/lib/paste-trade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const handle = req.nextUrl.searchParams.get("handle") ?? "";
  const originalUrl = req.nextUrl.searchParams.get("url") ?? "";

  // Primary: fetch source directly from paste.trade /api/sources/{id}
  const result = await fetchSource(id);
  if (result) {
    return NextResponse.json({
      // Backward-compatible fields
      source_id: result.source.id,
      source_url: result.source.url,
      status: result.source.status,
      handle: result.author?.handle ?? handle || null,
      original_url: originalUrl || result.source.url || null,
      trades: result.trades ?? [],
      processing: result.source.status === "processing",
      // Richer data from nested response
      title: result.source.title ?? null,
      summary: result.source.summary ?? null,
      source_theses: result.source.source_theses ?? [],
      author: result.author ?? null,
    });
  }

  // Fallback: search by author handle
  if (!handle) {
    return NextResponse.json({ trades: [], processing: true });
  }

  const trades = await searchPasteTrade({ author: handle, limit: 100 });

  const matched = trades.filter((t) => {
    if (!t.source_url) return false;
    if (originalUrl && t.source_url.includes(originalUrl)) return true;
    if (t.source_url.includes(id)) return true;
    return false;
  });

  const fallback = matched.length > 0 ? matched : [];

  return NextResponse.json({
    source_id: id,
    handle,
    original_url: originalUrl,
    trades: fallback,
    processing: fallback.length === 0,
  });
}
