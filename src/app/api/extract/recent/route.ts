import { NextResponse } from "next/server";
import { getRecentExtractions } from "@/lib/db";

export async function GET() {
  try {
    const extractions = await getRecentExtractions(20);
    return NextResponse.json(extractions);
  } catch (err) {
    console.error("[api/extract/recent] Error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
