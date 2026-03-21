import { NextRequest, NextResponse } from "next/server";
import { checkRisk, estimateFees } from "@/lib/execution/risk";
import { skillRoute, skillDiscover } from "@/lib/paste-trade";

// GET /api/execution/preflight — risk check + venue routing before execution
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
    // Run risk check, venue routing, and instrument discovery in parallel
    const [riskCheck, routeResult, discoverResult] = await Promise.all([
      Promise.resolve(checkRisk(
        { venue, asset, direction, size, leverage },
        {
          connected: true,
          address: wallet,
          chain: "evm",
          provider: null,
          balances: { usdc: 0, native: 0 },
        }
      )),
      // Route through paste.trade to validate instrument + get pricing
      skillRoute({
        tickers: [asset.replace(/^\$/, "").toUpperCase()],
        direction: direction as "long" | "short",
      }),
      // Discover available instruments for this ticker
      skillDiscover({
        query: asset.replace(/^\$/, "").toUpperCase(),
        platforms: venue ? [venue] : undefined,
      }),
    ]);

    const fees = estimateFees(
      size,
      venue as "hyperliquid" | "polymarket"
    );

    let estimatedLiquidation: number | undefined;
    if (venue === "hyperliquid" && leverage > 1) {
      estimatedLiquidation = undefined;
    }

    return NextResponse.json({
      riskCheck,
      estimatedFees: Math.round(fees * 100) / 100,
      estimatedLiquidation,
      availableBalance: 0,
      // Upstream routing data from paste.trade
      routing: routeResult,
      instruments: discoverResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preflight check failed";
    console.error("[/api/execution/preflight] Error:", err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
