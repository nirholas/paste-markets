import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Require secret to prevent unauthorized syncs
  const secret = process.env["SYNC_SECRET"];
  if (secret) {
    const provided =
      request.headers.get("x-sync-secret") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { seedFromApi } = await import("@/lib/seed-from-api");
    const result = await seedFromApi();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/sync] Sync failed:", err);
    return NextResponse.json(
      { error: "Sync failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
