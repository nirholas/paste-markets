import { NextRequest, NextResponse } from "next/server";
import { searchPasteTrade } from "@/lib/paste-trade";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const handle = req.nextUrl.searchParams.get("handle") ?? "";
  const originalUrl = req.nextUrl.searchParams.get("url") ?? "";

  if (!handle) {
    return NextResponse.json({ trades: [], processing: true });
  }

  const trades = await searchPasteTrade({ author: handle, limit: 100 });

  // Filter to trades whose source_url matches the submitted URL or source_id
  const matched = trades.filter((t) => {
    if (!t.source_url) return false;
    if (originalUrl && t.source_url.includes(originalUrl)) return true;
    if (t.source_url.includes(id)) return true;
    return false;
  });

  // Fall back to all author trades if no URL match (source may not be linked yet)
  const result = matched.length > 0 ? matched : [];

  return NextResponse.json({
    source_id: id,
    handle,
    original_url: originalUrl,
    trades: result,
    processing: result.length === 0,
  });
}
