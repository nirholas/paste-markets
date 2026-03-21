import { NextRequest, NextResponse } from "next/server";
import { fetchSource } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  const { source_id } = await params;
  const data = await fetchSource(source_id);
  if (!data) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
