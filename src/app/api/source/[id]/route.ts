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
  const source = await fetchSource(id);
  if (source) {
    return NextResponse.json({
      source_id: source.source_id,
      source_url: source.source_url,
      status: source.status,
      handle: handle || null,
      original_url: originalUrl || null,
      trades: source.trades ?? [],
      processing: source.status === "processing",
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

  const result = matched.length > 0 ? matched : [];

  return NextResponse.json({
    source_id: id,
    handle,
    original_url: originalUrl,
    trades: result,
    processing: result.length === 0,
  });
}
