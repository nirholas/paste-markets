import { NextRequest, NextResponse } from "next/server";

// GET /api/wallet/balances — fetch wallet balances (server-side)
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const chain = req.nextUrl.searchParams.get("chain") ?? "evm";

  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet parameter" },
      { status: 400 }
    );
  }

  try {
    // In production: query RPC nodes or indexers for real balances
    // For now: return zeros (client-side wallet handles real balance queries)
    return NextResponse.json({
      walletAddress: wallet,
      chain,
      balances: {
        usdc: 0,
        native: 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch balances" },
      { status: 500 }
    );
  }
}
