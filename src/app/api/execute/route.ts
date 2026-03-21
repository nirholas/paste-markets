import { NextRequest, NextResponse } from "next/server";
import { insertExecutedTrade, updateTradeStatus } from "@/lib/execution-db";
import { ensureExecutedTradesTable } from "@/lib/execution-db-init";
import { checkRisk } from "@/lib/execution/risk";
import { skillRoute } from "@/lib/paste-trade";

// POST /api/execute — execute a trade
export async function POST(req: NextRequest) {
  await ensureExecutedTradesTable();
  try {
    const body = await req.json();

    const {
      tradeId,
      venue,
      asset,
      direction,
      size,
      leverage = 1,
      orderType = "market",
      limitPrice,
      stopLoss,
      takeProfit,
      walletAddress,
      signature,
      conditionId,
    } = body;

    // Validate required fields
    if (!venue || !asset || !direction || !size || !walletAddress) {
      return NextResponse.json(
        { error: "Missing required fields: venue, asset, direction, size, walletAddress" },
        { status: 400 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "Missing wallet signature" },
        { status: 400 }
      );
    }

    // Validate venue
    if (!["hyperliquid", "polymarket"].includes(venue)) {
      return NextResponse.json(
        { error: `Unsupported venue: ${venue}. Supported: hyperliquid, polymarket` },
        { status: 400 }
      );
    }

    // Pre-execution: validate instrument and get routing via paste.trade /api/skill/route
    const dir = (["long", "short"].includes(direction) ? direction : "long") as "long" | "short";
    const routeInfo = await skillRoute({
      tickers: [asset.replace(/^\$/, "").toUpperCase()],
      direction: dir,
    });

    // Risk check (server-side)
    const riskCheck = checkRisk(
      {
        venue,
        asset,
        direction,
        size,
        leverage: venue === "hyperliquid" ? leverage : undefined,
        stopLoss,
      },
      {
        connected: true,
        address: walletAddress,
        chain: "evm",
        provider: null,
        balances: { usdc: 0, native: 0 },
      }
    );

    if (riskCheck.blocked) {
      return NextResponse.json(
        { error: riskCheck.blockReason },
        { status: 400 }
      );
    }

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Record the trade in DB as pending
    const trade = await insertExecutedTrade({
      id: executionId,
      tradeId: tradeId ?? null,
      walletAddress,
      venue,
      asset: asset.replace(/^\$/, "").toUpperCase(),
      direction,
      orderType,
      sizeUsd: size,
      leverage: venue === "hyperliquid" ? leverage : 1,
      stopLoss: stopLoss ?? null,
      takeProfit: takeProfit ?? null,
      status: "pending",
    });

    // Note: actual venue execution happens client-side via wallet signing.
    // The client calls venue APIs directly with the wallet signature.
    // This endpoint records the intent and tracks the trade.
    //
    // In a production system, you'd have a backend signer or relay,
    // but for paste.markets the browser is the execution engine.

    // For now, mark as filled with the submission data
    // (real fill data comes from client-side venue callbacks)
    await updateTradeStatus(executionId, {
      status: "filled",
      fillPrice: limitPrice ?? null,
    });

    return NextResponse.json({
      executionId,
      status: "filled",
      warnings: riskCheck.warnings,
      routing: routeInfo ?? undefined,
    });
  } catch (err: any) {
    console.error("[/api/execute] Error:", err);
    return NextResponse.json(
      { error: err.message || "Execution failed" },
      { status: 500 }
    );
  }
}
