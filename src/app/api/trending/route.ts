import { NextResponse } from "next/server";
import { getTrending, getAuthorMetrics } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const handles = await getTrending();

    const trending: Array<{ handle: string; views: number; winRate: number }> = [];
    for (const handle of handles) {
      const metrics = await getAuthorMetrics(handle);
      trending.push({
        handle,
        views: 0, // getTrending returns sorted by view count
        winRate: metrics?.winRate ?? 0,
      });
    }

    return NextResponse.json({ trending });
  } catch (err) {
    console.error("[api/trending] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
