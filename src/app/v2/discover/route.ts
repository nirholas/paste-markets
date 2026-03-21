/**
 * GET /v2/discover — newly discovered callers
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
      SELECT COUNT(*) as total FROM authors
      WHERE added_at >= NOW() - INTERVAL '14 days' AND total_trades >= 1
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT a.handle, a.display_name, a.total_trades, a.win_rate, a.avg_pnl,
             a.best_ticker, a.rank, a.added_at
      FROM authors a
      WHERE a.added_at >= NOW() - INTERVAL '14 days' AND a.total_trades >= 1
      ORDER BY a.added_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch discoveries", 500, auth.rateLimitHeaders);
  }
}
