import { NextRequest, NextResponse } from "next/server";
import { checkRisk, estimateLiquidationPrice, estimateFees } from "@/lib/execution/risk";

// GET /api/execution/preflight — risk check before execution
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const venue = sp.get("venue") as "hyperliquid" | "polymarket" | null;
  const asset = sp.get("asset");
  const direction = sp.get("direction");
  const size = parseFloat(sp.get("size") ?? "0");
  const leverage = parseFloat(sp.get("leverage") ?? "1");
  const wallet = sp.get("wallet");

  if (!venue || !asset || !direction || !size || !wallet) {
    return NextResponse.json(
      { error: "Missing required params: venue, asset, direction, size, wallet" },
      { status: 400 }
    );
  }

  try {
    const riskCheck = checkRisk(
      { venue, asset, direction, size, leverage },
      {
        connected: true,
        address: wallet,
        chain: "evm",
        provider: null,
        balances: { usdc: 0, native: 0 },
      }
    );

    // Estimate fees
    const fees = estimateFees(
      size,
      venue as "hyperliquid" | "polymarket"
    );

    // Estimate liquidation (for perps)
    let estimatedLiquidation: number | undefined;
    if (venue === "hyperliquid" && leverage > 1) {
      // We'd need current price from HL API in production
      // For preflight, return the formula-based estimate
      estimatedLiquidation = undefined; // needs currentPrice
    }

    return NextResponse.json({
      riskCheck,
      estimatedFees: Math.round(fees * 100) / 100,
      estimatedLiquidation,
      availableBalance: 0, // populated by client from wallet state
    });
  } catch (err: any) {
    console.error("[/api/execution/preflight] Error:", err);
    return NextResponse.json(
      { error: err.message || "Preflight check failed" },
      { status: 500 }
    );
  }
}
