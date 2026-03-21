import { NextRequest, NextResponse } from "next/server";
import { searchAuthors } from "@/lib/data";
import { searchPasteTrade } from "@/lib/paste-trade";

export const dynamic = "force-dynamic";

function cleanQuery(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawQuery = searchParams.get("q");

    if (!rawQuery || !rawQuery.trim()) {
      return NextResponse.json(
        { error: "Missing search query", details: "Provide a 'q' parameter" },
        { status: 400 },
      );
    }

    const query = cleanQuery(rawQuery);
    const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = isNaN(limitRaw) ? 10 : Math.min(Math.max(1, limitRaw), 50);

    // Search local DB first
    let results = await searchAuthors(query, limit);

    // If no local results, try paste.trade API
    if (results.length === 0) {
      try {
        const apiResults = await searchPasteTrade({ author: query, limit: 10 });
        // The search returns trades, not authors directly
        // We can infer the author exists if we got results
        if (apiResults.length > 0) {
          results = [{
            handle: query,
            totalTrades: apiResults.length,
            winRate: 0, // Unknown until synced
          }];
        }
      } catch (err) {
        console.error("[api/search] paste.trade search failed:", err);
        // Return empty results rather than erroring
      }
    }

    return NextResponse.json({
      results: results.slice(0, limit),
    });
  } catch (err) {
    console.error("[api/search] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
