/**
 * GET /v2/markets — event markets (prediction market calls grouped by topic)
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
    // Group polymarket trades by ticker as proxy for "markets"
    const countRows = await sql`
      SELECT COUNT(DISTINCT ticker) as total
      FROM trades WHERE platform = 'polymarket' AND ticker != ''
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT ticker as market_id,
             ticker as title,
             COUNT(*) as total_calls,
             COUNT(DISTINCT author_handle) as caller_count,
             SUM(CASE WHEN direction = 'yes' THEN 1 ELSE 0 END) as yes_count,
             SUM(CASE WHEN direction = 'no' THEN 1 ELSE 0 END) as no_count,
             AVG(pnl_pct) as avg_pnl,
             MAX(posted_at) as last_call_at
      FROM trades
      WHERE platform = 'polymarket' AND ticker != ''
      GROUP BY ticker
      ORDER BY total_calls DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch markets", 500, auth.rateLimitHeaders);
  }
}
