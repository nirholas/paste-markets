import { NextRequest, NextResponse } from "next/server";
import { enableWager, submitWager } from "@/lib/wager-db";
import { randomUUID } from "crypto";
import { isValidSolanaSignature, verifySolanaTransaction } from "@/lib/solana";

export const dynamic = "force-dynamic";

/**
 * POST /api/wager
 *
 * Two uses:
 *   action = "enable"  — caller enables wagering on a trade card
 *   action = "submit"  — user submits a wager
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body["action"] as string | undefined;

  // ── enable wagering on a trade ────────────────────────────────────────────
  if (action === "enable") {
    const tradeCardId = body["tradeCardId"] as string | undefined;
    const authorHandle = body["authorHandle"] as string | undefined;
    const ticker = body["ticker"] as string | undefined;
    const direction = body["direction"] as string | undefined;

    if (!tradeCardId || !authorHandle || !ticker || !direction) {
      return NextResponse.json(
        { error: "tradeCardId, authorHandle, ticker, and direction are required" },
        { status: 400 },
      );
    }

    const config = await enableWager({
      tradeCardId,
      authorHandle: authorHandle.replace(/^@/, "").toLowerCase(),
      ticker,
      direction,
      entryPrice: typeof body["entryPrice"] === "number" ? body["entryPrice"] : undefined,
      wagerWindowHours: typeof body["wagerWindowHours"] === "number" ? body["wagerWindowHours"] : 24,
      settlementDays: typeof body["settlementDays"] === "number" ? body["settlementDays"] : 7,
      callerTipBps: typeof body["callerTipBps"] === "number" ? body["callerTipBps"] : 1000,
    });

    return NextResponse.json({ ok: true, config });
  }

  // ── submit a wager ────────────────────────────────────────────────────────
  if (action === "submit" || !action) {
    const tradeCardId = body["tradeCardId"] as string | undefined;
    const walletAddress = body["walletAddress"] as string | undefined;
    const amount = body["amount"];
    const txSignature = body["txSignature"] as string | undefined;

    if (!tradeCardId || !walletAddress || !amount || !txSignature) {
      return NextResponse.json(
        { error: "tradeCardId, walletAddress, amount, and txSignature are required" },
        { status: 400 },
      );
    }

    const amountNum = typeof amount === "number" ? amount : parseFloat(String(amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    // Basic Solana address validation (32–44 base58 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
    }

    const result = await submitWager({
      id: randomUUID(),
      tradeCardId,
      walletAddress,
      handle: typeof body["handle"] === "string" ? body["handle"] : undefined,
      amount: amountNum,
      currency: typeof body["currency"] === "string" ? body["currency"] : "USDC",
      txSignature,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, wager: result.wager }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
