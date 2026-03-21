import { NextRequest, NextResponse } from "next/server";
import { getTradeById } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authorHint = request.nextUrl.searchParams.get("author") ?? undefined;

  const trade = await getTradeById(id, authorHint);

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  return NextResponse.json(trade);
}
