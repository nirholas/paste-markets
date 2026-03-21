/**
 * GET /v2/assets/trending — most-called assets (7d)
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
    const countRows = await sql`
      SELECT COUNT(DISTINCT ticker) as total FROM trades
      WHERE ticker != '' AND posted_at >= NOW() - INTERVAL '7 days'
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT ticker,
             COUNT(*) as call_count,
             COUNT(DISTINCT author_handle) as caller_count,
             AVG(pnl_pct) as avg_pnl,
             SUM(CASE WHEN direction IN ('long', 'yes') THEN 1 ELSE 0 END) as bull_count,
             SUM(CASE WHEN direction IN ('short', 'no') THEN 1 ELSE 0 END) as bear_count,
             MAX(posted_at) as last_call_at
      FROM trades
      WHERE ticker != '' AND posted_at >= NOW() - INTERVAL '7 days'
      GROUP BY ticker
      ORDER BY call_count DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch trending assets", 500, auth.rateLimitHeaders);
  }
}
