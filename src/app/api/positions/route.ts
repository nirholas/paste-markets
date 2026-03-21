import { NextRequest, NextResponse } from "next/server";
import { ensureExecutedTradesTable } from "@/lib/execution-db-init";
import { getPositions } from "@/lib/execution/positions";

// GET /api/positions — get open positions for a wallet
export async function GET(req: NextRequest) {
  await ensureExecutedTradesTable();
  const wallet = req.nextUrl.searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet parameter" },
      { status: 400 }
    );
  }

  try {
    const positions = await getPositions(wallet);
    return NextResponse.json({ positions });
  } catch (err: any) {
    console.error("[/api/positions] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
