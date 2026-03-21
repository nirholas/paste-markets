import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  submitWager,
  enableWager,
  getWagerConfig,
  getWagerStats,
  insertWagerEvent,
} from "@/lib/wager-db";

export const dynamic = "force-dynamic";

const VALID_AMOUNTS = new Set([5, 10, 25, 50, 100]);

/**
 * POST /api/wagers/quick
 *
 * Quick-wager endpoint for the "Double Down" flow.
 * Auto-enables wagering if not already enabled.
 *
 * Body: { tradeId, amount, walletAddress, handle? }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tradeId = body["tradeId"] as string | undefined;
  const amount = body["amount"] as number | undefined;
  const walletAddress = body["walletAddress"] as string | undefined;
  const handle = body["handle"] as string | undefined;

  if (!tradeId || !amount || !walletAddress) {
    return NextResponse.json(
      { error: "tradeId, amount, and walletAddress are required" },
      { status: 400 },
    );
  }

  if (!VALID_AMOUNTS.has(amount)) {
    return NextResponse.json(
      { error: "Amount must be one of: 5, 10, 25, 50, 100" },
      { status: 400 },
    );
  }

  // Basic Solana address validation
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }

  // Auto-enable wagering if not already enabled
  let config = getWagerConfig(tradeId);
  if (!config) {
    // For quick wagers, we auto-create a config with defaults.
    // The tradeId acts as both trade_card_id and ticker placeholder.
    try {
      enableWager({
        tradeCardId: tradeId,
        authorHandle: "unknown",
        ticker: "UNKNOWN",
        direction: "long",
        wagerWindowHours: 24,
        settlementDays: 7,
      });
      config = getWagerConfig(tradeId);
    } catch {
      return NextResponse.json({ error: "Failed to initialize wager" }, { status: 500 });
    }
  }

  // For quick wagers, generate a placeholder tx signature
  // In production this would be a real Solana tx
  const txSignature = `quick_${randomUUID().replace(/-/g, "")}`;

  const result = submitWager({
    id: randomUUID(),
    tradeCardId: tradeId,
    walletAddress,
    handle,
    amount,
    currency: "USDC",
    txSignature,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Record wager event for the feed
  try {
    insertWagerEvent({
      id: randomUUID(),
      type: "new_wager",
      tradeId,
      callerHandle: config?.author_handle ?? "unknown",
      backerHandle: handle,
      amount,
    });
  } catch {
    // Non-critical — event logging shouldn't block the wager
  }

  // Get updated stats
  const stats = getWagerStats(tradeId);

  return NextResponse.json(
    {
      wagerId: result.wager.id,
      status: "active",
      totalWagered: stats?.total_wagered ?? amount,
      backerCount: stats?.wager_count ?? 1,
    },
    { status: 201 },
  );
}
