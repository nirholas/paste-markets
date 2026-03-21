import { NextRequest, NextResponse } from "next/server";
import { getTradesForReputation, getOrCreateAuthor } from "@/lib/data";
import {
  calculateReputationScore,
  getCachedScore,
  setCachedScore,
} from "@/lib/reputation";

export const dynamic = "force-dynamic";

function cleanHandle(raw: string): string {
  return raw.replace(/^@/, "").toLowerCase().trim();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const { handle: rawHandle } = await params;
    const handle = cleanHandle(rawHandle);

    if (!handle) {
      return NextResponse.json({ error: "Missing handle" }, { status: 400 });
    }

    // Check in-memory cache first (30-min TTL)
    const cached = getCachedScore(handle);
    if (cached) {
      return NextResponse.json({ handle, ...cached }, {
        headers: { "X-Score-Cache": "HIT" },
      });
    }

    // Ensure author exists
    const author = await getOrCreateAuthor(handle);
    if (!author) {
      return NextResponse.json({ error: "Caller not found", handle }, { status: 404 });
    }

    // Fetch trades with integrity info
    const trades = await getTradesForReputation(handle);
    if (trades.length === 0) {
      return NextResponse.json({ error: "No trade data", handle }, { status: 404 });
    }

    // Compute score
    const scoreResult = calculateReputationScore(handle, trades);

    // Cache result
    setCachedScore(handle, scoreResult);

    return NextResponse.json(
      { handle, ...scoreResult },
      { headers: { "X-Score-Cache": "MISS" } },
    );
  } catch (err) {
    console.error("[api/caller/score] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
