import { NextRequest, NextResponse } from "next/server";
import { getExpiredUnsettledConfigs, settleWagers, getWagerConfig } from "@/lib/wager-db";
import { getTradeById } from "@/lib/paste-trade";
import { sendUsdcPayout } from "@/lib/solana";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/settle-wagers
 *
 * Intended to be called by a Vercel/Cloudflare cron on an hourly schedule.
 * Finds all wager configs whose settlement_date has passed and settles them
 * using the current PnL from paste.trade.
 *
 * Vercel cron: add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/settle-wagers", "schedule": "0 * * * *" }] }
 */
export async function GET(req: NextRequest) {
  // Lightweight secret check so the endpoint isn't abusable
  const cronSecret = process.env["CRON_SECRET"];
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const expired = await getExpiredUnsettledConfigs();

  if (expired.length === 0) {
    return NextResponse.json({ settled: 0, skipped: 0, errors: [] });
  }

  const results: Array<{
    tradeCardId: string;
    ticker: string;
    outcome: string;
  }> = [];
  let settledCount = 0;
  let skippedCount = 0;

  for (const config of expired) {
    try {
      // Fetch current trade from paste.trade to get live PnL
      const trade = await getTradeById(config.trade_card_id, config.author_handle);

      let pnlPctOverride: number | undefined;

      if (trade?.pnlPct != null) {
        pnlPctOverride = trade.pnlPct;
      } else {
        // Can't determine PnL — skip until we have price data
        skippedCount++;
        results.push({
          tradeCardId: config.trade_card_id,
          ticker: config.ticker,
          outcome: "skipped_no_pnl",
        });
        continue;
      }

      // Re-check config hasn't been settled concurrently
      const fresh = await getWagerConfig(config.trade_card_id);
      if (!fresh || fresh.status !== "active") {
        skippedCount++;
        continue;
      }

      const result = await settleWagers({
        tradeCardId: config.trade_card_id,
        exitPrice: trade.currentPrice ?? 0,
        pnlPctOverride,
      });

      if ("error" in result) {
        results.push({
          tradeCardId: config.trade_card_id,
          ticker: config.ticker,
          outcome: `error: ${result.error}`,
        });
      } else {
        settledCount++;

        // Send USDC payouts to winners (only when TREASURY_PRIVATE_KEY is set)
        const payoutErrors: string[] = [];
        if (process.env["TREASURY_PRIVATE_KEY"]) {
          for (const w of result.wagererResults) {
            if (w.status !== "won" || w.pnl <= 0) continue;

            const payoutAmount = w.principal + w.pnl;
            const payout = await sendUsdcPayout(w.walletAddress, payoutAmount);

            if (payout.signature) {
              // Record payout tx signature in DB
              try {
                await sql`
                  UPDATE wagers
                  SET payout_tx_signature = ${payout.signature}
                  WHERE trade_card_id = ${config.trade_card_id}
                    AND wallet_address = ${w.walletAddress}
                `;
              } catch {
                // Non-critical: payout succeeded even if DB update fails
              }
            } else {
              payoutErrors.push(`${w.walletAddress}: ${payout.error}`);
            }
          }
        }

        const payoutSuffix = payoutErrors.length > 0
          ? `, payout_errors: ${payoutErrors.length}`
          : "";

        results.push({
          tradeCardId: config.trade_card_id,
          ticker: config.ticker,
          outcome: `settled — callerTip: $${result.callerTip.toFixed(2)}, wagerers: ${result.wagererResults.length}${payoutSuffix}`,
        });
      }
    } catch (err) {
      results.push({
        tradeCardId: config.trade_card_id,
        ticker: config.ticker,
        outcome: `exception: ${String(err)}`,
      });
    }
  }

  return NextResponse.json({
    settled: settledCount,
    skipped: skippedCount,
    total: expired.length,
    results,
  });
}
