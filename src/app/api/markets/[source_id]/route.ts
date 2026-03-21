import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  const { source_id } = await params;
  const res = await fetch(`https://paste.trade/api/sources/${source_id}`, {
    headers: { Authorization: `Bearer ${process.env.PASTE_TRADE_KEY}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
