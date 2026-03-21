/**
 * GET /v2/leaderboard/predictions — prediction market leaderboard
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
  const pageSize = parsePageSize(sp.get("pageSize"), 50);
  const offset = pageToOffset(page, pageSize);

  try {
    const countRows = await sql`
      SELECT COUNT(DISTINCT t.author_handle) as total
      FROM trades t
      WHERE t.platform = 'polymarket' AND t.pnl_pct IS NOT NULL
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT t.author_handle as handle,
             COUNT(*) as total_trades,
             SUM(t.pnl_pct) as total_pnl,
             AVG(t.pnl_pct) as avg_pnl,
             SUM(CASE WHEN t.pnl_pct > 0 THEN 1 ELSE 0 END) as win_count,
             ROUND(SUM(CASE WHEN t.pnl_pct > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as win_rate,
             a.rank as overall_rank
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE t.platform = 'polymarket' AND t.pnl_pct IS NOT NULL
      GROUP BY t.author_handle, a.rank
      HAVING COUNT(*) >= 2
      ORDER BY total_pnl DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch prediction leaderboard", 500, auth.rateLimitHeaders);
  }
}
