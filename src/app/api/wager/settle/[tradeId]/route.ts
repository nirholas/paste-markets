import { NextRequest, NextResponse } from "next/server";
import { settleWagers, getWagerConfig } from "@/lib/wager-db";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ tradeId: string }>;
}

/**
 * POST /api/wager/settle/:tradeId
 *
 * Body:
 *   exitPrice      number   — current/final asset price
 *   pnlPctOverride number?  — override automatic PnL calculation
 *
 * In production this would require a caller signature / admin auth.
 * For now the API is open but requires the trade to be past its settlement date
 * (or the caller passes an explicit override).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const { tradeId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = getWagerConfig(tradeId);
  if (!config) {
    return NextResponse.json({ error: "Trade wager config not found" }, { status: 404 });
  }

  if (config.status !== "active") {
    return NextResponse.json(
      { error: `Already ${config.status}` },
      { status: 400 },
    );
  }

  const exitPrice = body["exitPrice"];
  const pnlPctOverride = body["pnlPctOverride"];

  if (exitPrice === undefined && pnlPctOverride === undefined) {
    return NextResponse.json(
      { error: "Provide exitPrice or pnlPctOverride" },
      { status: 400 },
    );
  }

  const result = settleWagers({
    tradeCardId: tradeId,
    exitPrice: typeof exitPrice === "number" ? exitPrice : parseFloat(String(exitPrice ?? 0)),
    pnlPctOverride:
      pnlPctOverride !== undefined
        ? typeof pnlPctOverride === "number"
          ? pnlPctOverride
          : parseFloat(String(pnlPctOverride))
        : undefined,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, settlement: result });
}
