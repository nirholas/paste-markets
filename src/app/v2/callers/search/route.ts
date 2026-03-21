/**
 * GET /v2/callers/search — search callers by handle
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

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const page = parsePage(sp.get("page"));
  const pageSize = parsePageSize(sp.get("pageSize"), 20);
  const offset = pageToOffset(page, pageSize);

  if (!q) {
    return v2Error("INVALID_PARAM", "Missing required parameter: q", 400, auth.rateLimitHeaders);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const pattern = `%${q}%`;

  try {
    const countRows = await sql`
      SELECT COUNT(*) as total FROM authors WHERE handle LIKE ${pattern}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await sql`
      SELECT handle, display_name, total_trades, win_rate, avg_pnl, rank
      FROM authors
      WHERE handle LIKE ${pattern}
      ORDER BY total_trades DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return v2Ok(rows, buildMeta(total, page, pageSize), auth.rateLimitHeaders);
  } catch {
    return v2Error("SERVER_ERROR", "Search failed", 500, auth.rateLimitHeaders);
  }
}
