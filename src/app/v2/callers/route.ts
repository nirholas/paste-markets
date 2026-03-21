/**
 * GET /v2/callers — paginated caller list with stats
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
  const sort = sp.get("sort") ?? "win_rate";
  const platform = sp.get("platform");
  const timeframe = sp.get("timeframe") ?? "30d";

  const validSorts: Record<string, string> = {
    win_rate: "a.win_rate DESC",
    avg_pnl: "a.avg_pnl DESC",
    total_pnl: "(a.avg_pnl * a.total_trades) DESC",
    most_active: "a.total_trades DESC",
  };
  const orderBy = validSorts[sort] ?? "a.win_rate DESC";

  try {
    const countRows = await sql`SELECT COUNT(*) as total FROM authors WHERE total_trades > 0`;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT a.handle, a.display_name, a.total_trades, a.win_count, a.loss_count,
             a.win_rate, a.avg_pnl, a.best_pnl, a.worst_pnl,
             a.best_ticker, a.worst_ticker, a.rank, a.last_fetched
      FROM authors a
      WHERE a.total_trades > 0
      ORDER BY ${sql(orderBy)}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch (err) {
    // Fallback: if raw SQL ordering fails, use simple query
    try {
      const countRows = await sql`SELECT COUNT(*) as total FROM authors WHERE total_trades > 0`;
      const total = Number(countRows[0]?.total ?? 0);

      const rows = await sql`
        SELECT a.handle, a.display_name, a.total_trades, a.win_count, a.loss_count,
               a.win_rate, a.avg_pnl, a.best_pnl, a.worst_pnl,
               a.best_ticker, a.worst_ticker, a.rank, a.last_fetched
        FROM authors a
        WHERE a.total_trades > 0
        ORDER BY a.win_rate DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;

      return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
    } catch (e) {
      return v2Error("SERVER_ERROR", "Failed to fetch callers", 500, auth.rateLimitHeaders);
    }
  }
}
