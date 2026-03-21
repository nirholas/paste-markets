import { NextRequest, NextResponse } from "next/server";
import { fetchPasteTradePrices } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json(
      { error: "Missing 'ids' parameter (comma-separated trade IDs)" },
      { status: 400 },
    );
  }

  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "No valid trade IDs provided" },
      { status: 400 },
    );
  }

  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Maximum 50 trade IDs per request" },
      { status: 400 },
    );
  }

  try {
    const prices = await fetchPasteTradePrices(ids);

    return NextResponse.json(prices, {
      headers: { "Cache-Control": "no-cache, no-store" },
    });
  } catch (err) {
    console.error("[api/prices] Error:", err);
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}
