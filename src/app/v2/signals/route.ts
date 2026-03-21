/**
 * GET /v2/signals — recent high-confidence signals (consensus + smart calls)
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error, parsePage, parsePageSize, pageToOffset, buildMeta } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"), 20);
  const offset = pageToOffset(page, pageSize);

  try {
    // Consensus signals: multiple high-win-rate callers on same asset+direction
    const consensusRows = await sql`
      SELECT t.ticker, t.direction,
             COUNT(DISTINCT t.author_handle) as caller_count,
             AVG(a.win_rate) as avg_caller_win_rate,
             AVG(t.pnl_pct) as avg_pnl,
             MAX(t.posted_at) as latest_call,
             STRING_AGG(DISTINCT t.author_handle::text, ',') as callers
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE a.win_rate >= 50
        AND a.total_trades >= 5
        AND t.posted_at >= NOW() - INTERVAL '7 days'
      GROUP BY t.ticker, t.direction
      HAVING COUNT(DISTINCT t.author_handle) >= 2
      ORDER BY caller_count DESC, avg_caller_win_rate DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const signals = consensusRows.map((row: any) => ({
      type: "consensus",
      ticker: row.ticker,
      direction: row.direction,
      callerCount: Number(row.caller_count),
      avgCallerWinRate: Number(row.avg_caller_win_rate),
      avgPnl: row.avg_pnl != null ? Number(row.avg_pnl) : null,
      latestCall: row.latest_call,
      callers: row.callers ? row.callers.split(",") : [],
    }));

    const total = signals.length;
    return v2Ok(signals, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch signals", 500, auth.rateLimitHeaders);
  }
}
