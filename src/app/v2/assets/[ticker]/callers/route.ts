/**
 * GET /v2/assets/[ticker]/callers — who's calling this asset
 */

import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "@/lib/api-auth";
import { v2Ok, v2Error, parsePage, parsePageSize, pageToOffset, buildMeta } from "@/lib/v2-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return v2Error(auth.error.code, auth.error.message, auth.statusCode, auth.headers);
  }

  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const sql = neon(process.env.DATABASE_URL!);
  const sp = req.nextUrl.searchParams;
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"), 50);
  const offset = pageToOffset(page, pageSize);

  try {
    const countRows = await sql`
      SELECT COUNT(DISTINCT t.author_handle) as total
      FROM trades t WHERE UPPER(t.ticker) = ${upperTicker}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    if (total === 0) {
      return v2Error("NOT_FOUND", `No callers found for asset "${ticker}".`, 404, auth.rateLimitHeaders);
    }

    const rows = await sql`
      SELECT t.author_handle,
             COUNT(*) as trade_count,
             SUM(t.pnl_pct) as total_pnl,
             AVG(t.pnl_pct) as avg_pnl,
             SUM(CASE WHEN t.pnl_pct > 0 THEN 1 ELSE 0 END) as win_count,
             a.win_rate as overall_win_rate,
             a.rank as author_rank
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE UPPER(t.ticker) = ${upperTicker} AND t.pnl_pct IS NOT NULL
      GROUP BY t.author_handle, a.win_rate, a.rank
      ORDER BY total_pnl DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch asset callers", 500, auth.rateLimitHeaders);
  }
}
