import { NextRequest, NextResponse } from "next/server";

// POST /api/wallet/connect — store wallet session (server-side tracking)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { walletAddress, chain, provider } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    // In production: store session, set cookie, etc.
    // For now: acknowledge the connection
    return NextResponse.json({
      connected: true,
      walletAddress,
      chain: chain ?? "evm",
      provider: provider ?? "unknown",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Connection failed" },
      { status: 500 }
    );
  }
}
