/**
 * GET /v2/callers/[handle]/stats — aggregated stats for a caller
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { handle } = await params;
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const authorRows = await sql`SELECT * FROM authors WHERE handle = ${handle}`;
    if (authorRows.length === 0) {
      return v2Error("NOT_FOUND", `Caller "${handle}" not found.`, 404, auth.rateLimitHeaders);
    }

    const author = authorRows[0];

    // Platform breakdown
    const platformRows = await sql`
      SELECT platform, COUNT(*) as count,
             AVG(pnl_pct) as avg_pnl,
             SUM(CASE WHEN pnl_pct > 0 THEN 1 ELSE 0 END) as wins
      FROM trades WHERE author_handle = ${handle} AND platform IS NOT NULL
      GROUP BY platform ORDER BY count DESC
    `;

    // Ticker breakdown (top 10)
    const tickerRows = await sql`
      SELECT ticker, COUNT(*) as count,
             AVG(pnl_pct) as avg_pnl,
             SUM(CASE WHEN pnl_pct > 0 THEN 1 ELSE 0 END) as wins
      FROM trades WHERE author_handle = ${handle} AND ticker != ''
      GROUP BY ticker ORDER BY count DESC LIMIT 10
    `;

    // Direction breakdown
    const directionRows = await sql`
      SELECT direction, COUNT(*) as count,
             AVG(pnl_pct) as avg_pnl
      FROM trades WHERE author_handle = ${handle}
      GROUP BY direction
    `;

    // Monthly performance (last 6 months)
    const monthlyRows = await sql`
      SELECT DATE_TRUNC('month', entry_date::timestamp) as month,
             COUNT(*) as count,
             AVG(pnl_pct) as avg_pnl,
             SUM(CASE WHEN pnl_pct > 0 THEN 1 ELSE 0 END) as wins
      FROM trades WHERE author_handle = ${handle}
        AND entry_date IS NOT NULL
      GROUP BY DATE_TRUNC('month', entry_date::timestamp)
      ORDER BY month DESC LIMIT 6
    `;

    return v2Ok(
      {
        handle: author.handle,
        totalTrades: author.total_trades,
        winRate: author.win_rate,
        avgPnl: author.avg_pnl,
        bestPnl: author.best_pnl,
        worstPnl: author.worst_pnl,
        bestTicker: author.best_ticker,
        worstTicker: author.worst_ticker,
        rank: author.rank,
        platforms: platformRows,
        topTickers: tickerRows,
        directions: directionRows,
        monthly: monthlyRows,
      },
      undefined,
      auth.rateLimitHeaders,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch caller stats", 500, auth.rateLimitHeaders);
  }
}
