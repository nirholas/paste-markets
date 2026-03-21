import { NextRequest, NextResponse } from "next/server";
import { ensureExecutedTradesTable } from "@/lib/execution-db-init";
import { closePosition } from "@/lib/execution/positions";

// POST /api/positions/[id]/close — close a position
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await ensureExecutedTradesTable();

  try {
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    const result = await closePosition(id, walletAddress);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`[/api/positions/${id}/close] Error:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to close position" },
      { status: 500 }
    );
  }
}
