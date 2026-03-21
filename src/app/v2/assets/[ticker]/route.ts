/**
 * GET /v2/assets/[ticker] — asset detail + trades
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
  const pageSize = parsePageSize(sp.get("pageSize"));
  const offset = pageToOffset(page, pageSize);

  try {
    // Asset stats
    const statsRows = await sql`
      SELECT ticker,
             COUNT(*) as call_count,
             AVG(pnl_pct) as avg_pnl,
             SUM(CASE WHEN direction IN ('long', 'yes') THEN 1 ELSE 0 END) as bull_count,
             SUM(CASE WHEN direction IN ('short', 'no') THEN 1 ELSE 0 END) as bear_count,
             MAX(posted_at) as last_call_at,
             COUNT(DISTINCT author_handle) as caller_count
      FROM trades
      WHERE UPPER(ticker) = ${upperTicker}
      GROUP BY ticker
    `;

    if (statsRows.length === 0) {
      return v2Error("NOT_FOUND", `Asset "${ticker}" not found.`, 404, auth.rateLimitHeaders);
    }

    const stats = statsRows[0];

    // Paginated trades
    const countRows = await sql`
      SELECT COUNT(*) as total FROM trades WHERE UPPER(ticker) = ${upperTicker}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const tradeRows = await sql`
      SELECT t.author_handle, t.direction, t.pnl_pct, t.platform,
             t.entry_date, t.posted_at, t.source_url, t.integrity,
             a.win_rate as author_win_rate, a.rank as author_rank
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE UPPER(t.ticker) = ${upperTicker}
      ORDER BY t.posted_at DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(
      { stats, trades: tradeRows },
      buildMeta(total, page, pageSize),
      auth.rateLimitHeaders,
    );
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch asset detail", 500, auth.rateLimitHeaders);
  }
}
