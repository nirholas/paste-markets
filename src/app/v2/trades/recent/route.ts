/**
 * GET /v2/trades/recent — most recent trades
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
      SELECT COUNT(*) as total FROM trades WHERE posted_at IS NOT NULL
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT t.author_handle, t.ticker, t.direction, t.pnl_pct, t.platform,
             t.entry_date, t.posted_at, t.source_url, t.integrity,
             a.win_rate as author_win_rate, a.rank as author_rank
      FROM trades t
      JOIN authors a ON a.handle = t.author_handle
      WHERE t.posted_at IS NOT NULL
      ORDER BY t.posted_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Failed to fetch recent trades", 500, auth.rateLimitHeaders);
  }
}
