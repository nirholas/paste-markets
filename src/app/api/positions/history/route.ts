import { NextRequest, NextResponse } from "next/server";
import { getClosedPositions } from "@/lib/execution/positions";

// GET /api/positions/history — closed position history
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet parameter" },
      { status: 400 }
    );
  }

  try {
    const positions = await getClosedPositions(wallet);
    return NextResponse.json({ positions });
  } catch (err: any) {
    console.error("[/api/positions/history] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch position history" },
      { status: 500 }
    );
  }
}
