/**
 * GET /v2/leaderboard — ranked callers by performance
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
  const timeframe = sp.get("timeframe") ?? "30d";
  const sort = sp.get("sort") ?? "win_rate";

  try {
    const countRows = await sql`
      SELECT COUNT(*) as total FROM rankings WHERE timeframe = ${timeframe}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const orderClause = sort === "avg_pnl" ? "r.avg_pnl DESC" : "r.win_rate DESC";

    const rows = await sql`
      SELECT r.author_handle as handle, r.rank, r.prev_rank, r.win_rate, r.avg_pnl,
             r.total_trades, r.total_pnl, COALESCE(r.streak, 0) as streak,
             a.display_name, a.best_ticker
      FROM rankings r
      JOIN authors a ON a.handle = r.author_handle
      WHERE r.timeframe = ${timeframe}
      ORDER BY r.rank ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch leaderboard", 500, auth.rateLimitHeaders);
  }
}
