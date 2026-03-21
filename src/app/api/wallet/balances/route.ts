import { NextResponse } from "next/server";

// Wallet balance queries require a Solana/EVM RPC integration (Helius, Alchemy, etc.)
// This endpoint is not yet implemented.
export async function GET() {
  return NextResponse.json(
    { error: "Wallet balance queries are not yet implemented. Integrate an RPC provider (Helius, Alchemy) to enable this." },
    { status: 501 },
  );
}
